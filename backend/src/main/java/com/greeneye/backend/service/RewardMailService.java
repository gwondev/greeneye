package com.greeneye.backend.service;

import com.greeneye.backend.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class RewardMailService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LEN = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JavaMailSender mailSender;

    @Value("${spring.mail.from:no-reply@greeneye.local}")
    private String fromAddress;

    public Map<String, String> sendRewardExchangeMail(User user, String itemName, int usedRewards) {
        String email = user.getEmail() == null ? "" : user.getEmail().trim();
        if (email.isBlank()) {
            throw new IllegalStateException("등록된 구글 이메일이 없습니다. 다시 로그인 후 시도해 주세요.");
        }
        String code = generateCode();
        String subject = "[GreenEye] 리워드 교환 코드 안내";
        String body = """
                안녕하세요, GreenEye 리워드 교환이 완료되었습니다.

                사용 리워드: %d
                교환 상품: %s
                리워드 코드: %s

                위 코드를 제시하여 교환을 진행해 주세요.
                감사합니다.
                """.formatted(usedRewards, itemName, code);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(email);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
        log.info("Reward exchange mail sent userId={} email={} item={} code={}", user.getId(), email, itemName, code);
        return Map.of("email", email, "code", code);
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LEN);
        for (int i = 0; i < CODE_LEN; i++) {
            int idx = RANDOM.nextInt(CODE_CHARS.length());
            sb.append(CODE_CHARS.charAt(idx));
        }
        return sb.toString().toUpperCase(Locale.ROOT);
    }
}
