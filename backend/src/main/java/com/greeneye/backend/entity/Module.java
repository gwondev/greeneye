package com.greeneye.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "modules")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Module {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String serialNumber;

    private String organization;
    private Double latitude;
    private Double longitude;
    private String binType; // GENERAL, CAN, PLASTIC, ALL_RECYCLE

    private int status = 0; // 0:DEFAULT, 1:READY, 2:CHECK
    private int totalDisposalCount = 0;
    
    private LocalDateTime lastHeartbeat = LocalDateTime.now();
}