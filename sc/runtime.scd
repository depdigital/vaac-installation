
// BOOT
s.boot;

~sceneBus = Bus.audio(s, 2);

~ghostEngine = nil;

~runtimePath =
    PathName(
        thisProcess.nowExecutingPath
    ).fullPath;

~scDir =
    PathName(
        ~runtimePath
    ).pathOnly;

~projectRoot =
    PathName(
        ~scDir
    ).parentPath;


~leftPath = "";
~rightPath = "";

~finishedCount = 0;

~backend = NetAddr(
    "127.0.0.1",
    9001
);

"RUNTIME PATH:".postln;
~runtimePath.postln;

"SC DIR:".postln;
~scDir.postln;

"PROJECT ROOT:".postln;
~projectRoot.postln;

~leftBuf = nil;
~rightBuf = nil;

~leftSynth = nil;
~rightSynth = nil;

~sceneStarted = false;

~heartbeatRoutine = Routine({

    loop {

        ~backend.sendMsg(
            "/heartbeat"
        );
		//
        10.wait;
    };

});

~heartbeatRoutine.play;

~stopScene = {

    "STOPPING SCENE".postln;

    if(~leftSynth.notNil) {
        ~leftSynth.free;
        ~leftSynth = nil;
    };

    if(~rightSynth.notNil) {
        ~rightSynth.free;
        ~rightSynth = nil;
    };

    if(~leftBuf.notNil) {
        ~leftBuf.free;
        ~leftBuf = nil;
    };

    if(~rightBuf.notNil) {
        ~rightBuf.free;
        ~rightBuf = nil;
    };

    ~finishedCount = 0;
    ~sceneStarted = false;

    "SCENE STOPPED".postln;
};

~runtimePath =
    PathName(
        thisProcess.nowExecutingPath
    ).fullPath;


// PLAYER

SynthDef(\scenePlayer, {

    |buf, playerId = 0|

    var sig;
    var done;

    sig = PlayBuf.ar(
        1,
        buf,
        doneAction: 2
    );

    done = Done.kr(sig);

    SendReply.kr(
        done,
        '/playerDone',
        [playerId]
    );

    Out.ar(
        ~sceneBus,
        [sig, sig]
    );

}).add;

// GHOST ENGINE

SynthDef(\ghostEngine, {

	|inBus=0,
    gain=1.0,
	delayEnabled=1,
    delayTime=0.05,
    delayFeedback=0.1,
    delayMix=0.0|

    var sig;
    var delayed;
	var wet;

    var gainSmooth;
    var delayTimeSmooth;
    var delayMixSmooth;
    var delayFeedbackSmooth;

    gainSmooth = Lag.kr(
        gain,
        1.0
    );

    delayTimeSmooth = Lag.kr(
        delayTime,
        1.0
    );

    delayMixSmooth = Lag.kr(
        delayMix,
        1.0
    );

    delayFeedbackSmooth = Lag.kr(
        delayFeedback,
        1.0
    );

    sig = In.ar(
        inBus,
        2
    );

    delayed = CombL.ar(
        sig,
        0.5,
        delayTimeSmooth,
        delayFeedbackSmooth
    );

	wet = XFade2.ar(
		sig,
		delayed,
		(delayMixSmooth * 2) - 1
	);

	sig = SelectX.ar(
		Lag.kr(delayEnabled, 0.2),
		[
			sig,
			wet
		]
	);

    sig = sig * gainSmooth;

    Out.ar(
        0,
        sig
    );

}).add;

OSCdef(
    \playerDone,

    { |msg|

        var playerId;

        playerId = msg[3];

        ("PLAYER DONE: " ++ playerId).postln;

        ~finishedCount = ~finishedCount + 1;

        if(~finishedCount >= 2) {

            "SCENE COMPLETE".postln;

            "SENDING TO PYTHON".postln;

            ~backend.sendMsg(
                "/scene/finished"
            );

            ~finishedCount = 0;
        };

    },

    '/playerDone',
    s.addr
);


// PLAYBACK FUNCTION

