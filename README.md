# Ghost Installation Platform

## Raspberry Pi Setup Manual

Version: Milestone 2A.4.2 Stable

---

# 1. Flash Raspberry Pi OS

Use Raspberry Pi Imager.

OS:

* Raspberry Pi OS Lite (64-bit)

Settings:

* Enable SSH
* Configure WiFi
* Set hostname
* Set username/password

Insert SD card and boot Pi.

---

# 2. Connect via SSH

From Mac:

ssh canvas_one@<PI_IP>

Verify:

hostname
uname -a

---

# 3. Update System

sudo apt update
sudo apt upgrade -y

sudo reboot

Reconnect after reboot.

---

# 4. Install Required Packages

sudo apt install -y 
git 
python3 
python3-pip 
python3-venv 
supercollider 
jackd2

---

# 5. Clone Project

cd ~

git clone <REPOSITORY_URL>

cd vaac-installation

Verify:

ls

Expected folders:

assets
backend
dashboard
docs
firmware
presets
sc

---

# 6. Create Python Environment

cd ~/vaac-installation/backend

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt

Verify:

pip freeze

Expected packages:

fastapi
uvicorn
pyserial
websockets
python-osc

---

# 7. Verify Sensor Hub

Connect ESP32 Sensor Hub.

Check:

ls /dev/ttyACM*

Expected:

/dev/ttyACM0

or similar.

No code changes required.

Sensor Hub auto-detection is enabled.

---

# 8. Start Backend

cd ~/vaac-installation/backend

source venv/bin/activate

python app.py

Expected:

Runtime state restored
OSC -> 127.0.0.1:57120
Serial worker started
Sensor Hub found
Serial connected

Leave running.

---

# 9. Start SuperCollider

Open second SSH session.

cd ~/vaac-installation/sc

QT_QPA_PLATFORM=offscreen sclang

Wait for:

*** Welcome to SuperCollider ***

Load runtime:

"/home/canvas_one/vaac-installation/sc/load_runtime.scd".load;

Expected:

Scene Receiver Ready

Leave running.

---

# 10. Verify Dashboard

Open browser:

http://<PI_IP>:8000

Verify:

Dashboard loads
Telemetry updates
Connection status = Connected
Firmware visible
Protocol visible

---

# 11. Verify Scene Playback

From Dashboard:

Select Scene
Send Scene

Expected in SuperCollider:

LEFT RECEIVED
RIGHT RECEIVED
AUTO PLAY
Loading Scene
Playing Scene

---

# 12. Recovery Checks

Unplug Sensor Hub.

Expected:

Serial Error

Reconnect Sensor Hub.

Expected:

Sensor Hub found
Serial connected

No backend restart required.

---

# 13. Power Cycle Test

Shutdown:

sudo shutdown now

Power off.

Power on.

Repeat sections:

8
9
10
11

Verify operation restored.

---

# Current Known Limitation

SuperCollider must currently be started manually.

Backend must currently be started manually.

These will be automated in future milestones using systemd.

---

# Stable Baseline

Milestone 2A.4.2

Includes:

* Sensor Hub Handshake
* Automatic Port Detection
* Automatic Reconnect
* Dashboard Status
* Git Deployment
* SC Clone Validation
* Fresh Pi Deployment Validation
