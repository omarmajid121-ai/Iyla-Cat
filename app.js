'use strict';
(() => {
/* ============================================================
   Dede دي دي — a virtual kitten for little ones (2–5 years)
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const now = () => performance.now();
const wait = ms => new Promise(r => setTimeout(r, ms));
const SVGNS = 'http://www.w3.org/2000/svg';

/* ---------------- words ---------------- */
const T = {
  ar: { hi:'مرحبا! أنا ليلي!', hungry:'أنا جوعانة!', thirsty:'أنا عطشانة!', sleepy:'أنا نعسانة...', dirty:'أريد أن أستحم!',
        bored:'هيا نلعب!', yummy:'لذيذ!', fav:'سمك! أحب السمك!', full:'شبعت!', spicy:'حار! أريد ماء!', ahh:'آه، طيب!',
        goodnight:'تصبحون على خير!', morning:'صباح الخير!', clean:'صرت نظيفة!', teeth:'أسناني تلمع!', yuck:'الدواء مر!',
        better:'صرت أحسن! شكرا!', love:'أحبك!', tickle:'هههه، يضحكني!', hot:'عندي حرارة!', pretty:'شكلي حلو!',
        thanks:'شكرا!', yay:'يااي!', dance:'هيا نرقص!', notThirsty:'لست عطشانة!', catch:'خذ الكرة!' },
  en: { hi:"Hi! I'm Lili!", hungry:"I'm hungry!", thirsty:"I'm thirsty!", sleepy:"I'm sleepy...", dirty:'I need a bath!',
        bored:"Let's play!", yummy:'Yummy!', fav:'Fish! I love fish!', full:"I'm full!", spicy:'Spicy! Water please!', ahh:'Ahh, tasty!',
        goodnight:'Good night!', morning:'Good morning!', clean:"I'm so clean!", teeth:'Shiny teeth!', yuck:'Yucky medicine!',
        better:'I feel better! Thank you!', love:'I love you!', tickle:'Hehe, that tickles!', hot:"I'm hot!", pretty:'I look pretty!',
        thanks:'Thank you!', yay:'Yaaay!', dance:"Let's dance!", notThirsty:"I'm not thirsty!", catch:'Catch!' }
};

/* ---------------- saved state ---------------- */
const KEY = 'lili-v1';
const DEF = { needs:{food:85,drink:85,sleep:85,clean:85,fun:85}, outfit:{hat:null,glasses:null,bow:'🎀',neck:null,cloth:null,shoes:null},
  settings:{lang:'ar',pitch:1.6,mic:true,talk:true,vol:.9}, bandages:[], t:Date.now() };
const RATE = { food:3, drink:4, sleep:2, clean:2.5, fun:4 };   // points lost per minute
const copy = o => JSON.parse(JSON.stringify(o));
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || !S.needs) S = copy(DEF);
else S = { ...copy(DEF), ...S, needs:{...DEF.needs, ...S.needs}, outfit:{...DEF.outfit, ...S.outfit}, settings:{...DEF.settings, ...S.settings}, bandages:S.bandages || [] };
{ const mins = Math.max(0, (Date.now() - S.t) / 60000);
  for (const k in RATE) { const v = S.needs[k]; S.needs[k] = Math.max(v - RATE[k] * mins, Math.min(v, 25)); } }
function save() { S.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function addNeed(k, v) { S.needs[k] = clamp(S.needs[k] + v, 0, 100); renderNeeds(); }

/* ---------------- DOM refs ---------------- */
const svg = $('#cat'), wrap = $('#catWrap'), FX = $('#fx'), PLAY = $('#play');
const R = {
  body: $('#catBody'), head: $('#head'), tail: $('#tail'), armL: $('#armL'), armR: $('#armR'), earL: $('#earL'), earR: $('#earR'),
  mouthC: $('#mouthC'), mouthO: $('#mouthO'), teeth: $('#teeth'), stains: $$('#stains circle'), stache: $('#stache'),
  red: $('#redFace'), sick: $('#sickFace'), brows: $('#brows'), item: $('#mouthItem'),
  hat: $('#hatSlot'), bow: $('#bowSlot'), glasses: $('#glassesSlot'), neck: $('#neckSlot'),
  foam: $('#foam'), cloth: $('#cloth'), backCloth: $('#backCloth'), shoes: $('#shoes'), sleeveL: $('#sleeveL'), sleeveR: $('#sleeveR'), wet: $('#wet'), dirtB: $('#dirtBody'), dirtH: $('#dirtHead'), band: $('#bandBody')
};
const EYES = [['#eyeL',148],['#eyeR',252]].map(([s,cx]) => { const g = $(s); return { cx, open:$('.open',g), closed:$('.closed',g), happy:$('.happy',g), pupil:$('.pupil',g) }; });

/* ---------------- geometry ---------------- */
let rect = wrap.getBoundingClientRect();
const sc = () => rect.width / 400;
const toC = (x, y) => ({ x: rect.left + x * sc(), y: rect.top + y * rect.height / 540 });
const toS = (x, y) => ({ x: (x - rect.left) / sc(), y: (y - rect.top) * 540 / rect.height });
const MOUTH = { x:200, y:284 };
function partAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const p = el && el.closest && el.closest('#cat [data-part]');
  return p ? p.dataset.part : null;
}
function nearMouth(x, y, r = 70) { const m = toC(MOUTH.x, MOUTH.y); return Math.hypot(x - m.x, y - m.y) < r * sc(); }

/* ============================================================
   AUDIO
   ============================================================ */
let AC = null, master, sfx, voiceIn, voiceAn, noiseBuf, started = false;
let busyUntil = 0;
const busy = sec => { busyUntil = Math.max(busyUntil, now() + sec * 1000 + 350); };

function initAudio() {
  if (AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) {}
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .2;
  master = AC.createGain(); master.gain.value = S.settings.vol;
  master.connect(comp); comp.connect(AC.destination);
  sfx = AC.createGain(); sfx.gain.value = .9; sfx.connect(master);
  // voice repeat chain: highpass → presence → compressor → analyser
  voiceIn = AC.createBiquadFilter(); voiceIn.type = 'highpass'; voiceIn.frequency.value = 120;
  const pk = AC.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3000; pk.gain.value = 4; pk.Q.value = .8;
  const vc = AC.createDynamicsCompressor(); vc.threshold.value = -20; vc.ratio.value = 4;
  const vg = AC.createGain(); vg.gain.value = 1.4;
  voiceAn = AC.createAnalyser(); voiceAn.fftSize = 1024;
  voiceIn.connect(pk); pk.connect(vc); vc.connect(vg); vg.connect(voiceAn); voiceAn.connect(master);
  const len = AC.sampleRate * 2; noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  loadSounds();
  const b = AC.createBuffer(1, 1, 22050), s = AC.createBufferSource(); s.buffer = b; s.connect(AC.destination); s.start(0);
}
function envAt(g, t, a, p, h, r) {
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a);
  g.gain.setValueAtTime(p, t + a + h); g.gain.exponentialRampToValueAtTime(.0001, t + a + h + r);
}
function tone({ f0 = 440, f1 = 0, dur = .2, type = 'sine', peak = .3, a = .005, t = 0, vib = 0, vibF = 6, lin = false, out } = {}) {
  if (!AC) return;
  const st = AC.currentTime + .005 + t, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, st);
  if (f1) lin ? o.frequency.linearRampToValueAtTime(f1, st + dur) : o.frequency.exponentialRampToValueAtTime(f1, st + dur);
  if (vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = vibF; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(st); l.stop(st + dur + .05); }
  envAt(g, st, a, peak, Math.max(0, dur * .6 - a), dur * .4 + .02);
  o.connect(g); g.connect(out || sfx); o.start(st); o.stop(st + dur + .1);
}
function noise({ dur = .2, type = 'bandpass', f = 1000, f1 = 0, q = 1, peak = .3, a = .005, t = 0 } = {}) {
  if (!AC) return;
  const st = AC.currentTime + .005 + t, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, st); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, st + dur); fl.Q.value = q;
  envAt(g, st, a, peak, Math.max(0, dur * .6 - a), dur * .4 + .02);
  s.connect(fl); fl.connect(g); g.connect(sfx); s.start(st, Math.random()); s.stop(st + dur + .1);
}

