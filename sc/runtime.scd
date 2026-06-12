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

        |inBus = 0, gain = 1.0, dspEnabled = 1, eqEnabled = 0, eqLow = 0, eqMid = 0, eqHigh = 0, compressorEnabled = 0, compressorThreshold = -18, compressorRatio = 4, compressorMakeup = 0, gateEnabled = 0, gateThreshold = -40, gateAttack = 0.01, gateRelease = 0.20, delayEnabled = 1, delayTime = 0.05, delayFeedback = 0.1, delayMix = 0.0, flangerEnabled=0, flangerRate=0.2, flangerDepth=0.5, flangerMix=0.3, chorusEnabled = 0, chorusRate = 0.2, chorusDepth = 0.5, chorusMix = 0.3, phaserEnabled = 0, phaserRate = 0.2, phaserDepth = 0.5, phaserMix = 0.3, pitchEnabled = 0, pitchSemitones = 0, pitchWindow = 0.20, pitchMix = 0.0, reverbEnabled = 0, reverbRoom = 0.5, reverbDamping = 0.5, reverbMix = 0.3, limiterEnabled = 0, limiterLevel = 0.95, limiterRelease = 0.01|

        var sig, delayed, drySig, wet, flanger, compressorWet, gateWet, flangerWet, chorusWet, phaserWet, pitchWet, reverb, reverbWet, limiterWet;
        var gainSmooth, delayTimeSmooth, delayMixSmooth, delayFeedbackSmooth;
		var flangerRateSmooth, flangerDepthSmooth, flangerMixSmooth;
		var reverbRoomSmooth, reverbDampingSmooth, reverbMixSmooth;
		var limiterLevelSmooth, limiterReleaseSmooth;
		var eqLowSmooth, eqMidSmooth, eqHighSmooth;
		var compressorThresholdSmooth, compressorRatioSmooth, compressorMakeupSmooth;
		var gateThresholdSmooth, gateAttackSmooth, gateReleaseSmooth;
		var chorusRateSmooth, chorusDepthSmooth, chorusMixSmooth;
		var phaserRateSmooth, phaserDepthSmooth, phaserMixSmooth;
		var phaserLFOLeft, phaserLFORight;
		var pitchSemitonesSmooth, pitchWindowSmooth, pitchMixSmooth;


        // Smooth parameters continuously to protect against sudden real-time value transitions
		gainSmooth                 = Lag.kr(gain, 1.0);
		eqLowSmooth                = Lag.kr(eqLow, 1.0);
		eqMidSmooth                = Lag.kr(eqMid, 1.0);
		eqHighSmooth               = Lag.kr(eqHigh, 1.0);
		compressorThresholdSmooth  = Lag.kr(compressorThreshold, 1.0);
		compressorRatioSmooth      = Lag.kr(compressorRatio, 1.0);
		compressorMakeupSmooth     = Lag.kr(compressorMakeup, 1.0);
		gateThresholdSmooth        = Lag.kr(gateThreshold, 1.0);
		gateAttackSmooth           = Lag.kr(gateAttack, 1.0);
		gateReleaseSmooth          = Lag.kr(gateRelease, 1.0);
        delayMixSmooth             = Lag.kr(delayMix, 1.0);
        delayTimeSmooth            = Lag.kr(delayTime, 1.0).clip(0.001, 0.49);
		delayFeedbackSmooth        = Lag.kr(delayFeedback, 1.0).clip(0.0, 1.5);
		flangerRateSmooth          = Lag.kr(flangerRate, 1.0);
		flangerDepthSmooth         = Lag.kr(flangerDepth, 1.0);
		flangerMixSmooth           = Lag.kr(flangerMix, 1.0);
		chorusRateSmooth           = Lag.kr(chorusRate, 1.0);
		chorusDepthSmooth          = Lag.kr(chorusDepth, 1.0);
		chorusMixSmooth            = Lag.kr(chorusMix, 1.0);
		phaserRateSmooth           = Lag.kr(phaserRate, 1.0);
		phaserDepthSmooth          = Lag.kr(phaserDepth, 1.0);
		phaserMixSmooth            = Lag.kr(phaserMix, 1.0);
		pitchSemitonesSmooth       = Lag.kr(pitchSemitones, 1.0);
		pitchWindowSmooth          = Lag.kr(pitchWindow, 1.0);
		pitchMixSmooth             = Lag.kr(pitchMix, 1.0);
		reverbRoomSmooth           = Lag.kr(reverbRoom, 1.0);
		reverbDampingSmooth        = Lag.kr(reverbDamping, 1.0);
		reverbMixSmooth            = Lag.kr(reverbMix, 1.0);
		limiterLevelSmooth         = Lag.kr(limiterLevel, 1.0);
		limiterReleaseSmooth       = Lag.kr(limiterRelease, 1.0);

        sig     = In.ar(inBus, 2);

		drySig  = sig;

		// EQ

		sig = SelectX.ar(Lag.kr(eqEnabled, 0.2),

			[
				sig,

				BHiShelf.ar(BPeakEQ.ar(BLowShelf.ar(sig, 200, 1.0, eqLowSmooth), 1000, 1.0, eqMidSmooth), 5000, 1.0, eqHighSmooth)

			]
		);

		// Compressor

		compressorWet = Compander.ar(sig, sig, compressorThresholdSmooth.dbamp, 1.0, 1.0 / compressorRatioSmooth, 0.01, 0.10);

		compressorWet = compressorWet * compressorMakeupSmooth.dbamp;

		sig = SelectX.ar(Lag.kr(compressorEnabled, 0.2),

			[
				sig,
				compressorWet
			]
		);

		// Gate

		gateWet = Compander.ar(sig, sig, gateThresholdSmooth.dbamp, 0.05, 1.0, gateAttackSmooth, gateReleaseSmooth);

		sig = SelectX.ar(Lag.kr(gateEnabled, 0.2),

			[
				sig,
				gateWet
			]
		);

		// Delay

        delayed = CombL.ar(sig, 0.5, delayTimeSmooth, delayFeedbackSmooth);
        wet     = XFade2.ar(sig, delayed, (delayMixSmooth * 2) - 1);
		sig     = SelectX.ar(Lag.kr(delayEnabled, 0.2), [sig, wet]);

		// Flanger

		flanger = DelayC.ar(sig, 0.03, SinOsc.kr(flangerRateSmooth).range(0.001, flangerDepthSmooth * 0.01));
		flangerWet  = XFade2.ar(sig, flanger, (flangerMixSmooth * 2) - 1);
		sig     = SelectX.ar(flangerEnabled, [sig, flangerWet]);

		// Chorus

		chorusWet = sig + DelayC.ar(sig, 0.05, SinOsc.kr(chorusRateSmooth).range( 0.005, 0.005 + (chorusDepthSmooth * 0.020))) * 0.5 + DelayC.ar(sig, 0.05, SinOsc.kr(chorusRateSmooth * 1.17, pi/2).range(0.005, 0.005 + (chorusDepthSmooth * 0.025))) * 0.5;

		chorusWet = XFade2.ar(sig, chorusWet, (chorusMixSmooth * 2) - 1);

		sig = SelectX.ar(Lag.kr(chorusEnabled, 0.2),

			[
				sig,
				chorusWet
			]
		);

		// Phaser

		phaserLFOLeft = SinOsc.kr(phaserRateSmooth).range(0.001, 0.001 + (phaserDepthSmooth * 0.020));

		phaserLFORight = SinOsc.kr(phaserRateSmooth, pi).range(0.001, 0.001 + (phaserDepthSmooth * 0.020));

		phaserWet = sig;

		4.do({phaserWet = AllpassC.ar(phaserWet, 0.05,

				[
					phaserLFOLeft,
					phaserLFORight
				],

				1.0);
		});

		phaserWet = XFade2.ar(sig, phaserWet, (phaserMixSmooth * 2) - 1);

		sig = SelectX.ar(Lag.kr(phaserEnabled, 0.2),

			[
				sig,
				phaserWet
			]

		);

		// Pitch Shift

		pitchWet = PitchShift.ar(sig, pitchWindowSmooth, 2.pow(pitchSemitonesSmooth / 12), 0, 0.01);

		pitchWet = XFade2.ar(sig, pitchWet, (pitchMixSmooth * 2) - 1);

		sig = SelectX.ar(Lag.kr(pitchEnabled, 0.2),

			[
				sig,
				pitchWet
			]

		);

		// Reverb

		reverbWet = FreeVerb2.ar(sig[0], sig[1], reverbMixSmooth, reverbRoomSmooth, reverbDampingSmooth);

		sig = SelectX.ar(Lag.kr(reverbEnabled, 0.2),
			[
				sig,
				reverbWet
			]
		);

		// Limiter

		limiterWet = Limiter.ar(sig, limiterLevelSmooth, limiterReleaseSmooth);

		sig = SelectX.ar(Lag.kr(limiterEnabled, 0.2),
			[
				sig,
				limiterWet
			]
		);

		sig = SelectX.ar(Lag.kr(dspEnabled, 0.2),

			[
				drySig,
				sig
			]
		);


		// Apply global gain
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

	OSCdef(\ghostDSPEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\dspEnabled, msg[1]);};

    }, "/ghost/dspEnabled");

	// OSC for master Gain

    OSCdef(\ghostGain, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\gain, msg[1]); };
    }, "/ghost/gain");

	// OSC for EQ

	OSCdef(\ghostEQEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\eqEnabled, msg[1]); };
    }, "/ghost/eqEnabled");

	OSCdef(\ghostEQLow, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\eqLow, msg[1]); };
    }, "/ghost/eqLow");

	OSCdef(\ghostEQMid, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\eqMid, msg[1]); };
    }, "/ghost/eqMid");

	OSCdef(\ghostEQHigh, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\eqHigh, msg[1]); };
    }, "/ghost/eqHigh");

	// OSC Compressor

	OSCdef(\ghostCompressorEnabled, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\compressorEnabled, msg[1]); };
	}, "/ghost/compressorEnabled");

	OSCdef(\ghostCompressorThreshold, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\compressorThreshold, msg[1]); };
	}, "/ghost/compressorThreshold");

	OSCdef(\ghostCompressorRatio, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\compressorRatio, msg[1]); };
	}, "/ghost/compressorRatio");

	OSCdef(\ghostCompressorMakeup, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\compressorMakeup, msg[1]); };
	}, "/ghost/compressorMakeup");

	// OSC for Gate

	OSCdef(\ghostGateEnabled, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\gateEnabled, msg[1]); };
	}, "/ghost/gateEnabled");

	OSCdef(\ghostGateThreshold, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\gateThreshold, msg[1]); };
	}, "/ghost/gateThreshold");

	OSCdef(\ghostGateAttack, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\gateAttack, msg[1]); };
	}, "/ghost/gateAttack");

	OSCdef(\ghostGateRelease, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\gateRelease, msg[1]); };
	}, "/ghost/gateRelease");

	// OSC for Delay

    OSCdef(\ghostDelayEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayEnabled, msg[1]); };
    }, "/ghost/delayEnabled");

    OSCdef(\ghostDelayTime, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayTime, msg[1]); };
    }, "/ghost/delayTime");

    OSCdef(\ghostDelayMix, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayMix, val); };
    }, "/ghost/delayMix");

    OSCdef(\ghostDelayFeedback, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\delayFeedback, val); };
    }, "/ghost/delayFeedback");

	// OSC for Flanger

	OSCdef(\ghostFlangerEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerEnabled, msg[1]); };
    }, "/ghost/flangerEnabled");

	OSCdef(\ghostFlangerRate, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerRate, msg[1]); };
    }, "/ghost/flangerRate");

	OSCdef(\ghostFlangerDepth, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerDepth, msg[1]); };
    }, "/ghost/flangerDepth");

	OSCdef(\ghostFlangerMix, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\flangerMix, val); };
    }, "/ghost/flangerMix");

	// OSC for Chorus

	OSCdef(\ghostChorusEnabled, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\chorusEnabled, msg[1]);};
	}, "/ghost/chorusEnabled");

	OSCdef(\ghostChorusRate, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\chorusRate, msg[1]);};
	}, "/ghost/chorusRate");

	OSCdef(\ghostChorusDepth, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\chorusDepth, msg[1]);};
	}, "/ghost/chorusDepth");

	OSCdef(\ghostChorusMix, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\chorusMix, msg[1]);};
	}, "/ghost/chorusMix");

	// OSC for Phaser

	OSCdef(\ghostPhaserEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\phaserEnabled, msg[1]);};
    }, "/ghost/phaserEnabled");

	OSCdef(\ghostPhaserRate, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\phaserRate, msg[1]);};
    }, "/ghost/phaserRate");

	OSCdef(\ghostPhaserDepth, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\phaserDepth, msg[1]);};
    }, "/ghost/phaserDepth");

	OSCdef(\ghostPhaserMix, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\phaserMix, msg[1]);};
    }, "/ghost/phaserMix");

	// OSC for Pitch Shift

	OSCdef(\ghostPitchEnabled, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\pitchEnabled, msg[1]);};
	}, "/ghost/pitchEnabled");

	OSCdef(\ghostPitchSemitones, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\pitchSemitones, msg[1]);};
	}, "/ghost/pitchSemitones");

	OSCdef(\ghostPitchWindow, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\pitchWindow, msg[1]);};
	}, "/ghost/pitchWindow");

	OSCdef(\ghostPitchMix, { |msg|
		if(~ghostEngine.notNil) { ~ghostEngine.set(\pitchMix, msg[1]);};
	}, "/ghost/pitchMix");

	// OSC for Reverb

	OSCdef(\ghostReverbEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\reverbEnabled, msg[1]); };
    }, "/ghost/reverbEnabled");

	OSCdef(\ghostReverbRoom, { |msg|
		var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\reverbRoom, val); };
    }, "/ghost/reverbRoom");

	OSCdef(\ghostreverbDamping, { |msg|
		var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\reverbDamping, val); };
    }, "/ghost/reverbDamping");

	OSCdef(\ghostReverbMix, { |msg|
        var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\reverbMix, val); };
    }, "/ghost/reverbMix");

	// OSC for Limiter

	OSCdef(\ghostLimiterEnabled, { |msg|
        if(~ghostEngine.notNil) { ~ghostEngine.set(\limiterEnabled, msg[1]); };
    }, "/ghost/limiterEnabled");

	OSCdef(\ghostLimiterLevel, { |msg|
		var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\limiterLevel, val); };
    }, "/ghost/limiterLevel");

	OSCdef(\ghostLimiterRelease, { |msg|
		var val = msg[1];
        if(~ghostEngine.notNil) { ~ghostEngine.set(\limiterRelease, val); };
    }, "/ghost/limiterRelease");



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