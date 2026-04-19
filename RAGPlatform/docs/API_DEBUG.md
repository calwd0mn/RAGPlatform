# API_DEBUG

## 认证
1. 注册：POST /auth/register
2. 登录：POST /auth/login
3. 后续接口带 Header: Authorization: Bearer TOKEN_PLACEHOLDER

## 调试接口访问限制
若配置了 RAG_DEBUG_ACCESS_TOKEN，调试接口需加：
- x-debug-token: DEBUG_TOKEN_PLACEHOLDER

缺少或错误时返回 404。

## Prompt 调试
- GET /rag/debug/prompt/current
- POST /rag/debug/prompt/render
请求体示例：
{
   query: 请总结当前文档要点,
  topK: 5,
  conversationId: 507f191e810c19729de860ea
}

## Retrieval 调试
- POST /rag/debug/retrieve
请求体示例：
{
  query: 调试检索命中,
  topK: 5
}

- GET /rag/debug/runs?limit=20&offset=0
- GET /rag/debug/runs/:runId

## Chunk 调试
- GET /chunks/debug?limit=20&offset=0&query=keyword
可选参数：documentId, keyword, query, page, limit, offset

- GET /chunks/:chunkId/context?before=1&after=1

## 请求示例
GET http://localhost:3000/rag/debug/prompt/current
Headers:
- Authorization: Bearer TOKEN_PLACEHOLDER
- x-debug-token: DEBUG_TOKEN_PLACEHOLDER

POST http://localhost:3000/rag/debug/retrieve
Headers:
- Authorization: Bearer TOKEN_PLACEHOLDER
- x-debug-token: DEBUG_TOKEN_PLACEHOLDER
- Content-Type: application/json
Body:
{
  query: 调试问题,
  topK: 5
}

GET http://localhost:3000/chunks/debug?limit=20&offset=0
Headers:
- Authorization: Bearer TOKEN_PLACEHOLDER
- x-debug-token: DEBUG_TOKEN_PLACEHOLDER
