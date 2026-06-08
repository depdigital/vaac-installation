import random
import audio_manager
from pathlib import Path
import time
import threading
import json
import logging
from logging.handlers import RotatingFileHandler
import osc_transport

heartbeat_lost = False

watchdog_last_seen = time.time()

ASSET_DIR = (
    Path(__file__).resolve().parent.parent
    / "assets"
)

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = (
    LOG_DIR /
    "runtime.log"
)

logger = logging.getLogger(
    "runtime"
)

logger.setLevel(
    logging.INFO
)

if not logger.handlers:

    handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5
    )

    formatter = logging.Formatter(
        "%(asctime)s | %(message)s"
    )

    handler.setFormatter(
        formatter
    )

    logger.addHandler(
        handler
    )
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

STATE_FILE = (
    DATA_DIR /
    "runtime_state.json"
)

system_start_time = time.time()
last_scene_completion_time = time.time()
_previous_scene = None
scene_start_time = None
current_scene = None
scene_active = False
scene_counter = 0
last_scene_duration = 0
scene_completed_count = 0
scene_history = []
recent_scenes = []

def generate_scene():

    global _previous_scene
    global recent_scenes

    pool = audio_manager.get_active_pool()

    assets = [
        str(
            ASSET_DIR /
            pool /
            a["name"]
        )
        for a in audio_manager.get_audio_assets()
    ]

    if not assets:

        raise RuntimeError(
            f"No assets found in active pool: "
            f"{audio_manager.get_active_pool()}"
        )

    for _ in range(100):

        left = random.choice(assets)
        right = random.choice(assets)

        if left == right:
            continue

        scene = (left, right)

        if scene in recent_scenes:
            continue

        _previous_scene = scene

        recent_scenes.append(scene)

        if len(recent_scenes) > 5:
            recent_scenes.pop(0)

        return {
            "left": left,
            "right": right
        }

    raise RuntimeError(
        "Unable to generate scene"
    )


def start_scene():

    global current_scene
    global scene_active
    global scene_counter
    global scene_start_time
    global scene_history

    scene_start_time = time.time()
    
    try:

        current_scene = generate_scene()

    except RuntimeError as e:

        print(e)

        return {

            "error": str(e)

        }

    scene_history.append(
        current_scene
    )

    if len(scene_history) > 10:

        scene_history.pop(0)

    scene_active = True

    scene_counter += 1

    print(
        f"SCENE #{scene_counter}"
    )

    runtime_log(
        f"SCENE #{scene_counter}"
    )

    save_runtime_state()

    return current_scene



def get_current_scene():

    return current_scene


def finish_scene():

    global scene_active
    global last_scene_duration
    global scene_completed_count
    global last_scene_completion_time

    last_scene_completion_time = time.time()

    scene_completed_count += 1

    scene_active = False

    if scene_start_time is not None:

        last_scene_duration = (
            time.time()
            - scene_start_time
        )

        print(
            f"Scene Duration: "
            f"{last_scene_duration:.1f}s"
        )

        runtime_log(
            f"SCENE COMPLETE "
            f"{last_scene_duration:.1f}s"
        )

        save_runtime_state()


def watchdog_worker():

    global heartbeat_lost
    global watchdog_last_seen

    while True:

        watchdog_last_seen = time.time()

        heartbeat_age = (
            time.time()
            - osc_transport.last_heartbeat
        )

        if heartbeat_age > 30:

            if not heartbeat_lost:

                print(
                    "SC HEARTBEAT LOST"
                )
                
                runtime_log(
                    "SC HEARTBEAT LOST"
                )

                heartbeat_lost = True

        else:

            if heartbeat_lost:

                print(
                    "SC HEARTBEAT RESTORED"
                )
                
                runtime_log(
                    "SC HEARTBEAT RESTORED"
                )

                heartbeat_lost = False

        time.sleep(5)


def get_status():

    return {

        "active": scene_active,

        "scene": current_scene,

        "scene_count": scene_counter,

        "last_scene_duration":
            round(
                last_scene_duration,
                1
            ),

        "history_size":
            len(scene_history),

        "uptime_seconds":
            round(
                time.time()
                - system_start_time,
                1
            ),

        "scene_started": scene_counter,

        "scene_completed": scene_completed_count,

    }

def runtime_log(message):

    logger.info(
        message
    )

def save_runtime_state():

    state = {

        "scene_counter":
            scene_counter,

        "scene_completed":
            scene_completed_count,

        "last_scene_duration":
            last_scene_duration
    }

    with open(
        STATE_FILE,
        "w"
    ) as f:

        json.dump(
            state,
            f,
            indent=4
        )

def load_runtime_state():

    global scene_counter
    global scene_completed_count
    global last_scene_duration

    try:

        with open(
            STATE_FILE,
            "r"
        ) as f:

            state = json.load(f)

        scene_counter = (
            state.get(
                "scene_counter",
                0
            )
        )

        scene_completed_count = (
            state.get(
                "scene_completed",
                0
            )
        )

        last_scene_duration = (
            state.get(
                "last_scene_duration",
                0
            )
        )

        print(
            "Runtime state restored"
        )

    except FileNotFoundError:

        print(
            "No runtime state found"
        )

    except Exception as e:

        print(
            "Runtime state load error:",
            e
        )

load_runtime_state()