/* --- Lili's voice: real recorded cat & giggle sounds, pitched up for a cartoon kitten --- */
const SND = {};
const SND_NAMES = ['meow_a','meow_b','mew','meow_c','meow_low','laugh_a','laugh_b','laugh_c','snore','sneeze_a','sneeze_b','cough','sip','pour','brush','breath'];
function loadSounds() {
  SND_NAMES.forEach(n => fetch('sounds/' + n + '.mp3').then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => AC.decodeAudioData(ab, res, rej))).then(buf => {
    const d = buf.getChannelData(0), step = Math.floor(buf.sampleRate * .02), env = [];
    let mx = 0;
    for (let i = 0; i < d.length; i += step) { let q = 0; for (let j = i; j < Math.min(d.length, i + step); j++) q += d[j] * d[j]; const v = Math.sqrt(q / step); env.push(v); if (v > mx) mx = v; }
    SND[n] = { buf, env:env.map(v => v / (mx || 1)) };
  }).catch(() => {}));
}
const speaking = [];   // vocal clips currently playing → mouth sync
function play(n, o = {}) {
  if (!AC || !SND[n]) return 0;
  const S_ = SND[n], rate = o.rate || 1, t0 = AC.currentTime + .005 + (o.t || 0);
  const src = AC.createBufferSource(); src.buffer = S_.buf; src.playbackRate.value = rate;
  const g = AC.createGain(); g.gain.value = o.gain ?? .9;
  src.connect(g); g.connect(sfx);
  const off = o.offset || 0, dur = o.dur ? Math.min(o.dur, S_.buf.duration - off) : S_.buf.duration - off;
  if (o.dur) { g.gain.setValueAtTime(o.gain ?? .9, t0 + dur / rate - .04); g.gain.linearRampToValueAtTime(.0001, t0 + dur / rate); }
  src.start(t0, off, dur);
  const real = dur / rate;
  if (o.mouth !== 0) speaking.push({ env:S_.env, s:now() + (o.t || 0) * 1000, off, rate, e:now() + ((o.t || 0) + real) * 1000, amp:o.mouth ?? 1 });
  busy(real + (o.t || 0));
  return real;
}
function speakMouth(t) {
  let m = 0;
  for (let i = speaking.length - 1; i >= 0; i--) {
    const v = speaking[i];
    if (t > v.e) { speaking.splice(i, 1); continue; }
    if (t < v.s) continue;
    const idx = Math.floor(((t - v.s) / 1000 * v.rate + v.off) / .02);
    m = Math.max(m, clamp((v.env[idx] || 0) * 1.25, 0, 1) * v.amp);
  }
  return m;
}
const kitten = () => rnd(1.18, 1.32);
function meow(p = 1, d = .6, o = {}) {
  const sh = o.shape || 'meow', r = kitten() * p;
  const n = sh === 'sad' ? 'meow_low' : sh === 'q' || sh === 'hee' ? 'mew' : sh === 'mrrp' ? 'meow_c' : d < .45 ? pick(['mew','meow_c']) : pick(['meow_a','meow_b']);
  return play(n, { rate:sh === 'sad' ? r * .95 : sh === 'q' ? r * 1.1 : r, t:o.t, gain:(o.gain ? Math.min(1, o.gain * 2.8) : .9), mouth:o.mouth });
}
const giggle = () => play(pick(['laugh_b','laugh_c']), { rate:rnd(1.55, 1.7), gain:.85, mouth:.8 });
const laugh = () => play('laugh_a', { rate:1.55, gain:.85, mouth:.9 });
const yawn = () => play('meow_low', { rate:.98, gain:.8, mouth:1 });
const sigh = () => play('breath', { rate:1.35, gain:.5, dur:1.1, mouth:.3 });
const mumble = () => play('meow_c', { rate:.95, gain:.35, mouth:.3 });
const chirp = (n = 2, p = 1.25) => { for (let i = 0; i < n; i++) play('mew', { rate:p + .1 + i * .08, t:i * .32, gain:.8, dur:.32 }); };
const nomnom = () => { play('mew', { rate:1.45, gain:.75 }); };
const nuhuh = () => { play('meow_c', { rate:1.05 }); };
const bleh = () => play('cough', { rate:1.75, gain:.7, dur:.5, mouth:.8 });
const ahah = () => { for (let i = 0; i < 3; i++) play('mew', { rate:1.55 + i * .12, t:i * .2, dur:.22 }); };
const stretchWake = () => play('meow_b', { rate:1.08, gain:.85, mouth:1 });
const hup = () => play('mew', { rate:1.6, dur:.3 });
const chomp = () => { noise({ dur:.08, f:1700, q:.8, peak:.4 }); tone({ f0:190, f1:90, dur:.07, peak:.3 }); busy(.1); };
const gulp = () => play('sip', { rate:1.1, offset:rnd(0, .5), dur:.3, gain:.9, mouth:0 });
const slurp = () => play('sip', { rate:1.15, offset:0, dur:.45, gain:.9, mouth:0 });
const boop = () => { tone({ f0:880, f1:1400, dur:.09, peak:.3 }); busy(.1); };
const pop = () => { tone({ f0:300, f1:1600, dur:.06, peak:.35 }); noise({ dur:.03, type:'highpass', f:3000, peak:.12 }); busy(.08); };
const boing = () => { tone({ f0:720, f1:170, dur:.45, peak:.32, vib:30, vibF:14 }); busy(.45); };
const chime = () => { [1318.5, 1568, 2093, 2637].forEach((f, i) => { tone({ f0:f, dur:.7, type:'triangle', peak:.16, t:i * .08, a:.003 }); }); busy(.95); };
const twinkle = () => { for (let i = 0; i < 6; i++) tone({ f0:rnd(1800, 3200), dur:.18, type:'sine', peak:.08, t:i * .05, a:.002 }); busy(.4); };
const scrub = () => play('brush', { rate:1.1, offset:rnd(0, 2), dur:.22, gain:.55, mouth:0 });
const splash = () => play('pour', { rate:1, offset:rnd(0, 1.5), dur:.4, gain:.6, mouth:0 });
const click = () => { tone({ f0:1900, dur:.025, type:'square', peak:.08 }); };
const whoosh = () => { noise({ dur:.3, f:400, f1:1800, q:2, peak:.2, a:.03 }); busy(.3); };
const squeak = () => { tone({ f0:1300, f1:950, dur:.22, type:'square', peak:.08, vib:60, vibF:28 }); busy(.25); };
const heartbeat = () => { tone({ f0:75, f1:40, dur:.14, peak:.9 }); tone({ f0:70, f1:38, dur:.12, peak:.6, t:.22 }); busy(.4); };
const cough = () => play('cough', { rate:1.5, gain:.65, mouth:.7 });
const spicySfx = () => { noise({ dur:.6, type:'highpass', f:2500, peak:.15, a:.05 }); ahah(); };
const yuckSfx = () => bleh();
const sneeze = () => play(pick(['sneeze_a','sneeze_b']), { rate:1.45, gain:.75, mouth:.9 });
const snore = () => { play('snore', { rate:1.25, gain:.6, mouth:.25 }); tone({ f0:1000, f1:1500, dur:.6, peak:.03, t:1.3 }); };
const note = f => { tone({ f0:f, dur:1, peak:.32, a:.003 }); tone({ f0:f * 4, dur:.25, peak:.05, a:.002 }); tone({ f0:f * 2, dur:.5, type:'triangle', peak:.06, a:.002 }); busy(.5); };
const musicBox = f => { tone({ f0:f, dur:1.4, peak:.1, a:.003 }); tone({ f0:f * 2, dur:.6, peak:.035, a:.002 }); };

let purrNodes = null;
function startPurr() {
  if (!AC || purrNodes) return;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 2;
  const am = AC.createGain(); am.gain.value = .5;
  const lfo = AC.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 24; const lg = AC.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(am.gain);
  const hum = AC.createOscillator(); hum.frequency.value = 52; const hg = AC.createGain(); hg.gain.value = .25;
  const out = AC.createGain(); out.gain.setValueAtTime(.0001, AC.currentTime); out.gain.exponentialRampToValueAtTime(.55, AC.currentTime + .25);
  s.connect(lp); lp.connect(am); hum.connect(hg); hg.connect(am); am.connect(out); out.connect(sfx);
  s.start(); lfo.start(); hum.start();
  purrNodes = { s, lfo, hum, out };
}
function stopPurr() {
  if (!purrNodes) return; const p = purrNodes; purrNodes = null;
  p.out.gain.cancelScheduledValues(AC.currentTime); p.out.gain.setTargetAtTime(.0001, AC.currentTime, .08);
  setTimeout(() => { try { p.s.stop(); p.lfo.stop(); p.hum.stop(); } catch (e) {} }, 500);
}

/* ---------------- Lili "talks" in cat sounds only ---------------- */
let lastSay = 0;
const SAYS = {
  hi:()=>{ meow(1.1,.35,{shape:'mrrp'}); meow(1.05,.6,{t:.45}); },
  hungry:()=>{ meow(1,.9,{shape:'sad'}); }, thirsty:()=>{ meow(1.1,.4,{shape:'sad'}); meow(1.05,.45,{shape:'sad',t:.5}); },
  sleepy:()=>yawn(), dirty:()=>{ meow(1,.45,{shape:'q'}); meow(.95,.5,{shape:'sad',t:.55}); }, bored:()=>chirp(3),
  yummy:()=>nomnom(), fav:()=>{ nomnom(); chirp(2,1.4); }, full:()=>nuhuh(), notThirsty:()=>nuhuh(),
  spicy:()=>ahah(), ahh:()=>meow(1.05,.8,{shape:'ahh'}), goodnight:()=>sigh(), morning:()=>{ stretchWake(); },
  clean:()=>{ chirp(2,1.35); setTimeout(()=>giggle(),450); }, teeth:()=>chirp(2,1.45), yuck:()=>bleh(),
  better:()=>{ chirp(3,1.3); }, love:()=>meow(1.15,.6,{shape:'mrrp'}), tickle:()=>laugh(), hot:()=>meow(.9,.7,{shape:'sad',gain:.25}),
  pretty:()=>{ chirp(2,1.4); }, thanks:()=>meow(1.2,.4,{shape:'mrrp'}), yay:()=>chirp(3,1.5), dance:()=>chirp(2,1.3), catch:()=>hup()
};
function say(key) { lastSay = now(); (SAYS[key] || meow)(); }

/* ============================================================
   MIC — listen, record, repeat in Lili's voice
   ============================================================ */
