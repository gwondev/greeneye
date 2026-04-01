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

// ========== 핀 (RGB LED: R=25, G=26, B=27 | 초음파 TRIG=32, ECHO=33) ==========
static const int PIN_TRIG = 32;
static const int PIN_ECHO = 33;
static const int PIN_LED_R = 25;
static const int PIN_LED_G = 26;
static const int PIN_LED_B = 27;
// FULL: 거리 10cm 미만이 1시간 연속 유지될 때만 전환
static const unsigned long FULL_DETECT_MS = 60UL * 60UL * 1000UL;  // 1 hour
static const float FULL_NEAR_CM = 10.0f;
// baseline 대비 20cm 이상 가까워짐(거리 감소)이 초음파 "틱" 기준 연속 N회 유지될 때 CHECK
static const float READY_DELTA_CM = 20.0f;
static const int READY_DROP_TICKS_REQUIRED = 5;
static const uint32_t LEDC_FREQ_HZ = 10000;  // 고주파 PWM → 깜빡임 줄이고 색이 또렷해 보이게
static const uint8_t LEDC_RES_BITS = 8;
static const int LEDC_CH_R = 0;
static const int LEDC_CH_G = 1;
static const int LEDC_CH_B = 2;
static const unsigned long ULTRA_PING_INTERVAL_MS = 65;
static const unsigned long ULTRA_LOG_INTERVAL_MS = 10000UL;  // 10s

static esp_mqtt_client_handle_t s_mqtt = nullptr;
static volatile bool s_mqtt_connected = false;
/** Wi-Fi 순간 플랩으로 MQTT를 매번 끊었다 붙이지 않도록, 끊김이 이 시간 이상 지속될 때만 재연결 */
static const unsigned long WIFI_DOWN_DEBOUNCE_MS = 500;
static unsigned long s_wifiDownSince = 0;

char pendingNickname[48] = "";
enum { MODE_DEFAULT, MODE_READY_WAIT, MODE_CHECK_SHOW, MODE_FULL } deviceMode = MODE_DEFAULT;
unsigned long readyDeadlineMs = 0;
unsigned long greenUntilMs = 0;
unsigned long fullDetectStartMs = 0;
bool fullSent = false;
float readyBaselineCm = -1.0f;
bool readyBaselineSet = false;

static unsigned long s_lastUltraPingMs = 0;
static unsigned long s_lastUltraLogMs = 0;
static float s_lastDistCm = -1.0f;
/** 초음파 새 측정이 나올 때마다 증가 (loop 20ms와 무관하게 1틱=1샘플) */
static uint32_t s_ultraSampleSeq = 0;
static int s_readyDropStreak = 0;
/** READY 진입 직후 오래된 s_lastDistCm으로 연산하지 않도록 마지막 처리한 샘플 번호 */
static uint32_t s_readyLastProcessedUltraSeq = 0;

String topicCmd() { return String("greeneye/") + MODULE_SERIAL + "/cmd"; }
String topicStatus() { return String("greeneye/") + MODULE_SERIAL + "/status"; }

void rgbPwm(uint8_t r, uint8_t g, uint8_t b) {
  ledcWrite(LEDC_CH_R, r);
  ledcWrite(LEDC_CH_G, g);
  ledcWrite(LEDC_CH_B, b);
}

void applyRgb(bool red, bool green, bool blue) {
  rgbPwm(red ? 255 : 0, green ? 255 : 0, blue ? 255 : 0);
}

/** READY: R·G 최대로 선명한 노랑 (모듈마다 G가 과하면 245 정도로만 낮춰보기) */
void applyReadyYellowVivid() { rgbPwm(255, 255, 0); }

void enterDefaultIdle() {
  deviceMode = MODE_DEFAULT;
  applyRgb(true, false, false);  // RED
  pendingNickname[0] = '\0';
  fullDetectStartMs = 0;
  fullSent = false;
  readyBaselineCm = -1.0f;
  readyBaselineSet = false;
  s_readyDropStreak = 0;
}

/** HC-SR04류: 실패 시 -1, 유효 시 cm (대략 2~400) */
float measureDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long durationUs = pulseIn(PIN_ECHO, HIGH, 30000);
  if (durationUs == 0) {
    return -1.0f;
  }
  float cm = (float)durationUs / 58.0f;
  if (cm < 2.0f || cm > 400.0f) {
    return -1.0f;
  }
  return cm;
}

void updateUltrasonicSample() {
  unsigned long now = millis();
  if (now - s_lastUltraPingMs < ULTRA_PING_INTERVAL_MS) {
    return;
  }
  s_lastUltraPingMs = now;
  s_lastDistCm = measureDistanceCm();
  s_ultraSampleSeq++;
  if (s_lastDistCm >= 0 && (now - s_lastUltraLogMs >= ULTRA_LOG_INTERVAL_MS)) {
    s_lastUltraLogMs = now;
    Serial.printf("[ULTRA] dist=%.1f cm\n", s_lastDistCm);
  }
}

