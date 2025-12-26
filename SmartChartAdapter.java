package com.shineyue.util;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 智能图表适配器 (SmartChartAdapter)
 * 适配 Spring Boot 2.3 + JDK 1.8
 * 
 * 功能：
 * 1. 接收业务数据
 * 2. 自动分析数据特征（如风险等级、趋势）
 * 3. 动态匹配颜色和样式
 * 4. 返回符合 ECharts/AMIS 规范的配置对象
 */
@Service
public class SmartChartAdapter {

    // --- 核心业务接口 ---

    /**
     * 根据业务数据生成带有智能样式的图表配置
     * @param businessData 原始业务数据列表
     * @param type 图表类型 (pie, bar, line)
     * @return 包含样式和数据的完整响应对象
     */
    public ChartResponse adapt(List<BusinessMetric> businessData, String type) {
        // 1. 数据预处理与分析
        DataAnalysis analysis = analyzeData(businessData);
        
        // 2. 智能选择主题/颜色策略
        ColorPalette palette = selectPaletteInternal(analysis);

        // 3. 构建 ECharts Series 数据
        List<Map<String, Object>> seriesData = buildSeriesData(businessData, type);

        // 4. 组装最终 ECharts Option 结构
        EchartsOption option = new EchartsOption();
        
        // 自动生成标题
       /* option.setTitle(new Title(
            "业务数据概览", 
            "总计: " + analysis.totalValue + " | 风险占比: " + String.format("%.1f", analysis.riskRatio * 100) + "%"
        ));*/
        
        // 应用调色板（带智能偏移，避免多图表颜色重复）
        List<String> colors = applyColorRotation(palette.getColors(), businessData);
        option.setColor(colors);

        // 根据类型构建 Series 和坐标轴
        configureSeries(option, seriesData, type, businessData);

        // 5. 包装响应
        return ChartResponse.success(option);
    }
    
    /**
     * 智能颜色轮转 - 基于数据特征计算偏移量
     * 使不同的图表自动使用不同的颜色组合
     */
    private List<String> applyColorRotation(List<String> originalColors, List<BusinessMetric> data) {
        if (data == null || data.isEmpty()) {
            return originalColors;
        }
        
        // 计算数据特征哈希值（基于所有 itemId）
        StringBuilder hashSource = new StringBuilder();
        for (BusinessMetric metric : data) {
            if (metric.getItemId() != null) {
                hashSource.append(metric.getItemId());
            }
        }
        
        // 计算偏移量（0 到颜色数组长度-1）
        int offset = Math.abs(hashSource.toString().hashCode()) % originalColors.size();
        
        // 轮转颜色数组
        List<String> rotatedColors = new ArrayList<>(originalColors.size());
        for (int i = 0; i < originalColors.size(); i++) {
            rotatedColors.add(originalColors.get((i + offset) % originalColors.size()));
        }
        
        return rotatedColors;
    }
    
    /**
     * 构建系列数据（饼图、漏斗图、仪表盘等使用对象格式）
     */
    private List<Map<String, Object>> buildSeriesData(List<BusinessMetric> businessData, String type) {
        return businessData.stream().map(item -> {
            Map<String, Object> point = new HashMap<>();
            point.put("itemId", item.getItemId());
            point.put("name", item.getLabel());
            point.put("value", item.getValue());
            
            // 针对单个数据点的样式适配 (例如：高风险标红)
            if (isHighRisk(item.getValue(), type)) {
                Map<String, Object> itemStyle = new HashMap<>();
                itemStyle.put("color", "#ff4d4f"); // 强制红色警告
                point.put("itemStyle", itemStyle);
            }
            return point;
        }).collect(Collectors.toList());
    }
    
    /**
     * 为柱状图/折线图构建纯数值数组（用于 series.data）
     */
    private List<Object> buildValueArray(List<BusinessMetric> businessData, String type) {
        return businessData.stream().map(item -> {
            // 对于需要保留 itemId 的情况（用于钻取），使用对象格式
            // 但是要保持 ECharts 兼容性
            Map<String, Object> dataPoint = new HashMap<>();
            dataPoint.put("value", item.getValue());
            dataPoint.put("name", item.getLabel());     // 添加 name 字段，用于钻取弹窗标题
            dataPoint.put("itemId", item.getItemId());
            
            // 针对高风险数据标红
            if (isHighRisk(item.getValue(), type)) {
                Map<String, Object> itemStyle = new HashMap<>();
                itemStyle.put("color", "#ff4d4f");
                dataPoint.put("itemStyle", itemStyle);
            }
            
            return dataPoint;
        }).collect(Collectors.toList());
    }
    
