import { useEffect, useRef, useState } from "react";

// アバター用の画像トリミング（枠固定・画像をドラッグ/ピンチで位置合わせ）。
// 依存ライブラリなし。出力は OUT×OUT の正方形 PNG Blob。
const FRAME = 260; // 画面上のトリミング枠(px)
const OUT = 256; // 出力サイズ(px)
const MAX_ZOOM = 4;

export default function AvatarCropper({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // ジェスチャ状態（再レンダ不要なので ref）
  const g = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    startDist: 0,
    startZoom: 1,
  });

  // 画像読み込み
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const img = new Image();
    img.onload = () => {
      imgElRef.current = img;
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const baseScale = dims ? Math.max(FRAME / dims.w, FRAME / dims.h) : 1;
  const scale = baseScale * zoom;
  const dispW = dims ? dims.w * scale : 0;
  const dispH = dims ? dims.h * scale : 0;

  function clampOffset(o: { x: number; y: number }, z: number) {
    if (!dims) return o;
    const s = baseScale * z;
    const dw = dims.w * s;
    const dh = dims.h * s;
    const maxX = Math.max(0, (dw - FRAME) / 2);
    const maxY = Math.max(0, (dh - FRAME) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  }

  function setZoomClamped(z: number) {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(nz);
    setOffset((o) => clampOffset(o, nz));
  }

  // タッチ操作（native addEventListener。iOS の合成イベント取りこぼし回避＋preventDefault）
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        g.current.mode = "pan";
        g.current.startX = e.touches[0].clientX;
        g.current.startY = e.touches[0].clientY;
        g.current.baseX = offset.x;
        g.current.baseY = offset.y;
      } else if (e.touches.length === 2) {
        g.current.mode = "pinch";
        g.current.startDist = dist(e.touches);
        g.current.startZoom = zoom;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (g.current.mode === "none") return;
      e.preventDefault();
      if (g.current.mode === "pan" && e.touches.length === 1) {
        const dx = e.touches[0].clientX - g.current.startX;
        const dy = e.touches[0].clientY - g.current.startY;
        setOffset(
          clampOffset({ x: g.current.baseX + dx, y: g.current.baseY + dy }, zoom),
        );
      } else if (g.current.mode === "pinch" && e.touches.length === 2) {
        const ratio = dist(e.touches) / (g.current.startDist || 1);
        setZoomClamped(g.current.startZoom * ratio);
      }
    };
    const onEnd = () => {
      g.current.mode = "none";
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // offset/zoom を閉じ込むため依存に含める
  }, [offset, zoom, dims]);

  // マウス操作（PC確認用のドラッグ）
  function onMouseDown(e: React.MouseEvent) {
    const sx = e.clientX;
    const sy = e.clientY;
    const bx = offset.x;
    const by = offset.y;
    const move = (ev: MouseEvent) => {
      setOffset(
        clampOffset({ x: bx + (ev.clientX - sx), y: by + (ev.clientY - sy) }, zoom),
      );
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const imageLeft = (FRAME - dispW) / 2 + offset.x;
  const imageTop = (FRAME - dispH) / 2 + offset.y;

  async function confirm() {
    const img = imgElRef.current;
    if (!img || !dims) return;
    setBusy(true);
    try {
      const cropX = -imageLeft / scale;
      const cropY = -imageTop / scale;
      const cropSize = FRAME / scale;
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas not supported");
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        OUT,
        OUT,
      );
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("変換に失敗しました"))),
          "image/png",
        ),
      );
      onCropped(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-4">
      <p className="mb-3 text-[14px] text-white">
        ドラッグ／ピンチで位置と大きさを調整
      </p>
      <div
        ref={frameRef}
        onMouseDown={onMouseDown}
        className="relative overflow-hidden rounded-full bg-slate-800"
        style={{ width: FRAME, height: FRAME, touchAction: "none" }}
      >
        {url && dims && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="absolute select-none"
            style={{
              width: dispW,
              height: dispH,
              left: imageLeft,
              top: imageTop,
              maxWidth: "none",
            }}
          />
        )}
        {/* 円形ガイド枠 */}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
      </div>

      {/* ズームスライダー */}
      <input
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(e) => setZoomClamped(Number(e.target.value))}
        className="mt-5 w-full max-w-[260px]"
        aria-label="ズーム"
      />

      <div className="mt-5 flex w-full max-w-[260px] gap-2">
        <button
          onClick={confirm}
          disabled={busy || !dims}
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
        >
          {busy ? "処理中…" : "決定"}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/40 px-4 py-2.5 text-[16px] font-medium text-white"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
