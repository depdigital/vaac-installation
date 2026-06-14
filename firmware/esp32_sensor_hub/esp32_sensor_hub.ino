#include <Wire.h>
#include <ArduinoJson.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_VL53L1X.h>
#include <SparkFun_VEML6030_Ambient_Light_Sensor.h>

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
#define AL_ADDR 0x48
const uint8_t DIST_BUF_SIZE = 5;
const float LUX_ALPHA = 0.15f;

// Polling Intervals (milliseconds)
const uint32_t VL53_INTERVAL = 50;
const uint32_t LUX_INTERVAL = 200;
const uint32_t AHT_INTERVAL = 1000;
const uint32_t STREAM_INTERVAL = 100;
const uint32_t HEARTBEAT_INTERVAL = 10000;
const uint32_t VL53_TIMEOUT = 5000;

// ==========================================
// STATE & VARIANCE TYPES
// ==========================================
enum HubState {
  WAIT_FOR_HOST,
  STREAMING
};

// ==========================================
// GLOBAL VARIABLES
// ==========================================
// Hardware Drivers
Adafruit_AHTX0 aht;
Adafruit_VL53L1X vl53 = Adafruit_VL53L1X();
SparkFun_Ambient_Light light(AL_ADDR);

// Core System State
HubState hubState = WAIT_FOR_HOST;
uint32_t frameCounter = 0;

// Non-blocking Timers
uint32_t lastVL53Poll = 0;
uint32_t lastLuxRead = 0;
uint32_t lastAHTRead = 0;
uint32_t lastHeartbeat = 0;
uint32_t lastStreamTime = 0;
uint32_t lastVL53Update = 0;

// Sensor Data Cache
float cachedTemp = 0;
float cachedHumidity = 0;
long luxRaw = 0;
long cachedLuxRaw = 0;
float luxFiltered = 0;
bool luxInitialized = false;

int lastDistance = 0;
int distanceFiltered = 0;

// Distance Filter Buffer
int distBuf[DIST_BUF_SIZE];
uint8_t distIndex = 0;
bool distBufferFilled = false;

// Watchdog / Recovery State
uint8_t vl53RecoveryLevel = 0;

// ==========================================
// FILTER ALGORITHMS
// ==========================================
int median5(int *arr) {
  int temp[5];
  for (int i = 0; i < 5; i++) {
    temp[i] = arr[i];
  }

  // Bubble sort implementation
  for (int i = 0; i < 4; i++) {
    for (int j = i + 1; j < 5; j++) {
      if (temp[j] < temp[i]) {
        int t = temp[i];
        temp[i] = temp[j];
        temp[j] = t;
      }
    }
  }
  return temp[2];
}

// ==========================================
// SENSOR MANAGEMENT & FAULT RECOVERY
// ==========================================
void recoverVL53() {
  Serial.println("VL53 timeout");

  if (vl53RecoveryLevel == 0) {
    Serial.println("VL53 restart ranging");
    vl53.stopRanging();
    delayMicroseconds(100);
    vl53.startRanging();
    vl53RecoveryLevel = 1;
  } 
  else if (vl53RecoveryLevel == 1) {
    Serial.println("VL53 reinit");
    vl53.stopRanging();
    if (vl53.begin(0x29, &Wire)) {
      vl53.startRanging();
    }
    vl53RecoveryLevel = 2;
  } 
  else {
    Serial.println("VL53 reboot ESP");
    ESP.restart();
  }
}

void readAHT20(uint32_t now) {
  if (now - lastAHTRead < AHT_INTERVAL) return;
  lastAHTRead = now;

  sensors_event_t humidity, temp;
  aht.getEvent(&humidity, &temp);

  cachedTemp = temp.temperature;
  cachedHumidity = humidity.relative_humidity;
}

void readVEML6030(uint32_t now) {
  if (now - lastLuxRead < LUX_INTERVAL) return;
  lastLuxRead = now;

  luxRaw = light.readLight();
  cachedLuxRaw = luxRaw;

  if (!luxInitialized) {
    luxFiltered = luxRaw;
    luxInitialized = true;
  } else {
    luxFiltered = (LUX_ALPHA * luxRaw) + ((1.0f - LUX_ALPHA) * luxFiltered);
  }
}

