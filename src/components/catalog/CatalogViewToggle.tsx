import { LayoutGrid, List } from "lucide-react";

export type CatalogView = "grid" | "list";

export function CatalogViewToggle({
  value,
  onChange,
}: {
  value: CatalogView;
  onChange: (view: CatalogView) => void;
}) {
  return (
    <div className="flex items-center gap-2" aria-label="Modo de visualização dos produtos">
      <span className="text-xs font-bold text-primary-foreground">Visualização</span>
      <div className="flex rounded-lg bg-ink p-1 text-ink-foreground shadow-sm">
        <button
          type="button"
          aria-label="Ver produtos em grade"
          aria-pressed={value === "grid"}
          title="Grade"
          onClick={() => onChange("grid")}
          className={`flex size-8 items-center justify-center rounded-md transition-colors ${value === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-ink-foreground/10"}`}
        >
          <LayoutGrid className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Ver produtos em lista"
          aria-pressed={value === "list"}
          title="Lista"
          onClick={() => onChange("list")}
          className={`flex size-8 items-center justify-center rounded-md transition-colors ${value === "list" ? "bg-primary text-primary-foreground" : "hover:bg-ink-foreground/10"}`}
        >
          <List className="size-4" />
        </button>
      </div>
    </div>
  );
}
