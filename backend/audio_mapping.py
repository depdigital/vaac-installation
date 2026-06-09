import json
from pathlib import Path

CONFIG_FILE = (
    Path(__file__).parent
    / "audio_mapping.json"
)

DEFAULT_CONFIG = {

    "global": {

        "masterGain": 1.0

    },

    "delay": {

        "enabled": True,

        "time": {

            "master": 0.0,

            "sensor": "none",

            "amount": 1.0

        },

        "feedback": {

            "master": 0.0,

            "sensor": "none",

            "amount": 1.0

        },

        "mix": {

            "master": 0.0,

            "sensor": "none",

            "amount": 1.0

        }

    },

    
    "flanger": {

        "enabled": False,

        "rate": {

            "master": 0.20,
            "sensor": "none",
            "amount": 0.00
        },

        "depth": {

            "master": 0.50,
            "sensor": "none",
            "amount": 0.00
        },

        "mix": {

            "master": 0.30,
            "sensor": "none",
            "amount": 0.00
        }
    },

    "reverb": {

        "enabled": False,

        "room": {

            "master": 0.5,
            "sensor": "none",
            "amount": 0.0
        },

        "damping": {

            "master": 0.5,
            "sensor": "none",
            "amount": 0.0
        },

        "mix": {

            "master": 0.3,
            "sensor": "none",
            "amount": 0.0
        }
    }

}

def load_config():

    if not CONFIG_FILE.exists():

        save_config(
            DEFAULT_CONFIG
        )

        return DEFAULT_CONFIG

    with open(
        CONFIG_FILE,
        "r"
    ) as f:

        return json.load(f)


def save_config(config):

    with open(
        CONFIG_FILE,
        "w"
    ) as f:

        json.dump(
            config,
            f,
            indent=4
        )