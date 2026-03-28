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
  if (loginResponse?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, loginResponse.accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (loginResponse?.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user));
  }
}

export function saveUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** `npm run dev`(Vite)일 때만: 로그인 강제 리다이렉트·관리자 가드 완화용 */
export function isDevBypass() {
  return import.meta.env.DEV === true;
}

/** 백엔드 `DevUserBootstrap` / `greeneye.dev-user.oauth-id` 와 동일해야 함 */
export const DEV_OAUTH_ID = "dev-local-greeneye";

/** 로컬 Vite dev: 저장된 사용자 없이도 Map 등에서 gwon / ADMIN 으로 취급 */
export function getEffectiveUser() {
  const u = getUser();
  if (u?.oauthId) return u;
  if (isDevBypass()) {
    return {
      oauthId: DEV_OAUTH_ID,
      nickname: "gwon",
      role: "ADMIN",
      status: "ACTIVE",
    };
  }
  return null;
}

/** 로그인 사용자 oauthId */
export function getEffectiveOauthId() {
  return getEffectiveUser()?.oauthId ?? null;
}

/** READY 등 닉네임 조회용 */
export function getEffectiveNickname() {
  return getEffectiveUser()?.nickname ?? null;
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}