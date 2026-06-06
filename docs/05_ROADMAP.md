# Vāac 1.0 Development Roadmap

---

# Completed Milestones

## 1A

ESP32 Sensor Hub

Status:
COMPLETE

Deliverables:

✓ ESP32 Feather V2 Integration

✓ VL53L1X Integration

✓ VEML6030 Integration

✓ AHT20 Integration

✓ JSON Transport

✓ Frame Counter

---

## 1B.1

ESP32 → Python Sensor Daemon

Status:
COMPLETE

Deliverables:

✓ Serial Communication

✓ JSON Parsing

✓ Sensor Validation

✓ Packet Handling

---

## 1B.2

Python → FastAPI

Status:
COMPLETE

Deliverables:

✓ Shared State Layer

✓ FastAPI Integration

✓ Backend Hosting

---

## 1B.3

FastAPI → WebSocket

Status:
COMPLETE

Deliverables:

✓ WebSocket Broadcasting

✓ Live Dashboard Updates

✓ Real-Time Data Transport

---

## 1B.4

Dashboard UI

Status:
COMPLETE

Deliverables:

✓ Dashboard Layout

✓ Sensor Display

✓ Connection Monitoring

---

## 1B.5

Live Graphs

Status:
COMPLETE

Deliverables:

✓ Distance Graph

✓ Lux Graph

✓ Temperature Graph

✓ Humidity Graph

✓ Real-Time Plotting

---

## 1C.1

Calibration Engine

Status:
COMPLETE

Deliverables:

✓ Calibration Ranges

✓ Normalization

✓ Config Persistence

---

## 1C.2

Calibration Dashboard

Status:
COMPLETE

Deliverables:

✓ Calibration Controls

✓ Live Preview

✓ Configuration Save/Restore

---

## 1C.5

Installation Control Dashboard

Status:
COMPLETE

Deliverables:

✓ Responsive Layout

✓ Connect / Disconnect

✓ Connection Status

✓ Packet Age

✓ Sensor Enable

✓ Sensor Disable

✓ Sensor Invert

✓ Sensor Deadzone

✓ Observation Tracking

✓ Reset Observation

✓ Global Save Calibration

✓ Restore Last Saved

---

## 1C.6

Signal Representation Layer

Status:
COMPLETE

Deliverables:

✓ Raw Signals

✓ Filtered Signals

✓ Calibrated Signals

✓ Normalized Signals

✓ Unified Signal Model

✓ Dashboard Integration

# Vāac Signal Model

Sensor

↓

Raw

↓

Filtered

↓

Calibrated

↓

Normalized

↓

OSC

↓

SuperCollider

---

## 1C.7

Calibration Workflow Enhancement

Status:
COMPLETE

Deliverables:

✓ Sensor Status Indicator

✓ Runtime Controls

✓ Set Min

✓ Set Max

✓ Observation Reset

✓ Calibration Space Graphs

✓ Raw Overlay

✓ Min Reference Line

✓ Max Reference Line

✓ Normalized Progress Bars

✓ Responsive Calibration Workflow

---

## 1C.8

Dashboard Visual Refinement

Status:
COMPLETE

Deliverables:

✓ Browser-style Tabs

✓ Audio Setup Tab

✓ Sensor Calibration Tab

✓ Audio Mapping Engine Tab

✓ Responsive Dashboard Layout

✓ Telemetry Console

✓ Runtime Control Redesign

✓ Integrated Connection Controls

✓ Dashboard Branding

✓ Professional Installation UI

✓ Save Status Notification

✓ Calibration Workflow Refinement

---

# Next Major Milestone

## 1D.1

OSC Transport Layer

Status:
READY TO START

Purpose:

Transmit normalized sensor values to external audio systems.

Deliverables:

✓ OSC Client

✓ Configurable Host

✓ Configurable Port

✓ OSC Routing Layer

✓ Connection Monitoring

✓ Dashboard Integration

Example OSC Messages:

```text
/vaac/distance 0.63

/vaac/lux 0.41

/vaac/temp 0.28

/vaac/humidity 0.77
```

Normalized Range:

```text
0.0 → 1.0
```

---

## 1D.2

Preset Management

Status:
PLANNED

Deliverables:

✓ Save Preset

✓ Load Preset

✓ Delete Preset

✓ Export Preset

✓ Import Preset

---

# Future Milestones

## 2A

Mapping Engine

Purpose:

Sensor → Audio Routing

Examples:

Distance → Pitch

Lux → Filter Cutoff

Temperature → Feedback

Humidity → Reverb Mix

---

## 2B

SuperCollider Integration

Purpose:

Real-Time Audio Synthesis

Deliverables:

✓ OSC Reception

✓ Parameter Routing

✓ Audio Control Layer

---

## 3

Advanced Audio Engine

Deliverables:

✓ Multi-Voice Synthesis

✓ Granular Processing

✓ Adaptive DSP

✓ Spatial Audio

---

## 4

Biopotential Sensors

Deliverables:

✓ Plant Sensors

✓ Human Biopotential Sensors

✓ Biofeedback Routing

---

## 5

Live Audio Processing

Deliverables:

✓ Microphone Input

✓ Live DSP

✓ Environmental Audio Interaction
