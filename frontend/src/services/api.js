// npm run dev: .env.development 의 VITE_API_BASE_URL 이 있으면 배포 백엔드·DB와 동일한 서버로 직접 요청(브라우저→인터넷, 로컬 Docker 무관).
// VITE 가 없을 때만 상대경로 /api → vite 프록시 → 127.0.0.1:8080 (로컬 백엔드).
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://greeneye.gwon.run/api" : "/api");

function parseApiError(text, status) {
  if (!text) return `서버 에러: ${status}`;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return "서버 응답 시간이 초과되었거나 일시 장애입니다. 잠시 후 다시 시도해 주세요.";
  }
  try {
    const json = JSON.parse(text);
    if (typeof json.message === "string" && json.message) return json.message;
    if (typeof json.error === "string" && json.error) return json.error;
  } catch {
    // not JSON
  }
  if (text.length > 240) return `${text.substring(0, 240)}…`;
  return text;
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!response.ok) {
    throw new Error(parseApiError(text, response.status));
  }

  if (contentType.includes("text/html")) {
    throw new Error("API가 백엔드 대신 프론트(index.html)로 라우팅되었습니다.");
  }
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("서버 JSON 응답을 해석하지 못했습니다.");
    }
  }

  return text;
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  return readApiResponse(response);
}

/** multipart/form-data (이미지 업로드 등). Content-Type은 브라우저가 boundary 포함해 설정 */
export async function apiFetchMultipart(path, formData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  return readApiResponse(response);
}
