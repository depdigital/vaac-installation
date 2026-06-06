# Runtime Stability Architecture

FastAPI

↓

OSC Worker

↓

OSC Transport

↓

SuperCollider

↓

Heartbeat

↓

Health Monitoring

↓

Dashboard

---

Runtime Services

1. Serial Worker

Responsibilities:

* Serial acquisition
* Automatic reconnect
* Packet parsing

2. OSC Worker

Responsibilities:

* Sensor OSC streaming
* 20 Hz transport
* Runtime monitoring

3. Watchdog Worker

Responsibilities:

* Heartbeat supervision
* SC connectivity monitoring
* Runtime health tracking

4. Scene Manager

Responsibilities:

* Scene generation
* Scene history
* Scene persistence
* Scene statistics
* Autonomous playback

---

Current Health Sources

OSC Worker Age

Serial Activity Age

SC Heartbeat Age

Watchdog Age

---

Current Runtime Control Flow

Run Installation

↓

Generate Scene

↓

Send Scene

↓

SuperCollider Playback

↓

Receive /scene/finished

↓

Generate Next Scene

↓

Repeat

---

Halt Scene

↓

OSC /scene/stop

↓

Stop Active Playback

↓

Preserve:

* OSCdefs
* Heartbeat
* Runtime State

↓

Ready For Next Run
