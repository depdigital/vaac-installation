import threading
import time
from fastapi import FastAPI
from fastapi import Body
from fastapi import WebSocket
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pathlib import Path
from contextlib import asynccontextmanager

import asyncio
import sensor_deamon
import calibration
import audio_mapping
import audio_manager
import scene_manager
import osc_transport


from fastapi.responses import FileResponse
from osc_transport import OSCTransport

osc = OSCTransport()

runtime_audio_config = (
    audio_mapping.load_config()
)

def scene_finished_callback(
    address,
    *args
):

    print(
        "SCENE FINISHED RECEIVED"
    )

    scene_manager.finish_scene()

    scene = scene_manager.start_scene()

    if "error" not in scene:

        osc.send_scene(scene)

        time.sleep(0.2)

        apply_runtime_audio_state()


last_osc_send = time.time()

thread_health = {

    "osc_worker":
        time.time()
}

def osc_worker():

    print("OSC worker started")

    global last_osc_send

    while True:

        try:

            packet = calibration.apply_calibration(
                dict(sensor_deamon.latest_packet)
            )

            send_osc(packet)

            thread_health[
                "osc_worker"
            ] = time.time()
            
            last_osc_send = time.time()

        except Exception as e:

            print(
                "OSC Worker Error:",
                e
            )

        time.sleep(0.05)

@asynccontextmanager
async def lifespan(app: FastAPI):

    osc.start_receiver(
        scene_finished_callback
    )

    sensor_deamon.start()

    threading.Thread(
        target=osc_worker,
        daemon=True
    ).start()

    threading.Thread(
    target=scene_manager.watchdog_worker,
    daemon=True
    ).start()

    try:

        yield

    finally:

        print(
            "Shutdown started"
        )

        sensor_deamon.disconnect()

        scene_manager.save_runtime_state()

        for handler in scene_manager.logger.handlers:

            handler.flush()

        print(
            "Shutdown complete"
        )


app = FastAPI(
    lifespan=lifespan
)

BASE_DIR = Path(__file__).resolve().parent
DASHBOARD_DIR = BASE_DIR.parent / "dashboard"

app.mount(
    "/static",
    StaticFiles(directory=str(DASHBOARD_DIR)),
    name="static"
)


@app.get("/")
def root():

    return FileResponse(
        DASHBOARD_DIR / "index.html"
    )

@app.get("/osc-status")
def osc_status():

    return {

        "status": "Active",

        "host": "127.0.0.1",

        "port": 57120,

        "last_tx":
            round(
                time.time() - last_osc_send,
                3
            ),

        "rate": "20 Hz"
    }

@app.get("/asset-pools")
def asset_pools():

    return {
        "pools":
        audio_manager.get_pools()
    }


@app.get("/active-pool")
def active_pool():

    return {
        "pool":
        audio_manager.get_active_pool()
    }


@app.post("/active-pool")
def set_active_pool(
    data: dict = Body(...)
):

    pool = data["pool"]

    audio_manager.set_active_pool(
        pool
    )

    return {
        "status": "ok"
    }

@app.get("/audio-assets")
def audio_assets():

    assets = audio_manager.get_audio_assets()

    return audio_manager.get_audio_summary()

@app.get("/audio-scene-assets")
def audio_scene_assets():

    assets = audio_manager.get_audio_assets()

    return {
        "assets": [
            f"assets/{asset['name']}"
            for asset in assets
        ]
    }

@app.get("/scene/start")
def scene_start():

    return scene_manager.start_scene()


@app.get("/scene/current")
def scene_current():

    return scene_manager.get_current_scene()


@app.post("/scene/finish")
def scene_finish():

    scene_manager.finish_scene()

    return {
        "status":"ok"
    }


@app.get("/scene/status")
def scene_status():

    return scene_manager.get_status()

@app.get("/scene/send")
def scene_send():

    scene = scene_manager.start_scene()

    if "error" in scene:

        return scene

    osc.send_scene(scene)

    time.sleep(0.2)

    apply_runtime_audio_state()

    return scene

@app.get("/scene/stop")
def stop_scene():

    osc.send(
        "/scene/stop",
        1
    )

    print(
        "STOP SCENE SENT"
    )

    return {
        "status": "stopped"
    }


@app.get("/latest")
def latest():

    return calibration.apply_calibration(
        dict(sensor_deamon.latest_packet)
    )

@app.get("/config")
def get_config():

    return calibration.load_config()


@app.post("/config")
def save_config(
    config: dict = Body(...)
):

    calibration.save_config(config)

    return {
        "status": "saved"
    }

@app.get("/audio-config")
def get_audio_config():

    return audio_mapping.load_config()


@app.post("/audio-config")
def save_audio_config(
    config: dict = Body(...)
):

    global runtime_audio_config

    runtime_audio_config = config

    audio_mapping.save_config(
        config
    )

    return {
        "status": "saved"
    }

@app.post("/audio-config/apply")
def apply_audio_config(
    config: dict = Body(...)
):

    global runtime_audio_config

    runtime_audio_config = config

    return {
        "status": "applied"
    }


@app.get("/connection")
def get_connection():

    return sensor_deamon.get_connection_info()


@app.post("/connect")
def connect():

    success = sensor_deamon.connect()

    return {
        "success": success,
        "connected":
        sensor_deamon.is_connected()
    }


@app.post("/disconnect")
def disconnect():

    success = sensor_deamon.disconnect()

    return {
        "success": success,
        "connected":
        sensor_deamon.is_connected()
    }

@app.get("/observed")
def get_observed():

    return calibration.get_observed()


@app.post("/reset-observed")
def reset_observed():

    calibration.reset_observed()

    return {
        "status": "reset"
    }

