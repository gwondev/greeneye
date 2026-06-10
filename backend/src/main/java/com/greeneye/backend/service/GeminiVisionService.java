package com.greeneye.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.greeneye.backend.util.ImagePrepareUtil;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiVisionService {

    private static final int MIN_GUIDANCE_CHARS = 25;
    private static final long TOTAL_DEADLINE_MS = 22_000L;

    /** 심층 추론·preview·thinking 모델 제외 — 분류+안내용 빠른 정식 모델만 */
    private static final List<String> DEFAULT_VISION_MODELS = List.of(
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite"
    );

    private static final Set<String> BLOCKED_MODEL_HINTS = Set.of(
            "preview", "pro", "thinking", "live", "tts", "image", "veo", "lyria",
            "robotics", "embedding", "deep-research", "exp", "lite-preview"
    );

    private static final String VISION_PROMPT = """
            대한민국 분리배출 관점에서 이미지의 주된 폐기물을 분류하고 배출 안내를 작성하라.

            [출력 형식 — 아래 3줄을 반드시 모두 출력]
            1줄: 분류 코드 하나만 — CAN, GENERAL, PET, HAZARD
            2줄: 인식: (물품명. 브랜드가 보이면 함께)
            3줄: 안내: (배출 방법 2~4문장. 라벨·뚜껑이 보이면 구체적으로)

            [규칙]
            - 마크다운·굵게(**)·목록 기호 금지. 평문만.
            - PET: 내용물 비우기·헹굼. 라벨 있으면 제거. 뚜껑 분리 가능 시 분리 배출.
            - CAN: 내용물 비우기·헹굼. 라벨·뚜껑 분리 안내.
            - GENERAL·HAZARD: 해당 분류 주의 안내.""";

    private final WebClient geminiWebClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.models:}")
    private String modelsCsv;

    @Value("${gemini.api.timeout-seconds:18}")
    private int timeoutSeconds;

    @Value("${gemini.api.max-image-side:960}")
    private int maxImageSide;

    @Value("${gemini.api.jpeg-quality:0.8}")
    private float jpegQuality;

    @PostConstruct
    void logGeminiConfig() {
        log.info("gemini configured keyPresent={} models={}", isKeyPresent(), modelsFor());
    }

    public boolean isKeyPresent() {
        return geminiApiKey != null && !geminiApiKey.isBlank();
    }

    public String keySuffix() {
        if (!isKeyPresent()) {
            return null;
        }
        String k = geminiApiKey.trim();
        return k.length() <= 4 ? "****" : "..." + k.substring(k.length() - 4);
    }

    public List<String> configuredModels() {
        return modelsFor();
    }

    public List<Map<String, Object>> probeModels() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String model : modelsFor()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("model", model);
            if (!isKeyPresent()) {
                row.put("ok", false);
                row.put("error", "GEMINI_API_KEY not configured");
                rows.add(row);
                continue;
            }
            try {
                String raw = callTextOnly(model, "Reply with exactly: OK");
                row.put("ok", true);
                row.put("snippet", summarize(raw, 80));
            } catch (ResponseStatusException e) {
                row.put("ok", false);
                row.put("error", e.getReason());
            } catch (Exception e) {
                row.put("ok", false);
                row.put("error", e.getMessage());
            }
            rows.add(row);
        }
        return rows;
    }

    public ClassificationResult classifyWaste(byte[] imageBytes, String contentType, boolean admin) {
        if (!isKeyPresent()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Gemini API key is not configured");
        }

        ImagePrepareUtil.PreparedImage prepared =
                ImagePrepareUtil.prepare(imageBytes, contentType, maxImageSide, jpegQuality);

        List<String> modelsToTry = modelsFor();
        log.info(
                "gemini classify start admin={} models={} preparedBytes={}",
                admin,
                modelsToTry,
                prepared.preparedBytes()
        );

        long started = System.currentTimeMillis();
        List<String> failures = new ArrayList<>();

        for (String model : modelsToTry) {
            if (System.currentTimeMillis() - started >= TOTAL_DEADLINE_MS) {
                break;
            }
            try {
                long remainingMs = Math.max(4_000L, TOTAL_DEADLINE_MS - (System.currentTimeMillis() - started));
                ClassificationResult result = tryClassifyOnce(model, prepared.bytes(), prepared.mimeType(), remainingMs);
                if (result != null) {
                    log.info(
                            "gemini classify ok model={} elapsedMs={} guidanceLen={}",
                            model,
                            System.currentTimeMillis() - started,
                            result.guidance().length()
                    );
                    return result;
                }
                failures.add(model + ": truncated or incomplete response");
            } catch (ResponseStatusException e) {
                String reason = e.getReason() != null ? e.getReason() : e.getStatusCode().toString();
                failures.add(model + ": " + reason);
                log.warn("gemini model failed model={} reason={}", model, reason);
            }
        }

        throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                buildFinalErrorMessage(modelsToTry, failures)
        );
    }

    private ClassificationResult tryClassifyOnce(String model, byte[] imageBytes, String mime, long remainingMs) {
        String raw = callVision(model, imageBytes, mime, remainingMs);
        JsonNode root;
        try {
            root = objectMapper.readTree(raw);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini JSON 파싱 실패");
        }

        String finishReason = root.path("candidates").path(0).path("finishReason").asText("");
        if ("MAX_TOKENS".equalsIgnoreCase(finishReason)) {
            log.warn("gemini truncated MAX_TOKENS model={}", model);
            return null;
        }

        String text = extractGeminiText(root);
        ParsedVision parsed = parseVisionText(text);

        if (!isGuidanceAcceptable(parsed.guidance())) {
            log.warn(
                    "gemini short guidance model={} finish={} raw={}",
                    model,
                    finishReason,
                    summarize(text, 120)
            );
            return null;
        }

        return new ClassificationResult(
                parsed.predictedType(),
                model,
                text,
                parsed.recognizedItem(),
                parsed.guidance()
        );
    }

    private List<String> modelsFor() {
        List<String> configured = new ArrayList<>();
        if (modelsCsv != null && !modelsCsv.isBlank()) {
            configured.addAll(parseCsv(modelsCsv));
        }
        if (configured.isEmpty()) {
            configured.addAll(DEFAULT_VISION_MODELS);
        }
        return filterVisionModels(configured);
    }

    private static List<String> filterVisionModels(List<String> models) {
        List<String> out = new ArrayList<>();
        for (String model : models) {
            if (model == null || model.isBlank()) {
                continue;
            }
            String m = model.trim().toLowerCase(Locale.ROOT);
            boolean blocked = BLOCKED_MODEL_HINTS.stream().anyMatch(m::contains);
            if (blocked) {
                continue;
            }
            if (!out.contains(model.trim())) {
                out.add(model.trim());
            }
        }
        if (out.isEmpty()) {
            return new ArrayList<>(DEFAULT_VISION_MODELS);
        }
        return out;
    }

    private static List<String> parseCsv(String csv) {
        List<String> out = new ArrayList<>();
        for (String part : csv.split(",")) {
            String m = part.trim();
            if (!m.isEmpty() && !out.contains(m)) {
                out.add(m);
            }
        }
        return out;
    }

    private String callTextOnly(String model, String prompt) {
        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
        reqBody.put("generationConfig", visionGenerationConfig());
        return postGenerateContent(model, reqBody, 12);
    }

    private String callVision(String model, byte[] imageBytes, String mime, long remainingMs) {
        long blockSeconds = Math.min(timeoutSeconds, Math.max(4L, remainingMs / 1000L));
        String b64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> inline = new LinkedHashMap<>();
        inline.put("mime_type", mime);
        inline.put("data", b64);

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", VISION_PROMPT));
        parts.add(Map.of("inline_data", inline));

        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(Map.of("parts", parts)));
        reqBody.put("generationConfig", visionGenerationConfig());

        try {
            return postGenerateContent(model, reqBody, blockSeconds);
        } catch (ResponseStatusException e) {
            if (isThinkingConfigRejected(e)) {
                reqBody.put("generationConfig", visionGenerationConfigWithoutThinking());
                return postGenerateContent(model, reqBody, blockSeconds);
            }
            throw e;
        }
    }

    private static boolean isThinkingConfigRejected(ResponseStatusException e) {
        String reason = e.getReason() != null ? e.getReason().toLowerCase(Locale.ROOT) : "";
        return reason.contains("thinking") || reason.contains("invalid_argument");
    }

    /** thinking 비활성 — 출력 토큰을 실제 답변에만 사용 */
    private static Map<String, Object> visionGenerationConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.1);
        config.put("maxOutputTokens", 384);
        config.put("thinkingConfig", Map.of("thinkingBudget", 0));
        return config;
    }

    private static Map<String, Object> visionGenerationConfigWithoutThinking() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.1);
        config.put("maxOutputTokens", 384);
        return config;
    }

    private String postGenerateContent(String model, Map<String, Object> reqBody, long blockSeconds) {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + model
                + ":generateContent";

        try {
            return geminiWebClient
                    .post()
                    .uri(url)
                    .header("x-goog-api-key", geminiApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(reqBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(blockSeconds));
        } catch (WebClientResponseException e) {
            throw toGeminiException(model, e);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (msg.contains("Timeout") || msg.contains("timeout")) {
                throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Gemini 응답 시간 초과 (" + model + ")");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 호출 실패 (" + model + "): " + msg);
        }
    }

    private static boolean isGuidanceAcceptable(String guidance) {
        if (guidance == null || guidance.isBlank()) {
            return false;
        }
        String g = guidance.trim();
        if (g.length() < MIN_GUIDANCE_CHARS) {
            return false;
        }
        return g.contains("배출") || g.contains("비우") || g.contains("헹") || g.contains("분리")
                || g.contains("제거") || g.contains("떼");
    }

    private static String buildFinalErrorMessage(List<String> models, List<String> failures) {
        String detail = String.join(" | ", failures);
        String billing = billingDepletedMessage(detail);
        if (billing != null) {
            return billing;
        }
        if (detail.contains("RESOURCE_EXHAUSTED") || detail.contains("429")) {
            return "Gemini API 호출 한도에 도달했습니다. AI Studio 결제 설정을 확인해 주세요.";
        }
        return "Gemini 분석 실패. 시도: " + String.join(" → ", models) + ". " + detail;
    }

    private static String billingDepletedMessage(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        if (text.toLowerCase(Locale.ROOT).contains("prepayment credits are depleted")) {
            return "Gemini 선불 크레딧이 소진되었습니다. AI Studio Billing에서 충전하거나 API 키를 갱신해 주세요.";
        }
        return null;
    }

    private ResponseStatusException toGeminiException(String model, WebClientResponseException e) {
        int status = e.getStatusCode().value();
        GeminiError parsed = parseGeminiError(e.getResponseBodyAsString(), status);
        log.warn("gemini api error model={} http={} msg={}", model, status, parsed.message());
        HttpStatus mapped = (status == 408 || status == 504) ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE;
        return new ResponseStatusException(mapped, parsed.message());
    }

    private GeminiError parseGeminiError(String body, int httpStatus) {
        if (body != null && !body.isBlank()) {
            try {
                JsonNode err = objectMapper.readTree(body).path("error");
                String apiStatus = err.path("status").asText("");
                String message = err.path("message").asText("");
                if ("PERMISSION_DENIED".equalsIgnoreCase(apiStatus)) {
                    return new GeminiError(apiStatus, "Gemini API 키가 거부되었습니다.");
                }
                if ("RESOURCE_EXHAUSTED".equalsIgnoreCase(apiStatus) || httpStatus == 429) {
                    String billing = billingDepletedMessage(message);
                    return new GeminiError(apiStatus, billing != null ? billing : "RESOURCE_EXHAUSTED: " + message);
                }
                if (!message.isBlank()) {
                    return new GeminiError(apiStatus, message.length() > 280 ? message.substring(0, 280) + "…" : message);
                }
            } catch (Exception ignored) {
                // fall through
            }
        }
        return new GeminiError("", "Gemini HTTP " + httpStatus);
    }

    /** non-thought 파트 전체를 합침 (thinking 모델 잘림 방지) */
    private String extractGeminiText(JsonNode root) {
        JsonNode blockReason = root.path("promptFeedback").path("blockReason");
        if (!blockReason.isMissingNode() && !blockReason.asText("").isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "이미지를 분석할 수 없습니다: " + blockReason.asText()
            );
        }

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini가 분류 결과를 반환하지 않았습니다.");
        }

        JsonNode candidate = candidates.get(0);
        if ("SAFETY".equalsIgnoreCase(candidate.path("finishReason").asText(""))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "안전 정책으로 분석이 차단되었습니다.");
        }

        JsonNode parts = candidate.path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답 형식이 올바르지 않습니다.");
        }

        StringBuilder answer = new StringBuilder();
        StringBuilder fallback = new StringBuilder();
        for (JsonNode part : parts) {
            if (part.path("text").isMissingNode()) {
                continue;
            }
            String text = part.path("text").asText("").trim();
            if (text.isEmpty()) {
                continue;
            }
            if (fallback.length() > 0) {
                fallback.append("\n");
            }
            fallback.append(text);

            if (!part.path("thought").asBoolean(false)) {
                if (answer.length() > 0) {
                    answer.append("\n");
                }
                answer.append(text);
            }
        }

        if (answer.length() > 0) {
            return answer.toString();
        }
        if (fallback.length() > 0) {
            return fallback.toString();
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 텍스트 응답이 비어 있습니다.");
    }

    private ParsedVision parseVisionText(String text) {
        if (text == null || text.isBlank()) {
            return new ParsedVision("GENERAL", "", defaultGuidance("GENERAL", ""));
        }

        String[] lines = text.trim().split("\\R");
        String predicted = normalizeTypeToken(lines[0]);
        String recognizedItem = "";
        StringBuilder guidance = new StringBuilder();

        for (int i = 1; i < lines.length; i++) {
            String line = stripMarkdown(lines[i]).trim();
            if (line.isEmpty()) {
                continue;
            }
            if (recognizedItem.isEmpty() && line.startsWith("인식:")) {
                recognizedItem = line.substring("인식:".length()).trim();
                continue;
            }
            if (line.startsWith("안내:")) {
                appendGuidance(guidance, line.substring("안내:".length()).trim());
                continue;
            }
            if (recognizedItem.isEmpty() && i == 1 && !looksLikeTypeToken(line)) {
                recognizedItem = line;
                continue;
            }
            appendGuidance(guidance, line);
        }

        String guidanceText = guidance.toString();
        if (!isGuidanceAcceptable(guidanceText)) {
            guidanceText = defaultGuidance(predicted, recognizedItem);
        }
        return new ParsedVision(predicted, recognizedItem, guidanceText);
    }

    private static void appendGuidance(StringBuilder guidance, String line) {
        if (line == null || line.isBlank()) {
            return;
        }
        if (guidance.length() > 0) {
            guidance.append("\n");
        }
        guidance.append(line);
    }

    private static String defaultGuidance(String type, String recognizedItem) {
        String item = recognizedItem == null ? "" : recognizedItem.trim();
        String subject = item.isBlank() ? "이 품목은" : item + "은(는)";
        return switch (type) {
            case "CAN" -> subject + " 내용물을 완전히 비우고 가볍게 헹군 뒤 배출하세요. "
                    + "라벨이 붙어 있으면 떼어 내고, 플라스틱 뚜껑이면 분리하여 배출하세요.";
            case "PET" -> subject + " 내용물을 비우고 라벨을 떼어 낸 뒤 가볍게 헹구세요. "
                    + "뚜껑과 몸통 재질이 다르면 분리하여 배출하세요.";
            case "HAZARD" -> subject + " 일반 쓰레기와 섞지 말고 지정된 위험물·대형폐기물 수거함에 배출하세요.";
            default -> subject + " 해당 지역의 분리배출 기준에 맞게 배출하세요.";
        };
    }

    private static boolean looksLikeTypeToken(String line) {
        String u = line.trim().toUpperCase(Locale.ROOT);
        return u.equals("CAN") || u.equals("GENERAL") || u.equals("PET") || u.equals("HAZARD");
    }

    private static String stripMarkdown(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("**", "").replace("__", "").replaceAll("^#+\\s*", "").trim();
    }

    private String normalizeTypeToken(String text) {
        if (text == null || text.isBlank()) {
            return "GENERAL";
        }
        String firstLine = stripMarkdown(text.trim().split("\\R", 2)[0]).trim().toUpperCase(Locale.ROOT);
        if (firstLine.contains("HAZARD")) return "HAZARD";
        if (firstLine.contains("PET")) return "PET";
        if (firstLine.contains("CAN")) return "CAN";
        if (firstLine.contains("GENERAL")) return "GENERAL";
        return "GENERAL";
    }

    private static String summarize(String text, int max) {
        if (text == null) return "";
        String t = text.replaceAll("\\s+", " ").trim();
        return t.length() > max ? t.substring(0, max) + "…" : t;
    }

    private record GeminiError(String apiStatus, String message) {}

    public record ClassificationResult(
            String predictedType,
            String model,
            String rawText,
            String recognizedItem,
            String guidance
    ) {}
}
