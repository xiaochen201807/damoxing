const express = require("express");
const router = express.Router();
const axios = require("axios");

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
router.post("/generate", async (req, res) => {
  const { query, pageId } = req.body;
  // 【修复点 1】获取环境变量中的 Key
  const apiKey = process.env.DIFY_API_KEY;
  // 1. Mock 模式检查
  if (!apiKey || apiKey === "YOUR_DIFY_API_KEY") {
    console.log("⚠️ 未检测到 Dify Key，使用本地 Mock 数据返回");

    // 返回假的成功数据，骗过前端
    return res.json({
      status: 0,
      msg: "success",
      data: {
        // 这下面的 JSON 就是“Mock 数据”
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

  // 2. 真实调用 Dify 模式
  try {
    const difyUrl = process.env.DIFY_API_URL || "https://api.dify.ai/v1";

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

    console.log(`[AI] Calling Dify: ${difyUrl}/chat-messages`);

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

      res.json({
        status: 0,
        msg: "success",
        data: parsedData,
      });
    } catch (parseError) {
      console.error("[AI] JSON Parse Error:", parseError);
      console.error("[AI] Raw Content:", rawAnswer);
      res.json({
        status: 1,
        msg: "LLM 返回的内容不是有效的 JSON 格式",
        data: {
          raw_content: rawAnswer, // 将原始内容返回给前端用于调试
        },
      });
    }
  } catch (error) {
    console.error("[AI] Request Error:", error.message);
    if (error.response) {
      console.error("[AI] Dify Error Details:", error.response.data);
    }

    res.status(500).json({
      status: 500,
      msg: error.response?.data?.message || error.message || "AI Service Error",
    });
  }
});

// POST /api/ai/generate
router.post("/generate-page", async (req, res) => {
  const { query, pageId } = req.body;

  if (!query) {
    return res.status(400).json({ error: "缺少 prompt 参数" });
  }
    const DIFY_API_URL = process.env.DIFY_API_URL;
    const DIFY_API_KEY = process.env.DIFY_API_KEY;
  try {
    console.log(`[AI Workflow] 正在请求 Dify Workflow: ${query}`);

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
        timeout: 120000, // Workflow 运行时间可能较长，设置 60秒超时
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
    //   console.log("[AI Workflow] 生成成功",JSON.stringify(workflowData, null, 2));

      if (workflowData.data.status === "succeeded") {
        // 获取 Dify 返回的原始结果 (这是一个 String，因为我们在 Python 节点打包了)
        const rawResult = workflowData.data.outputs.result;

        console.log("[AI Workflow] Dify 原始输出类型:", typeof rawResult); // 应该是 string
        let finalJsonObj;
        const generatedJson = JSON.stringify(workflowData.data.outputs.result);
        try {
          // 【关键修改】这里要用 parse，而不是 stringify
          // 只有把字符串还原成对象，AMIS 才能直接读取 body 里的数组
          finalJsonObj =
            typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
        } catch (e) {
          console.error("解析 Dify 返回的 JSON 字符串失败", e);
          // 兜底：如果解析失败，至少发个报错给前端，别崩
          finalJsonObj = { type: "page", body: "后端解析数据格式错误" };
        }

        console.log("[AI Workflow] 解析成功，准备返回给前端");
        // 直接返回 JSON 对象给前端 AMIS 渲染
        res.json({
          status: 0,
          msg: "success",
          data: finalJsonObj, // 这里的结构应该是 { type: "page", body: [...] }
        });
      } else {
      console.error("[AI Workflow] 运行状态非成功:", workflowData);
      res.status(500).json({ status: 1, msg: "Workflow 运行未完成或失败" });
    }
  } catch (error) {
    console.error(
      "[AI Workflow] API 调用出错:",
      error.response?.data || error.message
    );
    res.status(500).json({
      status: 1,
      msg: "生成页面失败，请检查后端日志",
      details: error.response?.data,
    });
  }
});

module.exports = router;
