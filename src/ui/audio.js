// Every sound is synthesised with WebAudio: cannon thumps, laser zaps, missile hiss, explosions
// from filtered noise, pickup chimes, a boss klaxon and a driving march for the menu and battle.

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let muted = false;
let musicLevel = 0.3;
const last = new Map();

export function unlock() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ac.destination);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.7;
  sfxBus.connect(master);
  musicBus = ac.createGain();
  musicBus.gain.value = musicLevel;
  musicBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.02);
}
export function setMusicLevel(v) {
  musicLevel = v;
  if (musicBus) musicBus.gain.setTargetAtTime(v, ac.currentTime, 0.05);
}

function throttle(key, ms) {
  const now = performance.now();
  if (now - (last.get(key) ?? 0) < ms) return false;
  last.set(key, now);
  return true;
}

function tone(freq, dur, { type = "square", vol = 0.2, slide = 0, delay = 0, bus = sfxBus, attack = 0.005 } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.3, freq = 1200, q = 0.8, type = "lowpass", slide = 0.3, delay = 0, bus = sfxBus } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t0, Math.random() * 0.4);
  src.stop(t0 + dur + 0.05);
}

const SFX = {
  fire() { if (throttle("fire", 60)) { tone(140, 0.09, { type: "square", vol: 0.08, slide: 0.4 }); noise(0.06, { vol: 0.12, freq: 2400, slide: 0.3 }); } },
  laser() { tone(1400, 0.18, { type: "sawtooth", vol: 0.07, slide: 0.25 }); },
  flak() { noise(0.25, { vol: 0.22, freq: 1800, slide: 0.2 }); },
  missile() { if (throttle("missile", 120)) noise(0.35, { vol: 0.1, freq: 3000, type: "bandpass", q: 2, slide: 0.4 }); },
  boom(size = 1) {
    if (!throttle("boom", 45)) return;
    noise(0.5 * size + 0.2, { vol: 0.35 * Math.min(1.4, size), freq: 900, slide: 0.08 });
    tone(80, 0.4 * size, { type: "sine", vol: 0.3, slide: 0.4 });
  },
  pop() { if (throttle("pop", 40)) { tone(600, 0.08, { type: "triangle", vol: 0.12, slide: 0.5 }); noise(0.1, { vol: 0.1, freq: 3000 }); } },
  spark() { if (throttle("spark", 50)) noise(0.03, { vol: 0.05, freq: 5000, type: "highpass" }); },
  hurt() { if (throttle("hurt", 90)) { tone(220, 0.2, { type: "sawtooth", vol: 0.18, slide: 0.5 }); noise(0.15, { vol: 0.2, freq: 1500 }); } },
  shield() { tone(900, 0.25, { type: "sine", vol: 0.15, slide: 1.8 }); tone(1350, 0.25, { type: "sine", vol: 0.08, slide: 1.6, delay: 0.03 }); },
  pickup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { type: "triangle", vol: 0.14, delay: i * 0.06 })); },
  crate() { tone(392, 0.1, { type: "triangle", vol: 0.1 }); tone(523, 0.12, { type: "triangle", vol: 0.1, delay: 0.08 }); },
  squash() { noise(0.12, { vol: 0.2, freq: 500 }); tone(90, 0.12, { type: "square", vol: 0.12, slide: 0.5 }); },
  rifle() { if (throttle("rifle", 80)) noise(0.04, { vol: 0.06, freq: 3500, type: "highpass" }); },
  tankDie() { noise(1.4, { vol: 0.5, freq: 700, slide: 0.05 }); tone(60, 1.2, { type: "sine", vol: 0.4, slide: 0.3 }); },
  nuke() {
    noise(2.6, { vol: 0.6, freq: 1200, slide: 0.02 });
    tone(45, 2.4, { type: "sine", vol: 0.5, slide: 0.5 });
    tone(1800, 0.6, { type: "sine", vol: 0.1, slide: 0.1 });
  },
  alarm() { for (let i = 0; i < 3; i++) { tone(440, 0.28, { type: "sawtooth", vol: 0.12, delay: i * 0.6 }); tone(330, 0.28, { type: "sawtooth", vol: 0.12, delay: i * 0.6 + 0.3 }); } },
  partDie() { noise(0.7, { vol: 0.4, freq: 1100, slide: 0.08 }); tone(120, 0.5, { type: "square", vol: 0.15, slide: 0.3 }); },
  bossDead() { for (let i = 0; i < 6; i++) noise(0.8, { vol: 0.4, freq: 900, slide: 0.06, delay: i * 0.18 }); tone(55, 2, { type: "sine", vol: 0.45, slide: 0.4 }); },
  fanfare() { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: "square", vol: 0.08, delay: i * 0.12 })); },
  supply() { tone(880, 0.08, { type: "sine", vol: 0.08 }); tone(1175, 0.1, { type: "sine", vol: 0.08, delay: 0.1 }); },
  click() { tone(660, 0.05, { type: "triangle", vol: 0.1 }); },
  hover() { tone(990, 0.03, { type: "sine", vol: 0.04 }); },
};

