#include <Arduino.h>
#include <cstdio>
#include <cstring>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <mqtt_client.h>
#include <esp_sntp.h>
#include <time.h>

// ========== 모듈 ID (DB modules.serial_number, MQTT greeneye/<id>/…) ==========
// platformio.ini 의 build_flags -DGREENEYE_MODULE_SERIAL=… 로만 설정 (문자열 매크로 이슈 방지용 stringify)
#define GREENEYE_MS_XSTR(s) #s
#define GREENEYE_MS_STR(s) GREENEYE_MS_XSTR(s)
#ifndef GREENEYE_MODULE_SERIAL
#define GREENEYE_MODULE_SERIAL g10
#endif
static const char MODULE_SERIAL_BUF[] = GREENEYE_MS_STR(GREENEYE_MODULE_SERIAL);
static const char *const MODULE_SERIAL = MODULE_SERIAL_BUF;

/**
 * Cloudflare Tunnel: HTTP(S) ??origin greeneye-mosquitto:9001 (Mosquitto WebSockets)
 * ?怨쀪퐨 ?怨뚭퍙 ??됱젟?遺? ?袁る퉸 TLS ??용뮉 WS(80)嚥?edge ?臾믩꺗 ?? tunnel????? WS 9001嚥??袁⑤뼎??뺣뼄.
 * Path??Cloudflare Published route?癒?퐣 ??쑴????怨밴묶(?袁⑷퍥 筌띲끉臾? 疫꿸퀣?.
 */
static const char *MQTT_WS_URI = "ws://mqtt-greeneye.gwon.run:80";

// ========== WiFi ==========
static const char *WIFI_SSIDS[] = {"gwon", "iptime"};
static const char *WIFI_PASSWORDS[] = {"00000000", "Gwondev0323", ""};
static const int WIFI_SSID_COUNT = 2;
static const int WIFI_PASSWORD_COUNT = 3;

// ========== ?? (RGB LED: R=25, G=26, B=27 | ?λ뜆???TRIG=32, ECHO=33) ==========
static const int PIN_TRIG = 32;
static const int PIN_ECHO = 33;
static const int PIN_LED_R = 25;
static const int PIN_LED_G = 26;
static const int PIN_LED_B = 27;
// FULL: 椰꾧퀡??10cm 沃섎챶彛??1??볦퍢 ?怨쀫꺗 ?醫??????춸 ?袁れ넎
static const unsigned long FULL_DETECT_MS = 60UL * 60UL * 1000UL;  // 1 hour
static const float FULL_NEAR_CM = 10.0f;
// baseline ????20cm ??곴맒 揶쎛繹먮슣?숋쭪?椰꾧퀡??揶쏅Ŋ?????λ뜆???"?? 疫꿸퀣? ?怨쀫꺗 N???醫?????CHECK
static const float READY_DELTA_CM = 20.0f;
static const int READY_DROP_TICKS_REQUIRED = 5;
static const uint32_t LEDC_FREQ_HZ = 10000;  // high-frequency PWM for stable color
static const uint8_t LEDC_RES_BITS = 8;
static const int LEDC_CH_R = 0;
static const int LEDC_CH_G = 1;
static const int LEDC_CH_B = 2;
static const unsigned long ULTRA_PING_INTERVAL_MS = 65;
static const unsigned long ULTRA_LOG_INTERVAL_MS = 10000UL;  // 10s

static esp_mqtt_client_handle_t s_mqtt = nullptr;
static volatile bool s_mqtt_connected = false;
/** ?됰슢以덅??怨뚭퍙 ?袁⑹뒠 ID (?醫뤿동??g1 ??癰귢쑨而?. ??덉뵬 ID ??덈뻻 ?臾믩꺗 ??"session taken over" 嚥?cmd ?醫롫뼄 揶쎛????MAC??곗쨮 ?醫롮뵬??*/
static char s_mqtt_client_id[28] = "";
static char s_topicCmd[48] = "";
static char s_topicStatus[52] = "";
static uint64_t s_lastCmdIssuedAt = 0;
static char s_mqttDataAccum[384];
static int s_mqttDataAccumLen = 0;
static char s_mqttTopicAccum[160];