def compute_parameter(
    packet,
    parameter_config
):

    value = parameter_config[
        "master"
    ]

    sensor = parameter_config[
        "sensor"
    ]

    influence = parameter_config[
        "amount"
    ]

    sensor_value = 0.0

    if sensor == "distance":

        sensor_value = packet[
            "distance_normalized"
        ]

    elif sensor == "lux":

        sensor_value = packet[
            "lux_normalized"
        ]

    elif sensor == "temp":

        sensor_value = packet[
            "temp_normalized"
        ]

    elif sensor == "humidity":

        sensor_value = packet[
            "humidity_normalized"
        ]

    value += (
        sensor_value
        * influence
    )

    return value


def apply_runtime_audio_state():

    packet = calibration.apply_calibration(
        dict(sensor_deamon.latest_packet)
    )

    send_osc(packet)

    print(
        "Runtime audio state applied"
    )


def send_osc(packet):

    osc.send(
        "/vaac/distance",
        packet["distance_normalized"]
    )

    osc.send(
        "/vaac/lux",
        packet["lux_normalized"]
    )

    osc.send(
        "/vaac/temp",
        packet["temp_normalized"]
    )

    osc.send(
        "/vaac/humidity",
        packet["humidity_normalized"]
    )

    global runtime_audio_config

    config = runtime_audio_config

    """
    print(
    "RUNTIME CONFIG MIX:",
    config["delay"]["mix"]["master"]
    )
    """
    #DELAY MODULE
    delay_time = compute_parameter(
        packet,
        config["delay"].get(
            "time",
            {
                "master": 0.05,
                "sensor": "none",
                "amount": 0.0
            }
        )
    )

    delay_feedback = compute_parameter(
            packet,
            config["delay"].get(
                "feedback",
                {
                    "master": 0.01,
                    "sensor": "none",
                    "amount": 0.0
                }
            )
        )

    delay_mix = compute_parameter(
            packet,
            config["delay"]["mix"]
        )

    delay_mix = max(
        0.0,
        min(1.0, delay_mix)
)
    """
    print(
    "TIME",
    round(delay_time, 3),
    "FB",
    round(delay_feedback, 3),
    "MIX",
    round(delay_mix, 3)
    )
    """

    delay_time = max(
    0.01,
    min(0.50, delay_time)
)
#DELAY MODULE ENDS
    
    gain = config["global"]["masterGain"]

    osc.send(
        "/ghost/gain",
        gain
    )

    delay_enabled = 1 if config["delay"]["enabled"] else 0

    osc.send(
        "/ghost/delayEnabled",
        delay_enabled
    )
    
    osc.send(
        "/ghost/delayTime",
        delay_time
    )

    osc.send(
        "/ghost/delayFeedback",
        delay_feedback
    )

    osc.send(
        "/ghost/delayMix",
        delay_mix
    )

    """
    print(
    "TIME", round(delay_time, 3),
    "FB", round(delay_feedback, 3),
    "MIX", round(delay_mix, 3)
    )
    """

    # FLANGER MODULE

    flanger_rate = compute_parameter(
        packet,
        config["flanger"]["rate"]
    )

    flanger_depth = compute_parameter(
        packet,
        config["flanger"]["depth"]
    )

    flanger_mix = compute_parameter(
        packet,
        config["flanger"]["mix"]
    )

    flanger_rate = max(
        0.05,
        min(5.0, flanger_rate)
    )

    flanger_depth = max(
        0.0,
        min(1.0, flanger_depth)
    )

    flanger_mix = max(
        0.0,
        min(1.0, flanger_mix)
    )

    osc.send(
    "/ghost/flangerEnabled",
        1 if config["flanger"]["enabled"] else 0
    )

    osc.send(
        "/ghost/flangerRate",
        flanger_rate
    )

    osc.send(
        "/ghost/flangerDepth",
        flanger_depth
    )

    osc.send(
        "/ghost/flangerMix",
        flanger_mix
    )
    
    

@app.get("/health")
def health():

    osc_age = (
        time.time()
        - thread_health[
            "osc_worker"
        ]
    )

    serial_age = (
        time.time()
        - sensor_deamon.last_serial_activity
    )

    heartbeat_age = (
        time.time()
        - osc_transport.last_heartbeat
    )

    watchdog_age = (
        time.time()
        - scene_manager.watchdog_last_seen
    )

    return {

        "osc_worker_age":
            round(
                osc_age,
                1
            ),

        "serial_age":
            round(
                serial_age,
                1
            ),

        "heartbeat_age":
            round(
                heartbeat_age,
                1
            ),

        "watchdog_age":
            round(
                watchdog_age,
                1
            ),

        "healthy":

            osc_age < 10
            and
            serial_age < 30
            and
            heartbeat_age < 30
            and
            watchdog_age < 30,

        "connected":
            sensor_deamon.connected,

        "scene_active":
            scene_manager.scene_active,

        "scene_count":
            scene_manager.scene_counter,

        "scene_completed":
            scene_manager.scene_completed_count

    }    


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):

    await ws.accept()

    try:

        while True:

            packet = calibration.apply_calibration(
                dict(sensor_deamon.latest_packet)
            )

            await ws.send_json(
                packet
            )

            await asyncio.sleep(0.05)

    except Exception:
        pass

@app.get("/test-scene")
def test_scene():

    try:

        return scene_manager.generate_scene()

    except RuntimeError as e:

        return {

            "error": str(e)

        }

@app.get("/scene/history")
def scene_history_endpoint():

    return scene_manager.scene_history

@app.get("/heartbeat")
def heartbeat_status():

    age = (
        time.time()
        - osc_transport.last_heartbeat
    )

    return {

        "heartbeat_age":
            round(age, 1),

        "alive":
            age < 30
    }


    