import { api, API_CONFIGURED } from "./client";
import { getAccessToken } from "./storage";

export async function fetchDashboard(): Promise<any> {
  if (!API_CONFIGURED || !getAccessToken()) return null;
  try {
    return await api<any>("/api/dashboard");
  } catch {
    return null;
  }
}
