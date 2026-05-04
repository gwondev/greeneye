package com.greeneye.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "oauth_id", unique = true, nullable = false, length = 100)
    private String oauthId;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "nickname", unique = true, length = 50)
    private String nickname;

    @Column(name = "role", nullable = false, length = 20)
    private String role = "USER";

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "now_rewards", nullable = false)
    private Integer nowRewards = 0;

    @Column(name = "total_rewards", nullable = false)
    private Integer totalRewards = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "camera_daily_count", nullable = false)
    private Integer cameraDailyCount = 0;

    @Column(name = "camera_daily_date")
    private LocalDate cameraDailyDate;

    @Column(name = "last_camera_at")
    private LocalDateTime lastCameraAt;

    /** 맵(지도) API 최초 진입 시 +1 리워드 1회만 지급했는지 */
    @Column(name = "map_entry_reward_claimed", nullable = false)
    private boolean mapEntryRewardClaimed = false;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
