import { useState } from "react";
import type { Product } from "../types/product";
import { LOW_STOCK } from "./StatCards";

interface Props {
  products: Product[];
  loading: boolean;
  error: string | null;
  editingId: number | null;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => Promise<void>;
  onRetry: () => void;
}

function stockBadge(qty: number) {
  if (qty === 0) return { cls: "badge--bad", text: "Agotado" };
  if (qty <= LOW_STOCK) return { cls: "badge--warn", text: "Stock bajo" };
  return { cls: "badge--ok", text: "Disponible" };
}

export default function ProductTable({
  products,
  loading,
  error,
  editingId,
  onEdit,
  onDelete,
  onRetry,
}: Props) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const doDelete = async (p: Product) => {
    setBusyId(p.id);
    try {
      await onDelete(p);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <section className="card table-card">
      <div className="table-card__head">
        <h2>Inventario</h2>
        <button className="btn btn--ghost btn--sm" onClick={onRetry} disabled={loading}>
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="notice notice--bad" role="alert">
          <p>{error}</p>
          <button className="btn btn--ghost btn--sm" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}

      {!error && !loading && products.length === 0 && (
        <div className="empty">
          <p className="empty__title">Aún no hay productos</p>
          <p>Agrega el primero con el formulario y aparecerá aquí.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th className="num">Cantidad</th>
                <th>Estado</th>
                <th className="actions-col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const badge = stockBadge(p.cantidad);
                return (
                  <tr key={p.id} className={editingId === p.id ? "row--editing" : ""}>
                    <td className="muted">#{p.id}</td>
                    <td className="strong">{p.nombre}</td>
                    <td className="num strong">{p.cantidad}</td>
                    <td>
                      <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    </td>
                    <td className="actions-col">
                      {confirmId === p.id ? (
                        <span className="confirm">
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => doDelete(p)}
                            disabled={busyId === p.id}
                          >
                            {busyId === p.id ? "Eliminando…" : "Sí, eliminar"}
                          </button>
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => setConfirmId(null)}
                            disabled={busyId === p.id}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <>
                          <button className="btn btn--ghost btn--sm" onClick={() => onEdit(p)}>
                            Editar
                          </button>
                          <button
                            className="btn btn--ghost btn--sm btn--bad"
                            onClick={() => setConfirmId(p.id)}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