export function sfx(name, ...args) {
  if (!ac || muted) return;
  SFX[name]?.(...args);
}

export function playEvents(events) {
  if (!ac || muted) return;
  for (const e of events) {
    switch (e.type) {
      case "fire": SFX.fire(); break;
      case "laser": SFX.laser(); break;
      case "flak": SFX.flak(); break;
      case "missile-fire": SFX.missile(); break;
      case "kill": SFX.boom(e.big ? 1.5 : 0.8); break;
      case "blast": case "ground-hit": SFX.boom(0.7); break;
      case "pop": SFX.pop(); break;
      case "spark": SFX.spark(); break;
      case "hurt": SFX.hurt(); break;
      case "shield-hit": SFX.shield(); break;
      case "pickup": SFX.pickup(); break;
      case "crate-drop": SFX.crate(); break;
      case "troop-die": if (e.how === "squash") SFX.squash(); break;
      case "rifle": SFX.rifle(); break;
      case "tank-die": SFX.tankDie(); break;
      case "nuke": SFX.nuke(); break;
      case "boss-start": SFX.alarm(); break;
      case "part-die": SFX.partDie(); break;
      case "boss-boom": SFX.boom(1.2); break;
      case "boss-dead": SFX.bossDead(); break;
      case "supply-in": SFX.supply(); break;
      case "upgrade": case "win": SFX.fanfare(); break;
    }
  }
}

// ---------------------------------------------------------------- music: a simple march loop

const BASS = [55, 55, 82.4, 55, 73.4, 55, 82.4, 98];
const LEAD = [440, 0, 523, 494, 440, 0, 392, 440, 0, 330, 392, 440, 523, 494, 440, 0];
let musicT = 0;
let beat = 0;
let intensity = 0;

/** Call every frame. mode: "menu" | "battle" | "boss" | "off" */
export function tickMusic(dt, mode = "menu") {
  if (!ac || muted || musicLevel <= 0 || mode === "off") return;
  const bpm = mode === "boss" ? 150 : mode === "battle" ? 132 : 104;
  const stepDur = 60 / bpm / 2;
  intensity = mode === "menu" ? 0.6 : 1;
  musicT -= dt;
  while (musicT <= 0) {
    musicT += stepDur;
    const b = beat++;
    const bass = BASS[(b >> 1) % BASS.length] * (mode === "boss" && (b >> 4) % 2 ? 1.0595 : 1);
    if (b % 2 === 0) tone(bass, stepDur * 1.6, { type: "sawtooth", vol: 0.09 * intensity, bus: musicBus });
    if (b % 4 === 0) { noise(0.12, { vol: 0.16 * intensity, freq: 160, slide: 0.5, bus: musicBus }); }
    if (b % 4 === 2) noise(0.08, { vol: 0.07 * intensity, freq: 4000, type: "highpass", slide: 0.6, bus: musicBus });
    if (mode !== "menu" || b % 32 >= 16) {
      const n = LEAD[b % LEAD.length];
      if (n) tone(n * (mode === "boss" ? 0.5 : 1), stepDur * 0.9, { type: "square", vol: 0.025, bus: musicBus });
    }
    if (b % 1 === 0 && mode !== "menu") noise(0.03, { vol: 0.025, freq: 7000, type: "highpass", bus: musicBus });
  }
}
