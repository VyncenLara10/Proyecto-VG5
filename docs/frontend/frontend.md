# Frontend — Aplicación web KubeLab

## 1. Tecnologías

| Componente | Tecnología | Versión (package.json) |
|---|---|---|
| Framework | React | ^19.3.1 |
| Lenguaje | TypeScript | ~5.9.3 |
| Bundler / dev server | Vite | ^8.3.5 |
| Gestor de paquetes | npm (con `package-lock.json`) | — |
| Linting | ESLint + typescript-eslint + eslint-plugin-react-hooks | ver `eslint.config.js` |
| Estilos | CSS puro (`src/index.css`, `src/App.css`) | sin frameworks |

No se utilizan librerías de UI, de estado global ni de peticiones HTTP: la comunicación con la API se hace con `fetch` nativo.

## 2. Estructura general

```text
apps/web/
├── Dockerfile                  # Build de producción (ver docs/docker/docker-frontend.md)
├── nginx/default.conf.template # Proxy inverso hacia la API
├── index.html
├── vite.config.ts
├── package.json
└── src/
    ├── main.tsx                # Punto de entrada
    ├── App.tsx                 # Composición: panel de estado, stats, formulario y tabla
    ├── types/product.ts        # Tipos: Product, ProductInput, HealthState
    ├── services/api.ts         # Toda la comunicación HTTP con la API
    ├── hooks/
    │   ├── useProducts.ts      # Listado + operaciones CRUD
    │   └── useHealth.ts        # Sondeo de /health cada 5 s
    └── components/
        ├── ProductForm.tsx     # Alta y edición de productos
        ├── ProductTable.tsx    # Listado, confirmación de borrado, reintentos
        ├── StatCards.tsx       # Tarjetas de resumen del inventario
        ├── StatusPanel.tsx     # Estado API/PostgreSQL y enlace a /metrics
        └── Toast.tsx           # Avisos de éxito/error (4 s)
```

Separación de responsabilidades: `services/api.ts` concentra el HTTP (sin JSX), `hooks/` gestiona estado, los componentes solo presentan.

## 3. Instalación de dependencias

```bash
cd apps/web
npm ci
```

`npm ci` instala exactamente las versiones de `package-lock.json`.

## 4. Ejecución en desarrollo

```bash
cd apps/web
VITE_API_URL=http://192.168.50.114:8000 npm run dev
```

- Vite levanta el servidor en `http://localhost:5173`.
- `VITE_API_URL` es la **única** variable de entorno del frontend en desarrollo (se inyecta en el bundle en tiempo de build).
- Sin definir, el código usa el fallback `http://localhost:8000`, que en este entorno **no tiene API** → hay que definirla siempre (ver §6).

**Restricción de CORS de la API (verificada):** la API solo acepta los orígenes `http://localhost:5173` y `http://127.0.0.1:5173`. Por eso en desarrollo hay que abrir la aplicación en `localhost:5173` (no en la IP de la máquina, eso daría error de CORS).

> Estado: preflight CORS `OPTIONS /products` con origen `localhost:5173` verificado → `200` con `access-control-allow-origin`. El flujo completo desde el navegador en dev está **pendiente de verificación visual** (captura).

## 5. Construcción para producción

```bash
cd apps/web
npm run build
```

Ejecuta `tsc -b` (type-check) y `vite build` → genera `dist/` (HTML + JS + CSS). **Verificado: build correcto (0 errores).**

El `dist/` se sirve con Nginx dentro del contenedor (etapa 2 del Dockerfile). En producción el frontend usa rutas **relativas** (`/products`, `/health`, `/metrics`), es decir, llama a su mismo origen y Nginx reenvía a la API (ver `docs/integracion-api/integracion-api.md`).

## 6. Variables de entorno

| Variable | Momento | Uso | Valor actual |
|---|---|---|---|
| `VITE_API_URL` | build (`npm run dev` / `npm run build`) | URL base de la API vista desde el navegador. Vacío = mismo origen (producción/Docker) | `http://192.168.50.114:8000` en dev; `""` en el Dockerfile |
| `API_UPSTREAM` | runtime del contenedor | Destino del proxy de Nginx (no afecta al bundle) | `http://192.168.50.114:8000` (ver docker-frontend.md) |

