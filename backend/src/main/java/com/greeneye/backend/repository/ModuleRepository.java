package com.greeneye.backend.repository;

import com.greeneye.backend.entity.Module;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ModuleRepository extends JpaRepository<Module, Long> {
    // 기기 고유 번호로 모듈 조회
    Optional<Module> findBySerialNumber(String serialNumber);
}