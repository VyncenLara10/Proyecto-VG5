# API de productos

## Ejecutar en local
1. Base de datos:
   `docker run -d --name pg -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app -p 5432:5432 -v $(pwd)/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro postgres:16`
2. `python3 -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. `uvicorn main:app --reload`

## Variables de entorno
| Variable | Uso | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (en el clúster la entrega Doppler) | base local de desarrollo |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma | `http://localhost:5173,http://127.0.0.1:5173` |

## Endpoints
| Método | Ruta | Respuesta |
|---|---|---|
| GET | /health | 200 `{"status":"ok"}` o 503 si la base no responde |
| GET | /metrics | Métricas para Prometheus |
| GET | /products | 200, lista de `{id, nombre, cantidad}` |
| POST | /products | 201 con el producto creado |
| PUT | /products/{id} | 200 con el producto, o 404 |
| DELETE | /products/{id} | 204, o 404 |

Validaciones: `nombre` de 1 a 100 caracteres (sin espacios en los extremos) y `cantidad` entera entre 0 y 1.000.000. Si no se cumplen, la API responde 422.

Documentación interactiva: http://localhost:8000/docs

## Pruebas
`pytest`