~playScene = {

    var leftReady = false;
    var rightReady = false;

    ~stopScene.value;

    "Loading Scene".postln;
    ("Left : " ++ ~leftPath).postln;
    ("Right: " ++ ~rightPath).postln;

    ~leftBuf = Buffer.read(
        s,
        ~leftPath,

        action: { |buf|

            ~leftBuf = buf;

            leftReady = true;

            "LEFT LOADED".postln;

            if(
                (leftReady && rightReady)
                &&
                (~sceneStarted.not)
            ) {

                ~sceneStarted = true;

                "Playing Scene".postln;

                ~finishedCount = 0;

                ~leftSynth = Synth(
                    \scenePlayer,
                    [
                        \buf, ~leftBuf.bufnum,
                        \playerId, 1
                    ]
                );

                ~rightSynth = Synth(
                    \scenePlayer,
                    [
                        \buf, ~rightBuf.bufnum,
                        \playerId, 2
                    ]
                );

            };

        }
    );

    ~rightBuf = Buffer.read(
        s,
        ~rightPath,

        action: { |buf|

            ~rightBuf = buf;

            rightReady = true;

            "RIGHT LOADED".postln;

            if(
                (leftReady && rightReady)
                &&
                (~sceneStarted.not)
            ) {

                ~sceneStarted = true;

                "Playing Scene".postln;

                ~finishedCount = 0;

                ~leftSynth = Synth(
                    \scenePlayer,
                    [
                        \buf, ~leftBuf.bufnum,
                        \playerId, 1
                    ]
                );

                ~rightSynth = Synth(
                    \scenePlayer,
                    [
                        \buf, ~rightBuf.bufnum,
                        \playerId, 2
                    ]
                );

            };

        }
    );

};

// OSC RECEIVERS

OSCdef(
    \sceneLeft,
    { |msg|

        ~leftPath = msg[1];

        "LEFT RECEIVED".postln;
        ~leftPath.postln;

    },
    '/scene/left'
);

OSCdef(
    \sceneRight,
    { |msg|

        ~rightPath = msg[1];

        "RIGHT RECEIVED".postln;
        ~rightPath.postln;

        if(
            (~leftPath != "")
            &&
            (~rightPath != "")
        )
        {
            "AUTO PLAY".postln;

			//~playScene.class.postln;

			~playScene.value;
        };

    },
    '/scene/right'
);

OSCdef(
    \sceneStop,
    {

        ~stopScene.value;

    },
	'/scene/stop'
);

// REAL TIME OSC SYNTH

OSCdef(
    \ghostGain,
    {
        |msg|

        if(~ghostEngine.notNil)
        {
            ~ghostEngine.set(
                \gain,
                msg[1]
            );
        };

        ("gain: " ++ msg[1]).postln;

    },
    "/ghost/gain"
);

OSCdef(
    \ghostDelayEnabled,
    {
        |msg|

        if(~ghostEngine.notNil)
        {
            ~ghostEngine.set(
                \delayEnabled,
                msg[1]
            );
        };

        ("delayEnabled: " ++ msg[1]).postln;

    },
    "/ghost/delayEnabled"
);

OSCdef(
    \ghostDelayEnabled,
    {
        |msg|

        if(~ghostEngine.notNil)
        {
            ~ghostEngine.set(
                \delayEnabled,
                msg[1]
            );
        };

        ("delayEnabled: " ++ msg[1]).postln;

    },
    "/ghost/delayEnabled"
);

OSCdef(
    \ghostDelayTime,
    {
        |msg|

        msg.postln;

        ~ghostEngine.set(
            \delayTime,
            msg[1]
        );

    },
    "/ghost/delayTime"
);

OSCdef(
    \ghostDelayMix,
    {
        |msg|

        var value;

        value = msg[1];

        ~ghostEngine.set(
            \delayMix,
            value
        );

        ("delayMix: " ++ value)
        .postln;

    },
    "/ghost/delayMix"
);

OSCdef(
    \ghostDelayFeedback,
    {
        |msg|

        var value;

        value = msg[1];

        ~ghostEngine.set(
            \delayFeedback,
            value
        );

        ("delayFeedback: " ++ value)
        .postln;

    },
    "/ghost/delayFeedback"
);

"Scene Receiver Ready".postln;

// PLOT LOADED BUFFER

//s.plotTree;
//s.queryAllNodes;

if(~ghostEngine.notNil) {
    ~ghostEngine.free;
};

~ghostEngine = Synth.tail(
    s,
    \ghostEngine,
    [
        \inBus, ~sceneBus,
        \gain, 1.0
    ]
);

"Ghost Engine Started".postln;

n = NetAddr(
    "127.0.0.1",
    NetAddr.langPort
);

//OSCdef.all;