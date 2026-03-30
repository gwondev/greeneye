package com.greeneye.backend.controller;

import com.greeneye.backend.entity.DisposalRecord;
import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.DisposalRecordRepository;
import com.greeneye.backend.repository.RewardHistoryRepository;
import com.greeneye.backend.repository.UserRepository;
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

    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
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
        return Map.of(
                "ok", true,
                "item", item,
                "cost", cost,
                "nowRewards", user.getNowRewards()
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
