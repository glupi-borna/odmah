const vowels = "aeiouy";
const consonants = "bcdfghjklmnpqrstvwxz";
const letters = vowels+consonants;
const digits = "0123456789";

function int(min, max) {
    let r = max-min;
    let i = Math.round(Math.random()*r);
    return min+i;
}

function bool() {
    return Math.round() > 0.5;
}

function any(arr) {
    return arr[int(0, arr.length-1)];
}

function word(len=5) {
    let out = "";
    let c = bool();
    for (let i=0; i<len; i++) {
        out += any(c?vowels:consonants);
        c = !c;
    }
    return out;
}

function digits_str(len=5) {
    let out = "";
    for (let i=0; i<len; i++) {
        out += any(digits);
    }
    return out;
}
