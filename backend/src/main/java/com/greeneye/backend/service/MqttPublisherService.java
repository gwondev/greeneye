package com.greeneye.backend.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * 브로커로의 발행은 연결·해제를 매 요청마다 반복하지 않고 하나의 세션을 유지한다.
 * (매번 새 clientId로 접속했다 끊는 방식은 브로커·타이밍 레이스로 IoT 구독자가 메시지를 놓치기 쉬움)
 */
@Service
@Slf4j
public class MqttPublisherService {

    private final MqttTrafficLogService mqttTrafficLogService;

    @Value("${mqtt.broker-url:tcp://mosquitto:1883}")
    private String brokerUrl;

    @Value("${mqtt.client-id:greeneye-backend}")
    private String clientId;

    private final Object clientLock = new Object();
    private volatile MqttClient client;

    public MqttPublisherService(MqttTrafficLogService mqttTrafficLogService) {
        this.mqttTrafficLogService = mqttTrafficLogService;
    }

    @PostConstruct
    public void init() {
        try {
            connectIfNeeded();
        } catch (MqttException e) {
            log.warn("MQTT publisher initial connect failed (will retry on publish): {}", e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        synchronized (clientLock) {
            if (client != null) {
                try {
                    if (client.isConnected()) {
                        client.disconnect();
                    }
                } catch (Exception e) {
                    log.debug("MQTT publisher disconnect: {}", e.getMessage());
                }
                try {
                    client.close();
                } catch (Exception ignored) {
                }
                client = null;
            }
        }
    }

    private void connectIfNeeded() throws MqttException {
        synchronized (clientLock) {
            if (client != null && client.isConnected()) {
                return;
            }
            if (client != null) {
                try {
                    client.close();
                } catch (Exception ignored) {
                }
                client = null;
            }
            String publisherId = clientId + "-pub";
            client = new MqttClient(brokerUrl, publisherId);
            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);
            options.setConnectionTimeout(15);
            options.setKeepAliveInterval(30);
            client.connect(options);
            log.info("MQTT publisher connected. brokerUrl={}, clientId={}", brokerUrl, publisherId);
        }
    }

    private void invalidateClient() {
        synchronized (clientLock) {
            if (client != null) {
                try {
                    if (client.isConnected()) {
                        client.disconnect();
                    }
                } catch (Exception ignored) {
                }
                try {
                    client.close();
                } catch (Exception ignored) {
                }
                client = null;
            }
        }
    }

    public void publish(String topic, String payload) {
        MqttMessage message = new MqttMessage(payload.getBytes(StandardCharsets.UTF_8));
        message.setQos(1);
        try {
            synchronized (clientLock) {
                connectIfNeeded();
                client.publish(topic, message);
            }
            mqttTrafficLogService.add("OUT", topic, payload);
        } catch (MqttException e) {
            log.warn("MQTT publish failed, one reconnect retry. topic={}", topic, e);
            invalidateClient();
            try {
                synchronized (clientLock) {
                    connectIfNeeded();
                    client.publish(topic, message);
                }
                mqttTrafficLogService.add("OUT", topic, payload);
            } catch (MqttException e2) {
                mqttTrafficLogService.add("OUT_ERR", topic, payload);
                log.error("MQTT publish failed after retry. topic={}, payload={}", topic, payload, e2);
                invalidateClient();
            }
        }
    }
}
