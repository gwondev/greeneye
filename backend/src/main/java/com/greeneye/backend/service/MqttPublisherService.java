package com.greeneye.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class MqttPublisherService {

    @Value("${mqtt.broker-url:tcp://gwon-mosquitto:1883}")
    private String brokerUrl;

    @Value("${mqtt.client-id:greeneye-backend}")
    private String clientId;

    public void publish(String topic, String payload) {
        try (MqttClient client = new MqttClient(brokerUrl, clientId + "-" + System.currentTimeMillis())) {
            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);

            client.connect(options);
            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(1);
            client.publish(topic, message);
            client.disconnect();
        } catch (MqttException e) {
            log.error("MQTT publish failed. topic={}, payload={}", topic, payload, e);
        }
    }
}
