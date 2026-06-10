package com.greeneye.backend.controller;

import com.greeneye.backend.entity.DisposalRecord;
import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.DisposalRecordRepository;
import com.greeneye.backend.repository.RewardHistoryRepository;
import com.greeneye.backend.repository.UserRepository;
import com.greeneye.backend.service.RewardMailService;
import com.greeneye.backend.service.TableIdCompactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final DisposalRecordRepository disposalRecordRepository;
    private final RewardHistoryRepository rewardHistoryRepository;
    private final RewardMailService rewardMailService;
    private final TableIdCompactionService tableIdCompactionService;

    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    /**
     * 지도 페이지로 들어올 때 1회만 +1 (유저별). 실제 배출 검증 10점은 CHECK(MQTT) 완료 시에만 {@link com.greeneye.backend.service.ModuleDisposalService}.
     */
    @PostMapping("/claim-map-entry-reward")
    @Transactional
    public Map<String, Object> claimMapEntryReward(@RequestBody Map<String, String> body) {
        String oauthId = body.get("oauthId");
        if (oauthId == null || oauthId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauthId is required");
        }
        User user = userRepository.findByOauthId(oauthId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (user.isMapEntryRewardClaimed()) {
            return Map.of(
                    "ok", true,
                    "reward", 0,
                    "alreadyClaimed", true,
                    "nowRewards", user.getNowRewards(),
                    "totalRewards", user.getTotalRewards()
            );
        }
        user.setMapEntryRewardClaimed(true);
        user.setNowRewards(user.getNowRewards() + 1);
        user.setTotalRewards(user.getTotalRewards() + 1);
        userRepository.save(user);
        return Map.of(
                "ok", true,
                "reward", 1,
                "alreadyClaimed", false,
                "nowRewards", user.getNowRewards(),
                "totalRewards", user.getTotalRewards()
        );
    }

    @PutMapping("/{id}")
    @Transactional
    public User updateUser(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (body.containsKey("nickname")) {
            Object v = body.get("nickname");
            if (v == null) {
                user.setNickname(null);
            } else if (v instanceof String s) {
                if (s.isBlank()) {
                    user.setNickname(null);
                } else {
                    String trimmed = s.trim();
                    userRepository.findByNickname(trimmed).ifPresent(other -> {
                        if (!other.getId().equals(id)) {
                            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다.");
                        }
                    });
                    user.setNickname(trimmed);
                }
            }
        }

        if (body.containsKey("role")) {
            Object v = body.get("role");
            if (v instanceof String s) {
                String r = s.trim().toUpperCase();
                if (!"USER".equals(r) && !"ADMIN".equals(r)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "role은 USER 또는 ADMIN 만 가능합니다.");
                }
                user.setRole(r);
            }
        }

        if (body.containsKey("status")) {
            Object v = body.get("status");
            if (v instanceof String s && !s.isBlank()) {
                user.setStatus(s.trim());
            }
        }

        if (body.containsKey("totalRewards")) {
            Object v = body.get("totalRewards");
            if (v instanceof Number n) {
                user.setTotalRewards(Math.max(0, n.intValue()));
            }
        }

        if (body.containsKey("nowRewards")) {
            Object v = body.get("nowRewards");
            if (v instanceof Number n) {
                user.setNowRewards(Math.max(0, n.intValue()));
            }
        }

        return userRepository.save(user);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<DisposalRecord> records = disposalRecordRepository.findByUser_IdOrderByCreatedAtDesc(user.getId());
        for (DisposalRecord dr : records) {
            rewardHistoryRepository.findByDisposalRecord(dr).ifPresent(rewardHistoryRepository::delete);
            disposalRecordRepository.delete(dr);
        }
        userRepository.delete(user);
        userRepository.flush();
        tableIdCompactionService.compactAllAfterDelete();
    }

    @PostMapping("/{id}/exchange")
    @Transactional
    public Map<String, Object> exchangeReward(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        int cost = parseInt(body.get("cost"), 0);
        if (cost <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cost must be positive");
        }
        if (user.getNowRewards() < cost) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "not enough rewards");
        }

        user.setNowRewards(user.getNowRewards() - cost);
        userRepository.save(user);

        String item = body.get("item") == null ? "" : body.get("item").toString().trim();
        Map<String, Object> mailInfo = rewardMailService.sendRewardExchangeMail(user, item, cost);
        return Map.of(
                "ok", true,
                "item", item,
                "cost", cost,
                "nowRewards", user.getNowRewards(),
                "sentTo", String.valueOf(mailInfo.getOrDefault("email", "")),
                "rewardCode", String.valueOf(mailInfo.getOrDefault("code", "")),
                "mailSent", Boolean.TRUE.equals(mailInfo.get("sent")),
                "mailMessage", String.valueOf(mailInfo.getOrDefault("message", "")),
                "mailReasonCode", String.valueOf(mailInfo.getOrDefault("reasonCode", "")),
                "mailReasonDetail", String.valueOf(mailInfo.getOrDefault("reasonDetail", ""))
        );
    }

    private static int parseInt(Object raw, int fallback) {
        if (raw == null) return fallback;
        if (raw instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(raw.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
