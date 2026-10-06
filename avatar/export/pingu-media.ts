import { standalone } from "./pingu-export";

/*
 * Animated exports. The engine runs on the real clock, so animations are recorded live:
 * every tick the avatar's <svg> is serialised (cheap), and the frames are rasterised and
 * encoded afterwards (GIF via gifenc, MP4/WebM via mediabunny, animated SVG via SMIL).
 */

export type Progress = (done: number, total: number) => void;

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Serialise the live avatar `fps` times a second for `ms` milliseconds. */
export function recordFrames(
  getSvg: () => SVGSVGElement | null,
  ms: number,
  fps: number,
  onProgress?: Progress,
  size = 512,
): Promise<string[]> {
  return new Promise((resolve) => {
    const frames: string[] = [];
    const total = Math.max(1, Math.round((ms / 1000) * fps));
    const start = performance.now();
    const grab = () => {
      const svg = getSvg();
      if (svg) frames.push(standalone(svg, size));
      onProgress?.(frames.length, total);
      if (frames.length >= total) return resolve(frames);
      // Keep to the wall clock so frames stay evenly spaced even if one grab runs late.
      const next = start + (frames.length * 1000) / fps;
      setTimeout(grab, Math.max(0, next - performance.now()));
    };
    grab();
  });
}

async function rasteriser(size: number, background: string | null) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const draw = async (markup: string) => {
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      ctx.clearRect(0, 0, size, size);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.drawImage(img, 0, 0, size, size);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  return { canvas, ctx, draw };
}

export async function framesToGif(
  frames: string[],
  { size = 480, fps = 15, background = null as string | null, onProgress }: { size?: number; fps?: number; background?: string | null; onProgress?: Progress } = {},
) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const { ctx, draw } = await rasteriser(size, background);
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (let i = 0; i < frames.length; i++) {
    await draw(frames[i]);
    const { data } = ctx.getImageData(0, 0, size, size);
    if (background) {
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), size, size, { palette, delay });
    } else {
      const palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true });
      const index = applyPalette(data, palette, "rgba4444");
      const transparentIndex = palette.findIndex((c) => c[3] === 0);
      gif.writeFrame(index, size, size, {
        palette,
        delay,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
        dispose: 2,
      });
    }
    onProgress?.(i + 1, frames.length);
    if (i % 4 === 0) await tick();
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
}

/** H.264 MP4 when the browser can encode it, VP9 WebM otherwise. */
export async function framesToVideo(
  frames: string[],
  { size = 720, fps = 24, background = "#ffffff", onProgress }: { size?: number; fps?: number; background?: string; onProgress?: Progress } = {},
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const mb = await import("mediabunny");
  const mp4 = await mb.canEncodeVideo("avc", { width: size, height: size });
  const { canvas, draw } = await rasteriser(size, background);
  const output = new mb.Output({
    format: mp4 ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat(),
    target: new mb.BufferTarget(),
  });
  const source = new mb.CanvasSource(canvas, { codec: mp4 ? "avc" : "vp9", quality: mb.QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  for (let i = 0; i < frames.length; i++) {
    await draw(frames[i]);
    await source.add(i / fps, 1 / fps);
    onProgress?.(i + 1, frames.length);
  }
  await output.finalize();
  const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer!;
  return { blob: new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }), ext: mp4 ? "mp4" : "webm" };
}

/** Flip-book SVG: every frame is a group shown for 1/fps of a looping timeline (SMIL). */
export function framesToAnimatedSvg(frames: string[], fps = 15) {
  const n = frames.length;
  const dur = (n / fps).toFixed(3);
  const head = /<svg[^>]*>/.exec(frames[0])?.[0] ?? '<svg xmlns="http://www.w3.org/2000/svg">';
  const groups = frames.map((markup, i) => {
    let inner = markup.slice(markup.indexOf(">") + 1, markup.lastIndexOf("</svg>"));
    // Every frame repeats the same ids (clip paths): suffix them so frames don't clash.
    const ids = new Set(Array.from(inner.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
    ids.forEach((id) => {
      inner = inner.split(`id="${id}"`).join(`id="${id}-f${i}"`).split(`url(#${id})`).join(`url(#${id}-f${i})`);
    });
    const a = (i / n).toFixed(5);
    const b = ((i + 1) / n).toFixed(5);
    const [values, keyTimes] =
      n === 1
        ? ["inline", "0"]
        : i === 0
          ? ["inline;none", `0;${b}`]
          : i === n - 1
            ? ["none;inline", `0;${a}`]
            : ["none;inline;none", `0;${a};${b}`];
    return `<g display="${i === 0 ? "inline" : "none"}"><animate attributeName="display" values="${values}" keyTimes="${keyTimes}" dur="${dur}s" calcMode="discrete" repeatCount="indefinite"/>${inner}</g>`;
  });
  return `${head}${groups.join("")}</svg>`;
}
