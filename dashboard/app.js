const MAX_POINTS = 200;

let latestData = null;
let currentConfig = null;
let ws = null;
let lastPacketTime = Date.now();
let reconnectTimer = null;

let dspEnabled = true;
window.dspEnabled = true;


function updateSensorStatus(
    sensor,
    enabled
)
{
    const el =
    document.getElementById(
        sensor + "Status"
    );

    if(!el)
        return;

    if(enabled)
    {
        el.innerText =
        "ACTIVE";

        el.className =
        "sensor-status sensor-active";
    }
    else
    {
        el.innerText =
        "DISABLED";

        el.className =
        "sensor-status sensor-disabled";
    }
}

function createChart(id, label)
{
return new Chart(
document.getElementById(id),
{
type: "line",


        data: {
            labels: [],
            datasets: [

{
    label: "Calibration Signal",
    data: [],
    borderWidth: 3
},

{
    label: "Raw Signal",
    data: [],
    borderWidth: 1,
    hidden: true
},

{
    label: "Min Range",
    data: [],
    borderWidth: 3,
    borderDash: [8,4],
    pointRadius: 0
},

{
    label: "Max Range",
    data: [],
    borderWidth: 3,
    borderDash: [8,4],
    pointRadius: 0
}

]
        },

        options: {
            responsive: true,
            animation: false
        }
    }
);


}

const charts = {
distance: createChart(
"distanceChart",
"Distance"
),

lux: createChart(
    "luxChart",
    "Lux"
),

temp: createChart(
    "tempChart",
    "Temperature"
),

humidity: createChart(
    "humidityChart",
    "Humidity"
)

};

function pushValues(
    chart,
    calibrated,
    raw,
    minValue,
    maxValue
)
{
    chart.data.labels.push("");

    chart.data.datasets[0].data.push(
        calibrated
    );

    chart.data.datasets[1].data.push(
        raw
    );

    chart.data.datasets[2].data.push(
        minValue
    );

    chart.data.datasets[3].data.push(
        maxValue
    );

    if(
        chart.data.labels.length >
        MAX_POINTS
    )
    {
        chart.data.labels.shift();

        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
        chart.data.datasets[2].data.shift();
        chart.data.datasets[3].data.shift();
    }

    chart.update();
}

async function loadConfig()
{
    
const response =
await fetch("/config");


currentConfig =
await response.json();

populateConfig();


}

function populateConfig()
{
const sensors = [
"distance",
"lux",
"temp",
"humidity"
];


sensors.forEach(sensor =>
{
    document.getElementById(
        sensor + "Enabled"
    ).checked =
    currentConfig[sensor].enabled;

    document.getElementById(
        sensor + "Invert"
    ).checked =
    currentConfig[sensor].invert;

    document.getElementById(
        sensor + "Deadzone"
    ).value =
    currentConfig[sensor].deadzone;

    document.getElementById(
        sensor + "Min"
    ).value =
    currentConfig[sensor].min;

    document.getElementById(
        sensor + "Max"
    ).value =
    currentConfig[sensor].max;

    // NEW

    refreshRuntimeButtons(
    sensor
    );
});


}

function collectConfig()
{
const sensors = [
"distance",
"lux",
"temp",
"humidity"
];


const config = {};

sensors.forEach(sensor =>
{
    config[sensor] =
    {
        enabled:
        document.getElementById(
            sensor + "Enabled"
        ).checked,

        invert:
        document.getElementById(
            sensor + "Invert"
        ).checked,

        deadzone:
        Number(
            document.getElementById(
                sensor + "Deadzone"
            ).value
        ),

        min:
        Number(
            document.getElementById(
                sensor + "Min"
            ).value
        ),

        max:
        Number(
            document.getElementById(
                sensor + "Max"
            ).value
        )
    };
});

return config;


}

function getCurrentSensorValue(sensor)
{
    if(!latestData)
        return null;

    switch(sensor)
    {
        case "distance":
            return latestData.distance_filtered;

        case "lux":
            return latestData.lux_filtered;

        case "temp":
            return latestData.temp;

        case "humidity":
            return latestData.humidity;

        default:
            return null;
    }
}

async function applyRuntimeSettings()
{
    const config =
    collectConfig();

    await fetch(
        "/config",
        {
            method: "POST",

            headers:
            {
                "Content-Type":
                "application/json"
            },

            body:
            JSON.stringify(config)
        }
    );
}

async function saveConfig()
{
await fetch(
"/config",
{
method: "POST",


        headers:
        {
            "Content-Type":
            "application/json"
        },

        body:
        JSON.stringify(
            collectConfig()
        )
    }
);

const saveStatus =
document.getElementById(
    "saveStatus"
);

saveStatus.innerText =
"✓ Saved";

saveStatus.style.display =
"inline";

setTimeout(() =>
{
    saveStatus.style.display =
    "none";
},
3000);


}

async function reloadConfig()
{
await loadConfig();


document.getElementById(
    "saveStatus"
).innerText =
"Reloaded";


}

async function updateConnection()
{
const response =
await fetch(
"/connection"
);

const info =
await response.json();

const status =
document.getElementById(
    "connectionStatus"
);

const button =
document.getElementById(
    "connectBtn"
);

document.getElementById(
    "packetAge"
).innerText =
info.packet_age;

if(info.connected)
{
    button.innerText =
        "Disconnect";

    button.style.background =
        "#040404";

    status.innerHTML =
        '<span class="status-good">CONNECTED</span>';
}
else
{
    button.innerText =
        "Connect";

    button.style.background =
        "#2c67c6";

    status.innerHTML =
        '<span class="status-bad">DISCONNECTED</span>';
}

    document.getElementById(
        "deviceName"
    ).innerText =
    info.device || "--";

    document.getElementById(
        "firmwareVersion"
    ).innerText =
    info.firmware || "--";

    document.getElementById(
        "protocolVersion"
    ).innerText =
    info.protocol || "--";

    document.getElementById(
        "portName"
    ).innerText =
    info.port || "--";

}

async function toggleConnection()
{
const response =
await fetch(
"/connection"
);

const info =
await response.json();

if(info.connected)
{
    await fetch(
        "/disconnect",
        {
            method:"POST"
        }
    );
}
else
{
    await fetch(
        "/connect",
        {
            method:"POST"
        }
    );
}

await updateConnection();

}

async function resetObserved()
{
await fetch(
"/reset-observed",
{
method:"POST"
}
);
}

function updateProgressBar(
    id,
    normalized
)
{
    const bar =
    document.getElementById(id);

    const width =
    normalized * 100;

    bar.style.width =
    Math.max(width, 1) + "%";
}

function startWebSocket()
{
ws = new WebSocket(
`ws://${location.host}/ws`
);

ws.onmessage = event =>
{
    const d =
    JSON.parse(
        event.data
    );

    lastPacketTime = Date.now();
    latestData = d;

    // DISTANCE

document.getElementById(
    "distanceRaw"
).innerText =
Math.round(
    d.distance_filtered
);

document.getElementById(
    "distanceCalibrated"
).innerText =
Math.round(
    d.distance_calibrated
);

document.getElementById(
    "distanceNormalized"
).innerText =
Number(
    d.distance_normalized
).toFixed(2);


// LUX

document.getElementById(
    "luxRaw"
).innerText =
Number(
    d.lux_filtered
).toFixed(1);

document.getElementById(
    "luxCalibrated"
).innerText =
Number(
    d.lux_calibrated
).toFixed(1);

document.getElementById(
    "luxNormalized"
).innerText =
Number(
    d.lux_normalized
).toFixed(2);


// TEMP

document.getElementById(
    "tempRaw"
).innerText =
Number(
    d.temp
).toFixed(1);

document.getElementById(
    "tempCalibrated"
).innerText =
Number(
    d.temp_calibrated
).toFixed(1);

document.getElementById(
    "tempNormalized"
).innerText =
Number(
    d.temp_normalized
).toFixed(2);


// HUMIDITY

document.getElementById(
    "humidityRaw"
).innerText =
Number(
    d.humidity
).toFixed(1);

document.getElementById(
    "humidityCalibrated"
).innerText =
Number(
    d.humidity_calibrated
).toFixed(1);

document.getElementById(
    "humidityNormalized"
).innerText =
Number(
    d.humidity_normalized
).toFixed(2);

    document.getElementById(
        "frameValue"
    ).innerText =
    d.frame;

    document.getElementById(
        "distanceValue"
    ).innerText =
    d.distance_filtered;

    document.getElementById(
        "luxValue"
    ).innerText =
    Number(
        d.lux_filtered
    ).toFixed(1);

    document.getElementById(
        "tempValue"
    ).innerText =
    Number(
        d.temp
    ).toFixed(1);

    document.getElementById(
        "humidityValue"
    ).innerText =
    Number(
        d.humidity
    ).toFixed(1);

    document.getElementById(
        "distanceObservedMin"
    ).innerText =
    d.distance_observed_min;

    document.getElementById(
        "distanceObservedMax"
    ).innerText =
    d.distance_observed_max;

    document.getElementById(
        "luxObservedMin"
    ).innerText =
    d.lux_observed_min;

    document.getElementById(
        "luxObservedMax"
    ).innerText =
    d.lux_observed_max;

    document.getElementById(
        "tempObservedMin"
    ).innerText =
    d.temp_observed_min;

    document.getElementById(
        "tempObservedMax"
    ).innerText =
    d.temp_observed_max;

    document.getElementById(
        "humidityObservedMin"
    ).innerText =
    d.humidity_observed_min;

    document.getElementById(
        "humidityObservedMax"
    ).innerText =
    d.humidity_observed_max;

    updateProgressBar(
        "distanceBar",
        d.distance_normalized
    );

    updateProgressBar(
        "luxBar",
        d.lux_normalized
    );

    updateProgressBar(
        "tempBar",
        d.temp_normalized
    );

    updateProgressBar(
        "humidityBar",
        d.humidity_normalized
    );

    pushValues(
    charts.distance,
    d.distance_calibrated,
    d.distance_filtered,

    Number(
        document.getElementById(
            "distanceMin"
        ).value
    ),

    Number(
        document.getElementById(
            "distanceMax"
        ).value
    )
);

    pushValues(
    charts.lux,
    d.lux_calibrated,
    d.lux_filtered,

    Number(
        document.getElementById(
            "luxMin"
        ).value
    ),

    Number(
        document.getElementById(
            "luxMax"
        ).value
    )
);

    pushValues(
    charts.temp,
    d.temp_calibrated,
    d.temp,

    Number(
        document.getElementById(
            "tempMin"
        ).value
    ),

    Number(
        document.getElementById(
            "tempMax"
        ).value
    )
);

    pushValues(
    charts.humidity,
    d.humidity_calibrated,
    d.humidity,

    Number(
        document.getElementById(
            "humidityMin"
        ).value
    ),

    Number(
        document.getElementById(
            "humidityMax"
        ).value
    )
);
};

ws.onerror = err =>
{
    console.error(
        "WebSocket ERROR",
        err
    );
};

}