Migración futura a dominios: cambiar estas dos variables; no hace falta tocar código.

## 7. Funcionamiento del CRUD

Contrato real de la API (inspeccionado en `/openapi.json`): producto = `{ id: number, nombre: string, cantidad: number }`; entrada = `{ nombre: string (1–100), cantidad: integer (0–1000000) }`.

| Operación | Flujo en la interfaz | HTTP |
|---|---|---|
| Listar | Carga inicial de `useProducts` → tabla; estado "Cargando…", vacío o aviso de error con botón "Reintentar" | `GET /products` |
| Crear | Formulario "Nuevo producto" → validación local → "Agregar producto" → toast de éxito y fila nueva | `POST /products` |
| Editar | Botón "Editar" → el formulario se rellena y cambia a "Editar producto #id" → "Guardar cambios" → toast | `PUT /products/{id}` |
| Eliminar | Botón "Eliminar" → confirmación inline ("Sí, eliminar" / "No") → toast | `DELETE /products/{id}` |

Comportamiento de errores y estados:

- **Validación local** antes de enviar: nombre obligatorio y ≤ 100 caracteres; cantidad entero entre 0 y 1.000.000.
- **Errores 422 de la API** (pydantic): se traducen y se muestran junto al campo (`translate()` en `services/api.ts`).
- **Error de red** (API caída): aviso "No se pudo conectar con la API…" + botón "Reintentar"; el panel de estado pasa a `api_down`.
- **503 en /health**: la API responde pero PostgreSQL no → estado `db_down`.
- **Estados de carga**: listado inicial, "Guardando…" en el formulario, "Eliminando…" por fila.
- El panel de estado vuelve a intentar la carga sola cuando `/health` recupera el `200`.
- Los borrados `404` se aceptan (el producto ya no existe) y se quita de la lista.

## 8. Estado de verificación

| Comprobación | Resultado |
|---|---|
| `npm run build` | ✅ Correcto (verificado) |
| CRUD por HTTP contra la API (vía proxy) | ✅ 200/201/200/204/422 (verificado, ver integracion-api) |
| `npm run lint` | ⚠️ Falla con 2 errores **previos** en el código original: `react-hooks/set-state-in-effect` en `ProductForm.tsx:22` y `useProducts.ts:26` (pendiente de corregir en una rama dedicada) |
| UI CRUD en navegador (capturas) | ⚃ Pendiente (tus capturas) |

## 9. Capturas pendientes

**[CAPTURA PENDIENTE: `frontend-listado-productos.png`]**

Descripción: Vista del frontend mostrando el listado de productos obtenido correctamente desde la API (tabla con ID, nombre, cantidad y estado).
Ubicación: `docs/evidencias/frontend-listado-productos.png`
Procedimiento: levantar el contenedor (ver docker-frontend.md), abrir `http://localhost:8080` y esperar a que la tabla cargue.

**[CAPTURA PENDIENTE: `frontend-crear-producto.png`]**

Descripción: Formulario "Nuevo producto" con nombre y cantidad rellenados y el toast de éxito "Producto … agregado" visible.
Ubicación: `docs/evidencias/frontend-crear-producto.png`
Procedimiento: en `http://localhost:8080`, rellenar el formulario, pulsar "Agregar producto" y capturar junto con el aviso.

**[CAPTURA PENDIENTE: `frontend-editar-producto.png`]**

Descripción: Formulario en modo "Editar producto #id" con los datos cargados, junto a la fila correspondiente resaltada en la tabla.
Ubicación: `docs/evidencias/frontend-editar-producto.png`
Procedimiento: pulsar "Editar" en cualquier fila de la tabla y capturar el formulario ya relleno.

**[CAPTURA PENDIENTE: `frontend-eliminar-producto.png`]**

Descripción: Confirmación inline de borrado en una fila ("Sí, eliminar" / "No") antes de confirmar.
Ubicación: `docs/evidencias/frontend-eliminar-producto.png`
Procedimiento: pulsar "Eliminar" en una fila y capturar sin llegar a confirmar.
