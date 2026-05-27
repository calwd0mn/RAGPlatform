export interface ApiErrorPayload {
  message: string | string[];
  code?: string;
}

export interface ApiResponse<TData> {
  data: TData;
  message?: string;
}
