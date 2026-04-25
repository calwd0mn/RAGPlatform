import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 数据在需要重新获取前保持新鲜的时间，在此期间的相同key请求不会再去获取数据，直接从缓存中获取
      refetchOnWindowFocus: false, // 切回窗口不自动重拉数据
      retry: 1, // 重试次数
    },
    mutations: {
      retry: 0,
    },
  },
});
