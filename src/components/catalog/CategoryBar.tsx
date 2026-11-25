import { useState } from "react";
import { categories, type CategoryId } from "@/data/catalog";

export function CategoryBar({
  active,
  onChange,
}: {
  active: CategoryId | null;
  onChange: (id: CategoryId | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleCategories = expanded ? categories : categories.slice(0, 4);

  return (
    <nav aria-label="Categorias" className="relative z-40 border-b border-[#D4AF37]/25 bg-[#111827]">
      <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5 lg:flex-wrap lg:overflow-visible">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold uppercase transition-colors ${
            active === null ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
          }`}
        >
          Todos
        </button>
        {visibleCategories.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active === c.id ? null : c.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
              active === c.id ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
            }`}
          >
            <span className="font-display opacity-70">{String(i + 1).padStart(2, "0")}</span>
            {c.label}
          </button>
        ))}
        {categories.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="shrink-0 rounded-full border border-[#D4AF37]/60 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            {expanded ? "Ver menos" : "+ Ver mais categorias"}
          </button>
        )}
      </div>
    </nav>
  );
}