static void buildMqttClientId() {
  uint64_t mac = ESP.getEfuseMac();
  snprintf(
      s_mqtt_client_id,
      sizeof(s_mqtt_client_id),
      "%s-%02X%02X%02X%02X%02X%02X",
      MODULE_SERIAL,
      (unsigned)((mac >> 40) & 0xff),
      (unsigned)((mac >> 32) & 0xff),
      (unsigned)((mac >> 24) & 0xff),
      (unsigned)((mac >> 16) & 0xff),
      (unsigned)((mac >> 8) & 0xff),
      (unsigned)(mac & 0xff));
}
/** Wi-Fi ??볦퍢 ???삫??곗쨮 MQTT??筌띲끇苡???녿????븐늿?좑쭪? ??낅즲嚥? ?????????볦퍢 ??곴맒 筌왖??얜쭍 ???춸 ??肉겼칰?*/
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
/** ?λ뜆?????筌β돦?????륁궞 ???춳??筌앹빓? (loop 20ms?? ?얜떯???띿쓺 1??1??묐탣) */
static uint32_t s_ultraSampleSeq = 0;
static int s_readyDropStreak = 0;
/** READY 筌욊쑴??筌욊낱????살삋??s_lastDistCm??곗쨮 ?怨쀪텦??? ??낅즲嚥?筌띾뜆?筌?筌ｌ꼶?????묐탣 甕곕뜇??*/
static uint32_t s_readyLastProcessedUltraSeq = 0;

static void buildMqttTopics() {
  snprintf(s_topicCmd, sizeof(s_topicCmd), "greeneye/%s/cmd", MODULE_SERIAL);
  snprintf(s_topicStatus, sizeof(s_topicStatus), "greeneye/%s/status", MODULE_SERIAL);
}

void rgbPwm(uint8_t r, uint8_t g, uint8_t b) {
  ledcWrite(LEDC_CH_R, r);
  ledcWrite(LEDC_CH_G, g);
  ledcWrite(LEDC_CH_B, b);
}

void applyRgb(bool red, bool green, bool blue) {
  rgbPwm(red ? 255 : 0, green ? 255 : 0, blue ? 255 : 0);
}

/** READY: ??뽯땾 ?紐껋삂??揶쎛繹먯빓苡?(?諭源??⑥눖??LED 癰귣똻?? */
void applyReadyYellowVivid() { rgbPwm(255, 50, 0); }

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

/** HC-SR04?? ??쎈솭 ??-1, ?醫륁뒞 ??cm (????2~400) */
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
  publishDoc(s_topicStatus, doc);
  Serial.println(">>> status CHECK");
}

void publishStatusReadyTimeout() {
  StaticJsonDocument<160> doc;
  doc["status"] = "READY";
  doc["userId"] = pendingNickname;
  publishDoc(s_topicStatus, doc);
  Serial.println(">>> status READY (timeout)");
}

