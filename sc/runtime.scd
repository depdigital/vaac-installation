/* =========================================================================
   1. SERVER CONFIGURATION & BOOT INITIALIZATION
   ========================================================================= */

s.quit;

// Expand real-time processing memory pool and channel limits drastically
Server.default.options.memSize = 65536;
Server.default.options.numAudioBusChannels = 1024;

s.waitForBoot({

    /* =====================================================================
       2. GLOBAL ENVIRONMENT VARIABLES & PATHS
       ===================================================================== */

    ~sceneBus = Bus.audio(s, 2);
    ~ghostEngine = nil;

    ~runtimePath = PathName(thisProcess.nowExecutingPath).fullPath;
    ~scDir       = PathName(~runtimePath).pathOnly;
    ~projectRoot = PathName(~scDir).parentPath;

    ~leftPath      = "";
    ~rightPath     = "";
    ~finishedCount = 0;
    ~sceneStarted  = false;

    ~backend = NetAddr("127.0.0.1", 9001);

    ~leftBuf    = nil;
    ~rightBuf   = nil;
    ~leftSynth  = nil;
    ~rightSynth = nil;

    // Diagnostic console logging
    "RUNTIME PATH:".postln;  ~runtimePath.postln;
    "SC DIR:".postln;       ~scDir.postln;
    "PROJECT ROOT:".postln; ~projectRoot.postln;

    /* =====================================================================
       3. BACKGROUND ROUTINES & STATE MANAGEMENT FUNCTIONS
       ===================================================================== */

    // Heartbeat clock routine alerting the Python backend every 10 seconds
    ~heartbeatRoutine = Routine({
        loop {
            ~backend.sendMsg("/heartbeat");
            10.wait;
        };
    });
    ~heartbeatRoutine.play;

    // Safety cleanup function to flush active voices, RAM buffers, and tracking flags
    ~stopScene = {
        "STOPPING SCENE".postln;

        if(~leftSynth.notNil)  { ~leftSynth.free;  ~leftSynth = nil;  };
        if(~rightSynth.notNil) { ~rightSynth.free; ~rightSynth = nil; };
        if(~leftBuf.notNil)    { ~leftBuf.free;    ~leftBuf = nil;    };
        if(~rightBuf.notNil)   { ~rightBuf.free;   ~rightBuf = nil;   };

        ~finishedCount = 0;
        ~sceneStarted  = false;

        "SCENE STOPPED".postln;
    };

    /* =====================================================================
       4. AUDIO DSP ENGINE DEFINITIONS (SYNTHDEFS)
       ===================================================================== */

    // Mono File Voice Player
    SynthDef(\scenePlayer, {

        |buf, playerId = 0, outChannel = 0|
        var sig, done;

        sig  = PlayBuf.ar(1, buf, doneAction: 2);
        done = Done.kr(sig);

        SendReply.kr(done, '/playerDone', [playerId]);

        // Isolates outputs perfectly onto discrete stereo lanes using audio-rate selection
        Out.ar(
            ~sceneBus,
            Select.ar(outChannel, [[sig, Silent.ar()], [Silent.ar(), sig]])
        );
    }).add;

    // Global Stereo FX Master Processor Chain
    SynthDef(\ghostEngine, {

        |inBus = 0, gain = 1.0, delayEnabled = 1, delayTime = 0.05, delayFeedback = 0.1, delayMix = 0.0, flangerEnabled=0, flangerRate=0.2, flangerDepth=0.5, flangerMix=0.3|
        var sig, delayed, wet, flanger, flangerWet;
        var gainSmooth, delayTimeSmooth, delayMixSmooth, delayFeedbackSmooth;
		var flangerRateSmooth, flangerDepthSmooth, flangerMixSmooth;

        // Smooth parameters continuously to protect against sudden real-time value transitions
        gainSmooth          = Lag.kr(gain, 1.0);
        delayMixSmooth       = Lag.kr(delayMix, 1.0);
        delayTimeSmooth     = Lag.kr(delayTime, 1.0).clip(0.001, 0.49);
        delayFeedbackSmooth = Lag.kr(delayFeedback, 1.0).clip(0.0, 1.5);
		flangerRateSmooth       = Lag.kr(flangerRate, 1.0);
		flangerDepthSmooth       = Lag.kr(flangerDepth, 1.0);
		flangerMixSmooth       = Lag.kr(flangerMix, 1.0);

        sig     = In.ar(inBus, 2);
        delayed = CombL.ar(sig, 0.5, delayTimeSmooth, delayFeedbackSmooth);
        wet     = XFade2.ar(sig, delayed, (delayMixSmooth * 2) - 1);
		flanger = DelayC.ar(sig, 0.03, SinOsc.kr(flangerRateSmooth).range(0.001, flangerDepthSmooth * 0.01));
		flangerWet     = XFade2.ar(sig, flanger, (flangerMixSmooth * 2) - 1);

        sig     = SelectX.ar(Lag.kr(delayEnabled, 0.2), [sig, wet]);
		sig     = SelectX.ar(flangerEnabled, [sig, flangerWet]);
        sig     = sig * gainSmooth;

        Out.ar(0, sig);
    }).add;

    /* =====================================================================
       5. INTER-PROCESS COMMUNICATIONS DEFS (OSC RECEIVERS)
       ===================================================================== */

    // Tracking trigger parsing voice completions
    OSCdef(\playerDone, { |msg|
        var playerId = msg[3];

        ("PLAYER DONE: " ++ playerId).postln;
        ~finishedCount = ~finishedCount + 1;

        if(~finishedCount >= 2) {
            "SCENE COMPLETE. SENDING TO PYTHON".postln;
            ~backend.sendMsg("/scene/finished");
            ~finishedCount = 0;
        };
    }, '/playerDone', s.addr);

    // Structural input streams handling environment variables
    OSCdef(\sceneLeft, { |msg|
        ~leftPath = msg[1];
        "LEFT RECEIVED".postln;
        ~leftPath.postln;
    }, '/scene/left');

    OSCdef(\sceneRight, { |msg|
        ~rightPath = msg[1];
        "RIGHT RECEIVED".postln;
        ~rightPath.postln;

        if((~leftPath != "") && (~rightPath != "")) {
            "AUTO PLAY".postln;
            ~playScene.value;
        };
    }, '/scene/right');

    OSCdef(\sceneStop, { ~stopScene.value; }, '/scene/stop');

    // Real-Time Control parameters modifying the FX processor nodes
    OSCdef(\ghostGain, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\gain, msg[1]); };
        ("gain: " ++ msg[1]).postln;
    }, "/ghost/gain");

    OSCdef(\ghostDelayEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayEnabled, msg[1]); };
        ("delayEnabled: " ++ msg[1]).postln;
    }, "/ghost/delayEnabled");

    OSCdef(\ghostDelayTime, { |msg|
        msg.postln;
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayTime, msg[1]); };
    }, "/ghost/delayTime");

    OSCdef(\ghostDelayMix, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayMix, val); };
        ("delayMix: " ++ val).postln;
    }, "/ghost/delayMix");

    OSCdef(\ghostDelayFeedback, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayFeedback, val); };
        ("delayFeedback: " ++ val).postln;
    }, "/ghost/delayFeedback");

	OSCdef(\ghostFlangerEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerEnabled, msg[1]); };
        ("flangerEnabled: " ++ msg[1]).postln;
    }, "/ghost/flangerEnabled");

	OSCdef(\ghostFlangerEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerEnabled, msg[1]); };
        ("flangerEnabled: " ++ msg[1]).postln;
    }, "/ghost/flangerEnabled");

	OSCdef(\ghostFlangerRate, { |msg|
        msg.postln;
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerRate, msg[1]); };
    }, "/ghost/flangerRate");

	OSCdef(\ghostFlangerDepth, { |msg|
        msg.postln;
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerDepth, msg[1]); };
    }, "/ghost/flangerDepth");

	OSCdef(\ghostFlangerMix, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerMix, val); };
        ("delayMix: " ++ val).postln;
    }, "/ghost/flangerMix");


    /* =====================================================================
       6. CENTRAL ASYNCHRONOUS PLAYBACK ENGINE
       ===================================================================== */

    ~playScene = {
        var leftReady = false, rightReady = false;

        ~stopScene.value;
        "Loading Scene".postln;

        // Asynchronous multi-threaded buffer disk load loops
        ~leftBuf = Buffer.read(s, ~leftPath, action: { |buf|
            ~leftBuf  = buf;
            leftReady = true;
            "LEFT LOADED".postln;

            if(leftReady && rightReady && ~sceneStarted.not) {
                ~sceneStarted = true;
                "Playing Scene".postln;
                ~finishedCount = 0;

				~leftSynth  = Synth(\scenePlayer, [\buf, ~leftBuf.bufnum,  \playerId, 1, \outChannel, 0]);
                ~rightSynth = Synth(\scenePlayer, [\buf, ~rightBuf.bufnum, \playerId, 2, \outChannel, 1]);
            };
        });

        ~rightBuf = Buffer.read(s, ~rightPath, action: { |buf|
            ~rightBuf  = buf;
            rightReady = true;
            "RIGHT LOADED".postln;

            if(leftReady && rightReady && ~sceneStarted.not) {
                ~sceneStarted = true;
                "Playing Scene".postln;
                ~finishedCount = 0;

                ~leftSynth  = Synth(\scenePlayer, [\buf, ~leftBuf.bufnum,  \playerId, 1, \outChannel, 0]);
                ~rightSynth = Synth(\scenePlayer, [\buf, ~rightBuf.bufnum, \playerId, 2, \outChannel, 1]);
            };
        });
    };

    /* =====================================================================
       7. POST-INITIALIZATION SYSTEM EXECUTION
       ===================================================================== */

    "Scene Receiver Ready".postln;
    s.sync; // Block thread smoothly to ensure all background configs register

    if(~ghostEngine.notNil) { ~ghostEngine.free; };
    ~ghostEngine = Synth.tail(s, \ghostEngine, [\inBus, ~sceneBus, \gain, 1.0]);
    "Ghost Engine Started".postln;

    n = NetAddr("127.0.0.1", NetAddr.langPort);
});