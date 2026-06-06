/////////////////////////////////////////////////////
// BOOT
/////////////////////////////////////////////////////

s.boot;

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

    s.freeAll;

    ~finishedCount = 0;

    ~leftDone = false;

    ~rightDone = false;

    "SCENE STOPPED".postln;
};

~runtimePath =
    PathName(
        thisProcess.nowExecutingPath
    ).fullPath;

/////////////////////////////////////////////////////
// PLAYER
/////////////////////////////////////////////////////

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
        0,
        [sig, sig]
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

/////////////////////////////////////////////////////
// PLAYBACK FUNCTION
/////////////////////////////////////////////////////

~playScene = {

	var l, r;

    "Loading Scene".postln;

    l = Buffer.read(
        s,
        ~leftPath
    );

    r = Buffer.read(
        s,
        ~rightPath
    );

    AppClock.sched(1.0, {

        "Playing Scene".postln;

        ~finishedCount = 0;

	Synth(
			\scenePlayer,
		[
			\buf, l.bufnum,
			\playerId, 1
		]
	);

	Synth(
			\scenePlayer,
		[
			\buf, r.bufnum,
			\playerId, 2
		]
	);


        nil;

    });

};

/////////////////////////////////////////////////////
// OSC RECEIVERS
/////////////////////////////////////////////////////

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

			~playScene.class.postln;

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

"Scene Receiver Ready".postln;