void publishStatusFull() {
  StaticJsonDocument<160> doc;
  doc["status"] = "FULL";
  doc["moduleSerial"] = MODULE_SERIAL;
  publishDoc(s_topicStatus, doc);
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
  uint64_t issuedMs = 0;
  if (!doc["issuedAt"].isNull()) {
    issuedMs = (uint64_t)doc["issuedAt"].as<double>();
  }
  if (issuedMs > 0) {
    if (issuedMs <= s_lastCmdIssuedAt) {
      Serial.printf("cmd ignored duplicate issuedAt=%llu last=%llu\n",
                    (unsigned long long)issuedMs, (unsigned long long)s_lastCmdIssuedAt);
      return;
    }
    // NTP 동기화된 경우에만 오래된 retained(재부팅 직후) 폐기. 시계 '미래' 검사는 ESP 시차로 정상 cmd가 버려져 제거.
    if (sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED) {
      time_t tsec = time(nullptr);
      if (tsec > 1700000000) {
        uint64_t nowMs = (uint64_t)tsec * 1000ULL;
        const uint64_t staleMax = 600000ULL;  // 10분 지난 retained cmd
        if (nowMs > issuedMs + staleMax) {
          Serial.printf("cmd ignored stale issuedAt age_ms=%llu\n",
                        (unsigned long long)(nowMs - issuedMs));
          return;
        }
      }
    }
  }
  const char *uid = doc["userId"];
  if (!uid || !uid[0]) {
    uid = doc["nickname"];
  }
  if (!uid || !uid[0]) {
    Serial.println("no userId/nickname");
    return;
  }
  if (issuedMs > 0) {
    s_lastCmdIssuedAt = issuedMs;
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
      s_mqttDataAccumLen = 0;
      if (deviceMode == MODE_FULL || fullSent) {
        publishStatusFull();
      }
      esp_mqtt_client_subscribe(s_mqtt, s_topicCmd, 1);
      Serial.printf("sub %s\n", s_topicCmd);
      break;

    case MQTT_EVENT_DISCONNECTED: {
      s_mqtt_connected = false;
      s_mqttDataAccumLen = 0;
      if (event->error_handle) {
        Serial.printf("MQTT_EVENT_DISCONNECTED type=%d esp_tls=%d sock_errno=%d\n",
                        (int)event->error_handle->error_type,
                        event->error_handle->esp_tls_last_esp_err,
                        event->error_handle->esp_transport_sock_errno);
      } else {
        Serial.println("MQTT_EVENT_DISCONNECTED");
      }
      break;
    }

    case MQTT_EVENT_SUBSCRIBED:
      Serial.printf("MQTT_EVENT_SUBSCRIBED msg_id=%d\n", event->msg_id);
      break;

    case MQTT_EVENT_DATA: {
      if (event->topic_len > 0) {
        int tl = event->topic_len;
        if (tl >= (int)sizeof(s_mqttTopicAccum)) {
          tl = sizeof(s_mqttTopicAccum) - 1;
        }
        memcpy(s_mqttTopicAccum, event->topic, tl);
        s_mqttTopicAccum[tl] = '\0';
        s_mqttDataAccumLen = 0;
      }

      int offset = event->current_data_offset;
      int chunk = event->data_len;
      if (offset < 0 || chunk < 0 || offset + chunk >= (int)sizeof(s_mqttDataAccum)) {
        Serial.println("[MQTT] cmd payload too large");
        s_mqttDataAccumLen = 0;
        break;
      }
      memcpy(s_mqttDataAccum + offset, event->data, chunk);
      s_mqttDataAccumLen = offset + chunk;
      if (s_mqttDataAccumLen < event->total_data_len) {
        break;
      }
      s_mqttDataAccum[s_mqttDataAccumLen] = '\0';

      Serial.printf("[MQTT] %s %s\n", s_mqttTopicAccum, s_mqttDataAccum);
      if (strstr(s_mqttTopicAccum, "/cmd") != nullptr) {
        handleIncomingCmdPayload(s_mqttDataAccum);
      }
      s_mqttDataAccumLen = 0;
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

  if (s_mqtt_client_id[0] == '\0') {
    buildMqttClientId();
  }

  esp_mqtt_client_config_t cfg = {};
  cfg.uri = MQTT_WS_URI;
  cfg.client_id = s_mqtt_client_id;
  // Cloudflare WS: 유휴·PING 미응답 시 반쪽 연결(zombie) → 구독은 됐는데 live cmd가 안 옴. 짧은 keepalive + 주기적 refresh.
  cfg.keepalive = 15;
  cfg.refresh_connection_after_ms = 120000;
  // cmd는 서버가 retained=true로 publish → clean session이어도 구독 직후 마지막 cmd 수신. persistent session은 zombie·session taken over 유발.
  cfg.disable_clean_session = false;
  cfg.disable_auto_reconnect = false;
  cfg.reconnect_timeout_ms = 5000;
  cfg.network_timeout_ms = 10000;
  cfg.buffer_size = 4096;
  Serial.printf("[MQTT] client start uri=%s id=%s (topic cmd still greeneye/%s/cmd)\n",
                cfg.uri, cfg.client_id, MODULE_SERIAL);
  s_mqtt = esp_mqtt_client_init(&cfg);
  esp_mqtt_client_register_event(s_mqtt, MQTT_EVENT_ANY, mqtt_event_handler, nullptr);
  esp_err_t err = esp_mqtt_client_start(s_mqtt);
  if (err != ESP_OK) {
    Serial.printf("esp_mqtt_client_start err=%d\n", (int)err);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("======== GREENEYE BOOT ========");
  Serial.printf("MODULE_SERIAL=%s  MQTT: greeneye/%s/cmd | greeneye/%s/status\n",
                MODULE_SERIAL, MODULE_SERIAL, MODULE_SERIAL);
  Serial.printf("build %s %s\n", __DATE__, __TIME__);
  Serial.println("==============================");
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
  // TLS ?紐꾩쵄???醫륁뒞疫꿸퀗而?野꺜??肉???뽯뮞????볦퍢 ?袁⑹뒄 ??沃섎챶猷욄묾怨좎넅 ??mbedtls ?紐껊굡?怨쀬뵠????쎈솭揶쎛 ????
  configTime(9 * 3600, 0, "pool.ntp.org", "time.google.com");
  Serial.print("NTP sync");
  for (int i = 0; i < 40 && time(nullptr) < 1700000000; i++) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("time=%ld\n", (long)time(nullptr));
  Serial.printf("MQTT WS URI: %s\n", MQTT_WS_URI);
  buildMqttClientId();
  buildMqttTopics();
  Serial.printf("[MQTT] broker client_id=%s\n", s_mqtt_client_id);
  Serial.printf("[MQTT] topics cmd=%s status=%s\n", s_topicCmd, s_topicStatus);
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
    Serial.println("[NET] WiFi down ??reconnect MQTT after WiFi restore");
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

  // ?λ뜆???????묐탣???????춸(1????65ms) 揶쏅Ŋ?쇱쮯??쎈뱜???癒?뼊 ??loop(20ms) 獄쏆꼶???곗쨮 餓λ쵎??燁삳똻???獄쎻뫗?
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

