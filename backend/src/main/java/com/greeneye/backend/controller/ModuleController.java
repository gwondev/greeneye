package com.greeneye.backend.controller;

import com.greeneye.backend.entity.DisposalRecord;
import com.greeneye.backend.entity.Module;
import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.DisposalRecordRepository;
import com.greeneye.backend.repository.ModuleRepository;
import com.greeneye.backend.repository.RewardHistoryRepository;
import com.greeneye.backend.repository.UserRepository;
import com.greeneye.backend.mqtt.GreeneyeMqttTopics;
import com.greeneye.backend.service.ModuleDisposalService;
import com.greeneye.backend.service.MqttPublisherService;
import com.greeneye.backend.service.TableIdCompactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/modules")
@RequiredArgsConstructor
public class ModuleController {
    private final ModuleRepository moduleRepository;
    private final UserRepository userRepository;
    private final DisposalRecordRepository disposalRecordRepository;
    private final RewardHistoryRepository rewardHistoryRepository;
    private final MqttPublisherService mqttPublisherService;
    private final ModuleDisposalService moduleDisposalService;
    private final TableIdCompactionService tableIdCompactionService;

    private static final Set<String> ALLOWED_MODULE_STATUS = Set.of("DEFAULT", "READY", "CHECK", "FULL");

    @GetMapping
    public List<Module> getAllModules() {
        return moduleRepository.findAll();
    }

