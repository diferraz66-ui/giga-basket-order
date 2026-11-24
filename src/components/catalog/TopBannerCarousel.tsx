import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listTopBanners } from "@/lib/banners.functions";

type Banner = { name: string; url: string };

export function TopBannerCarousel() {
  const listFn = useServerFn(listTopBanners);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const pointer = useRef<number | null>(null);
  const startX = useRef(0);
  useEffect(() => { let alive = true; void listFn().then(rows => { if (alive) setBanners(rows); }).catch(() => undefined); return () => { alive = false; }; }, [listFn]);
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % banners.length), 4000);
    return () => window.clearInterval(timer);
  }, [banners.length]);
  if (!banners.length) return null;
  function finishSwipe(endX: number) {
    const delta = endX - startX.current;
    if (Math.abs(delta) > 45) setIndex(value => delta < 0 ? (value + 1) % banners.length : (value - 1 + banners.length) % banners.length);
    pointer.current = null;
  }
  return <section aria-label="Banners da GIGA Shopping" className="px-3 pt-4 sm:px-5">
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-soft" style={{ touchAction: "pan-y" }} onPointerDown={event=>{pointer.current=event.pointerId;startX.current=event.clientX;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>{if(pointer.current===event.pointerId)finishSwipe(event.clientX);}} onPointerCancel={()=>{pointer.current=null;}}>
      <div className="flex transition-transform duration-500 ease-out" style={{transform:`translateX(-${index*100}%)`}}>
        {banners.map((banner,i)=><div key={banner.name} className="w-full shrink-0"><img src={banner.url} alt={`Banner promocional ${i+1}`} loading={i===0 ? "eager" : "lazy"} fetchPriority={i===0 ? "high" : "auto"} className="aspect-[3/1] w-full object-contain" /></div>)}
      </div>
    </div>
    {banners.length>1 && <div className="mt-2 flex justify-center gap-2">{banners.map((banner,i)=><button key={banner.name} type="button" aria-label={`Ir para banner ${i+1}`} aria-current={index===i} onClick={()=>setIndex(i)} className={`h-2 rounded-full transition-all ${index===i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40"}`} />)}</div>}
  </section>;
}
