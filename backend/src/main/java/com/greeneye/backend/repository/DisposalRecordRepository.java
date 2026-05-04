package com.greeneye.backend.repository;

import com.greeneye.backend.entity.DisposalRecord;
import com.greeneye.backend.entity.Module;
import com.greeneye.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DisposalRecordRepository extends JpaRepository<DisposalRecord, Long> {
    List<DisposalRecord> findByUser_IdOrderByCreatedAtDesc(Long userId);

    List<DisposalRecord> findByModule_Id(Long moduleId);

    Optional<DisposalRecord> findFirstByUserAndModuleAndStatusOrderByCreatedAtDesc(User user, Module module, String status);

    List<DisposalRecord> findAllByUserAndModuleAndStatus(User user, Module module, String status);
}