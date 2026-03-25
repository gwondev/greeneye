package com.greeneye.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

@Configuration
@EnableWebSecurity // 이거 꼭 붙여줘야 보안 설정이 활성화돼
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 1. REST API니까 CSRF 비활성화
            .csrf(AbstractHttpConfigurer::disable)
            
            // 2. 브라우저 기본 로그인 폼 & HTTP Basic 팝업 비활성화 (이거 안 끄면 API 호출 시 팝업 뜰 수도 있음)
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            
            // 3. 세션 사용 안 함 (STATELESS)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // 4. CORS 설정 (클라우드플레어 터널 도메인 허용)
            .cors(cors -> cors.configurationSource(request -> {
                var config = new CorsConfiguration();
                config.setAllowedOrigins(List.of("https://greeneye.gwon.run", "https://gwon.run"));
                config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(true); // 쿠키나 인증 헤더 허용
                return config;
            }))
            
            // 5. 경로별 권한 설정
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll() // 로그인 관련은 무조건 통과
                .anyRequest().permitAll() // 나머지 일단 개발용으로 허용
            );

        return http.build();
    }
}