let micOk = false, micStream = null, recording = false, recBuf = [], pre = [], nf = .01, above = 0, silence = 0, recDur = 0, voiced = 0, thr = .03;
async function initMic() {
  if (micStream && micStream.getAudioTracks().some(t => t.readyState === 'live')) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:false, autoGainControl:true, channelCount:1 } });
  } catch (e) { micOk = false; return; }
  const src = AC.createMediaStreamSource(micStream);
  const proc = AC.createScriptProcessor(2048, 1, 1), z = AC.createGain(); z.gain.value = 0;
  src.connect(proc); proc.connect(z); z.connect(AC.destination);
  proc.onaudioprocess = onMic; micOk = true;
}
function canListen() {
  return micOk && started && S.settings.mic && document.visibilityState === 'visible' && now() > busyUntil &&
    !A.lock && !A.sleeping && !A.voiceTalking && !A.petting && !['teeth','sleep'].includes(mode);
}
function onMic(e) {
  const c = new Float32Array(e.inputBuffer.getChannelData(0));
  let sum = 0; for (let i = 0; i < c.length; i++) sum += c[i] * c[i];
  const rms = Math.sqrt(sum / c.length), fd = c.length / AC.sampleRate, preMax = Math.ceil(.35 / fd);
  if (!recording) {
    pre.push(c); while (pre.length > preMax) pre.shift();
    if (rms < nf * 2.5) nf = clamp(nf * .97 + rms * .03, .002, .05);
    thr = Math.max(.022, nf * 3.2);
    if (canListen() && rms > thr) { if (++above >= 2) startRec(); } else above = 0;
  } else {
    recBuf.push(c); recDur += fd;
    if (rms > thr * .7) { voiced += fd; silence = 0; } else silence += fd;
    if (now() < busyUntil || A.lock) { recording = false; A.listening = false; recBuf = []; return; }   // interrupted by a touch
    if (silence > .75 || recDur > 8) stopRec();
  }
}
function startRec() { recording = true; recBuf = pre.slice(); pre = []; recDur = 0; silence = 0; voiced = 0; A.listening = true; }
function stopRec() {
  recording = false; A.listening = false; above = 0;
  const chunks = recBuf; recBuf = [];
  if (voiced < .22) return;
  const drop = Math.max(0, Math.floor((silence - .15) * AC.sampleRate));
  let len = chunks.reduce((n, c) => n + c.length, 0) - drop; if (len <= 0) return;
  const data = new Float32Array(len); let o = 0;
  for (const c of chunks) { if (o >= len) break; const n = Math.min(c.length, len - o); data.set(c.subarray(0, n), o); o += n; }
  let peak = 0; for (let i = 0; i < len; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
  const gain = Math.min(.92 / (peak || 1), 8), fade = Math.floor(AC.sampleRate * .012);
  for (let i = 0; i < len; i++) { let g = gain; if (i < fade) g *= i / fade; if (i > len - fade) g *= (len - i) / fade; data[i] *= g; }
  const b = AC.createBuffer(1, len, AC.sampleRate); b.getChannelData(0).set(data);
  const s = AC.createBufferSource(); s.buffer = b; s.playbackRate.value = S.settings.pitch; s.connect(voiceIn);
  const dur = b.duration / S.settings.pitch;
  A.voiceTalking = true; busy(dur); A.tiltT = rnd(-6, 6);
  s.onended = () => { A.voiceTalking = false; busy(.25); A.tiltT = 0; if (Math.random() < .25) setTimeout(giggle, 300); };
  s.start(); addNeed('fun', 2);
}

/* ============================================================
   ANIMATION STATE
   ============================================================ */
const A = {
  mouth:0, hold:0, wide:false, pulses:[], blink:1, blinkS:0, nextBlink:now() + 2000, eyeOv:null, eyeOvUntil:0,
  tilt:0, tiltT:0, shakeUntil:0, by:0, bv:0, wobUntil:0, waveUntil:0, danceUntil:0,
  armL:0, armR:0, armLT:0, armRT:0, armLUntil:0, armRUntil:0, earL:0, earR:0, earKick:0,
  tailKickUntil:0, look:null, lookUntil:0, wander:{x:0,y:0}, nextWander:0,
  listening:false, voiceTalking:false, tts:false, lock:false, sleeping:false, petting:false, sick:false,
  red:0, stacheUntil:0, dizzyUntil:0, nextIdle:now() + 6000
};
let mode = 'idle';
const mouthPulse = (d, amp = .7, delay = 0) => { const s = now() + delay * 1000; A.pulses.push({ s, e:s + d * 1000, amp }); };
const eyes = (m, ms) => { A.eyeOv = m; A.eyeOvUntil = now() + ms; };
const hop = (h = 30) => { if (A.by < 1) A.bv = Math.sqrt(2 * 1800 * h); };
const arm = (side, ang, ms) => { if (side === 'L') { A.armLT = ang; A.armLUntil = now() + ms; } else { A.armRT = ang; A.armRUntil = now() + ms; } };
const lockOn = () => { A.lock = true; };
const lockOff = () => { A.lock = false; busy(.3); };
const vbuf = new Float32Array(1024);

let last = now();
function frame() {
  const t = now(), dt = Math.min(.05, (t - last) / 1000); last = t;
  rect = wrap.getBoundingClientRect();

  /* body: breathing, hop, wobble */
  A.bv -= 1800 * dt; A.by += A.bv * dt; if (A.by < 0) { A.by = 0; A.bv = 0; }
  let rot = 0;
  if (t < A.wobUntil) rot = Math.sin(t / 110) * 6;
  if (t < A.dizzyUntil) rot = Math.sin(t / 160) * 8;
  if (t < A.danceUntil) rot = Math.sin(t / 180) * 5;
  const br = A.sleeping ? 1 + Math.sin(t / 700) * .022 : 1 + Math.sin(t / 450) * .012;
  R.body.setAttribute('transform', `translate(0 ${-A.by}) translate(200 528) rotate(${rot}) scale(${2 - br} ${br}) translate(-200 -528)`);

  /* head */
  let tt = A.tiltT;
  if (A.listening) tt = 9;
  if (A.sleeping) tt = 10;
  if (t < A.danceUntil) tt = Math.sin(t / 180) * 12;
  A.tilt += (tt - A.tilt) * Math.min(1, dt * 8);
  let hr = A.tilt, hy = 0;
  if (t < A.shakeUntil) hr += Math.sin(t / 45) * 11;
  if (A.voiceTalking) hy = Math.sin(t / 90) * 2.5;
  if (t < A.dizzyUntil) hr += Math.sin(t / 120) * 10;
  R.head.setAttribute('transform', `translate(0 ${hy}) rotate(${hr} 200 312)`);

  /* tail */
  const fast = t < A.tailKickUntil, sp = A.sleeping ? 2600 : fast ? 140 : A.sick ? 1400 : 650;
  const amp = A.sleeping ? 4 : fast ? 16 : A.sick ? 4 : 10;
  R.tail.setAttribute('transform', `rotate(${Math.sin(t / sp) * amp} 285 472)`);

  /* arms */
  if (t > A.armLUntil) A.armLT = 0; if (t > A.armRUntil) A.armRT = 0;
  let aL = A.armLT, aR = A.armRT;
  if (t < A.waveUntil) aR = -140 + Math.sin(t / 90) * 22;
  if (t < A.danceUntil) { aL = 70 + Math.sin(t / 180) * 50; aR = -70 + Math.sin(t / 180) * 50; }
  A.armL += (aL - A.armL) * Math.min(1, dt * 12); A.armR += (aR - A.armR) * Math.min(1, dt * 12);
  R.armL.setAttribute('transform', `rotate(${A.armL} 162 350)`);
  R.armR.setAttribute('transform', `rotate(${A.armR} 238 350)`);

  /* ears */
  A.earKick *= Math.pow(.02, dt);
  let eL = 0, eR = 0;
  if (A.listening) { eL = 8; eR = -8; }
  if (A.sick || A.sleeping) { eL = -14; eR = 14; }
  A.earL += (eL - A.earL) * Math.min(1, dt * 10); A.earR += (eR - A.earR) * Math.min(1, dt * 10);
  const k = Math.sin(t / 30) * A.earKick;
  R.earL.setAttribute('transform', `rotate(${A.earL + k} 130 130)`);
  R.earR.setAttribute('transform', `rotate(${A.earR - k} 270 130)`);

  /* eyes */
  let em = 'open';
  if (A.sleeping) em = 'closed'; else if (A.petting) em = 'happy'; else if (t < A.eyeOvUntil) em = A.eyeOv;
  if (t > A.nextBlink && !A.blinkS) { A.blinkS = t; }
  if (A.blinkS) { const p = (t - A.blinkS) / 150; if (p >= 1) { A.blinkS = 0; A.blink = 1; A.nextBlink = t + rnd(2200, 5200) * (Math.random() < .2 ? .1 : 1); } else A.blink = 1 - Math.sin(p * Math.PI) * .95; }
  const lidS = A.blink * (A.sick ? .62 : 1) * (A.voiceTalking ? 1.06 : 1);
  if (t > A.nextWander) { A.wander = Math.random() < .5 ? { x:0, y:0 } : { x:rnd(-8, 8), y:rnd(-5, 6) }; A.nextWander = t + rnd(1200, 3500); }
  for (const E of EYES) {
    E.open.setAttribute('display', em === 'open' ? '' : 'none');
    E.closed.setAttribute('display', em === 'closed' ? '' : 'none');
    E.happy.setAttribute('display', em === 'happy' ? '' : 'none');
    E.open.setAttribute('transform', `translate(${E.cx} 200) scale(1 ${lidS}) translate(${-E.cx} -200)`);
    let px = A.wander.x, py = A.wander.y;
    if (t < A.dizzyUntil) { const a = t / 120 + (E.cx > 200 ? Math.PI : 0); px = Math.cos(a) * 9; py = Math.sin(a) * 9; }
    else if (A.look && t < A.lookUntil) {
      const c = toC(E.cx, 200), dx = A.look.x - c.x, dy = A.look.y - c.y, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 160) * 10;
      px = dx / d * m; py = dy / d * m;
    }
    E.pupil.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
  }

  /* mouth */
  let mt = A.hold;
  if (A.voiceTalking) { voiceAn.getFloatTimeDomainData(vbuf); let s = 0; for (let i = 0; i < vbuf.length; i++) s += vbuf[i] * vbuf[i]; mt = Math.max(mt, clamp(Math.sqrt(s / vbuf.length) * 5, 0, 1)); }
  if (AC) mt = Math.max(mt, speakMouth(t));
  A.pulses = A.pulses.filter(p => t < p.e);
  for (const p of A.pulses) if (t >= p.s) mt = Math.max(mt, p.amp * Math.sin(Math.PI * (t - p.s) / (p.e - p.s)));
  if (A.wide) mt = 1;
  A.mouth += (mt - A.mouth) * Math.min(1, dt * 22);
  if (A.mouth < .06 && !A.wide) { R.mouthC.setAttribute('display', ''); R.mouthO.setAttribute('display', 'none'); }
  else {
    R.mouthC.setAttribute('display', 'none'); R.mouthO.setAttribute('display', '');
    const sx = A.wide ? 1.75 : .8 + A.mouth * .25, sy = A.wide ? 1.35 : .25 + A.mouth * .8;
    R.mouthO.setAttribute('transform', `translate(200 ${A.wide ? 284 : 280}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
  }
  R.teeth.setAttribute('display', A.wide ? '' : 'none');

  /* face overlays */
  A.red = Math.max(0, A.red - dt * .12);
  R.red.setAttribute('opacity', (A.red * .5).toFixed(3));
  R.sick.setAttribute('opacity', A.sick ? .28 : 0);
  R.brows.setAttribute('opacity', A.sick ? 1 : 0);
  R.stache.setAttribute('opacity', t < A.stacheUntil ? .95 : 0);

  /* bits that live in screen space */
  dizzyStars(t);
  placeHud();
  if (ball) ballStep(dt, t);
  if (bubbles.length || mode === 'play') bubbleStep(dt, t);
  if (started && mode === 'idle' && !A.lock && t > A.nextIdle && !A.voiceTalking && !A.listening && !A.tts) idle();

  requestAnimationFrame(frame);
}

/* ---------------- particles ---------------- */
function fx(txt, x, y, o = {}) {
  const d = document.createElement('div');
  d.className = 'p' + (o.cls ? ' ' + o.cls : '');
  d.textContent = txt;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  d.style.fontSize = (o.size || 40) + 'px';
  d.style.setProperty('--dx', (o.dx ?? rnd(-50, 50)) + 'px');
  d.style.setProperty('--dy', (o.dy ?? rnd(110, 190)) + 'px');
  if (o.s1) d.style.setProperty('--s1', o.s1);
  const dur = o.dur || 1.6; d.style.animationDuration = dur + 's';
  if (o.delay) d.style.animationDelay = o.delay + 's', d.style.opacity = 0;
  if (o.color) d.style.color = o.color;
  FX.appendChild(d); setTimeout(() => d.remove(), (dur + (o.delay || 0)) * 1000 + 80);
}
const hearts = (n = 4) => { const c = toC(200, 120); for (let i = 0; i < n; i++) fx(pick(['❤️','💖','💕','💗']), c.x + rnd(-90, 90) * sc(), c.y, { delay:i * .12, size:rnd(30, 46) }); };
const sparkles = (x, y, n = 6, spread = 80) => { for (let i = 0; i < n; i++) fx(pick(['✨','⭐','🌟']), x + rnd(-spread, spread), y + rnd(-spread, spread) * .6, { delay:i * .06, size:rnd(24, 40), dy:rnd(40, 120) }); };
const crumbs = () => { const m = toC(MOUTH.x, MOUTH.y + 10); for (let i = 0; i < 4; i++) fx('•', m.x + rnd(-20, 20), m.y, { size:rnd(14, 24), dy:-rnd(60, 120), dx:rnd(-60, 60), dur:.7, color:'#C98545' }); };
let stars = [];
function dizzyStars(t) {
  if (t < A.dizzyUntil) {
    if (!stars.length) for (let i = 0; i < 4; i++) { const s = document.createElement('div'); s.className = 'star'; s.textContent = i % 2 ? '💫' : '⭐'; FX.appendChild(s); stars.push(s); }
    const c = toC(200, 70);
    stars.forEach((s, i) => { const a = t / 260 + i * Math.PI / 2; s.style.left = (c.x + Math.cos(a) * 120 * sc()) + 'px'; s.style.top = (c.y + Math.sin(a) * 30 * sc()) + 'px'; });
  } else if (stars.length) { stars.forEach(s => s.remove()); stars = []; }
}

/* ---------------- HUD: needs, thought bubble, ear ---------------- */
const NEED_MODE = { food:'food', drink:'drink', sleep:'sleep', clean:'bath', fun:'play' };
const NEED_ICON = { food:'🍗', drink:'🥛', sleep:'🌙', clean:'🛁', fun:'⚽' };
const NEED_SAY = { food:'hungry', drink:'thirsty', sleep:'sleepy', clean:'dirty', fun:'bored' };
function renderNeeds() {
  $$('.need').forEach(el => {
    const v = S.needs[el.dataset.need];
    el.style.setProperty('--v', v.toFixed(1));
    el.style.setProperty('--c', v > 60 ? '#3BCE7A' : v > 30 ? '#FFC233' : '#FF5A5F');
    el.classList.toggle('low', v < 30);
  });
  renderDirt();
}
const thought = $('#thought'), ear = $('#ear');
let thoughtNeed = null;
function placeHud() {
  const p = toC(340, 60); thought.style.left = Math.min(p.x, innerWidth - 70) + 'px'; thought.style.top = Math.max(p.y, 70) + 'px';
  const e = toC(70, 120); ear.style.left = e.x + 'px'; ear.style.top = e.y + 'px';
  ear.classList.toggle('on', A.listening);
}
function lowestNeed() { let k = null, v = 101; for (const n in S.needs) if (S.needs[n] < v) { v = S.needs[n]; k = n; } return v < 30 ? k : null; }
function updateThought() {
  const k = mode === 'idle' && !A.lock ? lowestNeed() : null;
  thoughtNeed = k;
  thought.classList.toggle('on', !!k);
  if (k) $('span', thought).textContent = NEED_ICON[k];
}

/* ---------------- dirt, foam, bandages ---------------- */
const DIRT = [[160,400,22,14],[246,442,20,13],[128,466,16,11],[272,382,18,12],[210,474,17,11],[118,160,16,10],[276,150,15,10],[232,118,13,9]];
function renderDirt() {
  const n = S.needs.clean < 60 ? Math.min(DIRT.length, Math.ceil((60 - S.needs.clean) / 7)) : 0;
  if (R.dirtB.childElementCount + R.dirtH.childElementCount === n) return;
  R.dirtB.innerHTML = ''; R.dirtH.innerHTML = '';
  DIRT.slice(0, n).forEach(([x, y, rx, ry], i) => {
    const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('opacity', '.55');
    g.innerHTML = `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#8B5A2B"/><circle cx="${x + rx * .9}" cy="${y - ry * .6}" r="${ry * .45}" fill="#8B5A2B"/><circle cx="${x - rx * .8}" cy="${y + ry * .5}" r="${ry * .35}" fill="#8B5A2B"/>`;
    (i < 5 ? R.dirtB : R.dirtH).appendChild(g);
  });
}
function renderBandages() {
  R.band.innerHTML = '';
  S.bandages.forEach(([x, y, r]) => { const t = document.createElementNS(SVGNS, 'text'); t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', 42); t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central'); t.setAttribute('transform', `rotate(${r} ${x} ${y})`); t.textContent = '🩹'; R.band.appendChild(t); });
}
function renderOutfit() {
  R.hat.textContent = S.outfit.hat || ''; R.bow.textContent = S.outfit.bow || '';
  R.glasses.textContent = S.outfit.glasses || ''; R.neck.textContent = S.outfit.neck || '';
  const G = GARMENTS[S.outfit.cloth];
  R.cloth.innerHTML = G ? G.front : ''; R.backCloth.innerHTML = G ? (G.back || '') : '';
  R.sleeveL.innerHTML = G && G.sleeve ? sleeve('L', G.sleeve) : ''; R.sleeveR.innerHTML = G && G.sleeve ? sleeve('R', G.sleeve) : '';
  R.shoes.innerHTML = SHOES[S.outfit.shoes] ? SHOES[S.outfit.shoes].svg : '';
}
function addSvgCircle(group, x, y, r, fill, stroke) {
  const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r); c.setAttribute('fill', fill);
  if (stroke) { c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', 2); }
  group.appendChild(c); return c;
}


