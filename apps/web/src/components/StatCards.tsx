import type { Product } from "../types/product";

export const LOW_STOCK = 5;

export default function StatCards({ products }: { products: Product[] }) {
  const units = products.reduce((sum, p) => sum + p.cantidad, 0);
  const low = products.filter((p) => p.cantidad > 0 && p.cantidad <= LOW_STOCK).length;
  const out = products.filter((p) => p.cantidad === 0).length;

  const items = [
    { label: "Productos", value: products.length, hint: "registrados", tone: "" },
    { label: "Unidades", value: units, hint: "en inventario", tone: "" },
    { label: "Stock bajo", value: low, hint: `${LOW_STOCK} o menos`, tone: low ? "warn" : "" },
    { label: "Agotados", value: out, hint: "sin existencias", tone: out ? "bad" : "" },
  ];

  return (
    <div className="stats">
      {items.map((s) => (
        <div key={s.label} className={`stat ${s.tone ? `stat--${s.tone}` : ""}`}>
          <p className="stat__value">{s.value}</p>
          <p className="stat__label">{s.label}</p>
          <p className="stat__hint">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}
