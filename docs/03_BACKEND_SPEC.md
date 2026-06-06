# Scene Engine Layer

Current Status:

Production Stable

Components:

scene_manager.py

osc_transport.py

audio_manager.py

---

Scene Lifecycle

Generate Scene

↓

Start Scene

↓

Send Scene

↓

Playback

↓

Completion Event

↓

Finish Scene

↓

Generate Next Scene

---

Runtime Persistence

Stored:

* scene_counter
* scene_completed_count
* last_scene_duration

Storage:

data/runtime_state.json

Restored On Startup:

✓ Yes

---

Runtime Logging

Storage:

logs/runtime.log

Rotation:

5 MB

5 backups

Events Logged:

* Scene Start
* Scene Complete
* Heartbeat Lost
* Heartbeat Restored

---

Health Endpoint

GET

/health

Returns:

* osc_worker_age
* serial_age
* heartbeat_age
* watchdog_age
* connected
* scene_active
* scene_count
* scene_completed

Purpose:

Installation Diagnostics

---

Heartbeat Endpoint

GET

/heartbeat

Returns:

* heartbeat_age
* alive

Purpose:

SuperCollider Runtime Verification

---

Scene Control Endpoints

GET

/scene/send

Purpose:

Generate and send scene

GET

/scene/stop

Purpose:

Halt active scene playback

GET

/scene/status

Purpose:

Scene engine diagnostics

GET

/scene/history

Purpose:

Recent scene history
