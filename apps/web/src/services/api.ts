import type { HealthState, Product, ProductInput } from "../types/product";

export const API_URL = (
  import.meta.env.VITE_API_URL ?? ""
).replace(/\/$/, "");

export type FieldErrors = { nombre?: string; cantidad?: string };

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldErrors;
  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ValidationItem {
  type?: string;
  loc?: (string | number)[];
  msg: string;
}

// Traduce los errores 422 de FastAPI/pydantic a mensajes para el formulario
function translate(d: ValidationItem): string {
  switch (d.type) {
    case "greater_than_equal":
      return "La cantidad no puede ser negativa.";
    case "less_than_equal":
      return "La cantidad máxima es 1.000.000.";
    case "string_too_short":
      return "Escribe el nombre del producto.";
    case "string_too_long":
      return "El nombre admite máximo 100 caracteres.";
    case "int_parsing":
    case "int_type":
    case "int_from_float":
      return "La cantidad debe ser un número entero.";
    case "missing":
      return "Este campo es obligatorio.";
    default:
      return d.msg;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  // Solo enviamos Content-Type cuando hay body (evita preflights innecesarios en GET/DELETE)
  if (init.body) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      "No se pudo conectar con la API. Verifica que el backend esté activo y que CORS esté habilitado.",
    );
  }

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    const fieldErrors: FieldErrors = {};
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        for (const d of body.detail as ValidationItem[]) {
          const field = d.loc?.[d.loc.length - 1];
          if (field === "nombre" || field === "cantidad") fieldErrors[field] = translate(d);
        }
        detail = Object.values(fieldErrors).join(" ") || "Los datos enviados no son válidos.";
      }
    } catch {
      /* el cuerpo no era JSON */
    }
    throw new ApiError(res.status, detail, fieldErrors);
  }

  // 204 No Content: no hay nada que parsear
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listProducts(): Promise<Product[]> {
  const data = await request<Product[] | { products: Product[] }>("/products");
  return Array.isArray(data) ? data : (data.products ?? []);
}

export const createProduct = (input: ProductInput) =>
  request<Product>("/products", { method: "POST", body: JSON.stringify(input) });

export const updateProduct = (id: number, input: ProductInput) =>
  request<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const deleteProduct = (id: number) =>
  request<void>(`/products/${id}`, { method: "DELETE" });

export async function getHealth(): Promise<HealthState> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return "ok";
    if (res.status === 503) return "db_down";
    return "api_down";
  } catch {
    return "api_down";
  }
}

export const METRICS_URL = `${API_URL}/metrics`;
