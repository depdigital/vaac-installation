from pythonosc.udp_client import SimpleUDPClient
from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import ThreadingOSCUDPServer

import threading
import time

last_heartbeat = time.time()


class OSCTransport:

    def __init__(
        self,
        host="127.0.0.1",
        port=57120
    ):

        self.host = host
        self.port = port

        self.client = SimpleUDPClient(
            host,
            port
        )

        self.dispatcher = Dispatcher()

        print(
            f"OSC -> {host}:{port}"
        )

    def send(
        self,
        address,
        value
    ):

        try:

            self.client.send_message(
                address,
                value
            )

        except Exception as e:

            print(
                "OSC Error:",
                e
            )

    def send_scene(
        self,
        scene
    ):

        self.send(
            "/scene/left",
            scene["left"]
        )

        self.send(
            "/scene/right",
            scene["right"]
        )

        print(
            "SCENE SENT:"
        )

        print(
            scene["left"]
        )

        print(
            scene["right"]
        )

    def start_receiver(
        self,
        callback
    ):

        self.dispatcher.map(
            "/scene/finished",
            callback
        )

        self.dispatcher.map(
            "/heartbeat",
            heartbeat_callback
        )

        self.server = ThreadingOSCUDPServer(
            ("127.0.0.1", 9001),
            self.dispatcher
        )

        threading.Thread(
            target=self.server.serve_forever,
            daemon=True
        ).start()

        print(
            "OSC Receiver -> 127.0.0.1:9001"
        )

def heartbeat_callback(
    address,
    *args
):

    global last_heartbeat

    last_heartbeat = time.time()

def stop_receiver(self):

    if hasattr(self, "server"):

        self.server.shutdown()
        self.server.server_close()