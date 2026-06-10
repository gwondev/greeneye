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

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiVisionService {

    private static final String VISION_PROMPT = """
            대한민국 분리배출 관점에서 이미지의 주된 폐기물을 분류하라.
            첫 줄에는 아래 네 단어 중 정확히 하나만 출력하라: CAN, GENERAL, PET, HAZARD
            - CAN: 알루미늄·철 캔 등 금속 캔
            - GENERAL: 일반쓰레기(재활용·캔·페트에 해당하지 않는 경우)
            - PET: 페트병·플라스틱 병류(페트 위주)
            - HAZARD: 배터리, 스프레이캔, 유해·위험 폐기물로 보이는 경우
            둘째 줄부터는 한국어로 한 문장만 설명해도 된다.""";

    private final WebClient geminiWebClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.models:}")
    private String modelsCsv;

    @Value("${gemini.api.model:gemini-3-flash-preview}")
    private String geminiModel;

    @Value("${gemini.api.fallback-model:gemini-2.5-flash}")
    private String fallbackModel;

    @Value("${gemini.api.timeout-seconds:45}")
    private int timeoutSeconds;

    @Value("${gemini.api.max-image-side:960}")
    private int maxImageSide;

    @Value("${gemini.api.jpeg-quality:0.8}")
    private float jpegQuality;

    private static final long TOTAL_DEADLINE_MS = 48_000L;

    @PostConstruct
    void logGeminiConfig() {
        log.info("gemini configured keyPresent={} models={}", isKeyPresent(), modelsFor());
    }

    public boolean isKeyPresent() {
        return geminiApiKey != null && !geminiApiKey.isBlank();
    }

    /** 배포 검증용 — 키 전체 노출 없이 마지막 4자만 */
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

    /** 서버에서 모델별 연결 테스트 (관리용) */
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
                "gemini classify start admin={} models={} originalBytes={} preparedBytes={} mime={}",
                admin,
                modelsToTry,
                prepared.originalBytes(),
                prepared.preparedBytes(),
                prepared.mimeType()
        );

        long started = System.currentTimeMillis();
        GeminiCallResult call = callModelsInOrder(prepared.bytes(), prepared.mimeType(), modelsToTry);
        long elapsedMs = System.currentTimeMillis() - started;
        log.info("gemini classify done model={} elapsedMs={}", call.model(), elapsedMs);

        if (call.raw() == null || call.raw().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답이 비어 있습니다.");
        }

        try {
            JsonNode root = objectMapper.readTree(call.raw());
            String text = extractGeminiText(root);
            String predicted = normalizeTypeToken(text);
            return new ClassificationResult(predicted, call.model(), text);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("gemini response parse failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답 파싱 실패: " + e.getMessage());
        }
    }

    private List<String> modelsFor() {
        if (modelsCsv != null && !modelsCsv.isBlank()) {
            return parseCsv(modelsCsv);
        }
        List<String> models = new ArrayList<>();
        if (geminiModel != null && !geminiModel.isBlank()) {
            models.add(geminiModel.trim());
        }
        if (fallbackModel != null && !fallbackModel.isBlank()) {
            String fb = fallbackModel.trim();
            if (!models.contains(fb)) {
                models.add(fb);
            }
        }
        if (!models.contains("gemini-2.5-flash-lite")) {
            models.add("gemini-2.5-flash-lite");
        }
        return models;
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

    private GeminiCallResult callModelsInOrder(byte[] imageBytes, String mime, List<String> models) {
        long deadlineAt = System.currentTimeMillis() + TOTAL_DEADLINE_MS;
        List<String> failures = new ArrayList<>();

        for (String model : models) {
            if (System.currentTimeMillis() >= deadlineAt) {
                throw new ResponseStatusException(
                        HttpStatus.GATEWAY_TIMEOUT,
                        "이미지 분석 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
                );
            }
            try {
                long remainingMs = Math.max(5_000L, deadlineAt - System.currentTimeMillis());
                String raw = callVision(model, imageBytes, mime, remainingMs);
                return new GeminiCallResult(raw, model);
            } catch (ResponseStatusException e) {
                String reason = e.getReason() != null ? e.getReason() : e.getStatusCode().toString();
                failures.add(model + ": " + reason);
                log.warn("gemini model failed model={} status={} reason={}", model, e.getStatusCode().value(), reason);
            }
        }

        throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                buildFinalErrorMessage(models, failures)
        );
    }

    private String callTextOnly(String model, String prompt) {
        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
        reqBody.put("generationConfig", Map.of("maxOutputTokens", 16, "temperature", 0));
        return postGenerateContent(model, reqBody, 15);
    }

    private String callVision(String model, byte[] imageBytes, String mime, long remainingMs) {
        long blockSeconds = Math.min(timeoutSeconds, Math.max(5L, remainingMs / 1000L));
        String b64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> inline = new LinkedHashMap<>();
        inline.put("mime_type", mime);
        inline.put("data", b64);

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", VISION_PROMPT));
        parts.add(Map.of("inline_data", inline));

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", 0.1);
        generationConfig.put("maxOutputTokens", 64);

        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(Map.of("parts", parts)));
        reqBody.put("generationConfig", generationConfig);

        return postGenerateContent(model, reqBody, blockSeconds);
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
                throw new ResponseStatusException(
                        HttpStatus.GATEWAY_TIMEOUT,
                        "Gemini 응답 시간 초과 (" + model + ")"
                );
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 호출 실패 (" + model + "): " + msg);
        }
    }

    private static String buildFinalErrorMessage(List<String> models, List<String> failures) {
        String detail = String.join(" | ", failures);
        String billing = billingDepletedMessage(detail);
        if (billing != null) {
            return billing;
        }
        if (detail.contains("RESOURCE_EXHAUSTED") || detail.contains("429")) {
            return "Gemini API 호출 한도에 도달했습니다. 잠시 후 다시 시도하거나 AI Studio 결제 설정을 확인해 주세요.";
        }
        if (detail.contains("PERMISSION_DENIED")) {
            return "Gemini API 키가 거부되었습니다. 서버 GEMINI_API_KEY를 확인해 주세요.";
        }
        return "Gemini 분석 실패. 시도: " + String.join(" → ", models) + ". " + detail;
    }

    private static String billingDepletedMessage(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("prepayment credits are depleted")) {
            return "Gemini API 결제 문제입니다. 후불(GCP)과 AI Studio 선불(Prepay) 크레딧은 별도입니다. "
                    + "Cloud Console에 돈이 있어도 AI Studio 프로젝트에 'No available credits'면 API가 거부됩니다. "
                    + "AI Studio → 해당 API 키의 프로젝트 → Billing에서 Prepay 충전 또는 "
                    + "크레딧 있는 프로젝트에서 새 API 키 발급 후 GEMINI_API_KEY 교체.";
        }
        return null;
    }

    private ResponseStatusException toGeminiException(String model, WebClientResponseException e) {
        int status = e.getStatusCode().value();
        String body = e.getResponseBodyAsString();
        GeminiError parsed = parseGeminiError(body, status);
        log.warn(
                "gemini api error model={} http={} apiStatus={} message={}",
                model,
                status,
                parsed.apiStatus(),
                parsed.message()
        );

        HttpStatus mapped = switch (status) {
            case 408, 504 -> HttpStatus.GATEWAY_TIMEOUT;
            default -> HttpStatus.SERVICE_UNAVAILABLE;
        };
        return new ResponseStatusException(mapped, parsed.message());
    }

    private GeminiError parseGeminiError(String body, int httpStatus) {
        if (body != null && !body.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(body);
                JsonNode err = root.path("error");
                String apiStatus = err.path("status").asText("");
                String message = err.path("message").asText("");

                if ("PERMISSION_DENIED".equalsIgnoreCase(apiStatus)) {
                    return new GeminiError(apiStatus, "Gemini API 키가 거부되었습니다.");
                }
                if ("NOT_FOUND".equalsIgnoreCase(apiStatus) || httpStatus == 404) {
                    return new GeminiError(apiStatus, "모델 없음: " + message);
                }
                if ("RESOURCE_EXHAUSTED".equalsIgnoreCase(apiStatus) || httpStatus == 429) {
                    String billing = billingDepletedMessage(message);
                    if (billing != null) {
                        return new GeminiError(apiStatus, billing);
                    }
                    return new GeminiError(apiStatus, "RESOURCE_EXHAUSTED: " + message);
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

    /** thinking 모델은 parts[0]이 추론(thought)일 수 있음 → thought 아닌 마지막 text 사용 */
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
        JsonNode finishReason = candidate.path("finishReason");
        if ("SAFETY".equalsIgnoreCase(finishReason.asText(""))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "안전 정책으로 분석이 차단되었습니다.");
        }

        JsonNode parts = candidate.path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답 형식이 올바르지 않습니다.");
        }

        String lastNonThought = "";
        String anyText = "";
        for (JsonNode part : parts) {
            if (part.path("text").isMissingNode()) {
                continue;
            }
            String text = part.path("text").asText("").trim();
            if (text.isEmpty()) {
                continue;
            }
            anyText = text;
            if (!part.path("thought").asBoolean(false)) {
                lastNonThought = text;
            }
        }

        if (!lastNonThought.isBlank()) {
            return lastNonThought;
        }
        if (!anyText.isBlank()) {
            return anyText;
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 텍스트 응답이 비어 있습니다.");
    }

    private String normalizeTypeToken(String text) {
        if (text == null || text.isBlank()) {
            return "GENERAL";
        }
        String firstLine = text.trim().split("\\R", 2)[0].trim().toUpperCase(Locale.ROOT);
        if (firstLine.contains("HAZARD")) {
            return "HAZARD";
        }
        if (firstLine.contains("PET")) {
            return "PET";
        }
        if (firstLine.contains("CAN")) {
            return "CAN";
        }
        if (firstLine.contains("GENERAL")) {
            return "GENERAL";
        }
        return "GENERAL";
    }

    private static String summarize(String text, int max) {
        if (text == null) {
            return "";
        }
        String t = text.replaceAll("\\s+", " ").trim();
        return t.length() > max ? t.substring(0, max) + "…" : t;
    }

    private record GeminiError(String apiStatus, String message) {
    }

    private record GeminiCallResult(String raw, String model) {
    }

    public record ClassificationResult(String predictedType, String model, String rawText) {
    }
}
