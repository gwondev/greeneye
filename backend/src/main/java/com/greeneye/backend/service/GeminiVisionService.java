package com.greeneye.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.greeneye.backend.util.ImagePrepareUtil;
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

    @Value("${gemini.api.model:gemini-3.5-flash}")
    private String geminiModel;

    @Value("${gemini.api.fallback-model:gemini-3.1-flash-lite}")
    private String fallbackModel;

    @Value("${gemini.api.timeout-seconds:55}")
    private int timeoutSeconds;

    @Value("${gemini.api.max-retries:1}")
    private int maxRetries;

    @Value("${gemini.api.max-image-side:1280}")
    private int maxImageSide;

    @Value("${gemini.api.jpeg-quality:0.82}")
    private float jpegQuality;

    private static final long TOTAL_DEADLINE_MS = 48_000L;

    public ClassificationResult classifyWaste(byte[] imageBytes, String contentType, boolean admin) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
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
        GeminiCallResult call = callGeminiWithRetry(prepared.bytes(), prepared.mimeType(), admin, modelsToTry);
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
        List<String> models = new ArrayList<>();
        models.add(geminiModel);
        if (fallbackModel != null && !fallbackModel.isBlank() && !models.contains(fallbackModel)) {
            models.add(fallbackModel);
        }
        return models;
    }

    private GeminiCallResult callGeminiWithRetry(byte[] imageBytes, String mime, boolean admin, List<String> models) {
        long deadlineAt = System.currentTimeMillis() + TOTAL_DEADLINE_MS;
        int attemptsPerModel = admin ? 1 : Math.max(0, maxRetries) + 1;
        ResponseStatusException last = null;

        for (String model : models) {
            for (int attempt = 1; attempt <= attemptsPerModel; attempt++) {
                if (System.currentTimeMillis() >= deadlineAt) {
                    throw new ResponseStatusException(
                            HttpStatus.GATEWAY_TIMEOUT,
                            "이미지 분석 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
                    );
                }
                try {
                    long remainingMs = Math.max(5_000L, deadlineAt - System.currentTimeMillis());
                    String raw = callGeminiOnce(imageBytes, mime, model, remainingMs);
                    return new GeminiCallResult(raw, model);
                } catch (ResponseStatusException e) {
                    last = e;
                    if (!isRetryable(e)) {
                        throw e;
                    }
                    log.warn(
                            "gemini retry admin={} model={} attempt={}/{} reason={}",
                            admin,
                            model,
                            attempt,
                            attemptsPerModel,
                            e.getReason()
                    );
                    if (attempt < attemptsPerModel) {
                        sleepQuietly(admin ? 500L : 1000L * attempt);
                    }
                }
            }
        }

        throw last != null ? last : new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Gemini 호출에 실패했습니다. 잠시 후 다시 시도해 주세요."
        );
    }

    private String callGeminiOnce(byte[] imageBytes, String mime, String model, long remainingMs) {
        long blockSeconds = Math.min(timeoutSeconds, Math.max(5L, remainingMs / 1000L));
        String b64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> inline = new LinkedHashMap<>();
        inline.put("mime_type", mime);
        inline.put("data", b64);

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", VISION_PROMPT));
        parts.add(Map.of("inline_data", inline));

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("parts", parts);

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", 0.1);
        generationConfig.put("maxOutputTokens", 64);
        if (model.startsWith("gemini-3")) {
            generationConfig.put("thinkingConfig", Map.of("thinkingLevel", "MINIMAL"));
        }

        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(content));
        reqBody.put("generationConfig", generationConfig);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + model
                + ":generateContent?key="
                + geminiApiKey;

        try {
            return geminiWebClient
                    .post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(reqBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(blockSeconds));
        } catch (WebClientResponseException e) {
            throw toGeminiException(e);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (msg.contains("Timeout") || msg.contains("timeout")) {
                throw new ResponseStatusException(
                        HttpStatus.GATEWAY_TIMEOUT,
                        "이미지 분석 응답 시간이 초과되었습니다. 사진 크기를 줄이거나 잠시 후 다시 시도해 주세요."
                );
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 호출 실패: " + msg);
        }
    }

    private ResponseStatusException toGeminiException(WebClientResponseException e) {
        int status = e.getStatusCode().value();
        String body = e.getResponseBodyAsString();
        String friendly = parseGeminiErrorMessage(body, status);
        log.warn("gemini api error http={} message={}", status, friendly);

        HttpStatus mapped = switch (status) {
            case 404 -> HttpStatus.SERVICE_UNAVAILABLE;
            case 408, 504 -> HttpStatus.GATEWAY_TIMEOUT;
            case 429 -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.SERVICE_UNAVAILABLE;
        };
        if (status == 404) {
            friendly = "Gemini 모델을 사용할 수 없습니다. 서버 설정(GEMINI_MODEL)을 확인해 주세요.";
        }
        return new ResponseStatusException(mapped, friendly);
    }

    private String parseGeminiErrorMessage(String body, int httpStatus) {
        if (body != null && !body.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(body);
                JsonNode err = root.path("error");
                String status = err.path("status").asText("");
                String message = err.path("message").asText("");
                if ("RESOURCE_EXHAUSTED".equalsIgnoreCase(status) || httpStatus == 429) {
                    return "Gemini API 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
                }
                if ("PERMISSION_DENIED".equalsIgnoreCase(status)) {
                    return "Gemini API 키가 거부되었습니다. 서버 설정을 확인해 주세요.";
                }
                if ("INVALID_ARGUMENT".equalsIgnoreCase(status)) {
                    return "이미지 형식이 올바르지 않습니다. 다른 사진으로 시도해 주세요.";
                }
                if (!message.isBlank()) {
                    return message.length() > 300 ? message.substring(0, 300) + "…" : message;
                }
            } catch (Exception ignored) {
                // fall through
            }
            if (body.length() > 300) {
                body = body.substring(0, 300) + "…";
            }
            return "Gemini API 오류 HTTP " + httpStatus + ": " + body;
        }
        return "Gemini API 오류 HTTP " + httpStatus;
    }

    private static boolean isRetryable(ResponseStatusException e) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        if (status == null) {
            return false;
        }
        String reason = e.getReason() != null ? e.getReason() : "";
        if (reason.contains("키가 거부")) {
            return false;
        }
        return status == HttpStatus.SERVICE_UNAVAILABLE
                || status == HttpStatus.GATEWAY_TIMEOUT;
    }

    private static void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

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

        JsonNode finishReason = candidates.get(0).path("finishReason");
        if ("SAFETY".equalsIgnoreCase(finishReason.asText(""))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "안전 정책으로 분석이 차단되었습니다.");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답 형식이 올바르지 않습니다.");
        }
        JsonNode t = parts.get(0).path("text");
        return t.isMissingNode() ? "" : t.asText("");
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

    private record GeminiCallResult(String raw, String model) {
    }

    public record ClassificationResult(String predictedType, String model, String rawText) {
    }
}
