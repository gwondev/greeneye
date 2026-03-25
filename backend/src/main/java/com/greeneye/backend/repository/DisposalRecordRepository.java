package com.greeneye.backend.repository;

import com.greeneye.backend.entity.DisposalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DisposalRecordRepository extends JpaRepository<DisposalRecord, Long> {
    // 특정 사용자의 배출 기록 리스트 가져오기
    List<DisposalRecord> findByUserIdOrderByCreatedAtDesc(Long userId);
}