bool connectWifiFromLists() {
  WiFi.mode(WIFI_STA);
  Serial.println("[NET] WiFi connect start");
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
  Serial.println("[NET] WiFi connect failed (all candidates)");
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
  applyReadyYellowVivid();
  fullDetectStartMs = 0;
  readyBaselineCm = -1.0f;
  readyBaselineSet = false;
  s_readyDropStreak = 0;
  s_readyLastProcessedUltraSeq = s_ultraSampleSeq;
  Serial.printf(">>> READY 10s, userId=%s (drop>=%.0fcm x %d ultra-ticks -> CHECK)\n",
                pendingNickname, (double)READY_DELTA_CM, READY_DROP_TICKS_REQUIRED);
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
    case MQTT_EVENT_BEFORE_CONNECT:
      Serial.println("MQTT_EVENT_BEFORE_CONNECT");
      break;

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
  cfg.keepalive = 120;
  cfg.disable_clean_session = false;
  cfg.disable_auto_reconnect = false;
  cfg.reconnect_timeout_ms = 8000;
  cfg.buffer_size = 4096;
  Serial.printf("[MQTT] client start uri=%s id=%s\n", cfg.uri, cfg.client_id);
  s_mqtt = esp_mqtt_client_init(&cfg);
  esp_mqtt_client_register_event(s_mqtt, MQTT_EVENT_ANY, mqtt_event_handler, nullptr);
  esp_err_t err = esp_mqtt_client_start(s_mqtt);
  if (err != ESP_OK) {
    Serial.printf("esp_mqtt_client_start err=%d\n", (int)err);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);
  ledcSetup(LEDC_CH_R, LEDC_FREQ_HZ, LEDC_RES_BITS);
  ledcSetup(LEDC_CH_G, LEDC_FREQ_HZ, LEDC_RES_BITS);
  ledcSetup(LEDC_CH_B, LEDC_FREQ_HZ, LEDC_RES_BITS);
  ledcAttachPin(PIN_LED_R, LEDC_CH_R);
  ledcAttachPin(PIN_LED_G, LEDC_CH_G);
  ledcAttachPin(PIN_LED_B, LEDC_CH_B);
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
    if (s_wifiDownSince == 0) {
      s_wifiDownSince = millis();
    }
    if (millis() - s_wifiDownSince < WIFI_DOWN_DEBOUNCE_MS) {
      delay(20);
      return;
    }
    s_mqtt_connected = false;
    Serial.println("[NET] WiFi down — reconnect MQTT after WiFi restore");
    while (!connectWifiFromLists()) {
      delay(3000);
    }
    s_wifiDownSince = 0;
    startMqttClient();
  } else {
    s_wifiDownSince = 0;
  }

  updateUltrasonicSample();
  float cm = s_lastDistCm;

  if (deviceMode == MODE_CHECK_SHOW && millis() >= greenUntilMs) {
    enterDefaultIdle();
  }

  if (deviceMode == MODE_DEFAULT) {
    if (cm >= 0 && cm < FULL_NEAR_CM) {
      if (fullDetectStartMs == 0) {
        fullDetectStartMs = millis();
      } else if (!fullSent && millis() - fullDetectStartMs >= FULL_DETECT_MS) {
        publishStatusFull();
        deviceMode = MODE_FULL;
        fullSent = true;
        applyRgb(true, false, false);  // keep RED
        Serial.println(">>> enter FULL (near <10cm for 1h)");
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

  applyReadyYellowVivid();

  // 초음파 새 샘플이 올 때만(1틱=약 65ms) 감소·스트릭 판단 — loop(20ms) 반복으로 중복 카운트 방지
  if (s_ultraSampleSeq == s_readyLastProcessedUltraSeq) {
    if (millis() >= readyDeadlineMs) {
      publishStatusReadyTimeout();
      enterDefaultIdle();
    }
    delay(20);
    return;
  }
  s_readyLastProcessedUltraSeq = s_ultraSampleSeq;
  cm = s_lastDistCm;

  if (cm >= 0) {
    if (!readyBaselineSet) {
      readyBaselineCm = cm;
      readyBaselineSet = true;
      Serial.printf("[READY] baseline=%.1f cm\n", readyBaselineCm);
    } else {
      float drop = readyBaselineCm - cm;
      if (drop >= READY_DELTA_CM) {
        s_readyDropStreak++;
      } else {
        s_readyDropStreak = 0;
      }

      if (s_readyDropStreak >= READY_DROP_TICKS_REQUIRED) {
        Serial.printf(">>> CHECK trigger drop=%.1f (base=%.1f now=%.1f, streak=%d)\n",
                      (double)drop, (double)readyBaselineCm, (double)cm, s_readyDropStreak);
        publishStatusCheck();
        deviceMode = MODE_CHECK_SHOW;
        applyRgb(false, true, false);  // GREEN
        greenUntilMs = readyDeadlineMs;
        pendingNickname[0] = '\0';
        s_readyDropStreak = 0;
        delay(20);
        return;
      }
    }
  } else {
    s_readyDropStreak = 0;
  }

  if (millis() >= readyDeadlineMs) {
    publishStatusReadyTimeout();
    enterDefaultIdle();
  }
  delay(20);
}

