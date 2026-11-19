"use client";
// FaceValue's sound identity, synthesized with Web Audio (no files to load):
//   ding  - a soft, bright two-note chime: valid ticket, ticket bought, checked in.
//   thunk - a short, dull low knock: refused resale above face, rejected gate code.
// Browsers only allow sound after the user has interacted with the page; before that these are silent.
// The choice to mute is kept per device in localStorage ("fv:sound" = "off").

let ctx: AudioContext | null = null;
const KEY = "fv:sound";

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(a: AudioContext, freq: number, start: number, dur: number, peak: number, type: OscillatorType = "sine", endFreq?: number) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(a.destination);
  o.start(start); o.stop(start + dur + 0.02);
}

export function ding() {
  const a = audio(); if (!a) return;
  const t = a.currentTime + 0.01;
  tone(a, 1318.5, t, 0.5, 0.16);        // E6
  tone(a, 1975.5, t + 0.09, 0.7, 0.12); // B6, a fifth up: reads as "yes"
  tone(a, 3951, t + 0.09, 0.25, 0.02);  // a touch of shimmer
}

export function thunk() {
  const a = audio(); if (!a) return;
  const t = a.currentTime + 0.01;
  tone(a, 150, t, 0.22, 0.4, "sine", 55);        // falling low knock
  tone(a, 95, t, 0.14, 0.18, "triangle", 60);    // body
  // A tiny burst of filtered noise for the "wooden" attack.
  const n = a.createBuffer(1, Math.floor(a.sampleRate * 0.04), a.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = n; f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.25;
  src.connect(f).connect(g).connect(a.destination); src.start(t);
}
