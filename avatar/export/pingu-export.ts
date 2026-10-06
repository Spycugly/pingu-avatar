/**
 * Turns a live Pingu <svg> into a standalone file. The avatar paints with CSS variables
 * (--pingu-body, --pingu-eye…), which mean nothing outside the page, so they are resolved
 * to the values the browser computed before serialising.
 */
export function standalone(svg: SVGSVGElement, size: number) {
  const computed = getComputedStyle(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  return new XMLSerializer()
    .serializeToString(clone)
    .replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name: string, fallback?: string) => {
      return computed.getPropertyValue(name).trim() || fallback?.trim() || "currentColor";
    });
}

export function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function toPng(svg: SVGSVGElement, size: number, background: string | null) {
  const markup = standalone(svg, size);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ExportOptions = { size?: number; background?: string | null };

export async function downloadPng(svg: SVGSVGElement, filename: string, { size = 1024, background = null }: ExportOptions = {}) {
  save(await toPng(svg, size, background), `${filename}.png`);
}

export function downloadSvg(svg: SVGSVGElement, filename: string, size = 1024) {
  save(new Blob([standalone(svg, size)], { type: "image/svg+xml" }), `${filename}.svg`);
}

export async function copyPng(svg: SVGSVGElement, { size = 1024, background = null }: ExportOptions = {}) {
  const blob = await toPng(svg, size, background);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function copySvg(svg: SVGSVGElement, size = 1024) {
  await navigator.clipboard.writeText(standalone(svg, size));
}
