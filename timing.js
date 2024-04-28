const frame_times = {
    buf: new Float64Array(1000),
    len: 0,
    idx: 0
};

function record_frame_time(time) {
    if (frame_times.len < 1000) {
        frame_times.buf[frame_times.len++] = time;
    } else {
        frame_times.buf[frame_times.idx] = time;
        frame_times.idx = (frame_times.idx+1) % frame_times.buf.length;
    }
}

function frame_time_stats() {
    let total = 0;
    let min = Infinity;
    let max = 0;
    for (let t of frame_times.buf) {
        total += t;
        min = Math.min(min, t);
        max = Math.max(max, t);
    }
    let avg = total/frame_times.len;
    let last_idx = (frame_times.idx-1+frame_times.len)%frame_times.len;
    let last = frame_times.buf[last_idx];
    return {total, min, max, avg, last};
}
