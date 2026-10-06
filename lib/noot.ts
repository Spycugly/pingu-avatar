let ctx: AudioContext | null = null;

/** Two short brassy honks, synthesized: "noot noot". */
export function noot() {
  try {
    ctx ??= new AudioContext();
    const ac = ctx;
    const now = ac.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = ac.createOscillator();
      const filter = ac.createBiquadFilter();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(415, now + offset);
      osc.frequency.linearRampToValueAtTime(440, now + offset + 0.05);
      filter.type = "lowpass";
      filter.frequency.value = 1300;
      filter.Q.value = 6;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.14, now + offset + 0.02);
      gain.gain.setValueAtTime(0.14, now + offset + 0.12);
      gain.gain.linearRampToValueAtTime(0, now + offset + 0.17);
      osc.connect(filter).connect(gain).connect(ac.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch {
    // Audio not available: Pingu stays silent.
  }
}
