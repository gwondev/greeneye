package com.greeneye.backend.controller;

import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.UserRepository;
import com.greeneye.backend.service.GeminiVisionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final UserRepository userRepository;
    private final GeminiVisionService geminiVisionService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> analyzeMultipart(
            @RequestPart("image") MultipartFile image,
            @RequestPart("oauthId") String oauthId,
            @RequestPart(value = "userSelectedType", required = false) String userSelectedType
    ) {
        if (image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image is required");
        }
        String oid = oauthId == null ? "" : oauthId.trim();
        if (oid.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauthId is required");
        }

        log.info("analyze request oauthId={} imageBytes={} contentType={}", oid, image.getSize(), image.getContentType());

        User user = userRepository.findByOauthId(oid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        applyRateLimitOrThrow(user);

        GeminiVisionService.ClassificationResult classification;
        try {
            classification = geminiVisionService.classifyWaste(image.getBytes(), image.getContentType());
        } catch (ResponseStatusException e) {
            log.warn("analyze failed oauthId={} status={} reason={}", oid, e.getStatusCode().value(), e.getReason());
            throw e;
        }

        commitCameraUsage(user);

        String normalizedUserPick = normalizeUserPick(userSelectedType);
        String finalType = normalizedUserPick != null ? normalizedUserPick : classification.predictedType();
        String text = classification.rawText();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("predictedType", classification.predictedType());
        result.put("userSelectedType", normalizedUserPick);
        result.put("finalType", finalType);
        result.put("model", classification.model());
        result.put("rawSnippet", text != null && text.length() > 400 ? text.substring(0, 400) + "…" : text);
        result.put("cameraDailyCount", user.getCameraDailyCount());
        result.put("remainingToday", remainingTodayFor(user));
        result.put("rewardGranted", 1);
        result.put("nowRewards", user.getNowRewards());

        log.info(
                "analyze success oauthId={} predicted={} final={} model={}",
                oid,
                classification.predictedType(),
                finalType,
                classification.model()
        );
        return result;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> analyzeJson(@RequestBody Map<String, String> body) {
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
        result.put("remainingToday", remainingTodayFor(user));
        result.put("rewardGranted", 1);
        result.put("nowRewards", user.getNowRewards());
        return result;
    }

    private static boolean isAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    }

    /** ADMIN: 일일 한도 없음 → null (UI "-" 표시) */
    private static Integer remainingTodayFor(User user) {
        if (isAdmin(user)) {
            return null;
        }
        return 10 - user.getCameraDailyCount();
    }

    private void applyRateLimitOrThrow(User user) {
        if (isAdmin(user)) {
            return;
        }
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
        user.setNowRewards(user.getNowRewards() + 1);
        user.setTotalRewards(user.getTotalRewards() + 1);
        userRepository.save(user);
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
