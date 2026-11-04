# Integración frontend ↔ API

## 1. Arquitectura de comunicación

```text
                        MISMO ORIGEN (producción / Docker)
Navegador ──► Nginx (contenedor web, puerto 80) ──► http://192.168.50.114:8000
             /products /health /metrics                API FastAPI de Rocío
             (resto de rutas → index.html de React)

                        DESARROLLO (npm run dev)
Navegador (localhost:5173) ──► VITE_API_URL ──► http://192.168.50.114:8000
             (llamada directa; requiere CORS — ver §5)
```

- **En Docker/producción** el frontend llama a rutas relativas (`/products`…) sobre su mismo origen; Nginx hace de proxy inverso hacia la API. **No aplica CORS.**
- **En desarrollo** el navegador llama directo a la API usando `VITE_API_URL`; ahí sí importa el CORS de la API.

## 2. Dirección actual

| Parámetro | Valor | Dónde se configura |
|---|---|---|
| API | `http://192.168.50.114:8000` | `VITE_API_URL` (dev) y `API_UPSTREAM` (Docker/K8s) |

Verificado en esta sesión: la API responde en esa dirección (`/health` → 200). Es la misma que usa el contenedor en ejecución. Al llegar los dominios definitivos, solo hay que cambiar esas variables.

## 3. Endpoints consumidos

Contrato inspeccionado desde `http://192.168.50.114:8000/openapi.json` (título: *KubeLab API 0.1.0*):

| Método | Ruta | Uso en el frontend | Éxito |
|---|---|---|---|
| `GET` | `/products` | Listado | `200` + array de productos |
| `POST` | `/products` | Alta | `201` + producto creado |
| `PUT` | `/products/{id}` | Edición | `200` + producto actualizado |
| `DELETE` | `/products/{id}` | Borrado | `204` sin cuerpo |
| `GET` | `/health` | Panel de estado (cada 5 s) | `200` `{"status":"ok"}`; `503` = API sin BD |
| `GET` | `/metrics` | Enlace "Ver métricas" / Prometheus | `200` texto Prometheus |

Esquema de entrada `ProductIn`: `nombre` (string, 1–100), `cantidad` (entero, 0–1000000). Errores de validación → `422` con `detail` en formato pydantic (el frontend los traduce a mensajes por campo).

## 4. Configuración de Nginx (proxy inverso)

Archivo: `apps/web/nginx/default.conf.template` (lo procesa la imagen oficial de Nginx con `envsubst` al arrancar).

```nginx
location ~ ^/(products|health|metrics) {
    proxy_pass ${API_UPSTREAM};
    ...
}
location / { try_files $uri /index.html; }
```

Puntos clave:

- `proxy_pass` **sin URI al final**: Nginx reenvía la ruta original completa (`/products/34` → `http://…:8000/products/34`). **No se pierden ni se alteran prefijos.**
- `${API_UPSTREAM}` se sustituye en el arrancar por la variable de entorno del contenedor (por defecto `http://api:8000` para uso en Kubernetes; en local se pasa `http://192.168.50.114:8000`).
- Cualquier otra ruta cae en `location /` y sirve la SPA de React (`index.html`).

## 5. Procedimiento para probar la conexión

**a) API directa:**

```bash
curl -s http://192.168.50.114:8000/health
curl -s http://192.168.50.114:8000/products
```

**b) A través del frontend (contenedor, mismo origen):**

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/products
```

**c) CORS en desarrollo** (solo si se usa llamada directa con `VITE_API_URL`):

```bash
curl -s -i -X OPTIONS http://192.168.50.114:8000/products \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' | head -12
# Esperado: 200 y access-control-allow-origin: http://localhost:5173
```

## 6. Ejemplos de solicitudes HTTP (verificadas)

Ejecutadas contra el proxy de Nginx en `localhost:8080`, con la API en `192.168.50.114:8000`:

```bash
# Listar → 200
curl -s http://localhost:8080/products
# [{"id":1,"nombre":"Laptop","cantidad":10},{"id":2,"nombre":"Producto Persistente","cantidad":25}]

# Crear → 201
curl -s -X POST http://localhost:8080/products -H 'Content-Type: application/json' \
  -d '{"nombre":"Producto Verificacion","cantidad":5}'
# {"id":34,"nombre":"Producto Verificacion","cantidad":5}

# Editar → 200
curl -s -X PUT http://localhost:8080/products/34 -H 'Content-Type: application/json' \
  -d '{"nombre":"Producto Editado","cantidad":7}
# {"id":34,"nombre":"Producto Editado","cantidad":7}

# Eliminar → 204
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/products/34
# 204

# Datos inválidos → 422 (pydantic)
curl -s -X POST http://localhost:8080/products -H 'Content-Type: application/json' \
  -d '{"nombre":"","cantidad":-1}'
# {"detail":[{"type":"string_too_short",...},{"type":"greater_than_equal",...}]}
```

Resultado de la prueba: los 5 flujos respondieron como espera el frontend (el `id` 34 creado fue eliminado; los datos originales quedaron intactos).

## 7. Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "No se pudo conectar con la API…" en la UI | API caída o URL mal puesta | `curl http://192.168.50.114:8000/health`; revisar `VITE_API_URL` / `API_UPSTREAM` |
| Error de CORS solo en dev | Origen no permitido (p. ej. abrir por IP en vez de `localhost:5173`) | Usar `http://localhost:5173`, que es el origen que la API permite |
| `404` en el navegador pero `curl` va bien | El bundle se construyó con una `VITE_API_URL` equivocada | Reconstruir con el valor correcto o vacío (producción) |
| `503` en el panel de estado | API viva pero PostgreSQL no responde | Revisar la BD (componente de Rocío); el frontend lo muestra como `db_down` |
| El proxy devuelve el HTML de React en vez de JSON | Ruta no cubierta por el `location` de Nginx | Comprobar que la ruta empiece por `/products`, `/health` o `/metrics` |
| Contenedor contesta `502/504` | `API_UPSTREAM` apunta a un destino inaccesible desde el contenedor | Verificar la IP/puerto con `docker exec kubelab-web …` o cambiar la variable |

## 8. Estado de verificación

| Comprobación | Resultado |
|---|---|
| Contrato de la API vs. tipos del frontend | ✅ Coinciden (`id`, `nombre`, `cantidad`; límites 1–100 y 0–1e6) |
| GET/POST/PUT/DELETE/validación por HTTP | ✅ Verificados (códigos en §6) |
| Proxy Nginx conserva rutas | ✅ `/products`, `/health`, `/metrics` responden vía `localhost:8080` |
| Preflight CORS para `localhost:5173` | ✅ `200` con `access-control-allow-origin` |
| Flujo completo en navegador | ⚃ Pendiente (capturas) |

## 9. Capturas pendientes

**[CAPTURA PENDIENTE: `frontend-conexion-api.png`]**

Descripción: Panel de estado del frontend en verde ("Todo el sistema está operativo") y, junto a él, la pestaña Network del navegador (F12) mostrando `GET /products` con estado `200` y origen `localhost:8080` (mismo origen, sin errores de CORS).
Ubicación: `docs/evidencias/frontend-conexion-api.png`
Procedimiento: abrir `http://localhost:8080`, F12 → pestaña Network, recargar la página y capturar ambas cosas a la vez.
