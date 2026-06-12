import json
from pathlib import Path

CONFIG_FILE = (
    Path(__file__).parent
    / "audio_mapping.json"
)

DEFAULT_CONFIG = {

    "global": {

    "masterGain": 1.0,
    "dspEnabled": True

},

    "eq": {

            "enabled": False,

            "low": {

                "master": 0.0,
                "sensor": "none",
                "amount": 0.0
            },

            "mid": {

                "master": 0.0,
                "sensor": "none",
                "amount": 0.0
            },

            "high": {

                "master": 0.0,
                "sensor": "none",
                "amount": 0.0
            }
        },

    "compressor": {

        "enabled": False,

        "threshold": {

            "master": -18.0,
            "sensor": "none",
            "amount": 0.0
        },

        "ratio": {

            "master": 4.0,
            "sensor": "none",
            "amount": 0.0
        },

        "makeup": {

            "master": 0.0,
            "sensor": "none",
            "amount": 0.0
        }
    },

    "gate": {

        "enabled": False,

        "threshold": {

            "master": -40.0,
            "sensor": "none",
            "amount": 0.0
        },

        "attack": {

            "master": 0.01,
            "sensor": "none",
            "amount": 0.0
        },

        "release": {

            "master": 0.20,
            "sensor": "none",
            "amount": 0.0
        }
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

    "chorus": {

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

    "phaser": {

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

    "pitch": {

        "enabled": False,

        "semitones": {

            "master": 0,
            "sensor": "none",
            "amount": 0
        },

        "window": {

            "master": 0.20,
            "sensor": "none",
            "amount": 0.0
        },

        "mix": {

            "master": 0.0,
            "sensor": "none",
            "amount": 0.0
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
    },

    "magneto": {

        "enabled": False,

        "drive": {

            "master": 2.0,
            "sensor": "none",
            "amount": 0.0
        },

        "flutter": {

            "master": 0.10,
            "sensor": "none",
            "amount": 0.0
        },

        "mix": {

            "master": 0.25,
            "sensor": "none",
            "amount": 0.0
        }
    },
    
    "limiter": {

        "enabled": False,

        "level": {

            "master": 0.95,
            "sensor": "none",
            "amount": 0.0
        },

        "release": {

            "master": 0.01,
            "sensor": "none",
            "amount": 0.0
        }
    },


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