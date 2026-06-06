# osc_test.py

from osc_transport import OSCTransport
import time

osc = OSCTransport()

while True:

    osc.send(
        "/vaac/distance",
        0.75
    )

    print("sent")

    time.sleep(1)