    /**
     * 配置图表系列和坐标轴
     */
    private void configureSeries(EchartsOption option, List<Map<String, Object>> seriesData, 
                                  String type, List<BusinessMetric> businessData) {
        Series series = new Series();
        series.setData(seriesData);
        
        switch (type.toLowerCase()) {
            case "pie":
                configurePieSeries(series, option);
                break;
            case "bar":
                configureBarSeries(series, option, businessData, false);
                break;
            case "horizontal-bar": // 条形图（横向柱状图）
                configureBarSeries(series, option, businessData, true);
                break;
            case "grouped-bar": // 分组柱状图（多系列）
                configureGroupedBarSeries(option, businessData);
                return; // 分组图表直接设置多个 series，提前返回
            case "line":
                configureLineSeries(series, option, businessData);
                break;
            case "funnel":
                configureFunnelSeries(series, option);
                break;
            case "radar":
                configureRadarSeries(series, option, businessData);
                break;
            case "gauge":
                configureGaugeSeries(series, option, seriesData);
                break;
            default:
                series.setType(type);
        }
        
        option.setSeries(Collections.singletonList(series));
    }
    
    // --- 各图表类型的配置方法 ---
    
    private void configurePieSeries(Series series, EchartsOption option) {
        series.setType("pie");
        series.setRadius(Arrays.asList("40%", "70%")); // 环形图
        
        // 饼图专属配置 - 隐藏外部标签和引导线
        Map<String, Object> label = new HashMap<>();
        label.put("show", false); // 不显示标签（隐藏外部文字和引导线）
        series.setLabel(label);
        

        option.setTooltip(new Tooltip("item", "{b}: {c} ({d}%)"));
        option.getLegend().setOrient("horizontal");
    }
    
    private void configureBarSeries(Series series, EchartsOption option, 
                                     List<BusinessMetric> businessData, boolean horizontal) {
        series.setType("bar");
        
        // 为柱状图构建正确的数据格式（数值数组，支持钻取的 itemId）
        List<Object> valueData = buildValueArray(businessData, "bar");
        series.setDataAsObjects(valueData);
        
        // 柱状图圆角效果
        Map<String, Object> itemStyle = new HashMap<>();
        itemStyle.put("borderRadius", horizontal ? Arrays.asList(0, 4, 4, 0) : Arrays.asList(4, 4, 0, 0));
        series.setItemStyle(itemStyle);
        
        List<String> categories = businessData.stream()
                .map(BusinessMetric::getLabel)
                .collect(Collectors.toList());
        
        if (horizontal) {
            // 条形图：Y轴为类目，X轴为数值
            option.setYAxis(new Axis("category", categories));
            option.setXAxis(new Axis("value", null));
        } else {
            // 柱状图：X轴为类目，Y轴为数值
            option.setXAxis(new Axis("category", categories));
            option.setYAxis(new Axis("value", null));
        }
        
        option.setTooltip(new Tooltip("axis", null));
        // Grid 配置优化显示空间
        Map<String, Object> grid = new HashMap<>();
        grid.put("left", "3%");
        grid.put("right", "4%");
        grid.put("bottom", "10%");
        grid.put("containLabel", true);
        option.setGrid(grid);
    }
    
