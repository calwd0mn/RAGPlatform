# CHUNK_STRATEGY_TEST

## 目标

对同一批文档与同一批 query，进行多组 chunk strategy 对比测试，支持：

- `retrieve-only`
- `full-rag`

并输出最小报告字段：

- `chunkCount`
- `avgLength`
- `retrievedCount`
- `hits`
- `citationsCount`
- `answerPreview`（仅 `full-rag`）

## 接口

- `POST /rag/debug/chunk-strategy-test`
- 需要 JWT 鉴权
- 需要请求头 `x-debug-token`

## 请求体

```json
{
  "documentIds": ["681a7d3d93d017f149e2d0f2"],
  "queries": ["文档的核心结论是什么？", "有哪些风险点？"],
  "strategies": [
    {
      "name": "s-800-150-rec",
      "chunkSize": 800,
      "chunkOverlap": 150,
      "splitterType": "recursive"
    },
    {
      "name": "s-500-80-md",
      "chunkSize": 500,
      "chunkOverlap": 80,
      "splitterType": "markdown"
    }
  ],
  "mode": "retrieve-only",
  "topK": 5
}
```

## 返回示例

```json
{
  "testRunId": "chunk-test-20260419123456789-a1b2c3d4",
  "mode": "retrieve-only",
  "topK": 5,
  "documentIds": ["681a7d3d93d017f149e2d0f2"],
  "queryCount": 2,
  "strategies": [
    {
      "strategyName": "s-800-150-rec",
      "splitterType": "recursive",
      "chunkSize": 800,
      "chunkOverlap": 150,
      "chunkCount": 24,
      "avgLength": 622.5,
      "retrievedCount": 10,
      "hits": [
        {
          "query": "文档的核心结论是什么？",
          "retrievedCount": 5,
          "hits": [],
          "citationsCount": 0
        },
        {
          "query": "有哪些风险点？",
          "retrievedCount": 5,
          "hits": [],
          "citationsCount": 0
        }
      ],
      "citationsCount": 0
    }
  ]
}
```

## 本地脚本运行

后端目录：`nest-service`

1. 准备 payload 文件（例如 `scripts/chunk-strategy.payload.json`）。
2. 运行：

```bash
npm run chunk-strategy:test -- --userId=<USER_ID> --payloadFile=./scripts/chunk-strategy.payload.json
```

也可以直接传 JSON：

```bash
npm run chunk-strategy:test -- --userId=<USER_ID> --payload='{"documentIds":["..."],"queries":["..."],"strategies":[{"name":"s1","chunkSize":800,"chunkOverlap":150}],"mode":"retrieve-only"}'
```

## 数据隔离说明

- 策略测试 chunks 写入独立集合：`chunk_strategy_test_chunks`
- 字段包含：`testRunId`、`strategyName`
- 不会写入生产 `chunks` 集合，因此不会污染正式检索数据
