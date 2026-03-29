#include <Arduino.h>
#include <cstring>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <mqtt_client.h>
#include <time.h>

// ========== 모듈 고유번호만 수정 (DB modules.serial_number) ==========
static const char *MODULE_SERIAL = "g1";

/**
 * Cloudflare Tunnel: HTTP(S) → origin greeneye-mosquitto:9001 (Mosquitto WebSockets)
 * 우선 연결 안정화를 위해 TLS 없는 WS(80)로 edge 접속 후, tunnel이 내부 WS 9001로 전달한다.
 * Path는 Cloudflare Published route에서 비워둔 상태(전체 매칭) 기준.
 */
static const char *MQTT_WS_URI = "ws://mqtt-greeneye.gwon.run:80";

// ========== WiFi ==========
static const char *WIFI_SSIDS[] = {"gwon", "iptime"};
static const char *WIFI_PASSWORDS[] = {"00000000", "Gwondev0323", ""};
static const int WIFI_SSID_COUNT = 2;
static const int WIFI_PASSWORD_COUNT = 3;

// ========== 핀 (RGB LED: R=25, G=26, B=27) ==========
static const int PIN_IR = 34;
static const int PIN_LED_R = 25;
static const int PIN_LED_G = 26;
static const int PIN_LED_B = 27;
static const bool IR_DETECTED_IS_LOW = true;
static const unsigned long FULL_DETECT_MS = 10UL * 60UL * 1000UL;  // 10 minutes

static esp_mqtt_client_handle_t s_mqtt = nullptr;
static volatile bool s_mqtt_connected = false;

char pendingNickname[48] = "";
enum { MODE_DEFAULT, MODE_READY_WAIT, MODE_CHECK_SHOW, MODE_FULL } deviceMode = MODE_DEFAULT;
unsigned long readyDeadlineMs = 0;
unsigned long greenUntilMs = 0;
unsigned long fullDetectStartMs = 0;
bool fullSent = false;

String topicCmd() { return String("greeneye/") + MODULE_SERIAL + "/cmd"; }
String topicStatus() { return String("greeneye/") + MODULE_SERIAL + "/status"; }

void applyRgb(bool red, bool green, bool blue) {
  digitalWrite(PIN_LED_R, red ? HIGH : LOW);
  digitalWrite(PIN_LED_G, green ? HIGH : LOW);
  digitalWrite(PIN_LED_B, blue ? HIGH : LOW);
}

void enterDefaultIdle() {
  deviceMode = MODE_DEFAULT;
  applyRgb(true, false, false);  // RED
  pendingNickname[0] = '\0';
  fullDetectStartMs = 0;
  fullSent = false;
}

bool irDetected() {
  int v = digitalRead(PIN_IR);
  return IR_DETECTED_IS_LOW ? (v == LOW) : (v == HIGH);
}

bool connectWifiFromLists() {
  WiFi.mode(WIFI_STA);
  for (int s = 0; s < WIFI_SSID_COUNT; s++) {
    for (int p = 0; p < WIFI_PASSWORD_COUNT; p++) {
      Serial.printf("WiFi: SSID=\"%s\" ", WIFI_SSIDS[s]);
      if (strlen(WIFI_PASSWORDS[p]) == 0) {
        Serial.println("(open)");
        WiFi.begin(WIFI_SSIDS[s]);
      } else {
        Serial.println("(psk)");
        WiFi.begin(WIFI_SSIDS[s], WIFI_PASSWORDS[p]);
      }
      unsigned long start = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - start < 12000UL) {
        delay(300);
        Serial.print(".");
      }
      Serial.println();
      if (WiFi.status() == WL_CONNECTED) {
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        return true;
      }
      delay(300);
    }
  }
  return false;
}

static void mqttPublishRaw(const char *topic, const char *payload, int qos = 1) {
  if (!s_mqtt || !s_mqtt_connected) {
    Serial.println("mqttPublishRaw: not connected");
    return;
  }
  int len = (int)strlen(payload);
  int mid = esp_mqtt_client_publish(s_mqtt, topic, payload, len, qos, 0);
  if (mid < 0) {
    Serial.printf("publish failed topic=%s\n", topic);
  }
}

template <size_t N>
void publishDoc(const char *topic, StaticJsonDocument<N> &doc) {
  char buf[256];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  if (n == 0 || n >= sizeof(buf)) {
    Serial.println("publishDoc: buffer too small");
    return;
  }
  buf[n] = '\0';
  Serial.printf(">>> PUB %s %s\n", topic, buf);
  mqttPublishRaw(topic, buf);
}

void publishStatusCheck() {
  StaticJsonDocument<160> doc;
  doc["status"] = "CHECK";
  doc["userId"] = pendingNickname;
  publishDoc(topicStatus().c_str(), doc);
  Serial.println(">>> status CHECK");
}

void publishStatusReadyTimeout() {
  StaticJsonDocument<160> doc;
  doc["status"] = "READY";
  doc["userId"] = pendingNickname;
  publishDoc(topicStatus().c_str(), doc);
  Serial.println(">>> status READY (timeout)");
}

void publishStatusFull() {
  StaticJsonDocument<160> doc;
  doc["status"] = "FULL";
  doc["moduleSerial"] = MODULE_SERIAL;
  publishDoc(topicStatus().c_str(), doc);
  Serial.println(">>> status FULL");
}

void armReady(const char *nick) {
  if (deviceMode == MODE_FULL) {
    Serial.println("ignore cmd: module is FULL");
    return;
  }
  strncpy(pendingNickname, nick, sizeof(pendingNickname) - 1);
  pendingNickname[sizeof(pendingNickname) - 1] = '\0';
  deviceMode = MODE_READY_WAIT;
  readyDeadlineMs = millis() + 10000UL;
  applyRgb(true, true, false);  // YELLOW = R + G
  fullDetectStartMs = 0;
  Serial.printf(">>> READY 10s, userId=%s\n", pendingNickname);
}

