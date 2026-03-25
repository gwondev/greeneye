package com.greeneye.backend.controller;

import com.greeneye.backend.entity.User;
import com.greeneye.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserRepository userRepository;

    // 모든 유저 목록 가져오기 (DBPage용)
    @GetMapping
    public List<User> getAllUsers() {
        // 실제로는 여기서 ROLE_ADMIN 체크를 수행해야 함
        return userRepository.findAll();
    }
}