document.getElementById(
"saveConfig"
).onclick =
saveConfig;

document.getElementById(
"reloadConfig"
).onclick =
reloadConfig;

document.getElementById(
"connectBtn"
).onclick =
toggleConnection;

document.getElementById(
"distanceResetObserved"
).onclick =
resetObserved;

document.getElementById(
"luxResetObserved"
).onclick =
resetObserved;

document.getElementById(
"tempResetObserved"
).onclick =
resetObserved;

document.getElementById(
"humidityResetObserved"
).onclick =
resetObserved;

[
    "distance",
    "lux",
    "temp",
    "humidity"
]
.forEach(sensor =>
{
    const checkbox =
    document.getElementById(
        sensor + "ShowRaw"
    );

    if(!checkbox)
        return;

    checkbox.addEventListener(
        "change",
        e =>
    {
        charts[sensor]
            .data
            .datasets[1]
            .hidden =
            !e.target.checked;

        charts[sensor].update();
    });
});

const runtimeSensors =
[
    "distance",
    "lux",
    "temp",
    "humidity"
];

runtimeSensors.forEach(sensor =>
{
    // ENABLED

    document
    .getElementById(
        sensor + "Enabled"
    )
    .addEventListener(
        "change",
        async () =>
    {
        updateSensorStatus(
            sensor,
            document
            .getElementById(
                sensor + "Enabled"
            )
            .checked
        );

        await applyRuntimeSettings();
    });

    // INVERT

    document
    .getElementById(
        sensor + "Invert"
    )
    .addEventListener(
        "change",
        async () =>
    {
        await applyRuntimeSettings();
    });

    // DEADZONE

    document
    .getElementById(
        sensor + "Deadzone"
    )
    .addEventListener(
        "change",
        async () =>
    {
        await applyRuntimeSettings();
    });
});

[
    "distance",
    "lux",
    "temp",
    "humidity"
]
.forEach(sensor =>
{
    const minBtn =
    document.getElementById(
        sensor + "CurrentMin"
    );

    if(minBtn)
    {
        minBtn.addEventListener(
            "click",
            () =>
        {
            const value =
            getCurrentSensorValue(
                sensor
            );

            if(value === null)
                return;

            document.getElementById(
                sensor + "Min"
            ).value =
            Number(value).toFixed(1)
        });
    }
});

[
    "distance",
    "lux",
    "temp",
    "humidity"
]
.forEach(sensor =>
{
    const maxBtn =
    document.getElementById(
        sensor + "CurrentMax"
    );

    if(maxBtn)
    {
        maxBtn.addEventListener(
            "click",
            () =>
        {
            const value =
            getCurrentSensorValue(
                sensor
            );

            if(value === null)
                return;

            document.getElementById(
                sensor + "Max"
            ).value =
            Number(value).toFixed(1)
        });
    }
});

loadConfig();

updateConnection();

setInterval(
updateConnection,
1000
);

startWebSocket();

document
.querySelectorAll(".tab-button")
.forEach(button => {

    button.addEventListener("click", () => {

        document
        .querySelectorAll(".tab-button")
        .forEach(btn =>
            btn.classList.remove("active")
        );

        document
        .querySelectorAll(".tab-page")
        .forEach(page =>
            page.classList.remove("active")
        );

        button.classList.add("active");

        document
        .getElementById(
            button.dataset.tab
        )
        .classList.add("active");

    });

});

function refreshRuntimeButtons(sensor)
{
    const enabledCheckbox =
        document.getElementById(
            sensor + "Enabled"
        );

    const invertCheckbox =
        document.getElementById(
            sensor + "Invert"
        );

    const enabledBtn =
        document.getElementById(
            sensor + "EnabledBtn"
        );

    const invertBtn =
        document.getElementById(
            sensor + "InvertBtn"
        );

    if(
        !enabledCheckbox ||
        !invertCheckbox ||
        !enabledBtn ||
        !invertBtn
    )
    {
        return;
    }

    enabledBtn.textContent =
        enabledCheckbox.checked
        ? "Disable"
        : "Enable";

    enabledBtn.className =
        enabledCheckbox.checked
        ? "runtime-btn enabled"
        : "runtime-btn disabled";

    invertBtn.textContent =
        invertCheckbox.checked
        ? "Inverted"
        : "Direct";

    invertBtn.className =
        invertCheckbox.checked
        ? "runtime-btn inverted"
        : "runtime-btn direct";

    updateSensorStatus(
        sensor,
        enabledCheckbox.checked
    );
}

function setupRuntimeButtons(sensor)
{
    const enabledCheckbox =
        document.getElementById(
            sensor + "Enabled"
        );

    const invertCheckbox =
        document.getElementById(
            sensor + "Invert"
        );

    const enabledBtn =
        document.getElementById(
            sensor + "EnabledBtn"
        );

    const invertBtn =
        document.getElementById(
            sensor + "InvertBtn"
        );


    enabledBtn.onclick = () =>
    {
        enabledCheckbox.checked =
            !enabledCheckbox.checked;

        enabledCheckbox.dispatchEvent(
            new Event("change")
        );

        refreshRuntimeButtons(sensor);
    };

    invertBtn.onclick = () =>
    {
        invertCheckbox.checked =
            !invertCheckbox.checked;

        invertCheckbox.dispatchEvent(
            new Event("change")
        );

        refreshRuntimeButtons(sensor);
    };

    refreshRuntimeButtons(sensor);
}

[
 "distance",
 "lux",
 "temp",
 "humidity"
]
.forEach(setupRuntimeButtons);

function setupDeadzoneSlider(sensor)
{
    const slider =
        document.getElementById(
            sensor + "Deadzone"
        );

    const value =
        document.getElementById(
            sensor + "DeadzoneValue"
        );

    slider.addEventListener(
        "input",
        () =>
        {
            value.textContent =
                slider.value + "%";
        }
    );
}

[
 "distance",
 "lux",
 "temp",
 "humidity"
]
.forEach(setupDeadzoneSlider);

async function updateOscStatus()
{
    try
    {
        const r =
            await fetch("/osc-status");

        const d =
            await r.json();

        document.getElementById(
            "oscStatus"
        ).textContent = d.status;

        document.getElementById(
            "oscHost"
        ).textContent = d.host;

        document.getElementById(
            "oscPort"
        ).textContent = d.port;

        document.getElementById(
            "oscLastTx"
        ).textContent = d.last_tx;

        document.getElementById(
            "oscRate"
        ).textContent = d.rate;
    }
    catch(e)
    {
        console.error(e);
    }
}

updateOscStatus();

setInterval(
    updateOscStatus,
    1000
);

async function loadAudioAssets()
{
    try
    {
        const response =
            await fetch(
                "/audio-assets"
            );

        const data =
            await response.json();

        const list =
            document.getElementById(
                "audioAssetList"
            );

        if(data.assets.length === 0)
{
    list.innerHTML =
        "No audio assets found";
}
else
{
    list.innerHTML = "";
        
        data.assets.forEach(
    asset =>
    {
        const row =
            document.createElement(
                "div"
            );

        row.textContent =
    `${asset.name} (${asset.size_mb} MB)`;

        list.appendChild(
            row
        );
    }
);

}

        document.getElementById(
            "audioAssetCount"
        ).textContent =
            data.count;

            document.getElementById(
            "audioPoolSize"
        ).textContent =
            data.total_mb;
    }
    catch(err)
    {
        console.error(
            err
        );
    }
}

const runBtn =
    document.getElementById(
        "runInstallationBtn"
    );

if (runBtn)
{
    runBtn.addEventListener(
    "click",
    async () =>
    {
        runBtn.disabled = true;
        runBtn.textContent = "Sending...";

        try
        {
            const response =
                await fetch(
                    "/scene/send"
                );

            await response.json();

            runBtn.textContent =
                "Packet Sent";
        }
        catch(err)
        {
            runBtn.textContent =
                "Failed";

            console.error(err);
        }

        setTimeout(() =>
        {
            runBtn.disabled = false;

            runBtn.textContent =
                "Run";
        },
        2000);
    }
);
}

const stopSceneBtn =
    document.getElementById(
        "stopSceneBtn"
    );

if (stopSceneBtn)
{
    stopSceneBtn.addEventListener(
        "click",
        async () =>
        {
            try
            {
                stopSceneBtn.disabled =
                    true;

                stopSceneBtn.textContent =
                    "Stopping...";

                await fetch(
                    "/scene/stop"
                );

                stopSceneBtn.textContent =
                    "Stopped";

                setTimeout(
                    () =>
                    {
                        stopSceneBtn.disabled =
                            false;

                        stopSceneBtn.textContent =
                            "Halt";
                    },
                    2000
                );
            }
            catch(err)
            {
                console.error(
                    err
                );

                stopSceneBtn.disabled =
                    false;

                stopSceneBtn.textContent =
                    "Stop Scene";
            }
        }
    );
}

