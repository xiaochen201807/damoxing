const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../../db");
const logger = require("../../utils/logger");
const cache = require("../../utils/cache");
const { aiLimiter } = require("../../middleware/security");
const { validate, schemas } = require("../../middleware/validator");



/**
 * 静态 Mock 数据 (当没有配置 API Key 时返回)
 * 一个简单的 AMIS 页面配置，包含 KPI 卡片和图表
 */
const MOCK_AMIS_JSON = {
  type: "page",
  title: "AI 生成页面 (Mock)",
  body: [
    {
      type: "grid",
      columns: [
        {
          body: [
            {
              type: "card",
              header: { title: "Mock KPI A" },
              body: "12,345",
            },
          ],
        },
        {
          body: [
            {
              type: "card",
              header: { title: "Mock KPI B" },
              body: "88%",
            },
          ],
        },
      ],
    },
    {
      type: "chart",
      height: 300,
      api: "https://echarts.apache.org/examples/data/asset/data/aqi-beijing.json",
      config: {
        title: { text: "Mock Chart Data" },
        xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
        yAxis: { type: "value" },
        series: [{ data: [120, 200, 150, 80, 70], type: "bar" }],
      },
    },
  ],
};

// POST /api/ai/generate
router.post("/generate", aiLimiter, validate(schemas.aiGenerate), async (req, res) => {
  const { query, pageId } = req.body;

  // 1. 先检查缓存
  const cachedResult = cache.ai.get(pageId || 'default', query);
  if (cachedResult) {
    logger.info('[AI] Cache hit for query:', query.substring(0, 50));
    return res.json({
      status: 0,
      msg: 'success (cached)',
      data: cachedResult,
      cached: true,
    });
  }

  // 2. 从数据库获取 Dify 配置
  const getConfig = () => {
    return new Promise((resolve, reject) => {
      // 优先从数据库查询配置（如果提供了 pageId）
      if (pageId) {
        const sql = 'SELECT * FROM sys_dify_config WHERE page_key = ? AND enabled = 1';
        db.get(sql, [pageId], (err, row) => {
          if (err) {
            logger.error('[AI Generate] 查询配置失败:', err);
            return reject(err);
          }

          if (row) {
            // 找到配置，直接使用
            logger.info(`[AI Generate] 使用页面配置: ${row.workflow_name} (${pageId})`);
            return resolve(row);
          }

          // 数据库中没有找到配置，使用环境变量兜底
          logger.warn(`⚠️  页面 ${pageId} 未配置工作流，尝试使用环境变量`);
          const apiKey = process.env.DIFY_API_KEY;
          const apiUrl = process.env.DIFY_API_URL || "https://api.dify.ai/v1";

          if (!apiKey || apiKey === "YOUR_DIFY_API_KEY") {
            return resolve(null); // 返回 null 表示使用 Mock 模式
          }

          return resolve({ api_url: apiUrl, api_key: apiKey, enabled: 1 });
        });
      } else {
        // 没有提供 pageId，直接使用环境变量
        logger.warn('[AI Generate] 未提供 pageId，使用环境变量配置');
        const apiKey = process.env.DIFY_API_KEY;
        const apiUrl = process.env.DIFY_API_URL || "https://api.dify.ai/v1";

        if (!apiKey || apiKey === "YOUR_DIFY_API_KEY") {
          return resolve(null); // 返回 null 表示使用 Mock 模式
        }

        return resolve({ api_url: apiUrl, api_key: apiKey, enabled: 1 });
      }
    });
  };

  try {
    const config = await getConfig();

    // 2. Mock 模式检查
    if (!config) {
      logger.warn("⚠️ 未检测到 Dify 配置，使用本地 Mock 数据返回");

      // 返回假的成功数据，骗过前端
      return res.json({
        status: 0,
        msg: "success",
        data: {
          // 这下面的 JSON 就是"Mock 数据"
          // AMIS 收到这坨 JSON，就会渲染出图表
          type: "grid",
          columns: [
            {
              md: 6,
              body: {
                type: "chart",
                height: 300,
                config: {
                  title: { text: "Mock数据-模拟逾期趋势" },
                  xAxis: {
                    type: "category",
                    data: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                  },
                  series: [{ data: [820, 932, 901, 934, 1290], type: "line" }],
                },
              },
            },
            {
              md: 6,
              body: {
                type: "chart",
                height: 300,
                config: {
                  title: { text: "Mock数据-模拟风险分布" },
                  series: [
                    {
                      type: "pie",
                      data: [
                        { value: 30, name: "高风险" },
                        { value: 70, name: "低风险" },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      });
    }

    // 3. 真实调用 Dify 模式
    const difyUrl = config.api_url;
    const apiKey = config.api_key;

    logger.info(`[AI] 使用配置: ${config.workflow_name || 'Default'} (${pageId || 'env'})`);


    // 构造 Dify 请求体 (Chat Messages API)
    const payload = {
      inputs: {
        page_id: pageId || "default", // 可以将 pageId 作为变量传给 Prompt
      },
      query: query, // 用户输入的 Prompt
      response_mode: "blocking", // 阻塞模式，等待完整回复
      user: "amis-system-user", // 标识用户，用于会话隔离
      conversation_id: "", // 如果需要连续对话，需前端传递 conversation_id
    };

    logger.info(`[AI] Calling Dify: ${difyUrl}/chat-messages`);

    const response = await axios.post(`${difyUrl}/chat-messages`, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 获取 LLM 的文本回复
    let rawAnswer = response.data.answer;

    if (!rawAnswer) {
      throw new Error("Empty response from Dify");
    }

    // 3. 数据清洗 (去除 Markdown 代码块标记)
    // LLM 经常返回 ```json { ... } ``` 格式，需要提取中间的纯 JSON
    // 正则解释：匹配 ```json (可选换行) 开头，和 ``` 结尾
    const jsonCodeBlockRegex = /```json\s*([\s\S]*?)\s*```/i;
    const genericCodeBlockRegex = /```\s*([\s\S]*?)\s*```/i;

    let cleanJsonStr = rawAnswer;
    const matchJson = rawAnswer.match(jsonCodeBlockRegex);
    const matchGeneric = rawAnswer.match(genericCodeBlockRegex);

    if (matchJson && matchJson[1]) {
      cleanJsonStr = matchJson[1];
    } else if (matchGeneric && matchGeneric[1]) {
      cleanJsonStr = matchGeneric[1];
    }

    // 4. 解析 JSON 并返回 AMIS 格式
    try {
      const parsedData = JSON.parse(cleanJsonStr);

      // 缓存成功的 AI 结果
      cache.ai.set(pageId || 'default', query, parsedData);

      res.json({
        status: 0,
        msg: "success",
        data: parsedData,
      });
    } catch (parseError) {
      logger.error("[AI] JSON Parse Error:", parseError);
      logger.error("[AI] Raw Content:", rawAnswer);
      res.json({
        status: 1,
        msg: "LLM 返回的内容不是有效的 JSON 格式",
        data: {
          raw_content: rawAnswer, // 将原始内容返回给前端用于调试
        },
      });
    }
  } catch (error) {
    logger.error("[AI] Request Error:", error.message);
    if (error.response) {
      logger.error("[AI] Dify Error Details:", error.response.data);
    }

    res.status(500).json({
      status: 500,
      msg: error.response?.data?.message || error.message || "AI Service Error",
    });
  }
});

// POST /api/ai/generate-page
router.post("/generate-page", aiLimiter, validate(schemas.aiGenerate), async (req, res) => {
  const { query, pageId, workflowType } = req.body;  // 🆕 新增 workflowType 参数

  if (!query) {
    return res.status(400).json({ error: "缺少 prompt 参数" });
  }

  // 1. 从数据库获取 Dify 配置
  const getConfig = () => {
    return new Promise((resolve, reject) => {
      // 🆕 如果传递了 workflowType，则精确查询；否则返回第一个匹配的配置
      let sql, params;

      if (workflowType) {
        sql = 'SELECT * FROM sys_dify_config WHERE page_key = ? AND workflow_type = ? AND enabled = 1';
        params = [pageId, workflowType];
        logger.info(`[AI Workflow] 查询配置: page_key=${pageId}, workflow_type=${workflowType}`);
      } else {
        sql = 'SELECT * FROM sys_dify_config WHERE page_key = ? AND enabled = 1 LIMIT 1';
        params = [pageId];
        logger.info(`[AI Workflow] 查询配置: page_key=${pageId} (未指定工作流类型，使用第一个)`);
      }

      db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('[AI Workflow] 查询配置失败:', err);
          return reject(err);
        }

        if (!row) {
          const apiKey = process.env.DIFY_API_KEY;
          const apiUrl = process.env.DIFY_API_URL || "https://api.dify.ai/v1";

          if (!apiKey || apiKey === "YOUR_DIFY_API_KEY") {
            const errorMsg = workflowType
              ? `页面 ${pageId} 的工作流类型 ${workflowType} 未配置`
              : `页面 ${pageId} 未配置工作流`;
            return reject(new Error(errorMsg));
          }

          logger.warn(`⚠️  页面 ${pageId} 未配置工作流，使用默认环境变量`);
          return resolve({ api_url: apiUrl, api_key: apiKey });
        }

        resolve(row);
      });
    });
  };

  try {
    const config = await getConfig();
    const DIFY_API_URL = config.api_url;
    const DIFY_API_KEY = config.api_key;

    logger.info(`[AI Workflow] 使用配置: ${config.workflow_name || 'Default'} (${pageId || 'env'})`);
    logger.info(`[AI Workflow] 正在请求 Dify Workflow: ${query}`);

    // Dify Workflow API 调用结构
    const response = await axios.post(
      `${DIFY_API_URL}/workflows/run`, // 注意路径是 /workflows/run
      {
        inputs: {
          query: query, // 对应 Start 节点的输入变量名
          pageId: pageId || "default_page",
        },
        response_mode: "blocking", // 使用阻塞模式，等待完全生成后返回
        user: "amis-user-001", // 唯一用户标识，用于日志记录
      },
      {
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json",
        },
        // 从环境变量读取超时时间，默认 300秒 (5分钟)
        timeout: parseInt(process.env.DIFY_API_TIMEOUT || '300000'),
      }
    );

    // Dify Workflow 成功响应结构 (Blocking 模式):
    // response.data = {
    //   workflow_run_id: "...",
    //   data: {
    //     status: "succeeded",
    //     outputs: {
    //       result: { ... }  <-- 我们在 End 节点定义的变量名
    //     }
    //   }
    // }

    const workflowData = response.data;

    if (workflowData.data.status === "succeeded") {
      // 获取 Dify 返回的原始结果 (这是一个 String，因为我们在 Python 节点打包了)
      const rawResult = workflowData.data.outputs.result;

      logger.info("[AI Workflow] Dify 原始输出类型:", typeof rawResult);
      let finalJsonObj;
      const generatedJson = JSON.stringify(workflowData.data.outputs.result);
      try {
        // 【关键修改】这里要用 parse，而不是 stringify
        // 只有把字符串还原成对象，AMIS 才能直接读取 body 里的数组
        finalJsonObj =
          typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
      } catch (e) {
        logger.error("解析 Dify 返回的 JSON 字符串失败", e);
        // 兜底：如果解析失败，至少发个报错给前端，别崩
        finalJsonObj = { type: "page", body: "后端解析数据格式错误" };
      }

      logger.info("[AI Workflow] 解析成功，准备返回给前端");
      // 直接返回 JSON 对象给前端 AMIS 渲染
      res.json({
        status: 0,
        msg: "success",
        data: finalJsonObj, // 这里的结构应该是 { type: "page", body: [...] }
      });
    } else {
      logger.error("[AI Workflow] 运行状态非成功:", workflowData);
      res.status(500).json({ status: 1, msg: "Workflow 运行未完成或失败" });
    }
  } catch (error) {
    logger.error("[AI Workflow] API 调用出错详情:");
    if (error.response) {
      // 服务器返回了错误状态码 (4xx, 5xx)
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Data: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // 请求发出去了，但没有收到响应 (超时/网络断开)
      logger.error("无响应 (Timeout/Network Error)");
      logger.error(error.message);
    } else {
      // 设置请求时发生错误
      logger.error("Error Message:", error.message);
    }

    res.status(500).json({
      status: 1,
      msg: "生成页面失败: " + (error.message || "未知错误"),
      details: error.response?.data || "无详细信息",
    });
  }
});

module.exports = router;