/* ---------------- clothes (drawn to fit Dede's body) ---------------- */
const BODY_D = 'M148 318 C 112 334 88 382 88 436 C 88 488 128 518 200 518 C 272 518 312 488 312 436 C 312 382 288 334 252 318 Z';
const torso = (fill, top, extra = '', trim = '#fff') => `<g clip-path="url(#bodyClip)"><path d="M70 ${top} Q 200 ${top + 34} 330 ${top} L330 545 L70 545 Z" fill="${fill}"/>${extra}<ellipse cx="200" cy="440" rx="125" ry="105" fill="url(#gShade)"/><path d="M70 ${top} Q 200 ${top + 34} 330 ${top}" fill="none" stroke="${trim}" stroke-width="6"/></g>`;
const stripes = (a, b, top) => { let r = `<rect x="70" y="${top}" width="260" height="240" fill="${a}"/>`; for (let y = top; y < 545; y += 28) r += `<rect x="70" y="${y}" width="260" height="13" fill="${b}"/>`; return r; };
function sleeve(side, [fill, len, cuff, pattern]) {
  const x = side === 'L' ? 112 : 212, y2 = 332 + len;
  const pat = pattern ? (() => { let r = ''; for (let y = 336; y < y2; y += 26) r += `<rect x="${x}" y="${y}" width="80" height="12" fill="${pattern}"/>`; return r; })() : '';
  return `<g clip-path="url(#armClip${side})"><rect x="${x}" y="326" width="80" height="${len + 6}" fill="${fill}"/>${pat}<rect x="${x}" y="${y2 - 8}" width="80" height="9" fill="${cuff}"/></g>`;
}
const GARMENTS = {
  tee:{ sleeve:['#4FA3FF',58,'#3B86DB'], front:torso('#4FA3FF',336,'<rect x="70" y="492" width="260" height="40" fill="#3B86DB"/><path d="M200 398 l7 15 17 2 -12 12 3 17 -15 -8 -15 8 3 -17 -12 -12 17 -2 Z" fill="#FFD84D" stroke="#E8B400" stroke-width="2" stroke-linejoin="round"/>') },
  dress:{ sleeve:['#FFA6CF',46,'#fff'], front:torso('#FF7EB6',338,'')+
    '<path d="M116 424 L284 424 Q 330 478 338 514 Q 200 542 62 514 Q 70 478 116 424 Z" fill="#FF7EB6" stroke="#E05A97" stroke-width="3"/>'+
    '<g fill="#fff" opacity=".9"><circle cx="130" cy="480" r="6"/><circle cx="170" cy="455" r="6"/><circle cx="205" cy="495" r="6"/><circle cx="245" cy="458" r="6"/><circle cx="275" cy="490" r="6"/><circle cx="105" cy="508" r="5"/><circle cx="300" cy="508" r="5"/></g>'+
    '<rect x="118" y="418" width="164" height="12" rx="6" fill="#fff"/><path d="M200 424 l-18 -10 v20 Z M200 424 l18 -10 v20 Z" fill="#E05A97"/><circle cx="200" cy="424" r="5" fill="#C93F7F"/>'+
    '<ellipse cx="183" cy="347" rx="19" ry="10" fill="#fff"/><ellipse cx="217" cy="347" rx="19" ry="10" fill="#fff"/>' },
  raincoat:{ sleeve:['#FFD23F',110,'#E0B020'], front:torso('#FFD23F',334,'<path d="M200 352 V545" stroke="#E0B020" stroke-width="4"/><g fill="#E0A000"><circle cx="214" cy="384" r="6"/><circle cx="214" cy="422" r="6"/><circle cx="214" cy="460" r="6"/></g><g fill="none" stroke="#E0B020" stroke-width="3"><rect x="112" y="446" width="36" height="28" rx="5"/><rect x="252" y="446" width="36" height="28" rx="5"/></g>','#E0B020') },
  overalls:{ sleeve:['#FF6B6B',46,'#E04848'], front:torso('#FF6B6B',336,'<g clip-path="url(#bodyClip)"><path d="M150 388 L250 388 L250 414 L330 414 L330 545 L70 545 L70 414 L150 414 Z" fill="#4A72C9"/><rect x="178" y="398" width="44" height="26" rx="4" fill="none" stroke="#34569E" stroke-width="3"/><path d="M200 470 V545" stroke="#34569E" stroke-width="3"/></g><path d="M166 334 L158 392 M234 334 L242 392" stroke="#4A72C9" stroke-width="13" stroke-linecap="round"/><circle cx="158" cy="392" r="6" fill="#FFD24D"/><circle cx="242" cy="392" r="6" fill="#FFD24D"/>') },
  hoodie:{ sleeve:['#4CC38A',110,'#33A06E'], front:'<ellipse cx="200" cy="334" rx="76" ry="18" fill="#33A06E"/>'+torso('#4CC38A',334,'<path d="M146 452 L254 452 L266 500 L134 500 Z" fill="#43B57E" stroke="#33A06E" stroke-width="3"/><g stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M186 350 L183 392"/><path d="M214 350 L217 392"/></g><circle cx="183" cy="394" r="4" fill="#fff"/><circle cx="217" cy="394" r="4" fill="#fff"/>','#33A06E') },
  princess:{ sleeve:['#C9A2FF',44,'#FFD24D'], front:torso('#A066F0',340,'','#FFD24D')+
    '<path d="M112 426 L288 426 Q 346 486 352 520 Q 200 550 48 520 Q 54 486 112 426 Z" fill="#A066F0" stroke="#7E46D0" stroke-width="3"/>'+
    '<path d="M70 512 Q 110 494 150 514 Q 200 494 250 514 Q 290 494 330 512" fill="none" stroke="#C9A2FF" stroke-width="6" stroke-linecap="round"/>'+
    '<g fill="#FFE27A"><circle cx="128" cy="470" r="4"/><circle cx="168" cy="448" r="3"/><circle cx="214" cy="478" r="4"/><circle cx="254" cy="452" r="3"/><circle cx="282" cy="486" r="4"/><circle cx="96" cy="500" r="3"/></g>'+
    '<rect x="114" y="420" width="172" height="12" rx="6" fill="#FFD24D"/><circle cx="200" cy="426" r="8" fill="#FF7EB6" stroke="#FFD24D" stroke-width="3"/>' },
  pajama:{ sleeve:['#BFE3FF',110,'#8CC8F5','#fff'], front:`<g clip-path="url(#bodyClip)"><path d="M70 334 Q 200 368 330 334 L330 545 L70 545 Z" fill="#BFE3FF"/></g>`+
    `<g clip-path="url(#bodyClip)"><path d="M70 334 Q 200 368 330 334 L330 545 L70 545 Z" fill="url(#pjStripes)"/><ellipse cx="200" cy="440" rx="125" ry="105" fill="url(#gShade)"/></g>`+
    '<g fill="#fff" stroke="#8CC8F5" stroke-width="2"><circle cx="200" cy="384" r="6"/><circle cx="200" cy="420" r="6"/><circle cx="200" cy="456" r="6"/><circle cx="200" cy="492" r="6"/></g><text x="250" y="470" font-size="26" text-anchor="middle" dominant-baseline="central">🌙</text>' },
  cape:{ back:'<path d="M150 330 C 100 400 64 470 58 528 Q 200 552 342 528 C 336 470 300 400 250 330 Z" fill="#E8344E" stroke="#B81F37" stroke-width="3.5"/><path d="M90 512 Q 200 532 310 512" fill="none" stroke="#FF6B7E" stroke-width="5" stroke-linecap="round"/>',
    front:'<path d="M160 336 Q 200 352 240 336" fill="none" stroke="#FFD24D" stroke-width="5"/><circle cx="160" cy="338" r="8" fill="#FFD24D" stroke="#E0A800" stroke-width="2"/><circle cx="240" cy="338" r="8" fill="#FFD24D" stroke="#E0A800" stroke-width="2"/><circle cx="200" cy="415" r="30" fill="#FFD24D" stroke="#E0A800" stroke-width="3"/><text x="200" y="417" font-size="36" font-weight="900" fill="#E8344E" text-anchor="middle" dominant-baseline="central" font-family="Arial Rounded MT Bold,Arial,sans-serif">D</text>' }
};
const shoePair = (fill, dark, extra) => [146, 254].map(x => `<ellipse cx="${x}" cy="503" rx="49" ry="28" fill="${fill}" stroke="${dark}" stroke-width="3.5"/>${extra(x)}`).join('');
const SHOES = {
  sneakers:{ e:'👟', svg:shoePair('#FF4D5E', '#C9283A', x => `<ellipse cx="${x}" cy="511" rx="34" ry="14" fill="#fff"/><path d="M${x - 44} 514 Q ${x} 536 ${x + 44} 514" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M${x - 14} 486 h28 M${x - 14} 494 h28" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`) },
  boots:{ e:'👢', svg:shoePair('#FF7EB6', '#D9558F', x => `<ellipse cx="${x}" cy="480" rx="40" ry="10" fill="#fff"/><circle cx="${x}" cy="503" r="7" fill="#fff"/>`) },
  wellies:{ e:'🥾', svg:shoePair('#FFD23F', '#D9A800', x => `<path d="M${x - 46} 512 Q ${x} 534 ${x + 46} 512" fill="none" stroke="#3A86FF" stroke-width="7" stroke-linecap="round"/><circle cx="${x + 18}" cy="492" r="6" fill="#3A86FF"/>`) }
};

