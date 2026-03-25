package com.greeneye.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "disposal_records")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DisposalRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "module_id")
    private Module module;

    private String imageUrl;
    private String predictedType;
    private String selectedType;
    private int rewardAmount;
    
    private String status = "PENDING"; // PENDING, SUCCESS, FAILED
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime verifiedAt;
}