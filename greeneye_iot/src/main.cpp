#include <Arduino.h>
#include <cstring>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <mqtt_client.h>

// Arduino WiFiClientSecure 의 esp_crt_bundle.h 가 IDF 헤더와 이름이 겹쳐 SDK 심볼을 가림 → 전방 선언
extern "C" esp_err_t esp_crt_bundle_attach(void *conf);

// ========== 모듈 고유번호만 수정 (DB modules.serial_number) ==========
static const char *MODULE_SERIAL = "g1";

/**
 * Cloudflare Tunnel: HTTP(S) → origin localhost:9001 (Mosquitto protocol websockets)
 * ESP32는 Raw TCP 1883이 아니라 WSS로 같은 브로커에 붙는다.
 * URI는 환경에 맞게 조정 (경로는 Mosquitto 기본 / 또는 /mqtt — 안 되면 둘 다 시도)
 */
// wss 기본 포트 443. 경로: Mosquitto 기본 WS는 / 인 경우 많음 → 안 되면 "/mqtt" 제거해 "wss://mqtt.greeneye.gwon.run" 만 시도
static const char *MQTT_WSS_URI = "wss://mqtt.greeneye.gwon.run/mqtt";

// ========== WiFi ==========
static const char *WIFI_SSIDS[] = {"gwon", "iptime"};
static const char *WIFI_PASSWORDS[] = {"00000000", "Gwondev0323", ""};
static const int WIFI_SSID_COUNT = 2;
static const int WIFI_PASSWORD_COUNT = 3;

// ========== 핀 ==========
static const int PIN_IR = 34;
static const int PIN_LED_RED = 25;
static const int PIN_LED_YELLOW = 26;
static const int PIN_LED_GREEN = 27;
static const bool IR_DETECTED_IS_LOW = true;

static esp_mqtt_client_handle_t s_mqtt = nullptr;
static volatile bool s_mqtt_connected = false;

char pendingNickname[48] = "";
enum { MODE_DEFAULT, MODE_READY_WAIT, MODE_CHECK_SHOW } deviceMode = MODE_DEFAULT;
unsigned long readyDeadlineMs = 0;
unsigned long greenUntilMs = 0;

String topicReady() { return String("greeneye/") + MODULE_SERIAL + "/ready"; }
String topicStatus() { return String("greeneye/") + MODULE_SERIAL + "/status"; }

void applyLeds(bool red, bool yellow, bool green) {
  digitalWrite(PIN_LED_RED, red ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, yellow ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN, green ? HIGH : LOW);
}

void enterDefaultIdle() {
  deviceMode = MODE_DEFAULT;
  applyLeds(true, false, false);
  pendingNickname[0] = '\0';
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
      WiFi.disconnect(true);
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

void armReady(const char *nick) {
  strncpy(pendingNickname, nick, sizeof(pendingNickname) - 1);
  pendingNickname[sizeof(pendingNickname) - 1] = '\0';
  deviceMode = MODE_READY_WAIT;
  readyDeadlineMs = millis() + 10000UL;
  applyLeds(false, true, false);
  Serial.printf(">>> READY 10s, userId=%s\n", pendingNickname);
}

void handleIncomingReadyPayload(const char *payload) {
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
      Serial.println("MQTT_EVENT_CONNECTED (WSS)");
      s_mqtt_connected = true;
      {
        String tr = topicReady();
        esp_mqtt_client_subscribe(s_mqtt, tr.c_str(), 1);
        Serial.printf("sub %s\n", tr.c_str());
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
      if (strstr(topicBuf, "/ready") != nullptr) {
        handleIncomingReadyPayload(dataBuf);
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
  cfg.uri = MQTT_WSS_URI;
  cfg.client_id = MODULE_SERIAL;
  cfg.keepalive = 60;
  cfg.disable_clean_session = false;
  cfg.disable_auto_reconnect = false;
  cfg.reconnect_timeout_ms = 8000;
  cfg.buffer_size = 4096;
  // esp-tls는 CA 번들·PEM·global store 등 "검증 수단"이 하나는 있어야 함 (전부 null 이면 SSL 설정 실패)
  cfg.use_global_ca_store = false;
  cfg.crt_bundle_attach = esp_crt_bundle_attach;
  cfg.cert_pem = nullptr;
  cfg.skip_cert_common_name_check = false;

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
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  enterDefaultIdle();

  while (!connectWifiFromLists()) {
    Serial.println("WiFi retry 5s");
    delay(5000);
  }
  Serial.printf("MQTT WSS URI: %s\n", MQTT_WSS_URI);
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

  if (deviceMode != MODE_READY_WAIT) {
    delay(20);
    return;
  }

  if (irDetected()) {
    publishStatusCheck();
    deviceMode = MODE_CHECK_SHOW;
    applyLeds(false, false, true);
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