document
.getElementById(
    "refreshAssetsBtn"
)
.addEventListener(
    "click",
    loadAudioAssets
);

async function loadPools()
{
    const response =
        await fetch(
            "/asset-pools"
        );

    const data =
        await response.json();

    const select =
        document.getElementById(
            "assetPoolSelect"
        );

    select.innerHTML = "";

    data.pools.forEach(
        pool =>
    {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            pool;

        option.textContent =
            pool;

        select.appendChild(
            option
        );
    });

    const active =
        await fetch(
            "/active-pool"
        );

    const activeData =
        await active.json();

    select.value =
        activeData.pool;
}

const applyPoolBtn =
document.getElementById(
    "applyPoolBtn"
);

if(applyPoolBtn)
{
    applyPoolBtn.addEventListener(
        "click",
        async () =>
    {
        const pool =
        document.getElementById(
            "assetPoolSelect"
        ).value;

        await fetch(
            "/active-pool",
            {
                method:"POST",

                headers:
                {
                    "Content-Type":
                    "application/json"
                },

                body:
                JSON.stringify(
                {
                    pool: pool
                })
            }
        );

        await loadAudioAssets();

        showPoolStatus(
            "✓ Pool Loaded"
        );
    }
);
}

loadPools();
loadAudioAssets();

async function updateRuntimeStatus()
{
    try
    {
        const response =
            await fetch("/health");

        const data =
            await response.json();

        document.getElementById(
            "runtimeStatus"
        ).innerHTML = `

            <div>
                Backend:
                ${
                    data.healthy
                    ? '<span class="status-good">Healthy</span>'
                    : '<span class="status-bad">Fault</span>'
                }
            </div>

            <div>
                Heartbeat:
                ${
                    data.heartbeat_age < 15
                    ? '<span class="status-good">Alive</span>'
                    : '<span class="status-bad">Lost</span>'
                }
            </div>

            <div>
                Serial:
                ${
                    data.connected
                    ? '<span class="status-good">Connected</span>'
                    : '<span class="status-bad">Disconnected</span>'
                }
            </div>

            <div>
                Watchdog:
                ${
                    data.watchdog_age < 10
                    ? '<span class="status-good">✓ Running</span>'
                    : '<span class="status-bad">✗ Stalled</span>'
                }
            </div>

        `;
    }
    catch(err)
    {
        console.error(err);
    }
}

async function updateSceneStatus()
{
    try
    {
        const response =
            await fetch(
                "/scene/status"
            );

        const data =
            await response.json();

        document.getElementById(
            "sceneStatus"
        ).innerHTML = `

            <div>
                Active:
                ${
                    data.active
                    ? '<span class="status-good">Yes</span>'
                    : '<span class="status-bad">No</span>'
                }
            </div>

            <div>
                Scene Count:
                ${
                    data.scene_count
                }
            </div>

            <div>
                Completed:
                ${
                    data.scene_completed
                }
            </div>


            <div>
                Success Rate:
                ${
                    data.scene_count > 0
                    ? Math.round(
                        (data.scene_completed /
                        data.scene_count) * 100
                    )
                    : 0
                }%
            </div>

            <div>
                Last Duration:
                ${
                    data.last_scene_duration
                }s
            </div>

            <div>
                Uptime:
                ${
                    Math.round(
                        data.uptime_seconds
                    )
                }s
            </div>

        `;
    }
    catch(err)
    {
        console.error(err);
    }
}

updateRuntimeStatus();
updateSceneStatus();

setInterval(
    updateRuntimeStatus,
    2000
);

setInterval(
    updateSceneStatus,
    2000
);

setInterval(() =>
{
    const age =
        Date.now() -
        lastPacketTime;

    if(age > 5000)
{
    console.warn(
        "Packet timeout"
    );

    try
    {
        if(ws)
        {
            ws.close();
        }
    }
    catch(e)
    {
        console.error(e);
    }

    ws = null;

    startWebSocket();

    lastPacketTime =
        Date.now();
}

}, 1000);

document.addEventListener(
    "visibilitychange",
    () =>
    {
        if(!document.hidden)
        {
            console.log(
                "Page visible again"
            );

            console.log(
                "Current WS state:",
                ws
                    ? ws.readyState
                    : "null"
            );

            try
            {
                if(ws)
                {
                    ws.close();
                }
            }
            catch(e)
            {
                console.error(e);
            }

            startWebSocket();

            lastPacketTime =
                Date.now();
        }
    }

);

const masterGain =
document.getElementById(
    "masterGain"
);

if(masterGain)
{
    masterGain.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "masterGainValue"
            ).textContent =
            Number(
                masterGain.value
            ).toFixed(2);
        }
    );
}

// EQ MODULE SLIDER

const eqLowMaster =
document.getElementById(
    "eqLowMaster"
);

if(eqLowMaster)
{
    eqLowMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "eqLowMasterValue"
            ).textContent =
            Number(
                eqLowMaster.value
            ).toFixed(1);
        }
    );
}

const eqLowAmount =
document.getElementById(
    "eqLowAmount"
);

if(eqLowAmount)
{
    eqLowAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "eqLowAmountValue"
            ).textContent =
            Number(
                eqLowAmount.value
            ).toFixed(1);
        }
    );
}

const eqMidMaster =
document.getElementById(
    "eqMidMaster"
);

if(eqMidMaster)
{
    eqMidMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "eqMidMasterValue"
            ).textContent =
            Number(
                eqMidMaster.value
            ).toFixed(1);
        }
    );
}

const eqMidAmount =
document.getElementById(
    "eqMidAmount"
);

if(eqMidAmount)
{
    eqMidAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "eqMidAmountValue"
            ).textContent =
            Number(
                eqMidAmount.value
            ).toFixed(1);
        }
    );
}

const eqHighMaster =
document.getElementById(
    "eqHighMaster"
);

if(eqHighMaster)
{
    eqHighMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "eqHighMasterValue"
            ).textContent =
            Number(
                eqHighMaster.value
            ).toFixed(1);
        }
    );
}

const eqHighAmount =
document.getElementById(
    "eqHighAmount"
);

if(eqHighAmount)
{
    eqHighAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "eqHighAmountValue"
            ).textContent =
            Number(
                eqHighAmount.value
            ).toFixed(1);
        }
    );
}

//EQ MODULE SLIDER

// COMPRESSOR MODULE SLIDER

const compressorThresholdMaster =
document.getElementById(
    "compressorThresholdMaster"
);

if(compressorThresholdMaster)
{
    compressorThresholdMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "compressorThresholdMasterValue"
            ).textContent =
            Number(
                compressorThresholdMaster.value
            ).toFixed(0);
        }
    );
}

const compressorThresholdAmount =
document.getElementById(
    "compressorThresholdAmount"
);

if(compressorThresholdAmount)
{
    compressorThresholdAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "compressorThresholdAmountValue"
            ).textContent =
            Number(
                compressorThresholdAmount.value
            ).toFixed(0);
        }
    );
}

const compressorRatioMaster =
document.getElementById(
    "compressorRatioMaster"
);

if(compressorRatioMaster)
{
    compressorRatioMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "compressorRatioMasterValue"
            ).textContent =
            Number(
                compressorRatioMaster.value
            ).toFixed(1);
        }
    );
}

const compressorRatioAmount =
document.getElementById(
    "compressorRatioAmount"
);

if(compressorRatioAmount)
{
    compressorRatioAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "compressorRatioAmountValue"
            ).textContent =
            Number(
                compressorRatioAmount.value
            ).toFixed(1);
        }
    );
}

const compressorMakeupMaster =
document.getElementById(
    "compressorMakeupMaster"
);

if(compressorMakeupMaster)
{
    compressorMakeupMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "compressorMakeupMasterValue"
            ).textContent =
            Number(
                compressorMakeupMaster.value
            ).toFixed(1);
        }
    );
}

const compressorMakeupAmount =
document.getElementById(
    "compressorMakeupAmount"
);

if(compressorMakeupAmount)
{
    compressorMakeupAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "compressorMakeupAmountValue"
            ).textContent =
            Number(
                compressorMakeupAmount.value
            ).toFixed(1);
        }
    );
}

// COMPRESSOR MODULE SLIDER

// GATE MODULE SLIDER

const gateThresholdMaster =
document.getElementById(
    "gateThresholdMaster"
);

if(gateThresholdMaster)
{
    gateThresholdMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "gateThresholdMasterValue"
            ).textContent =
            Number(
                gateThresholdMaster.value
            ).toFixed(0);
        }
    );
}

const gateThresholdAmount =
document.getElementById(
    "gateThresholdAmount"
);

if(gateThresholdAmount)
{
    gateThresholdAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "gateThresholdAmountValue"
            ).textContent =
            Number(
                gateThresholdAmount.value
            ).toFixed(0);
        }
    );
}

const gateAttackMaster =
document.getElementById(
    "gateAttackMaster"
);

if(gateAttackMaster)
{
    gateAttackMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "gateAttackMasterValue"
            ).textContent =
            Number(
                gateAttackMaster.value
            ).toFixed(3);
        }
    );
}

const gateAttackAmount =
document.getElementById(
    "gateAttackAmount"
);

if(gateAttackAmount)
{
    gateAttackAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "gateAttackAmountValue"
            ).textContent =
            Number(
                gateAttackAmount.value
            ).toFixed(3);
        }
    );
}

const gateReleaseMaster =
document.getElementById(
    "gateReleaseMaster"
);

if(gateReleaseMaster)
{
    gateReleaseMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "gateReleaseMasterValue"
            ).textContent =
            Number(
                gateReleaseMaster.value
            ).toFixed(2);
        }
    );
}

