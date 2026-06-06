(
var dir;

dir = PathName(thisProcess.nowExecutingPath)
    .pathOnly;

(dir +/+ "runtime.scd").load;
)
