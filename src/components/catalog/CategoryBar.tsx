import { categories, type CategoryId } from "@/data/catalog";

export function CategoryBar({
  active,
  onChange,
}: {
  active: CategoryId | null;
  onChange: (id: CategoryId | null) => void;
}) {
  return (
    <nav aria-label="Categorias" className="sticky top-0 z-40 bg-ink">
      <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 py-2.5 sm:px-5 lg:flex-wrap lg:overflow-visible">
        <button
          onClick={() => onChange(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase transition-colors ${
            active === null ? "bg-primary text-primary-foreground" : "bg-ink-foreground/10 text-ink-foreground"
          }`}
        >
          Todos
        </button>
        {categories.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onChange(active === c.id ? null : c.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              active === c.id ? "bg-primary text-primary-foreground" : "bg-ink-foreground/10 text-ink-foreground"
            }`}
          >
            <span className="font-display opacity-70">{String(i + 1).padStart(2, "0")}</span>
            {c.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
