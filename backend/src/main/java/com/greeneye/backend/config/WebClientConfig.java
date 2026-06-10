package com.greeneye.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.channel.ChannelOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class WebClientConfig {

    /** Spring Boot 4 + 일부 구성에서 Jackson 자동 빈이 없을 때 AiController 등에서 주입 가능하도록 */
    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    /** Spring Boot 4 에서 WebClient.Builder 자동 등록이 안 될 때 AiController 등에서 주입 가능하도록 */
    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    /** Gemini 전용 — Cloudflare 터널(~100s) 안에 끝나도록 짧은 타임아웃 */
    @Bean
    public WebClient geminiWebClient(
            @Value("${gemini.api.timeout-seconds:55}") int timeoutSeconds
    ) {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(timeoutSeconds))
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000);

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
