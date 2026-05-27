# RAGPlatform

本仓库是一个 RAG 演示与交付项目，内部按前后端拆分：

- `frontend/`：前端应用，React + Vite。
- `backend/`：后端服务，NestJS + MongoDB。
- `docs/`：交付文档、调试手册、演示脚本。

## 交付范围

本期范围固定为：

- 文档上传 / 入库
- RAG 问答（/rag/ask）
- citations / trace
- prompt 调试
- chunk 调试

## 环境准备

1. Node.js 20+
2. MongoDB 6+
3. 在本目录安装依赖：

```bash
npm install
```

也可以分别进入 `frontend/` 和 `backend/` 安装依赖。

## 环境变量

请参考根目录 `.env.example`。

建议：

1. 前端变量写入 `frontend/.env.development`
2. 后端变量写入 `backend/.env`

## 本地启动

启动后端：

```bash
npm run dev:backend
```

启动前端：

```bash
npm run dev:frontend
```

默认前端走 `/api` 代理到后端，请根据本地实际端口调整 `VITE_API_BASE_URL`。

## 常用命令

```bash
npm run build:frontend
npm run build:backend
npm run typecheck:backend
npm run check
```

## 核心验收清单

1. 注册并登录成功。
2. 上传文档成功。
3. 触发 ingestion 后文档进入 ready。
4. 调用 /rag/ask 返回 answer / citations / trace。
5. 聊天页可查看 citations / trace。
6. 调试页可执行 prompt 调试与 chunk 调试。

## 最小回归（Smoke）

后端提供最小 e2e smoke 用例：

```bash
cd backend
npm run test:e2e -- delivery-smoke.e2e-spec.ts --runInBand
```

## 调试接口访问限制

为最小安全收口，调试接口支持附加 token：

- 环境变量：`RAG_DEBUG_ACCESS_TOKEN`
- 请求头：`x-debug-token`

当配置了 `RAG_DEBUG_ACCESS_TOKEN` 时，不携带或携带错误 token 的调试请求返回 404。

## 文档索引

- `docs/DEBUG_GUIDE.md`
- `docs/DEMO_SCRIPT.md`
- `docs/KNOWN_ISSUES.md`
- `docs/API_DEBUG.md`
