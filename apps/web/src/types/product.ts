export interface Product {
  id: number;
  nombre: string;
  cantidad: number;
}

export interface ProductInput {
  nombre: string;
  cantidad: number;
}

/** checking: primera comprobación · ok: API y PostgreSQL bien
 *  db_down: la API responde 503 · api_down: no hay respuesta de la API */
export type HealthState = "checking" | "ok" | "db_down" | "api_down";
