# DEBUG_GUIDE

## 目标
本指南用于验收最终收口范围内的调试闭环：
- prompt 调试
- retrieval 调试
- chunk 调试

## 前置条件
1. 已登录并拿到 JWT。
2. 至少有一个 eady 文档（已上传并完成 ingestion）。
3. 后端已开启调试：
   - NODE_ENV=development/test 或 RAG_DEBUG_ENABLED=true

## 调试访问限制
若配置了 RAG_DEBUG_ACCESS_TOKEN，所有调试接口需携带：
- Header: x-debug-token: <token>

不满足时返回 404 Not Found。

## Prompt 调试
1. 读取当前 Prompt：GET /rag/debug/prompt/current
2. 渲染 Prompt：POST /rag/debug/prompt/render
   - 入参：query，可选 conversationId、	opK
   - 返回：promptVersion、etrievalHits、promptInput、promptOutput

## Retrieval 调试
1. POST /rag/debug/retrieve
   - 入参：query，可选 	opK
   - 返回：etrievalProvider、etrievedCount、etrievalHits
2. GET /rag/debug/runs
   - 查看 debug 历史运行记录
3. GET /rag/debug/runs/:runId
   - 查看单次运行详情

## Chunk 调试
1. GET /chunks/debug
   - 可选参数：documentId、keyword、query、page、limit、offset
   - 返回：chunk 列表及总数
2. GET /chunks/:chunkId/context
   - 查询 chunk 邻近上下文

## 前端调试页
路径：/app/debug

页面调用真实接口：
- /rag/debug/*
- /chunks/debug

前端如需携带调试 token，请设置：VITE_DEBUG_ACCESS_TOKEN。
