import os
import psycopg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://app:app@localhost:5432/app")

app = FastAPI(title="KubeLab API")
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


class ProductIn(BaseModel):
    nombre: str
    cantidad: int


def db():
    return psycopg.connect(DATABASE_URL)


@app.get("/health")
def health():
    try:
        with db() as c:
            c.execute("SELECT 1")
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="db unavailable")


@app.get("/products")
def list_products():
    with db() as c:
        rows = c.execute("SELECT id, nombre, cantidad FROM products ORDER BY id").fetchall()
    return [{"id": r[0], "nombre": r[1], "cantidad": r[2]} for r in rows]


@app.post("/products", status_code=201)
def create_product(p: ProductIn):
    with db() as c:
        row = c.execute(
            "INSERT INTO products (nombre, cantidad) VALUES (%s, %s) RETURNING id",
            (p.nombre, p.cantidad),
        ).fetchone()
    return {"id": row[0], **p.model_dump()}


@app.put("/products/{pid}")
def update_product(pid: int, p: ProductIn):
    with db() as c:
        cur = c.execute(
            "UPDATE products SET nombre=%s, cantidad=%s WHERE id=%s",
            (p.nombre, p.cantidad, pid),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "not found")
    return {"id": pid, **p.model_dump()}


@app.delete("/products/{pid}", status_code=204)
def delete_product(pid: int):
    with db() as c:
        cur = c.execute("DELETE FROM products WHERE id=%s", (pid,))
        if cur.rowcount == 0:
            raise HTTPException(404, "not found")
