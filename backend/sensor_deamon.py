import serial
from serial.tools import list_ports
import json
import threading
import time

SERIAL_PORT = None
BAUD_RATE = 115200

serial_port = None
serial_thread = None

connect_lock = threading.Lock()

connected = False

last_packet_time = 0

last_serial_activity = time.time()

latest_packet = {
    "frame": 0,
    "distance_raw": 0,
    "distance_filtered": 0,
    "lux_raw": 0,
    "lux_filtered": 0,
    "temp": 0,
    "humidity": 0
}

sensor_hub_info = {
    "device": "Unknown",
    "firmware": "Unknown",
    "protocol": 0,
    "port": None
}

def find_sensor_hub():

    print("Scanning serial ports...")

    ports = list_ports.comports()

    for port in ports:

        try:

            print(
                f"Testing {port.device}"
            )

            test_serial = serial.Serial(
                port.device,
                BAUD_RATE,
                timeout=2
            )

            time.sleep(2)

            test_serial.reset_input_buffer()

            test_serial.write(
                b"HELLO\n"
            )

            start_time = time.time()

            while (
                time.time() - start_time
            ) < 2:

                line = (
                    test_serial.readline()
                    .decode(
                        "utf-8",
                        errors="ignore"
                    )
                    .strip()
                )

                if not line:
                    continue

                try:

                    packet = json.loads(
                        line
                    )

                    if (
                        packet.get("type")
                        == "handshake"
                        and
                        packet.get("device")
                        ==
                        "VAAC_SENSOR_HUB"
                    ):

                        print(
                            f"Sensor Hub found on "
                            f"{port.device}"
                        )

                        test_serial.close()

                        sensor_hub_info["device"] = packet.get(
                            "device",
                            "Unknown"
                        )

                        sensor_hub_info["firmware"] = packet.get(
                            "firmware",
                            "Unknown"
                        )

                        sensor_hub_info["protocol"] = packet.get(
                            "protocol",
                            0
                        )

                        sensor_hub_info["port"] = port.device

                        return port.device

                except:
                    pass

            test_serial.close()

        except Exception:

            pass

    return None

def serial_worker():

    global serial_port
    global SERIAL_PORT
    global connected
    global last_packet_time
    global last_serial_activity

    print("Serial worker started")

    while True:

        try:

            if not connected:

                connect()
                time.sleep(5)
                continue

            if serial_port is None:
                time.sleep(0.1)
                continue

            line = serial_port.readline().decode(
                "utf-8",
                errors="ignore"
            ).strip()

            if not line:
                continue

            packet = json.loads(line)

            latest_packet.update(packet)

            last_packet_time = time.time()

            last_serial_activity = time.time()

        except json.JSONDecodeError:
            pass

        except Exception as e:

            print(
                "Serial Error:",
                e
            )

            connected = False

            SERIAL_PORT = None

            try:

                if serial_port:
                    serial_port.close()

            except:
                pass

            serial_port = None

            time.sleep(1)


def connect():

    global serial_port
    global connected
    global SERIAL_PORT

    with connect_lock:

        if connected:
            return True

        try:

            if SERIAL_PORT is None:

                SERIAL_PORT = (
                    find_sensor_hub()
                )

            if SERIAL_PORT is None:

                print(
                    "No Sensor Hub found"
                )

                return False

            print(
                "Opening serial port..."
            )

            serial_port = serial.Serial(
                SERIAL_PORT,
                BAUD_RATE,
                timeout=1
            )

            connected = True

            print(
                "Serial connected"
            )

            return True

        except Exception as e:

            print(
                "Connection failed:",
                e
            )

            connected = False

            serial_port = None

            return False


def disconnect():

    global serial_port
    global SERIAL_PORT
    global connected

    try:

        connected = False
        SERIAL_PORT = None

        if serial_port:

            serial_port.close()

            serial_port = None

        print(
            "Serial disconnected"
        )

        return True

    except Exception as e:

        print(
            "Disconnect failed:",
            e
        )

        return False


def is_connected():

    return connected


def get_connection_info():

    age = 0

    if last_packet_time > 0:

        age = (
            time.time() -
            last_packet_time
        )

    return {

    "connected": connected,

    "packet_age": round(
        age,
        3
    ),

    "port":
        sensor_hub_info["port"],

    "device":
        sensor_hub_info["device"],

    "firmware":
        sensor_hub_info["firmware"],

    "protocol":
        sensor_hub_info["protocol"]
}


def start():

    global serial_thread

    if serial_thread is None:

        serial_thread = threading.Thread(
            target=serial_worker,
            daemon=True
        )

        serial_thread.start()

    connect()