    private void configureLineSeries(Series series, EchartsOption option, 
                                      List<BusinessMetric> businessData) {
        series.setType("line");
        series.setSmooth(true); // 平滑曲线
        
        // 为折线图构建正确的数据格式（数值数组，支持钻取的 itemId）
        List<Object> valueData = buildValueArray(businessData, "line");
        series.setDataAsObjects(valueData);
        
        // 区域填充效果
        Map<String, Object> areaStyle = new HashMap<>();
        areaStyle.put("opacity", 0.3);
        series.setAreaStyle(areaStyle);
        
        // 数据点样式
        Map<String, Object> itemStyle = new HashMap<>();
        itemStyle.put("borderWidth", 2);
        itemStyle.put("borderColor", "#fff");
        series.setItemStyle(itemStyle);
        
        List<String> categories = businessData.stream()
                .map(BusinessMetric::getLabel)
                .collect(Collectors.toList());
        option.setXAxis(new Axis("category", categories));
        option.setYAxis(new Axis("value", null));
        
        option.setTooltip(new Tooltip("axis", null));
        Map<String, Object> grid = new HashMap<>();
        grid.put("left", "3%");
        grid.put("right", "4%");
        grid.put("bottom", "10%");
        grid.put("containLabel", true);
        option.setGrid(grid);
    }
    
    /**
     * 配置分组柱状图（多系列）
     * 注意：此方法期望 businessData 包含多个维度的数据
     * 实际使用中，通常直接由后端 API 返回完整的多 series 配置
     */
    private void configureGroupedBarSeries(EchartsOption option, List<BusinessMetric> businessData) {
        // 提取类目
        List<String> categories = businessData.stream()
                .map(BusinessMetric::getLabel)
                .distinct()
                .collect(Collectors.toList());
        
        // 为演示目的，创建3个系列（实际应用中应根据业务需求调整）
        // 注：真实场景建议直接由 API 返回完整的多 series 数据
        List<Series> seriesList = new ArrayList<>();
        
        // 示例：创建单个系列（实际使用时应由 API 提供多系列数据）
        Series series1 = new Series();
        series1.setType("bar");
        series1.setName("系列1"); // 应从业务数据中获取
        
        List<Object> valueData = buildValueArray(businessData, "bar");
        series1.setDataAsObjects(valueData);
        
        Map<String, Object> itemStyle = new HashMap<>();
        itemStyle.put("borderRadius", Arrays.asList(4, 4, 0, 0));
        series1.setItemStyle(itemStyle);
        
        seriesList.add(series1);
        
        // 如果有多个系列，继续添加...
        // Series series2 = new Series();
        // series2.setType("bar");
        // series2.setName("系列2");
        // ...
        
        option.setSeries(seriesList);
        
        // 配置坐标轴
        option.setXAxis(new Axis("category", categories));
        option.setYAxis(new Axis("value", null));
        
        // 配置图例
        Legend legend = new Legend();
        legend.setBottom("0");
        legend.setLeft("center");
        option.setLegend(legend);
        
        // 配置网格
        Map<String, Object> grid = new HashMap<>();
        grid.put("left", "3%");
        grid.put("right", "4%");
        grid.put("bottom", "12%");
        grid.put("top", "10%");
        grid.put("containLabel", true);
        option.setGrid(grid);
        
        // 配置提示框
        option.setTooltip(new Tooltip("axis", null));
    }

    
    private void configureFunnelSeries(Series series, EchartsOption option) {
        series.setType("funnel");
        series.setSort("descending"); // 降序排列
        
        // 漏斗图布局
        Map<String, Object> extra = new HashMap<>();
        extra.put("left", "10%");
        extra.put("top", "60");
        extra.put("bottom", "60");
        extra.put("width", "80%");
        series.setExtra(extra);
        
        // 标签配置
        Map<String, Object> label = new HashMap<>();
        label.put("show", true);
        label.put("position", "inside");
        series.setLabel(label);
        
        option.setTooltip(new Tooltip("item", "{b}: {c}"));
    }
    
    private void configureRadarSeries(Series series, EchartsOption option, 
                                       List<BusinessMetric> businessData) {
        series.setType("radar");
        
        // 区域样式
        Map<String, Object> areaStyle = new HashMap<>();
        areaStyle.put("opacity", 0.3);
        series.setAreaStyle(areaStyle);
        
        // 雷达图需要 radar 配置
        Map<String, Object> radar = new HashMap<>();
        radar.put("shape", "circle"); // 圆形雷达图更美观
        
        // 构建指示器
        List<Map<String, Object>> indicator = businessData.stream()
                .map(item -> {
                    Map<String, Object> ind = new HashMap<>();
                    ind.put("name", item.getLabel());
                    ind.put("max", Math.max(100, item.getValue() * 1.2)); // 动态最大值
                    return ind;
                })
                .collect(Collectors.toList());
        radar.put("indicator", indicator);
        option.setRadar(radar);
        
        option.setTooltip(new Tooltip("item", null));
    }
    
