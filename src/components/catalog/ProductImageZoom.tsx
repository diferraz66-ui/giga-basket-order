import { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampProductZoom, MAX_PRODUCT_ZOOM, MIN_PRODUCT_ZOOM, toggleProductZoom } from "@/lib/product-zoom";

export function ProductImageZoom({ src, name }: { src: string; name: string }) {
  const transform = useRef<ReactZoomPanPinchRef>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);

  function changeScale(next: number) {
    const controls = transform.current;
    if (!controls) return;
    const target = clampProductZoom(next);
    if (target === 1) controls.resetTransform(0);
    else controls.centerView(target, 0);
  }

  function tap() {
    if (moved.current) { moved.current = false; return; }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      changeScale(toggleProductZoom(scaleRef.current));
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        changeScale(toggleProductZoom(scaleRef.current));
      }, 260);
    }
  }

  return <div>
    <TransformWrapper ref={transform} minScale={MIN_PRODUCT_ZOOM} maxScale={MAX_PRODUCT_ZOOM}
      initialScale={1} centerOnInit doubleClick={{ disabled: true }} wheel={{ step: 0.1 }}
      panning={{ disabled: scale <= 1 }} velocityAnimation={{ disabled: true }}
      onTransform={(_, state) => { scaleRef.current = state.scale; setScale(state.scale); }}
      onPanning={() => { moved.current = true; }}
      onPinchStart={() => { moved.current = true; if (tapTimer.current) clearTimeout(tapTimer.current); tapTimer.current = null; }}>
      <div className={`h-48 overflow-hidden rounded-2xl border border-border bg-card sm:h-64 ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        style={{ touchAction: "none" }} onClick={tap}
        onMouseDownCapture={() => { moved.current = false; }}
        onTouchStartCapture={(event) => { if (event.touches.length === 1) moved.current = false; }}>
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%", touchAction: "none" }} contentStyle={{ width: "100%", height: "100%" }}>
          <img src={src} alt={name} draggable={false} className="h-full w-full select-none object-contain p-2" />
        </TransformComponent>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2" aria-label="Controles de zoom">
        <Button variant="outline" size="icon" aria-label="Diminuir zoom" disabled={scale <= 1} onClick={() => changeScale(scale - 0.5)}><Minus /></Button>
        <Button variant="ghost" className="min-w-24 text-xs font-bold" aria-label="Restaurar zoom para 100%" onClick={() => changeScale(1)}>{Math.round(scale * 100)}%</Button>
        <Button variant="outline" size="icon" aria-label="Aumentar zoom" disabled={scale >= 3} onClick={() => changeScale(scale + 0.5)}><Plus /></Button>
      </div>
    </TransformWrapper>
  </div>;
}