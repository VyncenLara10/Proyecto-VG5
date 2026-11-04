import { useEffect, useState, type FormEvent } from "react";
import type { FieldErrors } from "../services/api";
import type { Product, ProductInput } from "../types/product";

const MAX_NAME = 100;
const MAX_QTY = 1_000_000;

interface Props {
  editing: Product | null;
  /** true si se guardó; si no, los errores por campo que devolvió la API */
  onSubmit: (input: ProductInput) => Promise<true | FieldErrors>;
  onCancel: () => void;
}

export default function ProductForm({ editing, onSubmit, onCancel }: Props) {
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(editing?.nombre ?? "");
    setCantidad(editing ? String(editing.cantidad) : "");
    setErrors({});
  }, [editing]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    const name = nombre.trim();
    const qty = Number(cantidad);

    if (!name) next.nombre = "Escribe el nombre del producto.";
    else if (name.length > MAX_NAME) next.nombre = `El nombre admite máximo ${MAX_NAME} caracteres.`;
    if (cantidad.trim() === "" || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY)
      next.cantidad = "Ingresa un número entero entre 0 y 1.000.000.";

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const result = await onSubmit({ nombre: name, cantidad: qty });
      if (result === true) {
        if (!editing) {
          setNombre("");
          setCantidad("");
        }
      } else {
        setErrors(result); // no borramos lo escrito si la API rechazó los datos
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? `Editar producto #${editing.id}` : "Nuevo producto"}</h2>

      <label className="field">
        <span>Nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Teclado mecánico"
          maxLength={MAX_NAME}
          aria-invalid={!!errors.nombre}
          autoComplete="off"
        />
        {errors.nombre && <small className="field__error">{errors.nombre}</small>}
      </label>

      <label className="field">
        <span>Cantidad</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_QTY}
          step={1}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="0"
          aria-invalid={!!errors.cantidad}
        />
        {errors.cantidad && <small className="field__error">{errors.cantidad}</small>}
      </label>

      <div className="form__actions">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar producto"}
        </button>
        {editing && (
          <button className="btn btn--ghost" type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
