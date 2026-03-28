// npm run dev: .env.development 의 VITE_API_BASE_URL 이 있으면 배포 백엔드·DB와 동일한 서버로 직접 요청(브라우저→인터넷, 로컬 Docker 무관).
// VITE 가 없을 때만 상대경로 /api → vite 프록시 → 127.0.0.1:8080 (로컬 백엔드).
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://greeneye.gwon.run/api" : "/api");

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `서버 에러: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("API가 백엔드 대신 프론트(index.html)로 라우팅되었습니다.");
  }
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

/** multipart/form-data (이미지 업로드 등). Content-Type은 브라우저가 boundary 포함해 설정 */
export async function apiFetchMultipart(path, formData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `서버 에러: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("API가 백엔드 대신 프론트(index.html)로 라우팅되었습니다.");
  }
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}