const gateReleaseAmount =
document.getElementById(
    "gateReleaseAmount"
);

if(gateReleaseAmount)
{
    gateReleaseAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "gateReleaseAmountValue"
            ).textContent =
            Number(
                gateReleaseAmount.value
            ).toFixed(2);
        }
    );
}

// GATE MODULE SLIDER

//DELAY MODULE SLIDER

const delayTimeMaster =
document.getElementById(
    "delayTimeMaster"
);

if(delayTimeMaster)
{
    delayTimeMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "delayTimeMasterValue"
            ).textContent =
            Number(
                delayTimeMaster.value
            ).toFixed(2);
        }
    );
}

const delayTimeAmount =
document.getElementById(
    "delayTimeAmount"
);

if(delayTimeAmount)
{
    delayTimeAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "delayTimeAmountValue"
            ).textContent =
            Number(
                delayTimeAmount.value
            ).toFixed(2);
        }
    );
}

const delayFeedbackMaster =
document.getElementById(
    "delayFeedbackMaster"
);

if(delayFeedbackMaster)
{
    delayFeedbackMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "delayFeedbackMasterValue"
            ).textContent =
            Number(
                delayFeedbackMaster.value
            ).toFixed(1);
        }
    );
}

const delayFeedbackAmount =
document.getElementById(
    "delayFeedbackAmount"
);

if(delayFeedbackAmount)
{
    delayFeedbackAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "delayFeedbackAmountValue"
            ).textContent =
            Number(
                delayFeedbackAmount.value
            ).toFixed(1);
        }
    );
}

const delayMixMaster =
document.getElementById(
    "delayMixMaster"
);

if(delayMixMaster)
{
    delayMixMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "delayMixMasterValue"
            ).textContent =
            Number(
                delayMixMaster.value
            ).toFixed(2);
        }
    );
}

const delayMixAmount =
document.getElementById(
    "delayMixAmount"
);

if(delayMixAmount)
{
    delayMixAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "delayMixAmountValue"
            ).textContent =
            Number(
                delayMixAmount.value
            ).toFixed(2);
        }
    );
}

//DELAY MODULE SLIDER

//FLANGER MODULE SLIDER

const flangerRateMaster =
document.getElementById(
    "flangerRateMaster"
);

if(flangerRateMaster)
{
    flangerRateMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "flangerRateMasterValue"
            ).textContent =
            Number(
                flangerRateMaster.value
            ).toFixed(2);
        }
    );
}

const flangerRateAmount =
document.getElementById(
    "flangerRateAmount"
);

if(flangerRateAmount)
{
    flangerRateAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "flangerRateAmountValue"
            ).textContent =
            Number(
                flangerRateAmount.value
            ).toFixed(2);
        }
    );
}

const flangerDepthMaster =
document.getElementById(
    "flangerDepthMaster"
);

if(flangerDepthMaster)
{
    flangerDepthMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "flangerDepthMasterValue"
            ).textContent =
            Number(
                flangerDepthMaster.value
            ).toFixed(1);
        }
    );
}

const flangerDepthAmount =
document.getElementById(
    "flangerDepthAmount"
);

if(flangerDepthAmount)
{
    flangerDepthAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "flangerDepthAmountValue"
            ).textContent =
            Number(
                flangerDepthAmount.value
            ).toFixed(1);
        }
    );
}

const flangerMixMaster =
document.getElementById(
    "flangerMixMaster"
);

if(flangerMixMaster)
{
    flangerMixMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "flangerMixMasterValue"
            ).textContent =
            Number(
                flangerMixMaster.value
            ).toFixed(2);
        }
    );
}

const flangerMixAmount =
document.getElementById(
    "flangerMixAmount"
);

if(flangerMixAmount)
{
    flangerMixAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "flangerMixAmountValue"
            ).textContent =
            Number(
                flangerMixAmount.value
            ).toFixed(2);
        }
    );
}

//FLANGER MODULE SLIDER

// CHORUS MODULE SLIDER

const chorusRateMaster =
document.getElementById(
    "chorusRateMaster"
);

if(chorusRateMaster)
{
    chorusRateMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "chorusRateMasterValue"
            ).textContent =
            Number(
                chorusRateMaster.value
            ).toFixed(2);
        }
    );
}

const chorusRateAmount =
document.getElementById(
    "chorusRateAmount"
);

if(chorusRateAmount)
{
    chorusRateAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "chorusRateAmountValue"
            ).textContent =
            Number(
                chorusRateAmount.value
            ).toFixed(2);
        }
    );
}

const chorusDepthMaster =
document.getElementById(
    "chorusDepthMaster"
);

if(chorusDepthMaster)
{
    chorusDepthMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "chorusDepthMasterValue"
            ).textContent =
            Number(
                chorusDepthMaster.value
            ).toFixed(2);
        }
    );
}

const chorusDepthAmount =
document.getElementById(
    "chorusDepthAmount"
);

if(chorusDepthAmount)
{
    chorusDepthAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "chorusDepthAmountValue"
            ).textContent =
            Number(
                chorusDepthAmount.value
            ).toFixed(2);
        }
    );
}

const chorusMixMaster =
document.getElementById(
    "chorusMixMaster"
);

if(chorusMixMaster)
{
    chorusMixMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "chorusMixMasterValue"
            ).textContent =
            Number(
                chorusMixMaster.value
            ).toFixed(2);
        }
    );
}

const chorusMixAmount =
document.getElementById(
    "chorusMixAmount"
);

if(chorusMixAmount)
{
    chorusMixAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "chorusMixAmountValue"
            ).textContent =
            Number(
                chorusMixAmount.value
            ).toFixed(2);
        }
    );
}

// PHASER MODULE SLIDER

const phaserRateMaster =
document.getElementById(
    "phaserRateMaster"
);

if(phaserRateMaster)
{
    phaserRateMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "phaserRateMasterValue"
            ).textContent =
            Number(
                phaserRateMaster.value
            ).toFixed(2);
        }
    );
}

const phaserRateAmount =
document.getElementById(
    "phaserRateAmount"
);

if(phaserRateAmount)
{
    phaserRateAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "phaserRateAmountValue"
            ).textContent =
            Number(
                phaserRateAmount.value
            ).toFixed(2);
        }
    );
}

const phaserDepthMaster =
document.getElementById(
    "phaserDepthMaster"
);

if(phaserDepthMaster)
{
    phaserDepthMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "phaserDepthMasterValue"
            ).textContent =
            Number(
                phaserDepthMaster.value
            ).toFixed(2);
        }
    );
}

const phaserDepthAmount =
document.getElementById(
    "phaserDepthAmount"
);

if(phaserDepthAmount)
{
    phaserDepthAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "phaserDepthAmountValue"
            ).textContent =
            Number(
                phaserDepthAmount.value
            ).toFixed(2);
        }
    );
}

const phaserMixMaster =
document.getElementById(
    "phaserMixMaster"
);

if(phaserMixMaster)
{
    phaserMixMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "phaserMixMasterValue"
            ).textContent =
            Number(
                phaserMixMaster.value
            ).toFixed(2);
        }
    );
}

const phaserMixAmount =
document.getElementById(
    "phaserMixAmount"
);

if(phaserMixAmount)
{
    phaserMixAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "phaserMixAmountValue"
            ).textContent =
            Number(
                phaserMixAmount.value
            ).toFixed(2);
        }
    );
}

// PITCH SHIFT MODULE SLIDER

const pitchSemitonesMaster =
document.getElementById(
    "pitchSemitonesMaster"
);

if(pitchSemitonesMaster)
{
    pitchSemitonesMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "pitchSemitonesMasterValue"
            ).textContent =
            Number(
                pitchSemitonesMaster.value
            ).toFixed(2);
        }
    );
}

const pitchSemitonesAmount =
document.getElementById(
    "pitchSemitonesAmount"
);

if(pitchSemitonesAmount)
{
    pitchSemitonesAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "pitchSemitonesAmountValue"
            ).textContent =
            Number(
                pitchSemitonesAmount.value
            ).toFixed(2);
        }
    );
}

const pitchWindowMaster =
document.getElementById(
    "pitchWindowMaster"
);

if(pitchWindowMaster)
{
    pitchWindowMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "pitchWindowMasterValue"
            ).textContent =
            Number(
                pitchWindowMaster.value
            ).toFixed(2);
        }
    );
}

const pitchWindowAmount =
document.getElementById(
    "pitchWindowAmount"
);

if(pitchWindowAmount)
{
    pitchWindowAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "pitchWindowAmountValue"
            ).textContent =
            Number(
                pitchWindowAmount.value
            ).toFixed(2);
        }
    );
}

const pitchMixMaster =
document.getElementById(
    "pitchMixMaster"
);

if(pitchMixMaster)
{
    pitchMixMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "pitchMixMasterValue"
            ).textContent =
            Number(
                pitchMixMaster.value
            ).toFixed(2);
        }
    );
}

const pitchMixAmount =
document.getElementById(
    "pitchMixAmount"
);

if(pitchMixAmount)
{
    pitchMixAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "pitchMixAmountValue"
            ).textContent =
            Number(
                pitchMixAmount.value
            ).toFixed(2);
        }
    );
}

// REVERB MODULE SLIDER

const reverbRoomMaster =
document.getElementById(
    "reverbRoomMaster"
);

if(reverbRoomMaster)
{
    reverbRoomMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "reverbRoomMasterValue"
            ).textContent =
            Number(
                reverbRoomMaster.value
            ).toFixed(2);
        }
    );
}

const reverbRoomAmount =
document.getElementById(
    "reverbRoomAmount"
);

if(reverbRoomAmount)
{
    reverbRoomAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "reverbRoomAmountValue"
            ).textContent =
            Number(
                reverbRoomAmount.value
            ).toFixed(2);
        }
    );
}

const reverbDampingMaster =
document.getElementById(
    "reverbDampingMaster"
);

