const MAX_POINTS = 200;

let latestData = null;
let currentConfig = null;
let ws = null;
let lastPacketTime = Date.now();
let reconnectTimer = null;


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

// REVERB MODULE SLIDER


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
            )
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
    }
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

    document.getElementById(
        "masterGainValue"
    ).textContent =
    Number(
        config.global.masterGain
    ).toFixed(2);

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

    refreshDelayButton();
    refreshFlangerButton();
    refreshReverbButton();
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