/* ============================================================
   TOUCHING LILI
   ============================================================ */
let taps = [], pet = null;
svg.addEventListener('pointerdown', e => {
  if (!started || drag) return;
  const pEl = e.target.closest('[data-part]'); if (!pEl) return;
  const part = pEl.dataset.part;
  e.preventDefault();
  if (A.sleeping) { mumble(); A.earKick = 12; A.tiltT = rnd(-12, 12); setTimeout(() => A.tiltT = 0, 900); return; }
  if (A.lock || !['idle','dress','play','doctor'].includes(mode)) return;
  if (mode === 'doctor') { cough(); A.earKick = 8; return; }
  A.stacheUntil = 0;
  if (part === 'head' || part === 'ear') { pet = { id:e.pointerId, x:e.clientX, y:e.clientY, dist:0, part }; return; }
  tapped(part, e);
});
window.addEventListener('pointermove', e => {
  if (started) { A.look = { x:e.clientX, y:e.clientY }; A.lookUntil = now() + 1600; }
  if (!pet || e.pointerId !== pet.id) return;
  pet.dist += Math.hypot(e.clientX - pet.x, e.clientY - pet.y); pet.x = e.clientX; pet.y = e.clientY;
  if (pet.dist > 45 && !A.petting) {
    A.petting = true; startPurr(); pet.heart = setInterval(() => { const c = toC(200, 110); fx(pick(['❤️','💕','💖']), c.x + rnd(-80, 80) * sc(), c.y, { size:rnd(28, 40) }); }, 450);
  }
  if (A.petting) { const c = toC(200, 200); A.tiltT = clamp((e.clientX - c.x) / (6 * sc()), -14, 14); busy(.5); }
});
const endPet = e => {
  if (!pet || e.pointerId !== pet.id) return;
  const p = pet; pet = null;
  if (A.petting) { A.petting = false; clearInterval(p.heart); A.tiltT = 0; setTimeout(stopPurr, 250); addNeed('fun', 4); if (Math.random() < .3) setTimeout(() => say('love'), 400); }
  else tapped(p.part, e);
};
window.addEventListener('pointerup', endPet); window.addEventListener('pointercancel', endPet);

function tapped(part, e) {
  const t = now(); taps = taps.filter(x => t - x < 2500); taps.push(t);
  if (taps.length >= 7) { taps = []; dizzy(); return; }
  addNeed('fun', 1);
  switch (part) {
    case 'nose': boop(); eyes('happy', 500); if (Math.random() < .35) setTimeout(() => { sneeze(); A.shakeUntil = now() + 400; setTimeout(() => hop(14), 550); }, 250); else setTimeout(giggle, 150); fx('💥', e.clientX, e.clientY, { size:30, dy:40 }); break;
    case 'ear': A.earKick = 18; meow(1.25, .25, { shape:'mrrp' }); break;
    case 'head': A.earKick = 10; meow(1.1, .35, { shape:'mrrp' }); eyes('happy', 700); fx('💗', e.clientX, e.clientY - 20, { size:34 }); break;
    case 'belly': case 'body': (Math.random() < .5 ? laugh : giggle)(); A.wobUntil = now() + 700; eyes('happy', 900); hop(12); if (Math.random() < .25) setTimeout(() => say('tickle'), 750); break;
    case 'foot': giggle(); hop(26); eyes('happy', 700); break;
    case 'tail': meow(1.3, .4, { shape:'q' }); A.tailKickUntil = now() + 1200; hop(30); eyes('open', 10); break;
    case 'hand': { const left = e.clientX < toC(200, 0).x; arm(left ? 'L' : 'R', left ? 150 : -150, 700); tone({ f0:500, f1:900, dur:.1, peak:.25 }); twinkle(); sparkles(e.clientX, e.clientY - 40, 4, 40); eyes('happy', 800); setTimeout(() => meow(1.2, .3, { shape:'mrrp' }), 200); break; }
  }
}
async function dizzy() {
  A.dizzyUntil = now() + 2600; meow(1.2, 1.3, { shape:'sad', vib:.12, vibF:3 }); addNeed('fun', 3);
  await wait(2700); A.wobUntil = now() + 500; laugh();
}

/* ---------------- idle life ---------------- */
function idle() {
  A.nextIdle = now() + rnd(6000, 11000);
  const opts = ['wave','meow','tail','look','stretch','hum','scratch'];
  if (S.needs.sleep < 45) opts.push('yawn', 'yawn');
  switch (pick(opts)) {
    case 'wave': A.waveUntil = now() + 1300; meow(1.15, .35, { shape:'mrrp' }); break;
    case 'meow': meow(rnd(.95, 1.15), rnd(.45, .7)); break;
    case 'tail': A.tailKickUntil = now() + 1800; A.tiltT = 8; setTimeout(() => A.tiltT = 0, 1500); break;
    case 'look': A.look = { x:rnd(0, innerWidth), y:rnd(innerHeight * .2, innerHeight * .7) }; A.lookUntil = now() + 1600; break;
    case 'stretch': arm('L', 150, 1100); arm('R', -150, 1100); yawn(); eyes('closed', 1100); hop(8); break;
    case 'hum': eyes('happy', 1000); meow(1.3, .25, { shape:'hee', gain:.2 }); meow(1.4, .25, { shape:'hee', gain:.2, t:.3 }); A.tiltT = -8; setTimeout(() => A.tiltT = 0, 900); break;
    case 'scratch': A.earKick = 16; arm('L', 160, 900); setTimeout(() => A.earKick = 16, 400); break;
    case 'yawn': yawn(); eyes('closed', 1200); arm('L', 140, 900); break;
  }
}
setInterval(() => {   // once per second
  if (!started) return;
  if (A.sleeping) addNeed('sleep', 4);
  else for (const k in RATE) S.needs[k] = Math.max(0, S.needs[k] - RATE[k] / 60);
  renderNeeds(); updateThought();
  if (A.sleeping && S.needs.sleep >= 100 && mode === 'sleep') closeMode();
  if (thoughtNeed && now() - lastSay > 40000 && !A.lock && !A.voiceTalking && !A.listening) { say(NEED_SAY[thoughtNeed]); A.shakeUntil = 0; }
  $('.dbtn[data-mode="drink"]').classList.toggle('hint', A.red > .05);
}, 1000);
setInterval(save, 5000);

/* ============================================================
   DRAGGING THINGS ONTO LILI
   ============================================================ */
let drag = null;
function startDrag(e, html, o = {}) {
  e.preventDefault();
  const g = document.createElement('div'); g.className = 'ghost'; g.innerHTML = html;
  if (o.size) g.style.fontSize = o.size + 'px';
  document.body.appendChild(g);
  const lift = o.lift ?? 50, id = e.pointerId;
  let lx = e.clientX, ly = e.clientY, moved = 0;
  const place = () => { g.style.left = lx + 'px'; g.style.top = (ly - lift) + 'px'; };
  place(); drag = g;
  const mv = ev => {
    if (ev.pointerId !== id) return;
    moved += Math.hypot(ev.clientX - lx, ev.clientY - ly); lx = ev.clientX; ly = ev.clientY; place();
    A.look = { x:lx, y:ly - lift }; A.lookUntil = now() + 900;
    o.move && o.move(lx, ly - lift, g);
  };
  const up = ev => {
    if (ev.pointerId !== id) return;
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    drag = null;
    if (o.drop) o.drop(lx, ly - lift, g, moved < 14); else g.remove();
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  return g;
}
function fly(g, x, y, ms = 380, scale = .55) {
  g.style.transition = `left ${ms}ms cubic-bezier(.4,0,.6,1), top ${ms}ms cubic-bezier(.4,0,.6,1), transform ${ms}ms, opacity ${ms}ms`;
  void g.offsetWidth;
  g.style.left = x + 'px'; g.style.top = y + 'px'; g.style.transform = `translate(-50%,-50%) scale(${scale})`;
  return wait(ms);
}
function vanish(g) { g.style.transition = 'transform .25s, opacity .25s'; g.style.transform = 'translate(-50%,-50%) scale(.2)'; g.style.opacity = 0; setTimeout(() => g.remove(), 260); }
const overCat = (x, y) => !!partAt(x, y);

/* ============================================================
   MODES
   ============================================================ */
const dock = $('#dock'), tray = $('#tray'), items = $('#trayItems');
const TOOLS = {};   // per-mode state
function setTray(list) {
  items.innerHTML = '';
  const btn = $('#dock .dbtn') ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock')) : 120;
  const big = Math.min(170, Math.max(112, Math.min(innerWidth, innerHeight) * .17)) * .8, avail = innerWidth - big - 70;
  let rows = 1, per = list.length, isz = Math.min(big, avail / per - 12);
  if (isz < 66 && list.length > 4) { rows = 2; per = Math.ceil(list.length / 2); isz = Math.min(big, avail / per - 12); }
  tray.style.setProperty('--rows', rows); tray.style.setProperty('--isz', Math.floor(isz) + 'px');
  list.forEach(it => {
    const b = document.createElement('button');
    b.className = 'item' + (it.cls ? ' ' + it.cls : '');
    b.innerHTML = it.html || it.e;
    if (it.id) b.dataset.id = it.id;
    b.addEventListener('pointerdown', ev => { if (!A.lock || it.always) it.down(ev, b); });
    items.appendChild(b);
  });
}
const itemEl = id => $(`.item[data-id="${id}"]`, items);

function openMode(m) {
  if (!started || A.lock || m === mode) return;
  if (mode !== 'idle') closeMode(true);
  mode = m; document.body.dataset.mode = m;
  dock.classList.add('hidden'); tray.classList.remove('hidden');
  click(); updateThought();
  ({ food:modeFood, drink:modeDrink, sleep:modeSleep, bath:modeBath, teeth:modeTeeth, play:modePlay, dress:modeDress, doctor:modeDoctor })[m]();
}
function closeMode(switching) {
  const m = mode;
  if (m === 'sleep') wake();
  if (m === 'teeth') { A.wide = false; }
  if (m === 'doctor') { clearInterval(TOOLS.coughT); if (A.sick) { A.sick = false; } }
  if (m === 'play') stopPlay();
  if (m === 'bath') { R.foam.innerHTML = ''; R.wet.innerHTML = ''; }
  mode = 'idle'; document.body.dataset.mode = 'idle';
  tray.classList.add('hidden'); dock.classList.remove('hidden');
  if (!switching) { click(); A.nextIdle = now() + 4000; }
  updateThought();
}
$('#homeBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (A.lock && mode !== 'sleep') return; closeMode(); });
$$('.dbtn').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); openMode(b.dataset.mode); }));
$$('.need').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); openMode(NEED_MODE[b.dataset.need]); }));
thought.addEventListener('pointerdown', e => { e.preventDefault(); if (thoughtNeed) openMode(NEED_MODE[thoughtNeed]); });
$('#lamp').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'sleep') closeMode(); else openMode('sleep'); });

