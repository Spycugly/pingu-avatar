import { audio } from "./sound";

/** Two short brassy honks, synthesized: "noot noot". */
export function noot() {
  const ac = audio();
  if (!ac) return;
  if (ac.state === "running") return honk(ac);
  // Not unlocked yet. During a click it unlocks within a few milliseconds: honk then. Without a
  // gesture the resume settles late or never, and a late honk would be out of place.
  const asked = performance.now();
  ac.resume()
    .then(() => {
      if (performance.now() - asked < 300) honk(ac);
    })
    .catch(() => {});
}

function honk(ac: AudioContext) {
  try {
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
