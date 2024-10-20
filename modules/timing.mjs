"use strict"

/**
@typedef {ReturnType<typeof frame_timer>} Timer
*/

/** @type {Map<any, Timer>} */
const timer_map = new Map();

function frame_timer() {
    return {
        buf: new Float64Array(100),
        len: 0,
        idx: 0,
        begin: NaN
    };
}

/** @arg {any} timer_unique_id */
export function timer_begin(timer_unique_id=null) {
    get_timer(timer_unique_id).begin = performance.now();
}

/** @arg {any} timer_unique_id */
export function timer_end(timer_unique_id=null) {
    let timer = timer_map.get(timer_unique_id);
    if (!timer) return;
    let time = performance.now() - timer.begin;
    timer.begin = NaN;

    if (timer.len < 100) {
        timer.buf[timer.len++] = time;
    } else {
        timer.buf[timer.idx] = time;
        timer.idx = (timer.idx+1) % 100;
    }
}

/** @arg {any} timer_unique_id */
export function get_timer(timer_unique_id) {
    let timer = timer_map.get(timer_unique_id);
    if (!timer) {
        timer = frame_timer();
        timer_map.set(timer_unique_id, timer);
    }
    return timer;
}

/** @arg {any} timer_unique_id */
export function timer_stats(timer_unique_id=null) {
    let timer = get_timer(timer_unique_id);

    let total = 0;
    let min = Infinity;
    let max = 0;

    for (let i=0; i<timer.buf.length; i++) {
        let t = timer.buf[i] ?? 0;
        total += t;
        min = Math.min(min, t);
        max = Math.max(max, t);
    }

    let avg = total/timer.len;
    let last_idx = (timer.idx-1+timer.len)%timer.len;
    let last = timer.buf[last_idx] ?? 0;
    return {total, min, max, avg, last};
}