/* ---------- FOOD ---------- */
const FOODS = [{e:'🐟',fav:1},{e:'🍎'},{e:'🍌'},{e:'🍉'},{e:'🍓'},{e:'🥕'},{e:'🧀'},{e:'🍪'},{e:'🍰'},{e:'🌶️',spicy:1}];
function modeFood() {
  setTray(FOODS.map(f => ({ e:f.e, down:(ev, b) => {
    startDrag(ev, f.e, { size:96,
      move:(x, y) => { A.hold = overCat(x, y) || nearMouth(x, y, 130) ? .85 : 0; },
      drop:async (x, y, g, tap) => {
        if (!(tap || overCat(x, y) || nearMouth(x, y, 130))) { A.hold = 0; vanish(g); return; }
        if (S.needs.food >= 97) { A.hold = 0; vanish(g); refuse(); return; }
        lockOn(); A.hold = .9; const m = toC(MOUTH.x, MOUTH.y); whoosh();
        await fly(g, m.x, m.y, tap ? 450 : 260); g.remove();
        await eat(f);
      } });
  } })));
}
async function eat(f) {
  R.item.textContent = f.e; R.item.removeAttribute('opacity');
  for (let i = 0; i < 3; i++) {
    A.hold = .95; await wait(220);
    A.hold = 0; chomp(); crumbs(); A.by < 1 && hop(4);
    const s = 1 - (i + 1) / 3; R.item.setAttribute('transform', `translate(200 288) scale(${s}) translate(-200 -288)`);
    await wait(260);
  }
  R.item.textContent = ''; R.item.removeAttribute('transform');
  addNeed('food', f.fav ? 30 : 20); addNeed('fun', 3);
  if (f.spicy) {
    A.red = 1; spicySfx(); eyes('closed', 1800); hop(45);
    const e1 = toC(110, 70), e2 = toC(290, 70);
    for (let i = 0; i < 6; i++) { fx('💨', e1.x, e1.y, { delay:i * .2, dx:-rnd(40, 90), dy:rnd(60, 120), size:34 }); fx('💨', e2.x, e2.y, { delay:i * .2 + .1, dx:rnd(40, 90), dy:rnd(60, 120), size:34 }); }
    await wait(500); hop(40); await wait(500); hop(35); say('spicy'); await wait(1300);
  } else if (f.fav) {
    eyes('happy', 1800); hearts(6); startPurr(); say('fav'); await wait(1700); stopPurr();
  } else {
    eyes('happy', 1200); hearts(3); hop(18);
    if (Math.random() < .6) say('yummy'); else meow(1.1, .7, { shape:'ahh' });
    await wait(1000);
  }
  lockOff();
}
function refuse(key = 'full') { A.shakeUntil = now() + 750; meow(.95, .4, { shape:'sad' }); arm('R', -60, 900); setTimeout(() => say(key), 450); }

/* ---------- DRINK ---------- */
const DRINKS = [{e:'🥛',milk:1},{e:'🧃'},{e:'🥤'},{e:'🍼',milk:1},{e:'💧'}];
function modeDrink() {
  setTray(DRINKS.map(d => ({ e:d.e, down:ev => {
    startDrag(ev, d.e, { size:96,
      move:(x, y) => { A.hold = overCat(x, y) || nearMouth(x, y, 130) ? .5 : 0; },
      drop:async (x, y, g, tap) => {
        if (!(tap || overCat(x, y) || nearMouth(x, y, 130))) { A.hold = 0; vanish(g); return; }
        if (S.needs.drink >= 97 && A.red < .05) { A.hold = 0; vanish(g); refuse('notThirsty'); return; }
        lockOn(); const m = toC(MOUTH.x, MOUTH.y); whoosh();
        await fly(g, m.x, m.y, tap ? 450 : 260); g.remove();
        await sip(d);
      } });
  } })));
}
async function sip(d) {
  R.item.textContent = d.e; R.item.setAttribute('transform', 'translate(210 268) rotate(-30) scale(.95) translate(-200 -288)');
  A.hold = .45; eyes('happy', 1500);
  for (let i = 0; i < 3; i++) { (i % 2 ? gulp : slurp)(); await wait(430); R.item.setAttribute('opacity', (1 - (i + 1) / 3.5).toFixed(2)); }
  R.item.textContent = ''; R.item.removeAttribute('transform'); R.item.removeAttribute('opacity'); A.hold = 0;
  const wasSpicy = A.red > .05; A.red = 0;
  addNeed('drink', 25);
  meow(1.05, .7, { shape:'ahh' }); hop(14);
  if (d.milk) A.stacheUntil = now() + 9000;
  await wait(800);
  say(wasSpicy ? 'thanks' : Math.random() < .5 ? 'ahh' : 'thanks');
  await wait(900); lockOff();
}

/* ---------- SLEEP ---------- */
const LULLABY = [659,784,880,784, 659,587,523,0, 587,659,784,659, 587,523,587,0, 659,784,1047,880, 784,659,587,0, 523,587,659,587, 523,392,523,0];
function modeSleep() {
  setTray([{ e:'☀️', always:true, cls:'wide', html:'☀️', down:e => { e.preventDefault(); closeMode(); } }]);
  goSleep();
}
async function goSleep() {
  lockOn(); TOOLS.sleep = { timers:[] };
  document.body.classList.add('night'); click();
  yawn(); arm('L', 150, 1000); arm('R', -150, 1000); await wait(1500);
  if (mode !== 'sleep') { lockOff(); return; }
  eyes('closed', 1300); sigh(); await wait(1300);
  if (mode !== 'sleep') { lockOff(); return; }
  A.sleeping = true; lockOff();
  const T1 = setInterval(() => { const c = toC(290, 90); fx(pick(['💤','Z','z']), c.x, c.y, { dx:rnd(30, 80), dy:rnd(120, 180), size:rnd(30, 50), dur:2.4, color:'#fff' }); }, 1500);
  const T2 = setInterval(snore, 5200);
  let i = 0; const T3 = setInterval(() => { const f = LULLABY[i++ % LULLABY.length]; if (f) musicBox(f); }, 480);
  TOOLS.sleep.timers.push(T1, T2, T3);
}
async function wake() {
  (TOOLS.sleep?.timers || []).forEach(clearInterval);
  const was = A.sleeping; A.sleeping = false;
  document.body.classList.remove('night'); click();
  if (!was) return;
  lockOn(); await wait(250);
  arm('L', 150, 1100); arm('R', -150, 1100); stretchWake(); eyes('closed', 1100); await wait(1300);
  hop(22); chirp(2, 1.3); eyes('happy', 1000); await wait(600); lockOff();
}

