package com.greeneye.backend.controller;

import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository userRepository;

    @Value("${google.client.id}")
    private String googleClientId;

    @PostMapping("/google")
    public Map<String, Object> googleLogin(@RequestBody Map<String, String> body) throws Exception {
        String token = body.get("credential");
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google credential is required");
        }
        
        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(Collections.singletonList(googleClientId))
                .build();

        GoogleIdToken idToken = verifier.verify(token);
        if (idToken == null) throw new RuntimeException("Invalid Google Token");

        GoogleIdToken.Payload payload = idToken.getPayload();
        String oauthId = payload.getSubject();
        String email = payload.getEmail();
        User user = userRepository.findByOauthId(oauthId)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setOauthId(oauthId);
                    newUser.setEmail(email);
                    newUser.setNickname(null); // 신규 유저 확인용
                    return userRepository.save(newUser);
                });

        if (email != null && !email.isBlank()) {
            user.setEmail(email.trim());
        }
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        // 프론트에서 기대하는 key들을 고정해서 내려줌 (oauthId가 null/직렬화 불일치로 안 내려오는 케이스 방지)
        Map<String, Object> userDTO = new HashMap<>();
        userDTO.put("id", user.getId());
        userDTO.put("oauthId", oauthId);
        userDTO.put("email", user.getEmail());
        userDTO.put("nickname", user.getNickname());
        userDTO.put("role", user.getRole());
        userDTO.put("status", user.getStatus());
        userDTO.put("nowRewards", user.getNowRewards());
        userDTO.put("totalRewards", user.getTotalRewards());
        userDTO.put("createdAt", user.getCreatedAt());
        userDTO.put("lastLoginAt", user.getLastLoginAt());
        userDTO.put("cameraDailyCount", user.getCameraDailyCount());
        userDTO.put("cameraDailyDate", user.getCameraDailyDate());
        userDTO.put("lastCameraAt", user.getLastCameraAt());

        return Map.of(
            "user", userDTO,
            "isNewUser", user.getNickname() == null
        );
    }

    @PutMapping("/nickname")
    public Map<String, Object> updateNickname(@RequestBody Map<String, String> body) {
        String oauthId = body.get("oauthId");
        String nickname = body.get("nickname");

        if (oauthId == null || oauthId.isBlank() || nickname == null || nickname.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauthId and nickname are required");
        }

        String trimmedNickname = nickname.trim();
        userRepository.findByNickname(trimmedNickname)
            .ifPresent(existing -> {
                if (!existing.getOauthId().equals(oauthId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Nickname already exists");
                }
            });

        // upsert: DB 매핑/기존 데이터 이슈로 find가 실패하는 경우에도 흐름이 막히지 않게
        User user = userRepository.findByOauthId(oauthId)
            .orElseGet(() -> {
                User newUser = new User();
                newUser.setOauthId(oauthId);
                newUser.setNickname(trimmedNickname);
                return newUser;
            });

        user.setNickname(trimmedNickname);
        User savedUser = userRepository.save(user);

        Map<String, Object> userDTO = new HashMap<>();
        userDTO.put("id", savedUser.getId());
        userDTO.put("oauthId", oauthId);
        userDTO.put("email", savedUser.getEmail());
        userDTO.put("nickname", savedUser.getNickname());
        userDTO.put("role", savedUser.getRole());
        userDTO.put("status", savedUser.getStatus());
        userDTO.put("nowRewards", savedUser.getNowRewards());
        userDTO.put("totalRewards", savedUser.getTotalRewards());
        userDTO.put("createdAt", savedUser.getCreatedAt());
        userDTO.put("lastLoginAt", savedUser.getLastLoginAt());
        userDTO.put("cameraDailyCount", savedUser.getCameraDailyCount());
        userDTO.put("cameraDailyDate", savedUser.getCameraDailyDate());
        userDTO.put("lastCameraAt", savedUser.getLastCameraAt());

        return Map.of("user", userDTO, "updated", true);
    }
}