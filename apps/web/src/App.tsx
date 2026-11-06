import { useCallback, useEffect, useState } from "react";
import ProductForm from "./components/ProductForm";
import ProductTable from "./components/ProductTable";
import StatCards from "./components/StatCards";
import StatusPanel from "./components/StatusPanel";
import Toast, { type ToastData } from "./components/Toast";
import { useHealth } from "./hooks/useHealth";
import { errorMessage, useProducts } from "./hooks/useProducts";
import { ApiError, type FieldErrors } from "./services/api";
import type { Product, ProductInput } from "./types/product";

export default function App() {
  const { state: health, lastCheck } = useHealth();
  const { products, loading, error, reload, create, update, remove } = useProducts();
  const [editing, setEditing] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Si la API vuelve a estar disponible y la lista había fallado, recargamos sola
  useEffect(() => {
    if (health === "ok" && error) reload();
  }, [health, error, reload]);

  const handleSubmit = async (input: ProductInput): Promise<true | FieldErrors> => {
    try {
      if (editing) {
        await update(editing.id, input);
        setToast({ kind: "ok", message: `Producto #${editing.id} actualizado.` });
        setEditing(null);
      } else {
        const created = await create(input);
        setToast({ kind: "ok", message: `Producto "${created.nombre}" agregado.` });
      }
      return true;
    } catch (e) {
      // 422: mostramos el error junto al campo; otros errores van en un aviso
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) return e.fieldErrors;
      setToast({ kind: "error", message: errorMessage(e) });
      return {};
    }
  };

  const handleDelete = async (p: Product) => {
    try {
      await remove(p.id);
      if (editing?.id === p.id) setEditing(null);
      setToast({ kind: "ok", message: `Producto "${p.nombre}" eliminado.` });
    } catch (e) {
      setToast({ kind: "error", message: errorMessage(e) });
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1>KubeLab</h1>
            <p>Inventario de productos</p>
          </div>
        </div>
      </header>

      <main className="layout">
        <StatusPanel state={health} lastCheck={lastCheck} />
        <StatCards products={products} />

        <div className="workspace">
          <ProductForm editing={editing} onSubmit={handleSubmit} onCancel={() => setEditing(null)} />
          <ProductTable
            products={products}
            loading={loading}
            error={error}
            editingId={editing?.id ?? null}
            onEdit={setEditing}
            onDelete={handleDelete}
            onRetry={reload}
          />
        </div>
      </main>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