if(reverbDampingMaster)
{
    reverbDampingMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "reverbDampingMasterValue"
            ).textContent =
            Number(
                reverbDampingMaster.value
            ).toFixed(2);
        }
    );
}

const reverbDampingAmount =
document.getElementById(
    "reverbDampingAmount"
);

if(reverbDampingAmount)
{
    reverbDampingAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "reverbDampingAmountValue"
            ).textContent =
            Number(
                reverbDampingAmount.value
            ).toFixed(2);
        }
    );
}

const reverbMixMaster =
document.getElementById(
    "reverbMixMaster"
);

if(reverbMixMaster)
{
    reverbMixMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "reverbMixMasterValue"
            ).textContent =
            Number(
                reverbMixMaster.value
            ).toFixed(2);
        }
    );
}

const reverbMixAmount =
document.getElementById(
    "reverbMixAmount"
);

if(reverbMixAmount)
{
    reverbMixAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "reverbMixAmountValue"
            ).textContent =
            Number(
                reverbMixAmount.value
            ).toFixed(2);
        }
    );
}

// REVERB MODULE SLIDER/

// LIMITER MODULE SLIDER

const limiterLevelMaster =
document.getElementById(
    "limiterLevelMaster"
);

if(limiterLevelMaster)
{
    limiterLevelMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "limiterLevelMasterValue"
            ).textContent =
            Number(
                limiterLevelMaster.value
            ).toFixed(2);
        }
    );
}

const limiterLevelAmount =
document.getElementById(
    "limiterLevelAmount"
);

if(limiterLevelAmount)
{
    limiterLevelAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "limiterLevelAmountValue"
            ).textContent =
            Number(
                limiterLevelAmount.value
            ).toFixed(2);
        }
    );
}

const limiterReleaseMaster =
document.getElementById(
    "limiterReleaseMaster"
);

if(limiterReleaseMaster)
{
    limiterReleaseMaster.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "limiterReleaseMasterValue"
            ).textContent =
            Number(
                limiterReleaseMaster.value
            ).toFixed(2);
        }
    );
}

const limiterReleaseAmount =
document.getElementById(
    "limiterReleaseAmount"
);

if(limiterReleaseAmount)
{
    limiterReleaseAmount.addEventListener(
        "input",
        () =>
        {
            document.getElementById(
                "limiterReleaseAmountValue"
            ).textContent =
            Number(
                limiterReleaseAmount.value
            ).toFixed(2);
        }
    );
}

// LIMITER MODULE SLIDER/




function buildAudioConfig()
{
    return {

        global:
        {
            masterGain:
            Number(
                document.getElementById(
                    "masterGain"
                ).value
            ),

            dspEnabled:
            window.dspEnabled

        },

        eq:
        {
            enabled:
            document.getElementById(
                "eqEnabled"
            ).checked,

            low:
            {
                master:
                Number(
                    document.getElementById(
                        "eqLowMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "eqLowSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "eqLowAmount"
                    ).value
                )
            },

            mid:
            {
                master:
                Number(
                    document.getElementById(
                        "eqMidMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "eqMidSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "eqMidAmount"
                    ).value
                )
            },

            high:
            {
                master:
                Number(
                    document.getElementById(
                        "eqHighMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "eqHighSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "eqHighAmount"
                    ).value
                )
            }
        },

        compressor:
        {
            enabled:
            document.getElementById(
                "compressorEnabled"
            ).checked,

            threshold:
            {
                master:
                Number(
                    document.getElementById(
                        "compressorThresholdMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "compressorThresholdSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "compressorThresholdAmount"
                    ).value
                )
            },

            ratio:
            {
                master:
                Number(
                    document.getElementById(
                        "compressorRatioMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "compressorRatioSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "compressorRatioAmount"
                    ).value
                )
            },

            makeup:
            {
                master:
                Number(
                    document.getElementById(
                        "compressorMakeupMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "compressorMakeupSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "compressorMakeupAmount"
                    ).value
                )
            }
        },

        gate:
        {
            enabled:
            document.getElementById(
                "gateEnabled"
            ).checked,

            threshold:
            {
                master:
                Number(
                    document.getElementById(
                        "gateThresholdMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "gateThresholdSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "gateThresholdAmount"
                    ).value
                )
            },

            attack:
            {
                master:
                Number(
                    document.getElementById(
                        "gateAttackMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "gateAttackSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "gateAttackAmount"
                    ).value
                )
            },

            release:
            {
                master:
                Number(
                    document.getElementById(
                        "gateReleaseMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "gateReleaseSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "gateReleaseAmount"
                    ).value
                )
            }
        },

        delay:
        {
            enabled:
            document.getElementById(
                "delayEnabled"
            ).checked,


            time:
            {
                master:
                Number(
                    document.getElementById(
                        "delayTimeMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "delayTimeSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "delayTimeAmount"
                    ).value
                )
            },

            feedback:
            {
                master:
                Number(
                    document.getElementById(
                        "delayFeedbackMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "delayFeedbackSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "delayFeedbackAmount"
                    ).value
                )
            },

            mix:
            {
                master:
                Number(
                    document.getElementById(
                        "delayMixMaster"
                    ).value
                ),

                sensor:
                document.getElementById(
                    "delayMixSensor"
                ).value,

                amount:
                Number(
                    document.getElementById(
                        "delayMixAmount"
                    ).value
                )
            }
        },

        flanger:
    {
        enabled:
        document.getElementById(
            "flangerEnabled"
        ).checked,

        rate:
        {
            master:
            Number(
                document.getElementById(
                    "flangerRateMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "flangerRateSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "flangerRateAmount"
                ).value
            )
        },

        depth:
        {
            master:
            Number(
                document.getElementById(
                    "flangerDepthMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "flangerDepthSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "flangerDepthAmount"
                ).value
            )
        },

        mix:
        {
            master:
            Number(
                document.getElementById(
                    "flangerMixMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "flangerMixSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "flangerMixAmount"
                ).value
            )
        }
    },

        chorus:
    {
        enabled:
        document.getElementById(
            "chorusEnabled"
        ).checked,

        rate:
        {
            master:
            Number(
                document.getElementById(
                    "chorusRateMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "chorusRateSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "chorusRateAmount"
                ).value
            )
        },

        depth:
        {
            master:
            Number(
                document.getElementById(
                    "chorusDepthMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "chorusDepthSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "chorusDepthAmount"
                ).value
            )
        },

        mix:
        {
            master:
            Number(
                document.getElementById(
                    "chorusMixMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "chorusMixSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "chorusMixAmount"
                ).value
            )
        }
    },

    phaser:
    {
        enabled:
        document.getElementById(
            "phaserEnabled"
        ).checked,

        rate:
        {
            master:
            Number(
                document.getElementById(
                    "phaserRateMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "phaserRateSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "phaserRateAmount"
                ).value
            )
        },

        depth:
        {
            master:
            Number(
                document.getElementById(
                    "phaserDepthMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "phaserDepthSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "phaserDepthAmount"
                ).value
            )
        },

        mix:
        {
            master:
            Number(
                document.getElementById(
                    "phaserMixMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "phaserMixSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "phaserMixAmount"
                ).value
            )
        }
    },

    pitch:
    {
        enabled:
        document.getElementById(
            "pitchEnabled"
        ).checked,

        semitones:
        {
            master:
            Number(
                document.getElementById(
                    "pitchSemitonesMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "pitchSemitonesSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "pitchSemitonesAmount"
                ).value
            )
        },

        window:
        {
            master:
            Number(
                document.getElementById(
                    "pitchWindowMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "pitchWindowSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "pitchWindowAmount"
                ).value
            )
        },

        mix:
        {
            master:
            Number(
                document.getElementById(
                    "pitchMixMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "pitchMixSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "pitchMixAmount"
                ).value
            )
        }
    },

    reverb:
    {
        enabled:
        document.getElementById(
            "reverbEnabled"
        ).checked,

        room:
        {
            master:
            Number(
                document.getElementById(
                    "reverbRoomMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "reverbRoomSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "reverbRoomAmount"
                ).value
            )
        },

        damping:
        {
            master:
            Number(
                document.getElementById(
                    "reverbDampingMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "reverbDampingSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "reverbDampingAmount"
                ).value
            )
        },

        mix:
        {
            master:
            Number(
                document.getElementById(
                    "reverbMixMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "reverbMixSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "reverbMixAmount"
                ).value
            )
        }
    },

    limiter:
    {
        enabled:
        document.getElementById(
            "limiterEnabled"
        ).checked,

        level:
        {
            master:
            Number(
                document.getElementById(
                    "limiterLevelMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "limiterLevelSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "limiterLevelAmount"
                ).value
            )
        },

        release:
        {
            master:
            Number(
                document.getElementById(
                    "limiterReleaseMaster"
                ).value
            ),

            sensor:
            document.getElementById(
                "limiterReleaseSensor"
            ).value,

            amount:
            Number(
                document.getElementById(
                    "limiterReleaseAmount"
                ).value
            )
        }
    }

    };
}

// EQ REFRESH
const eqEnabledBtn =
document.getElementById(
    "eqEnabledBtn"
);

const eqEnabled =
document.getElementById(
    "eqEnabled"
);

