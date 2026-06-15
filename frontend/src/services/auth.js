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
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * dev 우회는 기본 비활성화.
 * 정말 필요할 때만 VITE_ALLOW_DEV_BYPASS=true 로 켠다.
 */
export function isDevBypass() {
  return import.meta.env.DEV === true && String(import.meta.env.VITE_ALLOW_DEV_BYPASS || "").toLowerCase() === "true";
}

/** 백엔드 DevUserBootstrap oauth-id와 동일 */
export const DEV_OAUTH_ID = "dev-local-greeneye";

export function isAuthenticated() {
  const u = getUser();
  return Boolean(u?.oauthId);
}

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

export function getEffectiveOauthId() {
  return getEffectiveUser()?.oauthId ?? null;
}

export function getEffectiveNickname() {
  return getEffectiveUser()?.nickname ?? null;
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function mergeUserFromServer(cached, serverUser) {
  const oauthId = serverUser?.oauthId ?? cached?.oauthId;
  return { ...cached, ...serverUser, oauthId };
}

function isUserNotFoundError(error) {
  const msg = String(error?.message || "");
  return msg.includes("User not found") || msg.includes("404");
}

/**
 * localStorage 세션을 DB와 맞춤.
 * - deleted: DB에 없음 → clearAuth
 * - needs_nickname: oauthId는 있으나 닉네임 미설정
 * - ok: 정상
 * - offline: 네트워크 오류 등 → 캐시 유지
 */
export async function ensureSession() {
  const cached = getUser();
  if (!cached?.oauthId) {
    return { status: "unauthenticated" };
  }

  try {
    const res = await apiFetch(`/auth/session?oauthId=${encodeURIComponent(cached.oauthId)}`);
    const user = mergeUserFromServer(cached, res?.user);
    saveUser(user);
    if (res?.isNewUser) {
      return { status: "needs_nickname", user };
    }
    return { status: "ok", user };
  } catch (error) {
    if (isUserNotFoundError(error)) {
      clearAuth();
      return { status: "deleted" };
    }
    return { status: "offline", user: cached };
  }
}
