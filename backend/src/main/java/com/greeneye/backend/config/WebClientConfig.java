package com.greeneye.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    /** Spring Boot 4 에서 WebClient.Builder 자동 등록이 안 될 때 AiController 등에서 주입 가능하도록 */
    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}