    private void configureGaugeSeries(Series series, EchartsOption option, 
                                       List<Map<String, Object>> seriesData) {
        series.setType("gauge");
        series.setRadius(Collections.singletonList("75%"));
        
        // 仪表盘通常只显示第一个数据
        if (!seriesData.isEmpty()) {
            Map<String, Object> firstData = seriesData.get(0);
            series.setData(Collections.singletonList(firstData));
            
            // 仪表盘颜色配置（根据数值自动着色）
            double value = (Double) firstData.get("value");
            Map<String, Object> axisLine = new HashMap<>();
            Map<String, Object> lineStyle = new HashMap<>();
            
            // 分段着色：绿→黄→红
            List<List<Object>> colorStops = Arrays.asList(
                Arrays.asList(0.3, "#67c23a"),  // 绿色：0-30%
                Arrays.asList(0.7, "#e6a23c"),  // 黄色：30-70%
                Arrays.asList(1.0, "#f56c6c")   // 红色：70-100%
            );
            lineStyle.put("color", colorStops);
            lineStyle.put("width", 10);
            axisLine.put("lineStyle", lineStyle);
            series.setAxisLine(axisLine);
        }
        
        option.setTooltip(new Tooltip("item", "{b}: {c}"));
    }

    // --- 内部辅助逻辑 ---

    private boolean isHighRisk(double value, String type) {
        // 示例业务规则：作为比例(Pie)超过30%或数值(Bar/Line)超过80视为高风险
        if ("pie".equalsIgnoreCase(type)) return false; // 饼图通常看整体分布
        return value > 80.0;
    }

    private DataAnalysis analyzeData(List<BusinessMetric> data) {
        double total = 0;
        double riskTotal = 0;
        for (BusinessMetric m : data) {
            total += m.getValue();
            if (m.getValue() > 80) riskTotal += m.getValue(); // 假设 >80 为风险阈值
        }
        return new DataAnalysis(total, total == 0 ? 0 : riskTotal / total);
    }

    private ColorPalette selectPaletteInternal(DataAnalysis analysis) {
        // 策略模式：根据数据特征选择配色
        if (analysis.riskRatio > 0.5) {
            return ColorPalette.RISK_GRADIENT; // 风险过高，使用风险渐变色系
        } else if (analysis.riskRatio > 0.2) {
            return ColorPalette.DEFAULT_GRADIENT; // 中等风险，使用默认渐变
        }
        return ColorPalette.DEFAULT_GRADIENT; // 默认使用渐变色系（更美观）
    }

    // --- 数据模型定义 (POJOs) ---
    // 为了方便复制，全部以静态内部类形式放在这里。实际项目中可拆分文件。

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class BusinessMetric {
        private String itemId; // 分类id
        private String label; // 业务标签 (e.g., "华东区")
        private Double value; // 业务数值 (e.g., 95.5)
        // 可以扩展更多业务字段
    }

    @Data
    @AllArgsConstructor
    private static class DataAnalysis {
        double totalValue;
        double riskRatio;
    }

    // 预设调色板枚举 - 优化配色方案，支持最多30个分类
    public enum ColorPalette {
        // 默认渐变色系：红→橙→黄→绿 (参考用户需求图)
        DEFAULT_GRADIENT(Arrays.asList(
            "#d32029", "#e4393c", "#f45959", "#ff6b6b", "#ff7875",  // 红色系 (极高风险)
            "#ff8c42", "#ffa552", "#ffb366", "#ffc078", "#ffcc85",  // 橙色系 (高风险)
            "#ffd666", "#ffe17d", "#ffec8b", "#fff599", "#fffba8",  // 黄色系 (中风险)
            "#d4e157", "#c5e84b", "#b5dd2b", "#a3d421", "#94c83d",  // 黄绿系 (较低风险)
            "#7fc247", "#6cb944", "#5caf41", "#4ba73e", "#3a9f3c",  // 绿色系 (低风险)
            "#2e963a", "#268d38", "#1e8436", "#177b34", "#0d7233"   // 深绿系 (安全)
        )),
        
