import { getSupabaseAccessToken } from "./supabase/clients";

const BACKEND_URL = "http://141.11.123.151:3000";

export async function backendFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = await getSupabaseAccessToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });
}