/* ---------- BATH ---------- */
function modeBath() {
  TOOLS.bath = { step:'soap', foam:0, everFoam:false, lastFx:0, lastSnd:0, wet:0 };
  setTray([
    { e:'🧼', id:'soap', cls:'hint', down:ev => startDrag(ev, '🧼', { size:90, move:soapMove, drop:(x, y, g) => vanish(g) }) },
    { e:'🚿', id:'shower', down:ev => startDrag(ev, '🚿', { size:100, lift:90, move:showerMove, drop:(x, y, g) => vanish(g) }) },
    { html:'<div class="towel"></div>', id:'towel', down:ev => startDrag(ev, '<div class="towel"></div>', { move:towelMove, drop:(x, y, g) => vanish(g) }) },
    { e:'🦆', id:'duck', down:ev => { ev.preventDefault(); squeak(); giggle(); const c = toC(200, 40); fx('🦆', c.x + rnd(-60, 60), c.y, { size:60, dy:rnd(100, 160) }); addNeed('fun', 2); } }
  ]);
  if (S.needs.clean > 70) eyes('happy', 800); else meow(.95, .5, { shape:'q' });
}
function bathHint(step) { ['soap','shower','towel'].forEach(id => itemEl(id)?.classList.toggle('hint', id === step)); }
function soapMove(x, y) {
  const B = TOOLS.bath, t = now(); if (!overCat(x, y)) return;
  if (t - B.lastFx > 70) {
    B.lastFx = t; const p = toS(x, y);
    for (let i = 0; i < 3; i++) { addSvgCircle(R.foam, p.x + rnd(-14, 14), p.y + rnd(-14, 14), rnd(8, 18), 'rgba(255,255,255,.95)', 'rgba(150,210,255,.8)'); B.foam++; }
    if (Math.random() < .3) fx('🫧', x + rnd(-30, 30), y, { size:rnd(22, 36), dy:rnd(60, 120) });
    B.everFoam = true;
  }
  if (t - B.lastSnd > 160) { B.lastSnd = t; scrub(); if (Math.random() < .12) giggle(); }
  if (B.step === 'soap' && B.foam >= 45) { B.step = 'rinse'; bathHint('shower'); eyes('happy', 900); meow(1.2, .3, { shape:'mrrp' }); }
}
function showerMove(x, y) {
  const B = TOOLS.bath, t = now();
  if (t - B.lastFx > 70) { B.lastFx = t; for (let i = 0; i < 2; i++) fx('💧', x + rnd(-30, 30), y + 40, { size:rnd(16, 26), dy:-rnd(140, 260), dx:rnd(-20, 20), dur:.8 }); }
  if (t - B.lastSnd > 300) { B.lastSnd = t; splash(); }
  const p = toS(x, y + 60);
  [...R.foam.children].forEach(c => { if (Math.hypot(c.cx.baseVal.value - p.x, c.cy.baseVal.value - p.y) < 75) { c.remove(); B.foam = Math.max(0, B.foam - 1); } });
  if (overCat(x, y + 60)) {
    eyes('happy', 300);
    if (R.wet.childElementCount < 10 && Math.random() < .2) { addWetDrop(p.x, p.y); }
  }
  if (B.everFoam && R.foam.childElementCount === 0 && B.step === 'rinse') {
    B.step = 'dry'; S.needs.clean = Math.max(S.needs.clean, 90); renderNeeds();
    while (R.wet.childElementCount < 8) addWetDrop(rnd(120, 280), rnd(150, 470));
    bathHint('towel'); A.wobUntil = now() + 600; meow(1.15, .5, { shape:'q' });
  }
}
function addWetDrop(x, y) { const t = document.createElementNS(SVGNS, 'text'); t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', 26); t.setAttribute('text-anchor', 'middle'); t.textContent = '💧'; R.wet.appendChild(t); }
function towelMove(x, y) {
  const B = TOOLS.bath, t = now(); if (!overCat(x, y)) return;
  if (t - B.lastSnd > 180) { B.lastSnd = t; scrub(); }
  const p = toS(x, y);
  [...R.wet.children].forEach(c => { if (Math.hypot(+c.getAttribute('x') - p.x, +c.getAttribute('y') - p.y) < 70) c.remove(); });
  if (B.step === 'dry' && R.wet.childElementCount === 0) bathDone();
}
async function bathDone() {
  const B = TOOLS.bath; B.step = 'done'; bathHint(null);
  S.needs.clean = 100; S.bandages = []; renderBandages(); renderNeeds(); addNeed('fun', 5);
  lockOn(); A.wobUntil = now() + 700; await wait(600);
  const c = toC(200, 300); sparkles(c.x, c.y, 10, 150 * sc()); chime(); eyes('happy', 1600); hop(28);
  await wait(400); say('clean'); await wait(1200); lockOff();
  B.step = 'soap'; B.everFoam = false; bathHint('soap');
}

/* ---------- TEETH ---------- */
function modeTeeth() {
  TOOLS.teeth = { done:false, lastSnd:0, lastFx:0 };
  R.stains.forEach(s => s.setAttribute('opacity', 1));
  A.wide = true; meow(.95, .9, { shape:'ahh', gain:.18 });
  setTray([{ e:'🪥', cls:'hint', down:ev => startDrag(ev, '🪥', { size:96, move:brushMove, drop:(x, y, g) => vanish(g) }) }]);
}
function brushMove(x, y) {
  const Tt = TOOLS.teeth, t = now();
  if (Tt.done || !nearMouth(x, y, 75)) return;
  if (t - Tt.lastSnd > 130) { Tt.lastSnd = t; scrub(); }
  if (t - Tt.lastFx > 110) { Tt.lastFx = t; fx(pick(['🫧','○']), x + rnd(-30, 30), y + rnd(-10, 20), { size:rnd(16, 28), dy:rnd(30, 80), color:'#fff' }); }
  const left = R.stains.filter(s => +s.getAttribute('opacity') > .02);
  if (left.length) { const s = pick(left); s.setAttribute('opacity', Math.max(0, +s.getAttribute('opacity') - .09).toFixed(2)); }
  else teethDone();
}
async function teethDone() {
  TOOLS.teeth.done = true; $('.item', items)?.classList.remove('hint');
  const m = toC(MOUTH.x, MOUTH.y - 8); sparkles(m.x, m.y, 7, 60 * sc()); chime();
  await wait(700); A.wide = false; eyes('happy', 1500); hop(16); addNeed('clean', 10); addNeed('fun', 5);
  await wait(250); say('teeth');
  await wait(3500);
  if (mode === 'teeth') { R.stains.forEach(s => s.setAttribute('opacity', 1)); TOOLS.teeth.done = false; A.wide = true; $('.item', items)?.classList.add('hint'); }
}

/* ---------- PLAY ---------- */
let ball = null, bubbles = [], playKind = null;
function modePlay() {
  setTray([
    { e:'⚽', id:'ball', down:ev => { ev.preventDefault(); startPlay('ball'); } },
    { e:'🫧', id:'bubbles', down:ev => { ev.preventDefault(); startPlay('bubbles'); } },
    { e:'🎵', id:'music', down:ev => { ev.preventDefault(); startPlay('music'); } }
  ]);
  startPlay('ball');
}
function startPlay(k) {
  if (playKind === k) return;
  stopPlay(); playKind = k;
  $$('.item', items).forEach(b => b.classList.toggle('on', b.dataset.id === k));
  if (k === 'ball') makeBall();
  if (k === 'bubbles') { TOOLS.bub = setInterval(spawnBubble, 650); for (let i = 0; i < 4; i++) spawnBubble(); }
  if (k === 'music') { $('#xylo').classList.remove('hidden'); say('dance'); }
  meow(1.15, .35, { shape:'mrrp' });
}
function stopPlay() {
  if (ball) { ball.el.remove(); ball = null; }
  clearInterval(TOOLS.bub); bubbles.forEach(b => b.el.remove()); bubbles = [];
  $('#xylo').classList.add('hidden'); playKind = null; A.danceUntil = 0;
}
/* ball */
function makeBall() {
  const el = document.createElement('div'); el.className = 'ball'; el.textContent = pick(['⚽','🏀','🎾','🔴']);
  const r = clamp(innerWidth * .05, 34, 50); el.style.fontSize = r * 2 + 'px';
  PLAY.appendChild(el);
  ball = { el, r, x:rect.left - r * 2 > 0 ? rect.left - r * 2 : r * 2, y:innerHeight * .3, vx:200, vy:0, held:null, lastHit:0, rest:0 };
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); ball.held = { id:e.pointerId, hist:[] }; whoosh();
  });
}
window.addEventListener('pointermove', e => {
  if (!ball || !ball.held || ball.held.id !== e.pointerId) return;
  ball.x = e.clientX; ball.y = e.clientY; ball.held.hist.push([now(), e.clientX, e.clientY]); if (ball.held.hist.length > 6) ball.held.hist.shift();
});
const releaseBall = e => {
  if (!ball || !ball.held || ball.held.id !== e.pointerId) return;
  const h = ball.held.hist; ball.held = null;
  if (h.length >= 2) { const a = h[0], b = h[h.length - 1], dt = Math.max(16, b[0] - a[0]) / 1000; ball.vx = clamp((b[1] - a[1]) / dt, -2600, 2600); ball.vy = clamp((b[2] - a[2]) / dt, -2600, 2600); }
};
window.addEventListener('pointerup', releaseBall); window.addEventListener('pointercancel', releaseBall);
function ballStep(dt, t) {
  const B = ball, r = B.r, floor = rect.bottom - rect.height * .02 - r, W = innerWidth;
  if (!B.held) {
    B.vy += 2000 * dt; B.x += B.vx * dt; B.y += B.vy * dt;
    if (B.y > floor) { B.y = floor; if (Math.abs(B.vy) > 260) { B.vy *= -.72; tone({ f0:180, f1:120, dur:.06, peak:.2 }); } else B.vy = 0; B.vx *= Math.pow(.5, dt); }
    if (B.y < r + 10) { B.y = r + 10; B.vy = Math.abs(B.vy) * .7; }
    if (B.x < r) { B.x = r; B.vx = Math.abs(B.vx) * .8; }
    if (B.x > W - r) { B.x = W - r; B.vx = -Math.abs(B.vx) * .8; }
    // bump into Lili (head circle + body circle)
    for (const [cx, cy, cr] of [[200, 205, 132], [200, 410, 112]]) {
      const c = toC(cx, cy), R2 = cr * sc() + r * .8, dx = B.x - c.x, dy = B.y - c.y, d = Math.hypot(dx, dy);
      if (d < R2 && d > 0) {
        const nx = dx / d, ny = dy / d, vn = B.vx * nx + B.vy * ny;
        B.x = c.x + nx * R2; B.y = c.y + ny * R2;
        if (vn < 0) { B.vx -= 1.9 * vn * nx; B.vy -= 1.9 * vn * ny; B.vy -= 380; }
        if (t - B.lastHit > 450 && Math.abs(vn) > 120) {
          B.lastHit = t; boing(); const left = nx < 0; arm(left ? 'L' : 'R', left ? 120 : -120, 400); eyes('happy', 500); addNeed('fun', 3);
          if (Math.random() < .3) setTimeout(giggle, 250);
        }
      }
    }
    // resting near Lili? she pats it away
    const speed = Math.hypot(B.vx, B.vy), cc = toC(200, 400);
    if (speed < 60 && Math.abs(B.x - cc.x) < rect.width * .85) { B.rest += dt; if (B.rest > 1.4 && !A.lock) { B.rest = 0; const left = B.x < cc.x; arm(left ? 'L' : 'R', left ? 110 : -110, 500); B.vx = (left ? -1 : 1) * rnd(700, 1100); B.vy = -rnd(900, 1300); boing(); if (Math.random() < .4) say('catch'); } }
    else B.rest = 0;
  }
  A.look = { x:B.x, y:B.y }; A.lookUntil = t + 300;
  B.el.style.transform = `translate(${B.x - r}px,${B.y - r}px) rotate(${(B.x / r) * 57}deg)`;
  B.el.style.left = 0; B.el.style.top = 0;
}
/* bubbles */
function spawnBubble() {
  if (bubbles.length > 14) return;
  const el = document.createElement('div'); el.className = 'bubble';
  const r = rnd(26, 58); el.style.width = el.style.height = r * 2 + 'px';
  const b = { el, r, x:rnd(r, innerWidth - r), y:innerHeight - 40, vy:rnd(55, 110), ph:rnd(0, 6) };
  el.addEventListener('pointerdown', e => { e.preventDefault(); popBubble(b, false); });
  PLAY.appendChild(el); bubbles.push(b);
}
function popBubble(b, byLili) {
  if (!bubbles.includes(b)) return;
  bubbles = bubbles.filter(x => x !== b); b.el.remove(); pop();
  fx('✨', b.x, b.y, { size:b.r, dy:20, dur:.6 });
  addNeed('fun', 2); TOOLS.pops = (TOOLS.pops || 0) + 1;
  if (!byLili && TOOLS.pops % 4 === 0) { giggle(); eyes('happy', 700); hop(14); }
}
function bubbleStep(dt, t) {
  for (const b of bubbles) {
    b.y -= b.vy * dt; b.x += Math.sin(b.ph + t / 700) * 25 * dt;
    b.el.style.transform = `translate(${b.x - b.r}px,${b.y - b.r}px)`;
  }
  bubbles.filter(b => b.y < -b.r).forEach(b => { b.el.remove(); bubbles = bubbles.filter(x => x !== b); });
  if (bubbles.length && t > (TOOLS.liliPop || 0)) {
    TOOLS.liliPop = t + 2200;
    const near = bubbles.find(b => b.x > rect.left && b.x < rect.right && b.y > rect.top && b.y < rect.top + rect.height * .6);
    if (near) { const left = near.x < toC(200, 0).x; arm(left ? 'L' : 'R', left ? 160 : -160, 450); A.look = { x:near.x, y:near.y }; A.lookUntil = t + 600; setTimeout(() => popBubble(near, true), 200); }
  }
  if (playKind === 'bubbles' && bubbles.length) { const b = bubbles[0]; if (!A.look || t > A.lookUntil) { A.look = { x:b.x, y:b.y }; A.lookUntil = t + 300; } }
}
/* xylophone */
const XY = [[523.25,'#FF5A5F'],[587.33,'#FF9F1C'],[659.25,'#FFD23F'],[698.46,'#3BCE7A'],[783.99,'#2EC4D6'],[880,'#3A86FF'],[987.77,'#8E5CF7'],[1046.5,'#F15BB5']];
{
  const x = $('#xylo');
  XY.forEach(([f, c], i) => { const b = document.createElement('b'); b.style.background = c; b.style.height = `clamp(${110 - i * 7}px, ${26 - i * 1.4}vmin, ${230 - i * 12}px)`; b.dataset.i = i; x.appendChild(b); });
  let held = null, cnt = 0;
  const hit = b => {
    if (!b || b === held?.last) return; if (held) held.last = b;
    const [f, c] = XY[+b.dataset.i]; note(f); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140);
    const r = b.getBoundingClientRect(); fx(pick(['♪','♫','🎵','🎶']), r.left + r.width / 2, r.top, { size:38, color:c, dy:rnd(120, 200) });
    A.danceUntil = now() + 1600; if (A.by < 1) hop(10); eyes('happy', 500); addNeed('fun', 1);
    if (++cnt % 10 === 0) setTimeout(() => meow(1.25, .4, { shape:'mrrp' }), 300);
  };
  x.addEventListener('pointerdown', e => { e.preventDefault(); held = { id:e.pointerId, last:null }; hit(e.target.closest('b')); });
  window.addEventListener('pointermove', e => { if (!held || held.id !== e.pointerId) return; const el = document.elementFromPoint(e.clientX, e.clientY); hit(el && el.closest && el.closest('#xylo b')); });
  const end = e => { if (held && held.id === e.pointerId) held = null; };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
}