        // 风险渐变色系：专为风险可视化优化
        RISK_GRADIENT(Arrays.asList(
            "#c23531", "#d9534f", "#e74c3c", "#ff5252", "#ff6b6b",  // 极高风险
            "#ff7043", "#ff8a65", "#ffa726", "#ffb74d", "#ffc947",  // 高风险
            "#ffd54f", "#ffe082", "#ffeb3b", "#fff176", "#fff59d",  // 中等风险
            "#cddc39", "#d4e157", "#dce775", "#aed581", "#9ccc65",  // 较低风险
            "#66bb6a", "#4caf50", "#43a047", "#388e3c", "#2e7d32",  // 低风险
            "#1b5e20", "#1b5e20", "#1b5e20", "#1b5e20", "#1b5e20"   // 安全（填充至30色）
        )),
        
        // 现代鲜艳配色：适合普通业务场景
        MODERN_VIVID(Arrays.asList(
            "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",  // ECharts 经典5色
            "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#5470c6",  // 补充色
            "#5fb878", "#ff5722", "#01aaed", "#ffb800", "#393d49",  
            "#1e9fff", "#ff5722", "#ffb800", "#2f4554", "#61a0a8",
            "#d48265", "#91c7ae", "#749f83", "#ca8622", "#bda29a",
            "#6e7074", "#546570", "#c4ccd3", "#00d1b2", "#3273dc"
        ));

        private final List<String> colors;

        ColorPalette(List<String> colors) { this.colors = colors; }
        public List<String> getColors() { return colors; }
    }

    // --- 响应结构 (适配 ECharts JSON) ---

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChartResponse {
        private int status;
        private String msg;
        private EchartsOption data; // 将 Option 直接作为 data 返回，或根据 AMIS 需求调整结构

        public static ChartResponse success(EchartsOption option) {
            return ChartResponse.builder().status(0).msg("success").data(option).build();
        }
    }


    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EchartsOption {
        private Title title;
        private Tooltip tooltip = new Tooltip("item"); // 默认开启
        private Legend legend = new Legend();   // 默认开启
        private List<String> color;
        
        @com.fasterxml.jackson.annotation.JsonProperty("xAxis")
        private Axis xAxis;
        
        @com.fasterxml.jackson.annotation.JsonProperty("yAxis")
        private Axis yAxis;
        
        private Map<String, Object> radar; // 雷达图专用配置
        private Map<String, Object> grid;  // 网格配置
        private List<Series> series;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Title {
        private String text;
        private String subtext;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Tooltip {
        private String trigger;
        private String formatter; // 格式化字符串
        
        public Tooltip(String trigger) {
            this.trigger = trigger;
        }

    }

    @Data
    @NoArgsConstructor
    public static class Legend {
        private String bottom = "0";
        private String orient = "vertical"; // vertical 或 horizontal
        private String left;
        private String top;
        
        public void setOrient(String orient) {
            this.orient = orient;
        }
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Axis {
        private String type;
        private List<String> data;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Series {
        private String type;
        private String name;
        private List<String> radius;
        private String sort; // 漏斗图排序：descending/ascending
        private Boolean smooth; // 折线图平滑
        
        // 使用 List<?> 以支持多种数据格式：
        // - 饼图/漏斗图: List<Map<String, Object>>
        // - 柱状图/折线图: List<Object> (可以是数值或包含 value/itemId 的对象)
        private List<?> data;
        
        // 样式配置
        private Map<String, Object> label; // 标签配置
        private Map<String, Object> areaStyle; // 区域样式（折线图、雷达图）
        private Map<String, Object> itemStyle; // 单项样式
        private Map<String, Object> extra; // 额外配置（漏斗图布局等）
        private Map<String, Object> axisLine; // 仪表盘轴线配置
        
        // 辅助方法：设置对象数组数据（柱状图/折线图）
        public void setDataAsObjects(List<Object> dataList) {
            this.data = dataList;
        }
        
        // 辅助方法：设置 Map 数组数据（饼图/漏斗图）
        @SuppressWarnings("unchecked")
        public void setData(List<Map<String, Object>> dataList) {
            this.data = (List<?>) dataList;
        }
    }
}
