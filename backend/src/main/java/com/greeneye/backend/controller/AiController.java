package com.greeneye.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final UserRepository userRepository;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final String VISION_PROMPT = """
            대한민국 분리배출 관점에서 이미지의 주된 폐기물을 분류하라.
            첫 줄에는 아래 네 단어 중 정확히 하나만 출력하라: CAN, GENERAL, PET, HAZARD
            - CAN: 알루미늄·철 캔 등 금속 캔
            - GENERAL: 일반쓰레기(재활용·캔·페트에 해당하지 않는 경우)
            - PET: 페트병·플라스틱 병류(페트 위주)
            - HAZARD: 배터리, 스프레이캔, 유해·위험 폐기물로 보이는 경우
            둘째 줄부터는 한국어로 한 문장만 설명해도 된다.""";

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> analyzeMultipart(
            @RequestPart("image") MultipartFile image,
            @RequestPart("oauthId") String oauthId,
            @RequestPart(value = "userSelectedType", required = false) String userSelectedType
    ) throws Exception {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Gemini API key is not configured");
        }
        if (image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image is required");
        }
        String oid = oauthId == null ? "" : oauthId.trim();
        if (oid.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauthId is required");
        }

        User user = userRepository.findByOauthId(oid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        applyRateLimitOrThrow(user);

        String mime = Optional.ofNullable(image.getContentType()).filter(s -> !s.isBlank()).orElse("image/jpeg");
        String b64 = Base64.getEncoder().encodeToString(image.getBytes());

        Map<String, Object> inline = new LinkedHashMap<>();
        inline.put("mime_type", mime);
        inline.put("data", b64);

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", VISION_PROMPT));
        parts.add(Map.of("inline_data", inline));

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("parts", parts);

        Map<String, Object> reqBody = new LinkedHashMap<>();
        reqBody.put("contents", List.of(content));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="
                + geminiApiKey;

        String raw = webClientBuilder.build()
                .post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(reqBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini 응답이 비어 있습니다.");
        }

        JsonNode root = objectMapper.readTree(raw);
        String text = extractGeminiText(root);
        String predicted = normalizeTypeToken(text);

        commitCameraUsage(user);

        String normalizedUserPick = normalizeUserPick(userSelectedType);
        String finalType = normalizedUserPick != null ? normalizedUserPick : predicted;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("predictedType", predicted);
        result.put("userSelectedType", normalizedUserPick);
        result.put("finalType", finalType);
        result.put("model", "gemini-1.5-flash");
        result.put("rawSnippet", text != null && text.length() > 400 ? text.substring(0, 400) + "…" : text);
        result.put("cameraDailyCount", user.getCameraDailyCount());
        result.put("remainingToday", 10 - user.getCameraDailyCount());
        return result;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> analyzeJson(@RequestBody Map<String, String> body) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Gemini API key is not configured");
        }

        String oauthId = body.get("oauthId");
        if (oauthId == null || oauthId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauthId is required");
        }

        User user = userRepository.findByOauthId(oauthId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        applyRateLimitOrThrow(user);

        String hint = body.getOrDefault("hint", "").toLowerCase();
        String predictedType = "GENERAL";
        if (hint.contains("can") || hint.contains("캔")) {
            predictedType = "CAN";
        }
        if (hint.contains("pet") || hint.contains("plastic") || hint.contains("플라") || hint.contains("페트")) {
            predictedType = "PET";
        }
        if (hint.contains("hazard") || hint.contains("위험") || hint.contains("배터리")) {
            predictedType = "HAZARD";
        }

        commitCameraUsage(user);

        Map<String, Object> result = new HashMap<>();
        result.put("predictedType", predictedType);
        result.put("model", "hint-fallback");
        result.put("cameraDailyCount", user.getCameraDailyCount());
        result.put("remainingToday", 10 - user.getCameraDailyCount());
        return result;
    }

    private void applyRateLimitOrThrow(User user) {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        if (user.getCameraDailyDate() == null || !user.getCameraDailyDate().equals(today)) {
            user.setCameraDailyDate(today);
            user.setCameraDailyCount(0);
        }

        if (user.getLastCameraAt() != null) {
            long seconds = Duration.between(user.getLastCameraAt(), now).getSeconds();
            if (seconds < 60) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "촬영은 1분 간격으로 가능합니다.");
            }
        }

        if (user.getCameraDailyCount() >= 10) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "하루 촬영 한도(10회)를 초과했습니다.");
        }
    }

    private void commitCameraUsage(User user) {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        if (user.getCameraDailyDate() == null || !user.getCameraDailyDate().equals(today)) {
            user.setCameraDailyDate(today);
            user.setCameraDailyCount(0);
        }
        user.setCameraDailyCount(user.getCameraDailyCount() + 1);
        user.setLastCameraAt(now);
        userRepository.save(user);
    }

    private String extractGeminiText(JsonNode root) {
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return "";
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            return "";
        }
        JsonNode t = parts.get(0).path("text");
        return t.isMissingNode() ? "" : t.asText("");
    }

    private String normalizeTypeToken(String text) {
        if (text == null) {
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

    private String normalizeUserPick(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String u = raw.trim().toUpperCase(Locale.ROOT);
        return switch (u) {
            case "CAN", "GENERAL", "PET", "HAZARD" -> u;
            default -> null;
        };
    }
}
