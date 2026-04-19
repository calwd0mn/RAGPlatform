# RAGPlatform（最终收口版）

本仓库为可演示、可验收、可交付的 RAG 项目收口版本。

## 交付范围
详见 DELIVERY_SCOPE.md。

本期范围固定为：
- 文档上传 / 入库
- RAG 问答（/rag/ask）
- citations / trace
- prompt 调试
- chunk 调试

## 目录说明
- src/：前端（React + Vite）
- 
est-service/：后端（NestJS + MongoDB）
- docs/：交付文档、调试手册、演示脚本

## 环境准备
1. Node.js 20+
2. MongoDB 6+
3. 安装依赖：
   - 前端：
pm install
   - 后端：cd nest-service && npm install

## 环境变量
请参考根目录 .env.example。

建议：
1. 前端将变量写入根目录 .env.development
2. 后端将变量写入 
est-service/.env

## 本地启动
1. 启动后端
`ash
cd nest-service
npm run start:dev
`
2. 启动前端
`ash
npm run dev
`

默认前端走 /api 代理到后端，请根据本地实际端口调整 VITE_API_BASE_URL。

## 核心验收清单
1. 注册并登录成功。
2. 上传文档成功。
3. 触发 ingestion 后文档进入 eady。
4. 调用 /rag/ask 返回 nswer/citations/trace。
5. 聊天页可查看 citations / trace。
6. 调试页可执行 prompt 调试与 chunk 调试。

## 最小回归（Smoke）
后端提供最小 e2e smoke 用例：
`ash
cd nest-service
npm run test:e2e -- delivery-smoke.e2e-spec.ts --runInBand
`

## 调试接口访问限制
为最小安全收口，调试接口支持附加 token：
- 环境变量：RAG_DEBUG_ACCESS_TOKEN
- 请求头：x-debug-token

当配置了 RAG_DEBUG_ACCESS_TOKEN 时，不携带或携带错误 token 的调试请求返回 404。

## 文档索引
- docs/DEBUG_GUIDE.md
- docs/DEMO_SCRIPT.md
- docs/KNOWN_ISSUES.md
- docs/API_DEBUG.md
