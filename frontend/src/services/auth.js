import { apiFetch } from "./api";

const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "user";

export async function loginWithGoogleCredential(credential) {
  return apiFetch("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function saveAuth(loginResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, loginResponse.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user));
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}