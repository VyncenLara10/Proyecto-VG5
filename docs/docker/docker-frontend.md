# Docker — Frontend KubeLab

## 1. Explicación del Dockerfile

Archivo: `apps/web/Dockerfile` (build en dos etapas).

**Etapa 1 — `build` (node:22-alpine):**

```dockerfile
COPY package*.json ./
RUN npm ci              # dependencias exactas del lockfile
COPY . .
ARG VITE_API_URL=""     # por defecto vacío → el bundle usa rutas relativas (mismo origen)
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build       # tsc -b && vite build → /app/dist
```

**Etapa 2 — runtime (nginx:1.27-alpine):**

```dockerfile
ENV API_UPSTREAM=http://api:8000        # destino del proxy (se cambia al ejecutar)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

Detalles importantes:

- **`ARG VITE_API_URL=""` en build ≠ configuración de runtime.** La URL que ve el navegador queda fijada al compilar; por eso se deja **vacía** y el bundle llama a su mismo origen. Lo que se ajusta en cada despliegue es `API_UPSTREAM` (runtime), que Nginx sustituye en la plantilla al arrancar (`envsubst` de la imagen oficial de Nginx). Así no se "cocinan" IPs dentro del bundle.
- `proxy_pass ${API_UPSTREAM};` sin URI → se reenvía la ruta original completa (ver `docs/integracion-api/integracion-api.md` §4).
- `.dockerignore` excluye `node_modules`, `dist`, `.env*`, `.git` → el contexto de build queda limpio y el build es reproducible.

## 2. Construcción de la imagen

```bash
cd apps/web
docker build -t kubelab-web:dev .
```

Contexto de build: el directorio `apps/web/` (ahí está el `.dockerignore`).

## 3. Ejecución del contenedor

```bash
docker rm -f kubelab-web 2>/dev/null
docker run -d --name kubelab-web \
  -p 8080:80 \
  -e API_UPSTREAM=http://192.168.50.114:8000 \
  kubelab-web:dev
```

| Parámetro | Valor | Significado |
|---|---|---|
| `-p 8080:80` | host 8080 → contenedor 80 | La app queda en `http://localhost:8080` |
| `-e API_UPSTREAM=…` | `http://192.168.50.114:8000` | Destino real del proxy (IP de la API de Rocío) |

Estado verificado en esta sesión: contenedor en ejecución `kubelab-web:dev` con ese `API_UPSTREAM` y puerto `0.0.0.0:8080->80/tcp`.

## 4. Verificación del funcionamiento

```bash
# Contenedor arriba
docker ps --filter name=kubelab-web

# Salud a través del proxy (mismo origen que usa el navegador)
curl -s http://localhost:8080/health
# → {"status":"ok"}

# Listado
curl -s http://localhost:8080/products
# → [{"id":1,"nombre":"Laptop","cantidad":10}, …]

# Métricas de la API (las consume Prometheus)
curl -s http://localhost:8080/metrics | head -5
```

Prueba CRUD completa por el proxy (verificada: 201/200/204):

```bash
curl -s -X POST http://localhost:8080/products -H 'Content-Type: application/json' \
  -d '{"nombre":"Prueba docker","cantidad":3}'          # → 201
curl -s -X PUT http://localhost:8080/products/<id> -H 'Content-Type: application/json' \
  -d '{"nombre":"Prueba docker 2","cantidad":4}'        # → 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -X DELETE http://localhost:8080/products/<id>         # → 204
```

Logs del proxy:

```bash
docker logs kubelab-web --tail 20
```

## 5. Reproducción desde cero

```bash
cd apps/web
npm ci && npm run build          # comprobación local opcional
docker build -t kubelab-web:dev .
docker run -d --name kubelab-web -p 8080:80 \
  -e API_UPSTREAM=http://192.168.50.114:8000 kubelab-web:dev
# Abrir http://localhost:8080
```

Requisitos: Docker en ejecución y la API accesible desde la máquina (`curl http://192.168.50.114:8000/health`).

## 6. Compatibilidad con Kubernetes

- El contenedor expone el **puerto 80**; en el Deployment del clúster el `containerPort` debe ser `80` y el Service lo fronta con `targetPort: 80`.
- `API_UPSTREAM` se inyecta como variable de entorno en el Deployment (allí apuntará al Service de la API en el clúster o a la IP externa, según el despliegue).
- Los probes del Deployment deben apuntar a `/` (Nginx), **no** a `/health`, para que el pod no se reinicie si la API o la BD caen.
- Los manifiestos del web están en `k8s/apps/web/` (namespace `kubelab-dev`); el despliegue y la verificación en K3s se documentan en `docs/k8s/web.md`.

## 7. Estado de verificación

| Comprobación | Resultado |
|---|---|
| `docker build` de la imagen | ✅ Verificado (imagen `kubelab-web:dev` existente) |
| Contenedor en ejecución + `API_UPSTREAM` | ✅ Verificado |
| `/health`, `/products`, `/metrics` por el proxy | ✅ `200` verificados |
| CRUD por HTTP a través de Nginx | ✅ `201/200/204` verificados |
| UI en navegador + capturas | ⚃ Pendiente |

## 8. Capturas pendientes

**[CAPTURA PENDIENTE: `docker-frontend-build.png`]**

Descripción: Terminal mostrando el final del `docker build -t kubelab-web:dev .` sin errores (etapas de npm ci y vite build completadas).
Ubicación: `docs/evidencias/docker-frontend-build.png`
Procedimiento: ejecutar el build del §2 desde una terminal limpia y capturar la salida final.

**[CAPTURA PENDIENTE: `docker-frontend-running.png`]**

Descripción: Terminal con `docker ps` mostrando el contenedor `kubelab-web` `Up` con puerto `0.0.0.0:8080->80/tcp`, junto a la salida de `curl http://localhost:8080/health` (`{"status":"ok"}`).
Ubicación: `docs/evidencias/docker-frontend-running.png`
Procedimiento: ejecutar los comandos del §4 en una sola terminal y capturar.
