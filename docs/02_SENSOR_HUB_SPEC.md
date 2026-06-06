# 02_SENSOR_HUB_SPEC.md

# Sensor Hub Specification

Status:

Production Baseline

Milestone 1A Complete

# Hardware

Board:

Adafruit ESP32 Feather V2

Sensors:

VL53L1X

VEML6030

AHT20

I2C Pins:

SDA = GPIO22

SCL = GPIO20

# Libraries

ArduinoJson

Adafruit_AHTX0

Adafruit_VL53L1X

SparkFun_VEML6030_Ambient_Light_Sensor

# Transport

USB Serial

115200 Baud

JSON Format

# Current ESP32 Processing

## Distance

Input:

VL53L1X

Outputs:

distance_raw

distance_filtered

Filtering:

5-Sample Median Filter

## Lux

Input:

VEML6030

Outputs:

lux_raw

lux_filtered

Filtering:

Exponential Moving Average

Alpha:

0.15

## Temperature

Input:

AHT20

Outputs:

temp

Filtering:

None

## Humidity

Input:

AHT20

Outputs:

humidity

Filtering:

None

# Packet Format

```json
{
  "frame": 123,
  "distance_raw": 1804,
  "distance_filtered": 1802,
  "lux_raw": 4,
  "lux_filtered": 4.1,
  "temp": 27.75,
  "humidity": 67.42
}
```

# Current Firmware Rules

The ESP32 is responsible only for:

* Sensor acquisition
* Basic filtering
* Sensor validation
* Packet generation
* Transport

The ESP32 is NOT responsible for:

* Calibration
* Normalization
* Mapping
* Presets
* Audio control logic

These functions belong in the backend.

# Validated Features

✓ Sensor Detection

✓ I2C Communication

✓ JSON Output

✓ Frame Counter

✓ Distance Median Filter

✓ Lux EMA Filter

✓ Python Parsing

✓ FastAPI Integration

✓ Dashboard Integration

✓ Calibration Engine Integration

✓ Signal Representation Integration

# Current System Outputs

Distance:

* distance_raw
* distance_filtered

Lux:

* lux_raw
* lux_filtered

Temperature:

* temp

Humidity:

* humidity

Additional signal layers are generated in the backend.

# Future Sensor Expansion

Planned Sensor Categories:

* Plant Biopotential
* Human Biopotential
* IMU
* Capacitive Touch
* Environmental Audio
* Motion Sensors

All future sensors must follow the same architecture:

Raw Value

↓

Filtered Value

↓

Frame Counter

↓

JSON Transport

↓

Backend Calibration

↓

Backend Normalization
