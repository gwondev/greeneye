package com.greeneye.backend.config;

import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 로컬 개발용: Vite dev + 프론트의 고정 oauthId와 매칭되는 사용자를 DB에 두고, 닉네임/권한을 맞춥니다.
 * 배포 시 {@code greeneye.dev-user.enabled=false} (기본값) 유지.
 */
@Component
@RequiredArgsConstructor
public class DevUserBootstrap {

    private final UserRepository userRepository;

    @Value("${greeneye.dev-user.enabled:false}")
    private boolean enabled;

    @Value("${greeneye.dev-user.oauth-id:dev-local-greeneye}")
    private String oauthId;

    @PostConstruct
    public void ensureDevUser() {
        if (!enabled) {
            return;
        }
        Optional<User> opt = userRepository.findByOauthId(oauthId);
        if (opt.isPresent()) {
            User u = opt.get();
            boolean changed = false;
            if (!"gwon".equals(u.getNickname())) {
                u.setNickname("gwon");
                changed = true;
            }
            if (!"ADMIN".equals(u.getRole())) {
                u.setRole("ADMIN");
                changed = true;
            }
            if (changed) {
                userRepository.save(u);
            }
            return;
        }
        User u = new User();
        u.setOauthId(oauthId);
        u.setNickname("gwon");
        u.setRole("ADMIN");
        u.setStatus("ACTIVE");
        userRepository.save(u);
    }
}
