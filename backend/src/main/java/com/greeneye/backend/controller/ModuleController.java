package com.greeneye.backend.controller;

import com.greeneye.backend.entity.Module;
import com.greeneye.backend.repository.ModuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/modules")
@RequiredArgsConstructor
public class ModuleController {
    private final ModuleRepository moduleRepository;

    @GetMapping
    public List<Module> getAllModules() {
        return moduleRepository.findAll();
    }
}