/**
 * Preloader sound. OFF by default; toggled by the corner button.
 * Ambience: the user's own track (extracted from rnb wip_2.mp4 - it is the
 * soundtrack of the vibe reference video, envelope correlation 0.84).
 * Accents are synthesized via Web Audio for exact timing: symbol clicks,
 * a soft noise puff per sketch, one low tone on completion.
 * State lives in module scope - session memory, not localStorage.
 */
import { reducedMotion } from './motionPref';

const prm = reducedMotion();

let enabled = false;
let ctx: AudioContext | null = null;
let loopSrc: AudioBufferSourceNode | null = null;
let loopGain: GainNode | null = null;
let loopBuf: AudioBuffer | null = null;
let lastClick = 0;

async function ensureCtx() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

async function startLoop() {
  const ac = await ensureCtx();
  if (!loopBuf) {
    try {
      const res = await fetch('/audio/loop.mp3');
      loopBuf = await ac.decodeAudioData(await res.arrayBuffer());
    } catch { return; }
  }
  if (loopSrc || !enabled) return;
  loopSrc = ac.createBufferSource();
  loopSrc.buffer = loopBuf;
  loopSrc.loop = true;
  loopGain = ac.createGain();
  loopGain.gain.value = 0;
  loopGain.gain.linearRampToValueAtTime(0.09, ac.currentTime + 1.2);
  loopSrc.connect(loopGain).connect(ac.destination);
  loopSrc.start();
}

function stopLoopNow() {
  if (loopSrc && ctx && loopGain) {
    loopGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    const s = loopSrc;
    setTimeout(() => { try { s.stop(); } catch {} }, 350);
    loopSrc = null;
  }
}

function syncButton() {
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
}

export const sound = {
  get enabled() { return enabled; },

  async toggle(): Promise<boolean> {
    if (prm) return false;
    enabled = !enabled;
    if (enabled) await startLoop();
    else stopLoopNow();
    syncButton();
    return enabled;
  },

  /**
   * Turn sound on. Only meaningful when called from inside a user gesture -
   * browsers keep the audio context suspended until one happens, which is
   * exactly why the preloader opens with an invitation to press something.
   */
  async enable() {
  if (prm) return;
  enabled = true;
  await startLoop();
  syncButton();
},

  /** tiny typewriter click on symbol locks, throttled */
  click() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - lastClick < 0.05) return;
    lastClick = now;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800 + Math.random() * 1600;
    g.gain.setValueAtTime(0.03, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  },

  /** soft pencil-ish noise when a sketch appears */
  sketch() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.025;
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now);
  },

  /** one low tone when loading completes */
  complete() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 110;
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  },

  stopLoop: stopLoopNow,
};

// corner toggle
document.getElementById('sound-toggle')?.addEventListener('click', () => sound.toggle());
