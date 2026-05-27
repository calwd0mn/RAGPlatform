import { QueryClient } from "@tanstack/react-query";

const QUERY_STALE_TIME_MS = 30_000;
const QUERY_GC_TIME_MS = 5 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS, // 数据在需要重新获取前保持新鲜的时间，在此期间的相同key请求不会再去获取数据，直接从缓存中获取
      gcTime: QUERY_GC_TIME_MS, // 查询无人订阅后保留缓存的时间，避免会话/消息缓存长期堆积
      refetchOnWindowFocus: false, // 切回窗口不自动重拉数据
      retry: 1, // 重试次数
    },
    mutations: {
      retry: 0,
    },
  },
});
