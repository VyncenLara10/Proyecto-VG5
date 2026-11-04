import { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import type { Product, ProductInput } from "../types/product";

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error inesperado.";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await api.listProducts());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: ProductInput) => {
    const created = await api.createProduct(input);
    setProducts((prev) => [...prev, created]);
    return created;
  };

  const update = async (id: number, input: ProductInput) => {
    const updated = await api.updateProduct(id, input);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const remove = async (id: number) => {
    try {
      await api.deleteProduct(id);
    } catch (e) {
      // 404: ya no existe en el servidor; lo quitamos de la lista y avisamos
      if (e instanceof api.ApiError && e.status === 404) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
      throw e;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return { products, loading, error, reload: load, create, update, remove };
}