void readVL53L1X(uint32_t now) {
  if (now - lastVL53Poll < VL53_INTERVAL) return;
  lastVL53Poll = now;

  if (vl53.dataReady()) {
    lastDistance = vl53.distance();
    lastVL53Update = now;
    vl53RecoveryLevel = 0;

    distBuf[distIndex] = lastDistance;
    distIndex++;

    if (distIndex >= DIST_BUF_SIZE) {
      distIndex = 0;
      distBufferFilled = true;
    }
    vl53.clearInterrupt();
  }

  // Update distance calculations
  distanceFiltered = lastDistance;
  if (distBufferFilled) {
    distanceFiltered = median5(distBuf);
  }

  // Check hardware timeout watchdog
  if (now - lastVL53Update > VL53_TIMEOUT) {
    recoverVL53();
    lastVL53Update = now;
  }
}

// ==========================================
// SERIAL PROTOCOL & TELEMETRY
// ==========================================
void processSerialCommands() {
  while (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "HELLO") {
      StaticJsonDocument<128> reply;
      reply["type"] = "handshake";
      reply["device"] = "VAAC_SENSOR_HUB";
      reply["firmware"] = "1.2";
      reply["protocol"] = 1;

      serializeJson(reply, Serial);
      Serial.println();
    }
    else if (cmd == "START_STREAM") {
      lastStreamTime = millis();
      lastHeartbeat = millis();
      frameCounter = 0;
      hubState = STREAMING;

      StaticJsonDocument<128> reply;
      reply["type"] = "status";
      reply["state"] = "streaming";

      serializeJson(reply, Serial);
      Serial.println();
    }
    else if (cmd == "STOP_STREAM") {
      hubState = WAIT_FOR_HOST;

      StaticJsonDocument<128> reply;
      reply["type"] = "status";
      reply["state"] = "waiting";

      serializeJson(reply, Serial);
      Serial.println();
    }
  }
}

void handleTelemetry(uint32_t now) {
  // 1. Diagnostics Heartbeat
  if (hubState == STREAMING && now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;

    StaticJsonDocument<128> hb;
    hb["type"] = "heartbeat";
    hb["uptime"] = millis();
    hb["heap"] = ESP.getFreeHeap();

    serializeJson(hb, Serial);
    Serial.println();
  }

  // 2. Continuous Data Streaming
  if (hubState == STREAMING && now - lastStreamTime >= STREAM_INTERVAL) {
    lastStreamTime = now;

    StaticJsonDocument<384> doc;
    doc["frame"] = frameCounter++;
    doc["distance_raw"] = lastDistance;
    doc["distance_filtered"] = distanceFiltered;
    doc["lux_raw"] = cachedLuxRaw;
    doc["lux_filtered"] = luxFiltered;
    doc["temp"] = cachedTemp;
    doc["humidity"] = cachedHumidity;

    serializeJson(doc, Serial);
    Serial.println();
  }
}

// ==========================================
// CORE ARDUINO LIFECYCLE
// ==========================================
void setup() {
  Serial.begin(115200);
  Wire.begin(22, 20);
  Wire.setClock(100000);

  // Initialize filter array
  for (int i = 0; i < DIST_BUF_SIZE; i++) {
    distBuf[i] = 0;
  }

  // Initialize Hardware
  if (aht.begin())                Serial.println("AHT20 OK");
  else                            Serial.println("AHT20 FAILED");

  if (light.begin()) {
    Serial.println("VEML6030 OK");
    light.setGain(0.125);
    light.setIntegTime(100);
  } else {
    Serial.println("VEML6030 FAILED");
  }

  if (!vl53.begin(0x29, &Wire)) {
    Serial.println("VL53L1X FAILED");
  } else {
    Serial.println("VL53L1X OK");
    vl53.startRanging();
    lastVL53Update = millis();
  }

  Serial.println("Sensor Hub Ready");
}

void loop() {
  uint32_t now = millis();

  processSerialCommands();
  
  readAHT20(now);
  readVEML6030(now);
  readVL53L1X(now);
  
  handleTelemetry(now);
}
