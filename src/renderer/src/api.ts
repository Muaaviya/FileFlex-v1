import type { TidyApi } from "../../shared/api";

declare global {
  interface Window {
    api: TidyApi;
  }
}

export const api: TidyApi = window.api;
