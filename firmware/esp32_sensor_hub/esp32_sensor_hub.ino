#include <Wire.h>
#include <ArduinoJson.h>

#include <Adafruit_AHTX0.h>
#include <Adafruit_VL53L1X.h>
#include <SparkFun_VEML6030_Ambient_Light_Sensor.h>

#define AL_ADDR 0x48

Adafruit_AHTX0 aht;
Adafruit_VL53L1X vl53 = Adafruit_VL53L1X();
SparkFun_Ambient_Light light(AL_ADDR);

uint32_t frameCounter = 0;

// --------------------------------------------------
// Distance Median Filter
// --------------------------------------------------

const uint8_t DIST_BUF_SIZE = 5;

int distBuf[DIST_BUF_SIZE];
uint8_t distIndex = 0;
bool distBufferFilled = false;

int median5(int *arr)
{
  int temp[5];

  for (int i = 0; i < 5; i++)
    temp[i] = arr[i];

  for (int i = 0; i < 4; i++)
  {
    for (int j = i + 1; j < 5; j++)
    {
      if (temp[j] < temp[i])
      {
        int t = temp[i];
        temp[i] = temp[j];
        temp[j] = t;
      }
    }
  }

  return temp[2];
}

// --------------------------------------------------
// Lux EMA Filter
// --------------------------------------------------

float luxFiltered = 0;
bool luxInitialized = false;

const float luxAlpha = 0.15f;

// --------------------------------------------------

int lastDistance = 0;

void processSerialCommands()
{
  while (Serial.available())
  {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "HELLO")
    {
      StaticJsonDocument<128> reply;

      reply["type"] = "handshake";
      reply["device"] = "VAAC_SENSOR_HUB";
      reply["firmware"] = "1.1";
      reply["protocol"] = 1;

      serializeJson(reply, Serial);
      Serial.println();
    }
  }
}

void setup()
{
  Serial.begin(115200);
  delay(2000);

  Wire.begin(22, 20);

  // AHT20
  if (aht.begin())
    Serial.println("AHT20 OK");
  else
    Serial.println("AHT20 FAILED");

  // VEML6030
  if (light.begin())
  {
    Serial.println("VEML6030 OK");

    light.setGain(0.125);
    light.setIntegTime(100);
  }
  else
  {
    Serial.println("VEML6030 FAILED");
  }

  // VL53L1X
  if (!vl53.begin(0x29, &Wire))
  {
    Serial.println("VL53L1X FAILED");
  }
  else
  {
    Serial.println("VL53L1X OK");
    vl53.startRanging();
  }

  Serial.println("Sensor Hub Ready");
}

void loop()
{
  processSerialCommands();
  //------------------------------------------------
  // AHT20
  //------------------------------------------------

  sensors_event_t humidity;
  sensors_event_t temp;

  aht.getEvent(&humidity, &temp);

  //------------------------------------------------
  // VEML6030
  //------------------------------------------------

  long luxRaw = light.readLight();

  if (!luxInitialized)
  {
    luxFiltered = luxRaw;
    luxInitialized = true;
  }
  else
  {
    luxFiltered =
        (luxAlpha * luxRaw) +
        ((1.0f - luxAlpha) * luxFiltered);
  }

  //------------------------------------------------
  // VL53L1X
  //------------------------------------------------

  if (vl53.dataReady())
  {
    lastDistance = vl53.distance();

    distBuf[distIndex] = lastDistance;

    distIndex++;

    if (distIndex >= DIST_BUF_SIZE)
    {
      distIndex = 0;
      distBufferFilled = true;
    }

    vl53.clearInterrupt();
  }

  int distanceFiltered = lastDistance;

  if (distBufferFilled)
  {
    distanceFiltered = median5(distBuf);
  }

  //------------------------------------------------
  // JSON Output
  //------------------------------------------------

  StaticJsonDocument<384> doc;

  doc["frame"] = frameCounter++;

  doc["distance_raw"] = lastDistance;
  doc["distance_filtered"] = distanceFiltered;

  doc["lux_raw"] = luxRaw;
  doc["lux_filtered"] = luxFiltered;

  doc["temp"] = temp.temperature;
  doc["humidity"] = humidity.relative_humidity;

  serializeJson(doc, Serial);
  Serial.println();

  delay(50);
}