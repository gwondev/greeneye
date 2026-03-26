package com.greeneye.backend.controller;

import com.greeneye.backend.entity.DisposalRecord;
import com.greeneye.backend.entity.Module;
import com.greeneye.backend.entity.RewardHistory;
import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.DisposalRecordRepository;
import com.greeneye.backend.repository.ModuleRepository;
import com.greeneye.backend.repository.RewardHistoryRepository;
import com.greeneye.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final UserRepository userRepository;
    private final ModuleRepository moduleRepository;
    private final DisposalRecordRepository disposalRecordRepository;
    private final RewardHistoryRepository rewardHistoryRepository;

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        List<User> users = userRepository.findAll();
        List<Module> modules = moduleRepository.findAll();
        List<DisposalRecord> records = disposalRecordRepository.findAll();
        List<RewardHistory> rewards = rewardHistoryRepository.findAll();

        return Map.of(
                "users", users.stream().map(this::toUserDto).toList(),
                "modules", modules.stream().map(this::toModuleDto).toList(),
                "disposalRecords", records.stream().map(this::toRecordDto).toList(),
                "rewardHistories", rewards.stream().map(this::toRewardDto).toList()
        );
    }

    private Map<String, Object> toUserDto(User user) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", user.getId());
        dto.put("oauthId", user.getOauthId());
        dto.put("nickname", user.getNickname());
        dto.put("role", user.getRole());
        dto.put("status", user.getStatus());
        dto.put("nowRewards", user.getNowRewards());
        dto.put("totalRewards", user.getTotalRewards());
        dto.put("cameraDailyCount", user.getCameraDailyCount());
        dto.put("cameraDailyDate", user.getCameraDailyDate());
        dto.put("createdAt", user.getCreatedAt());
        dto.put("lastLoginAt", user.getLastLoginAt());
        return dto;
    }

    private Map<String, Object> toModuleDto(Module module) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", module.getId());
        dto.put("serialNumber", module.getSerialNumber());
        dto.put("organization", module.getOrganization());
        dto.put("lat", module.getLat());
        dto.put("lon", module.getLon());
        dto.put("type", module.getType());
        dto.put("status", module.getStatus());
        dto.put("totalDisposalCount", module.getTotalDisposalCount());
        dto.put("lastHeartbeat", module.getLastHeartbeat());
        return dto;
    }

    private Map<String, Object> toRecordDto(DisposalRecord record) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", record.getId());
        dto.put("userId", record.getUser() == null ? null : record.getUser().getId());
        dto.put("moduleId", record.getModule() == null ? null : record.getModule().getId());
        dto.put("predictedType", record.getPredictedType());
        dto.put("selectedType", record.getSelectedType());
        dto.put("rewardAmount", record.getRewardAmount());
        dto.put("status", record.getStatus());
        dto.put("createdAt", record.getCreatedAt());
        dto.put("verifiedAt", record.getVerifiedAt());
        return dto;
    }

    private Map<String, Object> toRewardDto(RewardHistory reward) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", reward.getId());
        dto.put("userId", reward.getUser() == null ? null : reward.getUser().getId());
        dto.put("disposalRecordId", reward.getDisposalRecord() == null ? null : reward.getDisposalRecord().getId());
        dto.put("points", reward.getPoints());
        dto.put("reason", reward.getReason());
        dto.put("createdAt", reward.getCreatedAt());
        return dto;
    }
}