void handleIncomingCmdPayload(const char *payload) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload)) {
    Serial.println("JSON error");
    return;
  }
  const char *uid = doc["userId"];
  if (!uid || !uid[0]) {
    uid = doc["nickname"];
  }
  if (!uid || !uid[0]) {
    Serial.println("no userId/nickname");
    return;
  }
  armReady(uid);
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
  esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
  (void)handler_args;
  (void)base;

  switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
      Serial.println("MQTT_EVENT_CONNECTED (WS)");
      s_mqtt_connected = true;
      if (deviceMode == MODE_FULL || fullSent) {
        publishStatusFull();
      }
      {
        String tc = topicCmd();
        esp_mqtt_client_subscribe(s_mqtt, tc.c_str(), 1);
        Serial.printf("sub %s\n", tc.c_str());
      }
      break;

    case MQTT_EVENT_DISCONNECTED:
      Serial.println("MQTT_EVENT_DISCONNECTED");
      s_mqtt_connected = false;
      break;

    case MQTT_EVENT_SUBSCRIBED:
      Serial.printf("MQTT_EVENT_SUBSCRIBED msg_id=%d\n", event->msg_id);
      break;

    case MQTT_EVENT_DATA: {
      char topicBuf[160];
      int tl = event->topic_len;
      if (tl >= (int)sizeof(topicBuf)) {
        tl = sizeof(topicBuf) - 1;
      }
      memcpy(topicBuf, event->topic, tl);
      topicBuf[tl] = '\0';

      char dataBuf[384];
      int dl = event->data_len;
      if (dl >= (int)sizeof(dataBuf)) {
        dl = sizeof(dataBuf) - 1;
      }
      memcpy(dataBuf, event->data, dl);
      dataBuf[dl] = '\0';

      Serial.printf("[MQTT] %s %s\n", topicBuf, dataBuf);
      if (strstr(topicBuf, "/cmd") != nullptr) {
        handleIncomingCmdPayload(dataBuf);
      }
      break;
    }

    case MQTT_EVENT_ERROR:
      if (event->error_handle) {
        Serial.printf("MQTT_EVENT_ERROR type=%d tls=%d\n",
                      (int)event->error_handle->error_type,
                      event->error_handle->esp_tls_last_esp_err);
      } else {
        Serial.println("MQTT_EVENT_ERROR");
      }
      break;

    default:
      break;
  }
}

void startMqttClient() {
  if (s_mqtt) {
    esp_mqtt_client_stop(s_mqtt);
    esp_mqtt_client_destroy(s_mqtt);
    s_mqtt = nullptr;
    s_mqtt_connected = false;
  }

  esp_mqtt_client_config_t cfg = {};
  cfg.uri = MQTT_WS_URI;
  cfg.client_id = MODULE_SERIAL;
  cfg.keepalive = 60;
  cfg.disable_clean_session = false;
  cfg.disable_auto_reconnect = false;
  cfg.reconnect_timeout_ms = 8000;
  cfg.buffer_size = 4096;
  s_mqtt = esp_mqtt_client_init(&cfg);
  esp_mqtt_client_register_event(s_mqtt, MQTT_EVENT_ANY, mqtt_event_handler, nullptr);
  esp_err_t err = esp_mqtt_client_start(s_mqtt);
  if (err != ESP_OK) {
    Serial.printf("esp_mqtt_client_start err=%d\n", (int)err);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_IR, INPUT_PULLUP);
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  enterDefaultIdle();

  while (!connectWifiFromLists()) {
    Serial.println("WiFi retry 5s");
    delay(5000);
  }
  // TLS 인증서 유효기간 검사에 시스템 시간 필요 — 미동기화 시 mbedtls 핸드셰이크 실패가 잦음
  configTime(9 * 3600, 0, "pool.ntp.org", "time.google.com");
  Serial.print("NTP sync");
  for (int i = 0; i < 40 && time(nullptr) < 1700000000; i++) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("time=%ld\n", (long)time(nullptr));
  Serial.printf("MQTT WS URI: %s\n", MQTT_WS_URI);
  startMqttClient();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    s_mqtt_connected = false;
    while (!connectWifiFromLists()) {
      delay(3000);
    }
    startMqttClient();
  }

  if (deviceMode == MODE_CHECK_SHOW && millis() >= greenUntilMs) {
    enterDefaultIdle();
  }

  if (deviceMode == MODE_DEFAULT) {
    if (irDetected()) {
      if (fullDetectStartMs == 0) {
        fullDetectStartMs = millis();
      } else if (!fullSent && millis() - fullDetectStartMs >= FULL_DETECT_MS) {
        publishStatusFull();
        deviceMode = MODE_FULL;
        fullSent = true;
        applyRgb(true, false, false);  // keep RED
      }
    } else {
      fullDetectStartMs = 0;
      fullSent = false;
    }
  }

  if (deviceMode == MODE_FULL) {
    delay(20);
    return;
  }

  if (deviceMode != MODE_READY_WAIT) {
    delay(20);
    return;
  }

  if (irDetected()) {
    publishStatusCheck();
    deviceMode = MODE_CHECK_SHOW;
    applyRgb(false, true, false);  // GREEN
    greenUntilMs = millis() + 5000UL;
    pendingNickname[0] = '\0';
    delay(20);
    return;
  }

  if (millis() >= readyDeadlineMs) {
    publishStatusReadyTimeout();
    enterDefaultIdle();
  }
  delay(20);
}
