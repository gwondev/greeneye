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

    @Value("${gemini.api.model:gemini-2.0-flash}")
    private String geminiModel;

    @Value("${gemini.api.timeout-seconds:55}")
    private int timeoutSeconds;

    @Value("${gemini.api.max-retries:1}")
    private int maxRetries;

    @Value("${gemini.api.max-image-side:1280}")
    private int maxImageSide;

    @Value("${gemini.api.jpeg-quality:0.82}")
    private float jpegQuality;

    public ClassificationResult classifyWaste(byte[] imageBytes, String contentType) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Gemini API key is not configured");
        }

        ImagePrepareUtil.PreparedImage prepared =
                ImagePrepareUtil.prepare(imageBytes, contentType, maxImageSide, jpegQuality);
        log.info(
                "gemini classify start model={} originalBytes={} preparedBytes={} mime={}",
                geminiModel,
                prepared.originalBytes(),
                prepared.preparedBytes(),
                prepared.mimeType()
        );

        long started = System.currentTimeMillis();
        String raw = callGeminiWithRetry(prepared.bytes(), prepared.mimeType());
        long elapsedMs = System.currentTimeMillis() - started;
        log.info("gemini classify done model={} elapsedMs={}", geminiModel, elapsedMs);

        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답이 비어 있습니다.");
        }

        try {
            JsonNode root = objectMapper.readTree(raw);
            String text = extractGeminiText(root);
            String predicted = normalizeTypeToken(text);
            return new ClassificationResult(predicted, geminiModel, text);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("gemini response parse failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답 파싱 실패: " + e.getMessage());
        }
    }

    private String callGeminiWithRetry(byte[] imageBytes, String mime) {
        int attempts = Math.max(0, maxRetries) + 1;
        RuntimeException last = null;

        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                return callGeminiOnce(imageBytes, mime);
            } catch (ResponseStatusException e) {
                last = e;
                if (attempt < attempts && isRetryable(e)) {
                    log.warn("gemini retry attempt={}/{} reason={}", attempt, attempts, e.getReason());
                    sleepQuietly(1500L * attempt);
                    continue;
                }
                throw e;
            } catch (RuntimeException e) {
                last = e;
                if (attempt < attempts) {
                    log.warn("gemini retry attempt={}/{} error={}", attempt, attempts, e.getMessage());
                    sleepQuietly(1500L * attempt);
                    continue;
                }
                throw e;
            }
        }

        throw last != null ? last : new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 호출 실패");
    }

    private String callGeminiOnce(byte[] imageBytes, String mime) {
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

        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(content));
        reqBody.put("generationConfig", generationConfig);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel
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
                    .block(Duration.ofSeconds(timeoutSeconds));
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
            case 429 -> HttpStatus.TOO_MANY_REQUESTS;
            case 408, 504 -> HttpStatus.GATEWAY_TIMEOUT;
            default -> HttpStatus.BAD_GATEWAY;
        };
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
        return status == HttpStatus.TOO_MANY_REQUESTS
                || status == HttpStatus.BAD_GATEWAY
                || status == HttpStatus.SERVICE_UNAVAILABLE
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

    public record ClassificationResult(String predictedType, String model, String rawText) {
    }
}
