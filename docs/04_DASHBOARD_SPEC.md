# Current Status

Milestone 1C.8 Complete

# Dashboard Name

Vāac 1.0

Interactive Sound Installation Platform

# Dashboard Purpose

The dashboard serves as:

* Sensor monitoring console
* Calibration console
* Installation setup interface
* Signal verification tool

The dashboard is NOT responsible for audio synthesis.

# Current Dashboard Layout

## Header Area

Displays:

Vāac 1.0

Interactive Sounds

Transforming environmental data into
generative audio experiences.

System developed by
Craftronixlab Technologies

---

## Dashboard Tabs

### Audio Setup

Purpose:

Future audio file selection and
playback configuration.

---

### Sensor Calibration

Purpose:

Calibration, normalization,
runtime control and signal verification.

---

### Audio Mapping Engine

Purpose:

Future Sensor → Audio routing.

---

## Telemetry Console

Displays:

✓ Connect / Disconnect

✓ Connection Status

✓ Packet Age

✓ Frame Counter

✓ Distance

✓ Lux

✓ Temperature

✓ Humidity

Live updates via WebSocket.

# Sensor Cards

One card per sensor:

Distance

Lux

Temperature

Humidity

# Runtime Controls

Each sensor supports:

✓ Enable

✓ Disable

✓ Direct

✓ Inverted

✓ Deadzone Slider

Runtime changes are applied immediately.

# Calibration Controls

Each sensor supports:

Calibration Min

Calibration Max

Set Min

Set Max

Save Calibration

Restore Last Saved

# Observation Controls

Each sensor supports:

Observed Min

Observed Max

Reset Observation

Observation tracking is independent from calibration.

# Signal Display

Every sensor displays:

Raw Value

Calibrated Value

Normalized Value

# Normalized Display

Each sensor includes:

Normalized Progress Bar

Range:

```text
0.0 → 1.0
```

Purpose:

Visual verification of audio control signal.

# Graph Model

The dashboard graph represents:

Calibration Space

NOT sensor space.

# Graph Datasets

Primary Trace:

```text
Calibration Signal
```

Optional Trace:

```text
Raw Signal
```

Reference Lines:

```text
Calibration Min Reference Line

Calibration Max Reference Line
```

# Raw Overlay

Optional.

User may enable:

```text
Show Raw Overlay
```

Purpose:

Compare filtered sensor data against calibrated signal.

# Calibration Workflow

Recommended workflow:

```text
Reset Observation

↓

Move object/person to minimum position

↓

Set Min

↓

Move object/person to maximum position

↓

Set Max

↓

Save Calibration
```

# Save Workflow

Save Calibration

↓

Display

```text
✓ Saved
```

↓

Auto-hide after a few seconds

# Dashboard UX Features

✓ Browser-style Tabs

✓ Responsive Desktop Layout

✓ Responsive Tablet Layout

✓ Responsive Mobile Layout

✓ Runtime Control Buttons

✓ Telemetry Console

✓ Integrated Connection Control

✓ Dashboard Branding

✓ Save Status Notification

# Vāac Signal Model

Dashboard Displays:

```text
Raw

Calibrated

Normalized
```

Graphs Display:

```text
Calibration Signal

Raw Overlay (optional)

Min Reference Line

Max Reference Line
```

Future Audio Engine Receives:

```text
Normalized Only
```

# Future Dashboard Tabs

## Audio Mapping Engine

Current Placeholder

Future Purpose:

Distance → Pitch

Lux → Filter Cutoff

Humidity → Reverb Mix

Temperature → Delay Feedback

## Presets

Planned

Features:

Save

Load

Delete

Export

Import

## System

Planned

Features:

OSC Status

SuperCollider Status

Transport Monitoring

Diagnostics

# Current Milestone

Milestone 1C.8

Dashboard Visual Refinement

Status:
COMPLETE

# Next Milestone

Milestone 1D.1

OSC Transport Layer