if(
    eqEnabledBtn &&
    eqEnabled
)
{
    function refreshEQButton()
    {
        if(eqEnabled.checked)
        {
            eqEnabledBtn.textContent =
                "ENABLED";

            eqEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            eqEnabledBtn.textContent =
                "DISABLED";

            eqEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    eqEnabledBtn.onclick = () =>
    {
        eqEnabled.checked =
            !eqEnabled.checked;

        refreshEQButton();
    };
}

    // COMPRESSOR REFRESH

    const compressorEnabledBtn =
    document.getElementById(
        "compressorEnabledBtn"
    );

    const compressorEnabled =
    document.getElementById(
        "compressorEnabled"
    );

    if(
        compressorEnabledBtn &&
        compressorEnabled
    )
    {
        function refreshCompressorButton()
    {
        if(compressorEnabled.checked)
        {
            compressorEnabledBtn.textContent =
                "ENABLED";

            compressorEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            compressorEnabledBtn.textContent =
                "DISABLED";

            compressorEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

        compressorEnabledBtn.onclick = () =>
        {
            compressorEnabled.checked =
                !compressorEnabled.checked;

            refreshCompressorButton();
        };
}

// GATE REFRESH

const gateEnabledBtn =
document.getElementById(
    "gateEnabledBtn"
);

const gateEnabled =
document.getElementById(
    "gateEnabled"
);

if(
    gateEnabledBtn &&
    gateEnabled
)
{
    function refreshGateButton()
    {
        if(gateEnabled.checked)
        {
            gateEnabledBtn.textContent =
                "ENABLED";

            gateEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            gateEnabledBtn.textContent =
                "DISABLED";

            gateEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    gateEnabledBtn.onclick = () =>
    {
        gateEnabled.checked =
            !gateEnabled.checked;

        refreshGateButton();
    };
}

// DELAY REFRESH
const delayEnabledBtn =
document.getElementById(
    "delayEnabledBtn"
);

const delayEnabled =
document.getElementById(
    "delayEnabled"
);

if(
    delayEnabledBtn &&
    delayEnabled
)
{
    function refreshDelayButton()
    {
        if(delayEnabled.checked)
        {
            delayEnabledBtn.textContent =
                "ENABLED";

            delayEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            delayEnabledBtn.textContent =
                "DISABLED";

            delayEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    delayEnabledBtn.onclick = () =>
    {
        delayEnabled.checked =
            !delayEnabled.checked;

        refreshDelayButton();
    };
}

//FLANGER REFRESH
const flangerEnabledBtn =
document.getElementById(
    "flangerEnabledBtn"
);

const flangerEnabled =
document.getElementById(
    "flangerEnabled"
);

if(
    flangerEnabledBtn &&
    flangerEnabled
)
{
    function refreshFlangerButton()
    {
        if(flangerEnabled.checked)
        {
            flangerEnabledBtn.textContent =
                "ENABLED";

            flangerEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            flangerEnabledBtn.textContent =
                "DISABLED";

            flangerEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    flangerEnabledBtn.onclick = () =>
    {
        flangerEnabled.checked =
            !flangerEnabled.checked;

        refreshFlangerButton();
    };
}

// CHORUS REFRESH

const chorusEnabledBtn =
document.getElementById(
    "chorusEnabledBtn"
);

const chorusEnabled =
document.getElementById(
    "chorusEnabled"
);

if(
    chorusEnabledBtn &&
    chorusEnabled
)
{
    function refreshChorusButton()
    {
        if(chorusEnabled.checked)
        {
            chorusEnabledBtn.textContent =
                "ENABLED";

            chorusEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            chorusEnabledBtn.textContent =
                "DISABLED";

            chorusEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    chorusEnabledBtn.onclick = () =>
    {
        chorusEnabled.checked =
            !chorusEnabled.checked;

        refreshChorusButton();
    };
}

// PHASER REFRESH

const phaserEnabledBtn =
document.getElementById(
    "phaserEnabledBtn"
);

const phaserEnabled =
document.getElementById(
    "phaserEnabled"
);

if(
    phaserEnabledBtn &&
    phaserEnabled
)
{
    function refreshPhaserButton()
    {
        if(phaserEnabled.checked)
        {
            phaserEnabledBtn.textContent =
                "ENABLED";

            phaserEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            phaserEnabledBtn.textContent =
                "DISABLED";

            phaserEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    phaserEnabledBtn.onclick = () =>
    {
        phaserEnabled.checked =
            !phaserEnabled.checked;

        refreshPhaserButton();
    };
}

// PITCH SHIFT REFRESH

const pitchEnabledBtn =
document.getElementById(
    "pitchEnabledBtn"
);

const pitchEnabled =
document.getElementById(
    "pitchEnabled"
);

if(
    pitchEnabledBtn &&
    pitchEnabled
)
{
    function refreshPitchButton()
    {
        if(pitchEnabled.checked)
        {
            pitchEnabledBtn.textContent =
                "ENABLED";

            pitchEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            pitchEnabledBtn.textContent =
                "DISABLED";

            pitchEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    pitchEnabledBtn.onclick = () =>
    {
        pitchEnabled.checked =
            !pitchEnabled.checked;

        refreshPitchButton();
    };
}

//REVERB REFRESH
const reverbEnabledBtn =
document.getElementById(
    "reverbEnabledBtn"
);

const reverbEnabled =
document.getElementById(
    "reverbEnabled"
);

if(
    reverbEnabledBtn &&
    reverbEnabled
)
{
    function refreshReverbButton()
    {
        if(reverbEnabled.checked)
        {
            reverbEnabledBtn.textContent =
                "ENABLED";

            reverbEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            reverbEnabledBtn.textContent =
                "DISABLED";

            reverbEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    reverbEnabledBtn.onclick = () =>
    {
        reverbEnabled.checked =
            !reverbEnabled.checked;

        refreshReverbButton();
    };
}

//LIMITER REFRESH
const limiterEnabledBtn =
document.getElementById(
    "limiterEnabledBtn"
);

const limiterEnabled =
document.getElementById(
    "limiterEnabled"
);

if(
    limiterEnabledBtn &&
    limiterEnabled
)
{
    function refreshLimiterButton()
    {
        if(limiterEnabled.checked)
        {
            limiterEnabledBtn.textContent =
                "ENABLED";

            limiterEnabledBtn.className =
                "effect-toggle-btn enabled";
        }
        else
        {
            limiterEnabledBtn.textContent =
                "DISABLED";

            limiterEnabledBtn.className =
                "effect-toggle-btn disabled";
        }
    }

    limiterEnabledBtn.onclick = () =>
    {
        limiterEnabled.checked =
            !limiterEnabled.checked;

        refreshLimiterButton();
    };
}



const applyAudioMappingBtn =
document.getElementById(
    "applyAudioMapping"
);

const saveAudioMappingBtn =
document.getElementById(
    "saveAudioMapping"
);

if(applyAudioMappingBtn)
{
    applyAudioMappingBtn.addEventListener(
        "click",
        async () =>
        {
            console.log("APPLY CLICKED");
            const config =
            buildAudioConfig();
            console.log(config);

            await fetch(
                "/audio-config/apply",
                {
                    method:"POST",

                    headers:
                    {
                        "Content-Type":
                        "application/json"
                    },

                    body:
                    JSON.stringify(
                        config
                    )
                }
            );

            showAudioStatus(
                "✓ Mapping Applied"
            );
        }
    );
}

if(saveAudioMappingBtn)
{
    saveAudioMappingBtn.addEventListener(
        "click",
        async () =>
        {
            console.log("SAVE CLICKED");
            const config =
            buildAudioConfig();
            console.log(config);

            await fetch(
                "/audio-config",
                {
                    method:"POST",

                    headers:
                    {
                        "Content-Type":
                        "application/json"
                    },

                    body:
                    JSON.stringify(
                        config
                    )
                }
            );

            showAudioStatus(
                "✓ Mapping Saved"
            );
        }
    );
}

async function loadAudioMapping()
{
    const response =
    await fetch(
        "/audio-config"
    );

    const config =
    await response.json();

    document.getElementById(
        "masterGain"
    ).value =
    config.global.masterGain;

    window.dspEnabled =
        config.global.dspEnabled ?? true;

    document.getElementById(
        "masterGainValue"
    ).textContent =
    Number(
        config.global.masterGain
    ).toFixed(2);

    //EQ MODULE STARTS

    document.getElementById(
        "eqEnabled"
    ).checked =
    config.eq.enabled;

    // LOW

    document.getElementById(
        "eqLowMaster"
    ).value =
    config.eq.low.master;

    document.getElementById(
        "eqLowMasterValue"
    ).textContent =
    Number(
        config.eq.low.master
    ).toFixed(1);

    document.getElementById(
        "eqLowSensor"
    ).value =
    config.eq.low.sensor;

    document.getElementById(
        "eqLowAmount"
    ).value =
    config.eq.low.amount;

    document.getElementById(
        "eqLowAmountValue"
    ).textContent =
    Number(
        config.eq.low.amount
    ).toFixed(1);

    // MID

    document.getElementById(
        "eqMidMaster"
    ).value =
    config.eq.mid.master;

    document.getElementById(
        "eqMidMasterValue"
    ).textContent =
    Number(
        config.eq.mid.master
    ).toFixed(1);

    document.getElementById(
        "eqMidSensor"
    ).value =
    config.eq.mid.sensor;

    document.getElementById(
        "eqMidAmount"
    ).value =
    config.eq.mid.amount;

    document.getElementById(
        "eqMidAmountValue"
    ).textContent =
    Number(
        config.eq.mid.amount
    ).toFixed(1);

    // HIGH

    document.getElementById(
        "eqHighMaster"
    ).value =
    config.eq.high.master;

    document.getElementById(
        "eqHighMasterValue"
    ).textContent =
    Number(
        config.eq.high.master
    ).toFixed(1);

    document.getElementById(
        "eqHighSensor"
    ).value =
    config.eq.high.sensor;

    document.getElementById(
        "eqHighAmount"
    ).value =
    config.eq.high.amount;

    document.getElementById(
        "eqHighAmountValue"
    ).textContent =
    Number(
        config.eq.high.amount
    ).toFixed(1);

    //EQ MODULE ENDS

    //COMPRESSOR MODULE STARTS

    document.getElementById(
        "compressorEnabled"
    ).checked =
    config.compressor.enabled;

    // THRESHOLD

    document.getElementById(
        "compressorThresholdMaster"
    ).value =
    config.compressor.threshold.master;

    document.getElementById(
        "compressorThresholdMasterValue"
    ).textContent =
    Number(
        config.compressor.threshold.master
    ).toFixed(0);

    document.getElementById(
        "compressorThresholdSensor"
    ).value =
    config.compressor.threshold.sensor;

    document.getElementById(
        "compressorThresholdAmount"
    ).value =
    config.compressor.threshold.amount;

    document.getElementById(
        "compressorThresholdAmountValue"
    ).textContent =
    Number(
        config.compressor.threshold.amount
    ).toFixed(0);

    // RATIO

    document.getElementById(
        "compressorRatioMaster"
    ).value =
    config.compressor.ratio.master;

    document.getElementById(
        "compressorRatioMasterValue"
    ).textContent =
    Number(
        config.compressor.ratio.master
    ).toFixed(1);

    document.getElementById(
        "compressorRatioSensor"
    ).value =
    config.compressor.ratio.sensor;

    document.getElementById(
        "compressorRatioAmount"
    ).value =
    config.compressor.ratio.amount;

    document.getElementById(
        "compressorRatioAmountValue"
    ).textContent =
    Number(
        config.compressor.ratio.amount
    ).toFixed(1);

    // MAKEUP

    document.getElementById(
        "compressorMakeupMaster"
    ).value =
    config.compressor.makeup.master;

    document.getElementById(
        "compressorMakeupMasterValue"
    ).textContent =
    Number(
        config.compressor.makeup.master
    ).toFixed(1);

    document.getElementById(
        "compressorMakeupSensor"
    ).value =
    config.compressor.makeup.sensor;

    document.getElementById(
        "compressorMakeupAmount"
    ).value =
    config.compressor.makeup.amount;

    document.getElementById(
        "compressorMakeupAmountValue"
    ).textContent =
    Number(
        config.compressor.makeup.amount
    ).toFixed(1);

    //COMPRESSOR MODULE ENDS

    // GATE MODULE STARTS

    document.getElementById(
        "gateEnabled"
    ).checked =
    config.gate.enabled;

    // THRESHOLD

    document.getElementById(
        "gateThresholdMaster"
    ).value =
    config.gate.threshold.master;

    document.getElementById(
        "gateThresholdMasterValue"
    ).textContent =
    Number(
        config.gate.threshold.master
    ).toFixed(0);

    document.getElementById(
        "gateThresholdSensor"
    ).value =
    config.gate.threshold.sensor;

    document.getElementById(
        "gateThresholdAmount"
    ).value =
    config.gate.threshold.amount;

    document.getElementById(
        "gateThresholdAmountValue"
    ).textContent =
    Number(
        config.gate.threshold.amount
    ).toFixed(0);

    // ATTACK

    document.getElementById(
        "gateAttackMaster"
    ).value =
    config.gate.attack.master;

    document.getElementById(
        "gateAttackMasterValue"
    ).textContent =
    Number(
        config.gate.attack.master
    ).toFixed(3);

    document.getElementById(
        "gateAttackSensor"
    ).value =
    config.gate.attack.sensor;

    document.getElementById(
        "gateAttackAmount"
    ).value =
    config.gate.attack.amount;

    document.getElementById(
        "gateAttackAmountValue"
    ).textContent =
    Number(
        config.gate.attack.amount
    ).toFixed(3);

    // RELEASE

    document.getElementById(
        "gateReleaseMaster"
    ).value =
    config.gate.release.master;

    document.getElementById(
        "gateReleaseMasterValue"
    ).textContent =
    Number(
        config.gate.release.master
    ).toFixed(2);

    document.getElementById(
        "gateReleaseSensor"
    ).value =
    config.gate.release.sensor;

    document.getElementById(
        "gateReleaseAmount"
    ).value =
    config.gate.release.amount;

    document.getElementById(
        "gateReleaseAmountValue"
    ).textContent =
    Number(
        config.gate.release.amount
    ).toFixed(2);

    // GATE MODULE ENDS

    //DELAY MODULE STARTS

    document.getElementById(
        "delayEnabled"
    ).checked =
    config.delay.enabled;

    document.getElementById(
    "delayTimeMaster"
    ).value =
    config.delay.time.master;

    document.getElementById(
        "delayTimeMasterValue"
    ).textContent =
    Number(
        config.delay.time.master
    ).toFixed(2);

    document.getElementById(
        "delayTimeSensor"
    ).value =
    config.delay.time.sensor;

    document.getElementById(
        "delayTimeAmount"
    ).value =
    config.delay.time.amount;

    document.getElementById(
        "delayTimeAmountValue"
    ).textContent =
    Number(
        config.delay.time.amount
    ).toFixed(2);

    document.getElementById(
    "delayFeedbackMaster"
    ).value =
    config.delay.feedback.master;

    document.getElementById(
        "delayFeedbackMasterValue"
    ).textContent =
    Number(
        config.delay.feedback.master
    ).toFixed(1);

    document.getElementById(
        "delayFeedbackSensor"
    ).value =
    config.delay.feedback.sensor;

    document.getElementById(
        "delayFeedbackAmount"
    ).value =
    config.delay.feedback.amount;

    document.getElementById(
        "delayFeedbackAmountValue"
    ).textContent =
    Number(
        config.delay.feedback.amount
    ).toFixed(1);

    document.getElementById(
        "delayMixMaster"
        ).value =
        config.delay.mix.master;

    document.getElementById(
        "delayMixMasterValue"
        ).textContent =
        Number(
        config.delay.mix.master
        ).toFixed(2);

    document.getElementById(
        "delayMixSensor"
    ).value =
    config.delay.mix.sensor;

    document.getElementById(
        "delayMixAmount"
    ).value =
    config.delay.mix.amount;

    document.getElementById(
        "delayMixAmountValue"
    ).textContent =
    Number(
        config.delay.mix.amount
    ).toFixed(2);

    //DELEY MODULE ENDS

    //FLANGER MODULE STARTS

    document.getElementById(
        "flangerEnabled"
    ).checked =
    config.flanger.enabled;

    document.getElementById(
    "flangerRateMaster"
    ).value =
    config.flanger.rate.master;

    document.getElementById(
        "flangerRateMasterValue"
    ).textContent =
    Number(
        config.flanger.rate.master
    ).toFixed(2);

    document.getElementById(
        "flangerRateSensor"
    ).value =
    config.flanger.rate.sensor;

    document.getElementById(
        "flangerRateAmount"
    ).value =
    config.flanger.rate.amount;

    document.getElementById(
        "flangerRateAmountValue"
    ).textContent =
    Number(
        config.flanger.rate.amount
    ).toFixed(2);

    document.getElementById(
    "flangerDepthMaster"
    ).value =
    config.flanger.depth.master;

    document.getElementById(
        "flangerDepthMasterValue"
    ).textContent =
    Number(
        config.flanger.depth.master
    ).toFixed(1);

    document.getElementById(
        "flangerDepthSensor"
    ).value =
    config.flanger.depth.sensor;

    document.getElementById(
        "flangerDepthAmount"
    ).value =
    config.flanger.depth.amount;

    document.getElementById(
        "flangerDepthAmountValue"
    ).textContent =
    Number(
        config.flanger.depth.amount
    ).toFixed(1);

    document.getElementById(
        "flangerMixMaster"
        ).value =
        config.flanger.mix.master;

    document.getElementById(
        "flangerMixMasterValue"
        ).textContent =
        Number(
        config.flanger.mix.master
        ).toFixed(2);

    document.getElementById(
        "flangerMixSensor"
    ).value =
    config.flanger.mix.sensor;

    document.getElementById(
        "flangerMixAmount"
    ).value =
    config.flanger.mix.amount;

    document.getElementById(
        "flangerMixAmountValue"
    ).textContent =
    Number(
        config.flanger.mix.amount
    ).toFixed(2);

    //FLANGER MODULE ENDS

    // CHORUS MODULE STARTS

    document.getElementById(
        "chorusEnabled"
    ).checked =
    config.chorus.enabled;

    // RATE

    document.getElementById(
        "chorusRateMaster"
    ).value =
    config.chorus.rate.master;

    document.getElementById(
        "chorusRateMasterValue"
    ).textContent =
    Number(
        config.chorus.rate.master
    ).toFixed(2);

    document.getElementById(
        "chorusRateSensor"
    ).value =
    config.chorus.rate.sensor;

    document.getElementById(
        "chorusRateAmount"
    ).value =
    config.chorus.rate.amount;

    document.getElementById(
        "chorusRateAmountValue"
    ).textContent =
    Number(
        config.chorus.rate.amount
    ).toFixed(2);

    // DEPTH

    document.getElementById(
        "chorusDepthMaster"
    ).value =
    config.chorus.depth.master;

    document.getElementById(
        "chorusDepthMasterValue"
    ).textContent =
    Number(
        config.chorus.depth.master
    ).toFixed(2);

    document.getElementById(
        "chorusDepthSensor"
    ).value =
    config.chorus.depth.sensor;

    document.getElementById(
        "chorusDepthAmount"
    ).value =
    config.chorus.depth.amount;

    document.getElementById(
        "chorusDepthAmountValue"
    ).textContent =
    Number(
        config.chorus.depth.amount
    ).toFixed(2);

    // MIX

    document.getElementById(
        "chorusMixMaster"
    ).value =
    config.chorus.mix.master;

    document.getElementById(
        "chorusMixMasterValue"
    ).textContent =
    Number(
        config.chorus.mix.master
    ).toFixed(2);

    document.getElementById(
        "chorusMixSensor"
    ).value =
    config.chorus.mix.sensor;

    document.getElementById(
        "chorusMixAmount"
    ).value =
    config.chorus.mix.amount;

    document.getElementById(
        "chorusMixAmountValue"
    ).textContent =
    Number(
        config.chorus.mix.amount
    ).toFixed(2);

    // CHORUS MODULE ENDS

    // PHASER MODULE STARTS

    document.getElementById(
        "phaserEnabled"
    ).checked =
    config.phaser.enabled;

    // RATE

    document.getElementById(
        "phaserRateMaster"
    ).value =
    config.phaser.rate.master;

    document.getElementById(
        "phaserRateMasterValue"
    ).textContent =
    Number(
        config.phaser.rate.master
    ).toFixed(2);

    document.getElementById(
        "phaserRateSensor"
    ).value =
    config.phaser.rate.sensor;

    document.getElementById(
        "phaserRateAmount"
    ).value =
    config.phaser.rate.amount;

    document.getElementById(
        "phaserRateAmountValue"
    ).textContent =
    Number(
        config.phaser.rate.amount
    ).toFixed(2);

    // DEPTH

    document.getElementById(
        "phaserDepthMaster"
    ).value =
    config.phaser.depth.master;

    document.getElementById(
        "phaserDepthMasterValue"
    ).textContent =
    Number(
        config.phaser.depth.master
    ).toFixed(2);

    document.getElementById(
        "phaserDepthSensor"
    ).value =
    config.phaser.depth.sensor;

    document.getElementById(
        "phaserDepthAmount"
    ).value =
    config.phaser.depth.amount;

    document.getElementById(
        "phaserDepthAmountValue"
    ).textContent =
    Number(
        config.phaser.depth.amount
    ).toFixed(2);

    // MIX

    document.getElementById(
        "phaserMixMaster"
    ).value =
    config.phaser.mix.master;

    document.getElementById(
        "phaserMixMasterValue"
    ).textContent =
    Number(
        config.phaser.mix.master
    ).toFixed(2);

    document.getElementById(
        "phaserMixSensor"
    ).value =
    config.phaser.mix.sensor;

    document.getElementById(
        "phaserMixAmount"
    ).value =
    config.phaser.mix.amount;

    document.getElementById(
        "phaserMixAmountValue"
    ).textContent =
    Number(
        config.phaser.mix.amount
    ).toFixed(2);

    // PHASER MODULE ENDS

    // PITCH SHIFT MODULE STARTS

    document.getElementById(
        "pitchEnabled"
    ).checked =
    config.pitch.enabled;

    // SEMITONES

    document.getElementById(
        "pitchSemitonesMaster"
    ).value =
    config.pitch.semitones.master;

    document.getElementById(
        "pitchSemitonesMasterValue"
    ).textContent =
    Number(
        config.pitch.semitones.master
    ).toFixed(0);

    document.getElementById(
        "pitchSemitonesSensor"
    ).value =
    config.pitch.semitones.sensor;

    document.getElementById(
        "pitchSemitonesAmount"
    ).value =
    config.pitch.semitones.amount;

    document.getElementById(
        "pitchSemitonesAmountValue"
    ).textContent =
    Number(
        config.pitch.semitones.amount
    ).toFixed(2);

    // WINDOW

    document.getElementById(
        "pitchWindowMaster"
    ).value =
    config.pitch.window.master;

    document.getElementById(
        "pitchWindowMasterValue"
    ).textContent =
    Number(
        config.pitch.window.master
    ).toFixed(2);

    document.getElementById(
        "pitchWindowSensor"
    ).value =
    config.pitch.window.sensor;

    document.getElementById(
        "pitchWindowAmount"
    ).value =
    config.pitch.window.amount;

    document.getElementById(
        "pitchWindowAmountValue"
    ).textContent =
    Number(
        config.pitch.window.amount
    ).toFixed(2);

    // MIX

    document.getElementById(
        "pitchMixMaster"
    ).value =
    config.pitch.mix.master;

    document.getElementById(
        "pitchMixMasterValue"
    ).textContent =
    Number(
        config.pitch.mix.master
    ).toFixed(2);

    document.getElementById(
        "pitchMixSensor"
    ).value =
    config.pitch.mix.sensor;

    document.getElementById(
        "pitchMixAmount"
    ).value =
    config.pitch.mix.amount;

    document.getElementById(
        "pitchMixAmountValue"
    ).textContent =
    Number(
        config.pitch.mix.amount
    ).toFixed(2);

    // PITCH SHIFT MODULE ENDS

    //REVERB MODULE STARTS

    document.getElementById(
        "reverbEnabled"
    ).checked =
    config.reverb.enabled;

    document.getElementById(
    "reverbRoomMaster"
    ).value =
    config.reverb.room.master;

    document.getElementById(
        "reverbRoomMasterValue"
    ).textContent =
    Number(
        config.reverb.room.master
    ).toFixed(2);

    document.getElementById(
        "reverbRoomSensor"
    ).value =
    config.reverb.room.sensor;

    document.getElementById(
        "reverbRoomAmount"
    ).value =
    config.reverb.room.amount;

    document.getElementById(
        "reverbRoomAmountValue"
    ).textContent =
    Number(
        config.reverb.room.amount
    ).toFixed(2);

    document.getElementById(
    "reverbDampingMaster"
    ).value =
    config.reverb.damping.master;

    document.getElementById(
        "reverbDampingMasterValue"
    ).textContent =
    Number(
        config.reverb.damping.master
    ).toFixed(1);

    document.getElementById(
        "reverbDampingSensor"
    ).value =
    config.reverb.damping.sensor;

    document.getElementById(
        "reverbDampingAmount"
    ).value =
    config.reverb.damping.amount;

    document.getElementById(
        "reverbDampingAmountValue"
    ).textContent =
    Number(
        config.reverb.damping.amount
    ).toFixed(1);

    document.getElementById(
        "reverbMixMaster"
        ).value =
        config.reverb.mix.master;

    document.getElementById(
        "reverbMixMasterValue"
        ).textContent =
        Number(
        config.reverb.mix.master
        ).toFixed(2);

    document.getElementById(
        "reverbMixSensor"
    ).value =
    config.reverb.mix.sensor;

    document.getElementById(
        "reverbMixAmount"
    ).value =
    config.reverb.mix.amount;

    document.getElementById(
        "reverbMixAmountValue"
    ).textContent =
    Number(
        config.reverb.mix.amount
    ).toFixed(2);

    //REVERB MODULE ENDS

    //LIMITER MODULE STARTS

    document.getElementById(
        "limiterEnabled"
    ).checked =
        config.limiter.enabled;

    document.getElementById(
        "limiterLevelMaster"
    ).value =
        config.limiter.level.master;

    document.getElementById(
        "limiterLevelMasterValue"
    ).textContent =
    Number(
        config.limiter.level.master
    ).toFixed(2);

    document.getElementById(
        "limiterLevelSensor"
    ).value =
        config.limiter.level.sensor;

    document.getElementById(
        "limiterLevelAmount"
    ).value =
        config.limiter.level.amount;

    document.getElementById(
        "limiterLevelAmountValue"
    ).textContent =
    Number(
        config.limiter.level.amount
    ).toFixed(2);

    document.getElementById(
        "limiterReleaseMaster"
    ).value =
        config.limiter.release.master;

    document.getElementById(
        "limiterReleaseMasterValue"
    ).textContent =
    Number(
        config.limiter.release.master
    ).toFixed(3);

    document.getElementById(
        "limiterReleaseSensor"
    ).value =
        config.limiter.release.sensor;

    document.getElementById(
        "limiterReleaseAmount"
    ).value =
        config.limiter.release.amount;

    document.getElementById(
        "limiterReleaseAmountValue"
    ).textContent =
    Number(
        config.limiter.release.amount
    ).toFixed(2);

    //LIMITER MODULE ENDS

    refreshEQButton();
    refreshCompressorButton();
    refreshGateButton();
    refreshDelayButton();
    refreshFlangerButton();
    refreshChorusButton();
    refreshPhaserButton();
    refreshPitchButton();
    refreshReverbButton();
    refreshLimiterButton();
    refreshGlobalFXButton();

}

loadAudioMapping();

document
.querySelectorAll(
    ".effect-tab"
)
.forEach(btn =>
{
    btn.addEventListener(
        "click",
        () =>
    {
        document
        .querySelectorAll(
            ".effect-tab"
        )
        .forEach(tab =>
            tab.classList.remove(
                "active"
            )
        );

        document
        .querySelectorAll(
            ".effect-panel"
        )
        .forEach(panel =>
            panel.classList.remove(
                "active"
            )
        );

        btn.classList.add(
            "active"
        );

        document
        .getElementById(
            btn.dataset.effect
        )
        .classList.add(
            "active"
        );
    });
});

function showAudioStatus(message)
{
    const status =
    document.getElementById(
        "audioMappingStatus"
    );

    if(!status)
    {
        return;
    }

    status.textContent =
        message;

    setTimeout(
        () =>
        {
            status.textContent = "";
        },
        3000
    );
}

function showPoolStatus(message)
{
    const status =
    document.getElementById(
        "audioPoolStatus"
    );

    if(!status)
    {
        return;
    }

    status.textContent =
        message;

    setTimeout(
        () =>
        {
            status.textContent = "";
        },
        3000
    );
}

const globalEffectsBtn =
document.getElementById(
    "globalEffectsBtn"
);

function refreshGlobalFXButton()
{
    if(!globalEffectsBtn)
        return;

    if(window.dspEnabled)
    {
        globalEffectsBtn.textContent =
            "FX ON";

        globalEffectsBtn.classList.remove(
            "fx-off"
        );

        globalEffectsBtn.classList.add(
            "fx-on"
        );
    }
    else
    {
        globalEffectsBtn.textContent =
            "FX OFF";

        globalEffectsBtn.classList.remove(
            "fx-on"
        );

        globalEffectsBtn.classList.add(
            "fx-off"
        );
    }
}

if(globalEffectsBtn)
{
    globalEffectsBtn.onclick =
    () =>
    {
        window.dspEnabled =
            !window.dspEnabled;

        refreshGlobalFXButton();
    };
}