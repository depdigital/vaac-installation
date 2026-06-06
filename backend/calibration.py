import json
from pathlib import Path

CONFIG_FILE = (
    Path(__file__).parent /
    "config" /
    "config.json"
)

observed_ranges = {
    "distance": {
        "min": 999999,
        "max": -999999
    },

    "lux": {
        "min": 999999,
        "max": -999999
    },

    "temp": {
        "min": 999999,
        "max": -999999
    },

    "humidity": {
        "min": 999999,
        "max": -999999
    }
}


def load_config():

    with open(CONFIG_FILE, "r") as f:
        return json.load(f)


def save_config(config):

    with open(CONFIG_FILE, "w") as f:

        json.dump(
            config,
            f,
            indent=4
        )


def get_observed():

    return observed_ranges


def reset_observed():

    global observed_ranges

    observed_ranges = {

        "distance": {
            "min": 999999,
            "max": -999999
        },

        "lux": {
            "min": 999999,
            "max": -999999
        },

        "temp": {
            "min": 999999,
            "max": -999999
        },

        "humidity": {
            "min": 999999,
            "max": -999999
        }
    }


def update_observed(
    sensor_name,
    value
):

    observed_ranges[sensor_name]["min"] = min(
        observed_ranges[sensor_name]["min"],
        value
    )

    observed_ranges[sensor_name]["max"] = max(
        observed_ranges[sensor_name]["max"],
        value
    )


def normalize(
    value,
    minimum,
    maximum
):

    if maximum <= minimum:
        return 0.0

    value = max(
        minimum,
        min(
            value,
            maximum
        )
    )

    return (
        value - minimum
    ) / (
        maximum - minimum
    )


def apply_deadzone(
    value,
    deadzone_percent
):

    deadzone = (
        deadzone_percent / 100.0
    )

    if value < deadzone:
        return 0.0

    return value


def calculate_calibrated_value(
    value,
    minimum,
    maximum,
    invert
):

    value = max(
        minimum,
        min(
            value,
            maximum
        )
    )

    if invert:

        value = (
            maximum -
            (value - minimum)
        )

    return value


def apply_calibration(packet):

    config = load_config()

    update_observed(
        "distance",
        packet["distance_filtered"]
    )

    update_observed(
        "lux",
        packet["lux_filtered"]
    )

    update_observed(
        "temp",
        packet["temp"]
    )

    update_observed(
        "humidity",
        packet["humidity"]
    )

    sensors = [

        (
            "distance",
            packet["distance_filtered"]
        ),

        (
            "lux",
            packet["lux_filtered"]
        ),

        (
            "temp",
            packet["temp"]
        ),

        (
            "humidity",
            packet["humidity"]
        )
    ]

    for sensor_name, value in sensors:

        cfg = config[sensor_name]

        calibrated = calculate_calibrated_value(
            value,
            cfg["min"],
            cfg["max"],
            cfg["invert"]
        )

        normalized = normalize(
            calibrated,
            cfg["min"],
            cfg["max"]
        )

        normalized = apply_deadzone(
            normalized,
            cfg["deadzone"]
        )

        if not cfg["enabled"]:

            normalized = 0.0

        packet[
            f"{sensor_name}_calibrated"
        ] = calibrated

        packet[
            f"{sensor_name}_normalized"
        ] = normalized

        packet[
            f"{sensor_name}_observed_min"
        ] = observed_ranges[
            sensor_name
        ]["min"]

        packet[
            f"{sensor_name}_observed_max"
        ] = observed_ranges[
            sensor_name
        ]["max"]

    return packet