    @PostMapping
    public Module createModule(@RequestBody Map<String, Object> body) {
        String serialNumber = body.get("serialNumber") == null ? null : body.get("serialNumber").toString().trim();
        if (serialNumber == null || serialNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "serialNumber is required");
        }
        if (moduleRepository.findBySerialNumber(serialNumber).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "serialNumber already exists");
        }

        Module module = Module.builder()
                .serialNumber(serialNumber)
                .organization(stringOrDefault(body.get("organization"), "CHOSUN_IT"))
                .lat(doubleOrDefault(body.get("lat"), 35.1469))
                .lon(doubleOrDefault(body.get("lon"), 126.9228))
                .type(stringOrDefault(body.get("type"), "GENERAL"))
                .status("DEFAULT")
                .totalDisposalCount(Math.max(0, intOrDefault(body.get("totalDisposalCount"), 0)))
                .lastHeartbeat(LocalDateTime.now())
                .build();
        return moduleRepository.save(module);
    }

    @PostMapping("/seed")
    public Map<String, Object> seedModules() {
        if (moduleRepository.count() > 0) {
            return Map.of("seeded", false, "reason", "already exists");
        }

        Module g1 = Module.builder()
                .serialNumber("g1")
                .organization("CHOSUN_IT")
                .lat(35.1462000)
                .lon(126.9229000)
                .type("CAN")
                .status("DEFAULT")
                .totalDisposalCount(0)
                .lastHeartbeat(LocalDateTime.now())
                .build();
        moduleRepository.save(g1);

        Module g2 = Module.builder()
                .serialNumber("g2")
                .organization("CHOSUN_IT")
                .lat(35.1474000)
                .lon(126.9242000)
                .type("PET")
                .status("DEFAULT")
                .totalDisposalCount(0)
                .lastHeartbeat(LocalDateTime.now())
                .build();
        moduleRepository.save(g2);

        return Map.of("seeded", true, "serialNumbers", List.of(g1.getSerialNumber(), g2.getSerialNumber()));
    }

    @PostMapping("/{serialNumber}/ready")
    public Map<String, Object> ready(
            @PathVariable String serialNumber,
            @RequestBody Map<String, String> body
    ) {
        String nickname = body.get("userId");
        if (nickname == null || nickname.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId(nickname) is required");
        }

        Module module = moduleRepository.findBySerialNumber(serialNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));
        User user = userRepository.findByNickname(nickname)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        module.setStatus("READY");
        module.setLastHeartbeat(LocalDateTime.now());
        moduleRepository.save(module);

        /* 새 READY 전에 같은 모듈·유저의 미완료 PENDING 을 정리 — 이중 CHECK·중복 리워드 방지 */
        disposalRecordRepository.findAllByUserAndModuleAndStatus(user, module, "PENDING").forEach((old) -> {
            old.setStatus("FAILED");
            old.setVerifiedAt(LocalDateTime.now());
            old.setRewardAmount(0);
            disposalRecordRepository.save(old);
        });

        DisposalRecord record = DisposalRecord.builder()
                .user(user)
                .module(module)
                .predictedType(body.get("predictedType"))
                .selectedType(body.get("selectedType"))
                .imageUrl(body.get("imageUrl"))
                .rewardAmount(0)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();
        disposalRecordRepository.save(record);

        String topic = GreeneyeMqttTopics.cmd(serialNumber);
        long issuedAt = System.currentTimeMillis();
        String payload = String.format(Locale.US, "{\"userId\":\"%s\",\"issuedAt\":%d}",
                escapeJson(nickname), issuedAt);
        mqttPublisherService.publish(topic, payload, true);

        return Map.of("ok", true, "moduleStatus", module.getStatus(), "recordId", record.getId());
    }

    @PostMapping("/{serialNumber}/check")
    public Map<String, Object> check(
            @PathVariable String serialNumber,
            @RequestBody Map<String, String> body
    ) {
        String nickname = body.get("userId");
        return moduleDisposalService.completeDisposalCheck(serialNumber, nickname);
    }

    private String stringOrDefault(Object raw, String fallback) {
        if (raw == null) return fallback;
        String value = raw.toString().trim();
        return value.isBlank() ? fallback : value;
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private Double doubleOrDefault(Object raw, double fallback) {
        if (raw == null) return fallback;
        try {
            return Double.parseDouble(raw.toString());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private Integer intOrDefault(Object raw, int fallback) {
        if (raw == null) return fallback;
        try {
            return Integer.parseInt(raw.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public Module updateModule(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Module module = moduleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));

        if (body.containsKey("serialNumber")) {
            String sn = body.get("serialNumber").toString().trim();
            if (!sn.isBlank()) {
                moduleRepository.findBySerialNumber(sn).ifPresent(other -> {
                    if (!other.getId().equals(id)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "serialNumber already exists");
                    }
                });
                module.setSerialNumber(sn);
            }
        }
        if (body.containsKey("organization") && body.get("organization") != null) {
            module.setOrganization(body.get("organization").toString().trim());
        }
        if (body.containsKey("lat")) {
            module.setLat(doubleOrDefault(body.get("lat"), module.getLat() != null ? module.getLat() : 35.1469));
        }
        if (body.containsKey("lon")) {
            module.setLon(doubleOrDefault(body.get("lon"), module.getLon() != null ? module.getLon() : 126.9228));
        }
        if (body.containsKey("type") && body.get("type") != null) {
            module.setType(body.get("type").toString().trim().toUpperCase());
        }
        if (body.containsKey("status") && body.get("status") != null) {
            String st = body.get("status").toString().trim().toUpperCase();
            if (!ALLOWED_MODULE_STATUS.contains(st)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "status must be one of: DEFAULT, READY, CHECK, FULL");
            }
            module.setStatus(st);
        }
        if (body.containsKey("totalDisposalCount")) {
            module.setTotalDisposalCount(
                    Math.max(
                            0,
                            intOrDefault(
                                    body.get("totalDisposalCount"),
                                    module.getTotalDisposalCount()
                            )
                    )
            );
        }
        module.setLastHeartbeat(LocalDateTime.now());
        return moduleRepository.save(module);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void deleteModule(@PathVariable Long id) {
        Module module = moduleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));

        List<DisposalRecord> records = disposalRecordRepository.findByModule_Id(module.getId());
        for (DisposalRecord dr : records) {
            rewardHistoryRepository.findByDisposalRecord(dr).ifPresent(rewardHistoryRepository::delete);
            disposalRecordRepository.delete(dr);
        }
        moduleRepository.delete(module);
        moduleRepository.flush();
        tableIdCompactionService.compactAllAfterDelete();
    }
}