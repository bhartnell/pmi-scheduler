'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Eraser } from 'lucide-react';

/**
 * Lightweight signature pad — draw with mouse/touch/stylus, emits a PNG data URL.
 * Used by the AHA instructor-credentials page. No deps; pointer events + canvas.
 */
export default function SignaturePad({
  onChange,
  width = 500,
  height = 160,
}: {
  onChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  // Sizes the backing store to width/height * devicePixelRatio (so strokes
  // stay crisp on retina/high-dpr displays) and (re)applies the line style.
  // Setting canvas.width/height — even to a value equal to itself — resets
  // the ENTIRE bitmap and 2D context state (transform, styles, everything)
  // per the HTML canvas spec. That's used deliberately in clear() below: it's
  // the only way to guarantee a full wipe regardless of the current transform,
  // rather than relying on clearRect() dimensions matching the backing store.
  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    }
  }, [width, height]);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current!.toDataURL('image/png'));
  };
  const clear = useCallback(() => {
    if (!canvasRef.current) return;
    // setupCanvas() reassigns canvas.width, which per the HTML canvas spec
    // wipes the ENTIRE backing-store bitmap and resets the 2D context's
    // transform to identity — unconditionally correct, unlike the previous
    // clearRect()-based approach, which only cleared whatever region its
    // coordinates covered and left part of the signature behind whenever
    // the transform and backing-store size were out of sync (hi-dpr
    // displays). It also re-applies the dpr scale + line style in the same
    // pass, since the reset wipes those too.
    setupCanvas();
    dirty.current = false;
    onChange(null);
  }, [onChange, setupCanvas]);

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        style={{ width, height, touchAction: 'none' }}
        className="border border-gray-300 dark:border-gray-600 rounded-md bg-white cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
      <div className="mt-1">
        <button type="button" onClick={clear}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400">
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
