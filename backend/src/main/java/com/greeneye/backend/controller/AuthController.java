package com.greeneye.backend.controller;

import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Collections;
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
        String token = body.get("token");
        
        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(Collections.singletonList(googleClientId))
                .build();

        GoogleIdToken idToken = verifier.verify(token);
        if (idToken == null) throw new RuntimeException("Invalid Google Token");

        GoogleIdToken.Payload payload = idToken.getPayload();
        String oauthId = payload.getSubject();
        String name = (String) payload.get("name");

        User user = userRepository.findByOauthId(oauthId)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setOauthId(oauthId);
                    newUser.setNickname(null); // 신규 유저 확인용
                    return userRepository.save(newUser);
                });

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        return Map.of(
            "user", user,
            "isNewUser", user.getNickname() == null
        );
    }
}