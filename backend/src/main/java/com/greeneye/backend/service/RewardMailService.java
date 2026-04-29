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

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    public Map<String, Object> sendRewardExchangeMail(User user, String itemName, int usedRewards) {
        String email = user.getEmail() == null ? "" : user.getEmail().trim();
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

        boolean smtpConfigured = !mailUsername.isBlank() && !mailPassword.isBlank();
        if (!smtpConfigured) {
            log.warn("Reward mail skipped (SMTP not configured). userId={} item={} code={}", user.getId(), itemName, code);
            return Map.of(
                    "email", email,
                    "code", code,
                    "sent", false,
                    "reasonCode", "SMTP_NOT_CONFIGURED",
                    "reasonDetail", "MAIL_USERNAME 또는 MAIL_PASSWORD 환경변수가 비어 있습니다.",
                    "message", "메일 설정이 없어 코드만 발급되었습니다."
            );
        }
        if (email.isBlank()) {
            log.warn("Reward mail skipped (user email missing). userId={} item={} code={}", user.getId(), itemName, code);
            return Map.of(
                    "email", "",
                    "code", code,
                    "sent", false,
                    "reasonCode", "USER_EMAIL_MISSING",
                    "reasonDetail", "DB users.email 값이 비어 있습니다.",
                    "message", "등록된 구글 이메일이 없어 코드만 발급되었습니다. 다시 로그인해 이메일을 갱신해 주세요."
            );
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(email);
        message.setSubject(subject);
        message.setText(body);
        try {
            mailSender.send(message);
            log.info("Reward exchange mail sent userId={} email={} item={} code={}", user.getId(), email, itemName, code);
            return Map.of(
                    "email", email,
                    "code", code,
                    "sent", true,
                    "reasonCode", "SENT",
                    "reasonDetail", "",
                    "message", "등록된 이메일로 코드가 발송되었습니다."
            );
        } catch (Exception e) {
            log.error("Reward mail send failed userId={} email={} item={} code={}", user.getId(), email, itemName, code, e);
            String detail = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "" : e.getMessage());
            if (detail.length() > 240) {
                detail = detail.substring(0, 240) + "…";
            }
            return Map.of(
                    "email", email,
                    "code", code,
                    "sent", false,
                    "reasonCode", "SMTP_SEND_FAILED",
                    "reasonDetail", detail,
                    "message", "메일 전송에 실패해 코드만 발급되었습니다."
            );
        }
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