/* ---------- DRESS UP ---------- */
const WARDROBE = {
  cloth: Object.keys(GARMENTS), hat:['👑','🎩','🧢','👒','🎓'], bow:['🎀','🌸','🦋','🌻'],
  glasses:['🕶️','👓','🥽'], shoes: Object.keys(SHOES), neck:['🔔','🧣','🏅','📿']
};
const CAT_ICON = { cloth:'👗', hat:'👑', bow:'🎀', glasses:'🕶️', shoes:'👟', neck:'🔔' };
const thumb = k => `<svg viewBox="58 300 284 250" width="82%" height="82%"><path d="${BODY_D}" fill="#F9A455"/>${GARMENTS[k].back || ''}${GARMENTS[k].front}</svg>`;
function modeDress() { dressCats(); }
function dressCats() {
  setTray([...Object.keys(WARDROBE).map(slot => ({ e:CAT_ICON[slot], id:'cat:' + slot, cls:S.outfit[slot] ? 'on' : '', down:ev => { ev.preventDefault(); click(); dressSlot(slot); } })),
    { e:'🔄', id:'clear', down:ev => { ev.preventDefault(); S.outfit = { hat:null, glasses:null, bow:null, neck:null, cloth:null, shoes:null }; renderOutfit(); dressCats(); whoosh(); A.wobUntil = now() + 500; save(); } }]);
}
function dressSlot(slot) {
  setTray([{ e:'⬅️', id:'back', down:ev => { ev.preventDefault(); click(); dressCats(); } },
    ...WARDROBE[slot].map(k => ({ html:slot === 'cloth' ? thumb(k) : slot === 'shoes' ? SHOES[k].e : k, id:slot + ':' + k, cls:S.outfit[slot] === k ? 'on' : '', down:ev => { ev.preventDefault(); wear(slot, k); } }))]);
}
function markOutfit() { $$('.item', items).forEach(b => { const id = b.dataset.id || ''; const [slot, k] = id.split(':'); if (k && slot !== 'cat' && slot in S.outfit) b.classList.toggle('on', S.outfit[slot] === k); }); }
function wear(slot, e) {
  if (A.lock) return;
  S.outfit[slot] = S.outfit[slot] === e ? null : e; renderOutfit(); markOutfit(); save();
  const pos = { hat:[200,58], bow:[300,96], glasses:[200,200], neck:[200,326], cloth:[200,420], shoes:[200,505] }[slot], c = toC(...pos);
  if (S.outfit[slot]) { pop(); twinkle(); sparkles(c.x, c.y, 6, 60 * sc()); eyes('happy', 900); hop(14); addNeed('fun', 2); if (Math.random() < .4) setTimeout(() => say('pretty'), 350); else setTimeout(() => meow(1.2, .35, { shape:'mrrp' }), 200); }
  else whoosh();
}

/* ---------- DOCTOR ---------- */
function modeDoctor() {
  TOOLS.doc = { done:new Set(), beats:0, lastBeat:0 };
  A.sick = true; meow(.85, .7, { shape:'sad', gain:.24 }); setTimeout(cough, 900);
  TOOLS.coughT = setInterval(() => { if (A.sick && !A.lock) { Math.random() < .6 ? cough() : sneeze(); } }, 4200);
  setTray([
    { e:'🌡️', id:'thermo', down:ev => startDrag(ev, '🌡️', { size:90, drop:(x, y, g, tap) => docMouth('thermo', x, y, g, tap) }) },
    { e:'🩺', id:'steth', down:ev => startDrag(ev, '🩺', { size:90, move:stethMove, drop:(x, y, g) => vanish(g) }) },
    { e:'💊', id:'pill', down:ev => startDrag(ev, '💊', { size:80, move:(x, y) => { A.hold = nearMouth(x, y, 130) ? .7 : 0; }, drop:(x, y, g, tap) => docMouth('pill', x, y, g, tap) }) },
    { e:'🩹', id:'band', down:ev => startDrag(ev, '🩹', { size:80, drop:bandDrop }) }
  ]);
}
function docMark(id) { const D = TOOLS.doc; D.done.add(id); itemEl(id)?.classList.add('done'); if (D.done.size === 4 && A.sick) setTimeout(recover, 600); }
async function docMouth(kind, x, y, g, tap) {
  if (!(tap || overCat(x, y) || nearMouth(x, y, 130))) { A.hold = 0; vanish(g); return; }
  lockOn(); const m = toC(MOUTH.x, MOUTH.y); A.hold = .5; await fly(g, m.x, m.y, 300); g.remove();
  if (kind === 'thermo') {
    R.item.textContent = '🌡️'; R.item.setAttribute('transform', 'translate(232 286) rotate(-50) scale(.8) translate(-200 -288)'); A.hold = .2;
    for (let i = 0; i < 3; i++) { tone({ f0:1800, dur:.06, type:'square', peak:.05 }); await wait(500); }
    R.item.textContent = ''; R.item.removeAttribute('transform'); A.hold = 0;
    const c = toC(330, 140); fx('38°', c.x, c.y, { cls:'word', size:54, dy:60, dur:2 }); fx('🔥', c.x + 40, c.y, { size:36, dy:80, dur:2 });
    A.red = .5; say('hot'); await wait(1300); docMark('thermo');
  } else {
    R.item.textContent = '💊'; R.item.setAttribute('transform', 'translate(200 288) scale(.6) translate(-200 -288)'); await wait(300);
    A.hold = 0; gulp(); R.item.textContent = ''; R.item.removeAttribute('transform');
    await wait(250); eyes('closed', 1200); A.wobUntil = now() + 900; yuckSfx(); await wait(800); say('yuck'); await wait(1100); docMark('pill');
  }
  lockOff();
}
function stethMove(x, y) {
  const D = TOOLS.doc, t = now(), p = partAt(x, y);
  if (p !== 'belly' && p !== 'body') return;
  if (t - D.lastBeat > 800) {
    D.lastBeat = t; heartbeat(); fx('❤️', x, y - 30, { cls:'pulse', size:50, dur:.9 });
    if (++D.beats >= 3 && !D.done.has('steth')) { docMark('steth'); setTimeout(() => meow(1.1, .4, { shape:'mrrp' }), 600); }
  }
}
function bandDrop(x, y, g, tap) {
  if (!overCat(x, y) || tap) { vanish(g); return; }
  g.remove(); const p = toS(x, y);
  S.bandages.push([Math.round(p.x), Math.round(p.y), Math.round(rnd(-30, 30))]); if (S.bandages.length > 6) S.bandages.shift();
  renderBandages(); save(); pop(); eyes('happy', 800); setTimeout(() => say('thanks'), 300); docMark('band');
}
async function recover() {
  lockOn(); A.sick = false; A.red = 0; clearInterval(TOOLS.coughT);
  const c = toC(200, 260); sparkles(c.x, c.y, 10, 140 * sc()); chime(); hearts(5); hop(32); eyes('happy', 1800);
  await wait(500); say('better'); await wait(1500); lockOff();
  if (mode === 'doctor') { $$('.item', items).forEach(b => b.classList.remove('done')); TOOLS.doc.done.clear(); TOOLS.doc.beats = 0; }
}

/* ============================================================
   PARENTS (hold the gear for 2 seconds)
   ============================================================ */
const pBtn = $('#parentBtn'), panel = $('#parent');
let holdT = null, holdStart = 0;
pBtn.addEventListener('pointerdown', e => {
  e.preventDefault(); holdStart = now();
  holdT = setInterval(() => { const p = (now() - holdStart) / 2000; pBtn.style.setProperty('--h', Math.min(100, p * 100)); if (p >= 1) { stopHold(); openPanel(); } }, 30);
});
const stopHold = () => { clearInterval(holdT); holdT = null; pBtn.style.setProperty('--h', 0); };
pBtn.addEventListener('pointerup', stopHold); pBtn.addEventListener('pointerleave', stopHold); pBtn.addEventListener('pointercancel', stopHold);
function openPanel() {
  panel.classList.remove('hidden');
  $('#optMic').checked = S.settings.mic;
  $('#optPitch').value = S.settings.pitch; $('#optVol').value = S.settings.vol;
}
$('#optMic').addEventListener('change', e => { S.settings.mic = e.target.checked; save(); });
$('#optPitch').addEventListener('change', e => { S.settings.pitch = +e.target.value; save(); meow(S.settings.pitch / 1.6, .4); });
$('#optVol').addEventListener('input', e => { S.settings.vol = +e.target.value; if (master) master.gain.value = S.settings.vol; save(); });
let resetArm = 0;
$('#optReset').addEventListener('click', e => {
  if (now() - resetArm < 3000) { const st = S.settings; S = copy(DEF); S.settings = st; save(); renderAll(); e.target.textContent = 'Reset • إعادة ضبط'; resetArm = 0; chime(); }
  else { resetArm = now(); e.target.textContent = 'Tap again • اضغط مرة أخرى'; setTimeout(() => { e.target.textContent = 'Reset • إعادة ضبط'; }, 3000); }
});
$('#optClose').addEventListener('click', () => { panel.classList.add('hidden'); save(); });

/* ============================================================
   START / RESUME
   ============================================================ */
const startEl = $('#start');
async function begin(e) {
  e && e.preventDefault();
  initAudio();
  try { await AC.resume(); } catch (er) {}
  startEl.classList.add('hidden');
  const first = !started; started = true;
  await initMic();
  if (first) { await wait(300); A.waveUntil = now() + 1600; hop(20); eyes('happy', 1200); say('hi'); }
}
$('#playBtn').addEventListener('click', begin);
startEl.addEventListener('click', e => { if (e.target === startEl) begin(e); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { save(); stopPurr(); recording = false; A.listening = false; }
  else if (started && AC) { AC.resume().then(() => { if (AC.state !== 'running') startEl.classList.remove('hidden'); }).catch(() => startEl.classList.remove('hidden'));
    if (micStream && !micStream.getAudioTracks().some(t => t.readyState === 'live')) startEl.classList.remove('hidden'); }
});
document.addEventListener('touchend', () => { if (AC && AC.state !== 'running') AC.resume(); }, { passive:true });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

function renderAll() { renderNeeds(); renderOutfit(); renderBandages(); }
renderAll();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && !started) { reloaded = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache:'none' }).then(r => r.update()).catch(() => {}));
}
})();
