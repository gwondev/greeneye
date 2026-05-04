package com.greeneye.backend.service;

import com.greeneye.backend.entity.DisposalRecord;
import com.greeneye.backend.entity.Module;
import com.greeneye.backend.entity.RewardHistory;
import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.DisposalRecordRepository;
import com.greeneye.backend.repository.ModuleRepository;
import com.greeneye.backend.repository.RewardHistoryRepository;
import com.greeneye.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ModuleDisposalService {
    /** CHECK 완료(배출 검증 성공) 시 지급 포인트 */
    private static final int DISPOSAL_REWARD = 10;

    private final ModuleRepository moduleRepository;
    private final UserRepository userRepository;
    private final DisposalRecordRepository disposalRecordRepository;
    private final RewardHistoryRepository rewardHistoryRepository;

    @Transactional
    public Map<String, Object> completeDisposalCheck(String serialNumber, String nickname) {
        if (nickname == null || nickname.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId(nickname) is required");
        }

        Module module = moduleRepository.findBySerialNumber(serialNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));
        User user = userRepository.findByNickname(nickname)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        DisposalRecord record = disposalRecordRepository
                .findFirstByUserAndModuleAndStatusOrderByCreatedAtDesc(user, module, "PENDING")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No pending disposal found"));

        record.setStatus("SUCCESS");
        record.setVerifiedAt(LocalDateTime.now());
        record.setRewardAmount(DISPOSAL_REWARD);
        disposalRecordRepository.save(record);

        user.setNowRewards(user.getNowRewards() + DISPOSAL_REWARD);
        user.setTotalRewards(user.getTotalRewards() + DISPOSAL_REWARD);
        userRepository.save(user);

        module.setTotalDisposalCount(module.getTotalDisposalCount() + 1);
        module.setStatus("CHECK");
        module.setLastHeartbeat(LocalDateTime.now());
        moduleRepository.save(module);
        log.info("module status CHECK serial={} user={}", serialNumber, nickname);

        RewardHistory history = rewardHistoryRepository.findByDisposalRecord(record)
                .orElseGet(() -> {
                    RewardHistory newHistory = new RewardHistory();
                    newHistory.setUser(user);
                    newHistory.setDisposalRecord(record);
                    return newHistory;
                });
        history.setPoints(DISPOSAL_REWARD);
        history.setReason("쓰레기 투입 성공");
        rewardHistoryRepository.save(history);

        module.setStatus("DEFAULT");
        moduleRepository.save(module);
        log.info("module status DEFAULT serial={} after CHECK", serialNumber);

        return Map.of(
                "ok", true,
                "reward", DISPOSAL_REWARD,
                "nowRewards", user.getNowRewards(),
                "totalRewards", user.getTotalRewards()
        );
    }

    @Transactional
    public void setModuleStatusDefault(String serialNumber) {
        Module module = moduleRepository.findBySerialNumber(serialNumber).orElse(null);
        if (module == null) {
            return;
        }
        module.setStatus("DEFAULT");
        module.setLastHeartbeat(LocalDateTime.now());
        moduleRepository.save(module);
        log.info("module status DEFAULT serial={}", serialNumber);
    }

    @Transactional
    public void setModuleStatusFull(String serialNumber) {
        Module module = moduleRepository.findBySerialNumber(serialNumber).orElse(null);
        if (module == null) {
            return;
        }
        module.setStatus("FULL");
        module.setLastHeartbeat(LocalDateTime.now());
        moduleRepository.save(module);
        log.info("module status FULL serial={}", serialNumber);
    }

    /**
     * IoT가 10초 안에 IR 미감지로 보낸 READY(status 토픽) — PENDING 배출을 실패 처리, 리워드 없음.
     */
    @Transactional
    public void failPendingDisposalTimeout(String serialNumber, String nickname) {
        if (nickname == null || nickname.isBlank()) {
            return;
        }
        Module module = moduleRepository.findBySerialNumber(serialNumber).orElse(null);
        if (module == null) {
            return;
        }
        User user = userRepository.findByNickname(nickname).orElse(null);
        if (user == null) {
            return;
        }
        disposalRecordRepository
                .findFirstByUserAndModuleAndStatusOrderByCreatedAtDesc(user, module, "PENDING")
                .ifPresent(record -> {
                    record.setStatus("FAILED");
                    record.setVerifiedAt(LocalDateTime.now());
                    record.setRewardAmount(0);
                    disposalRecordRepository.save(record);
                });
        module.setStatus("DEFAULT");
        module.setLastHeartbeat(LocalDateTime.now());
        moduleRepository.save(module);
        log.info("module status DEFAULT serial={} after READY timeout", serialNumber);
    }
}
