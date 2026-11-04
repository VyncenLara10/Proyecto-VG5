# Frontend en Kubernetes — KubeLab

Despliegue del frontend (`kubelab-web`) en el clúster K3s, con imagen publicada en GHCR y conexión a la API de Rocío a través del proxy de Nginx.

## 1. Alcance

- Namespace propio: **`apps`**.
- La API sigue en **`http://192.168.50.114:8000`** (IP/puerto centralizados en un ConfigMap, no en el bundle). **Importante:** cuando Rocío despliegue su API en el clúster (namespace `apps`, Service `api` en el puerto 80), cambiar este valor a `http://api.apps.svc.cluster.local` y hacer `kubectl rollout restart deploy/kubelab-web -n apps`. **Nota:** nginx resuelve el nombre interno de `API_UPSTREAM` al arrancar el contenedor, por lo que el cambio solo se debe hacer una vez el Service `api` existe; de lo contrario nginx no inicia.
- El navegador llama a su **mismo origen** (`/products`, `/health`, `/metrics`); Nginx dentro del pod los reenvía a `API_UPSTREAM`.
- Exposición: **NodePort `30080`** para pruebas inmediatas e **Ingress (Traefik)** como mecanismo definitivo.
- Imagen publicada en **GitHub Container Registry**: `ghcr.io/vyncenlara10/proyecto-vg5/web:dev` (pública).

## 2. Archivos

| Archivo | Contenido |
|---|---|
| `k8s/apps/web/namespace.yaml` | Namespace `apps` |
| `k8s/apps/web/configmap.yaml` | `API_UPSTREAM=http://192.168.50.114:8000` |
| `k8s/apps/web/deployment.yaml` | 2 réplicas, imagen GHCR + `Always`, probes, resources |
| `k8s/apps/web/service.yaml` | `NodePort 30080 → 80` |
| `k8s/apps/web/ingress.yaml` | Ingress `traefik`, ruta `/` Prefix → `kubelab-web:80` |
| `.github/workflows/web-ghcr.yml` | Build y publicación automática de la imagen en GHCR |

## 3. Decisiones de configuración

- **Imagen `ghcr.io/vyncenlara10/proyecto-vg5/web:dev` + `imagePullPolicy: Always`**: el proyecto no tiene registry propio; la imagen se construye y publica en GHCR con GitHub Actions (§5). Como `:dev` es una etiqueta que se sobreescribe con cada build, `Always` garantiza que el nodo baje la versión más reciente en cada arranque de pod. El nombre va **en minúsculas** porque GHCR lo exige (el repositorio es `VyncenLara10/Proyecto-VG5`).
- **Probes sobre `GET /` (puerto 80), nunca `/health`**: el pod no debe reiniciarse si la API o la BD caen; la salud de la API es una señal separada.
- **Resources acotados** (los workers tienen ~830 MiB y 1 CPU): `requests: 25m/32Mi`, `limits: 200m/96Mi`.
- **`API_UPSTREAM` en ConfigMap**: la dirección de la API se cambia en un solo lugar, sin reconstruir la imagen. **Nota importante:** nginx resuelve el hostname de `API_UPSTREAM` al arrancar el contenedor (envsubst hornea la URL en `default.conf`), por lo que el valor debe ser una **dirección IP** o un nombre que ya resuelva en el clúster; apuntar a un Service que aún no existe hace que nginx falle al iniciar (`host not found in upstream`) y el pod quede en `CrashLoopBackOff` hasta que el Service exista.
- **2 réplicas** para tolerar la caída de un pod.

## 4. Despliegue

```bash
export KUBECONFIG=$HOME/.kube/kubelab-k3s/config   # generado desde el nodo (§7)

kubectl apply -f k8s/apps/web/namespace.yaml       # primero: el resto depende del namespace
kubectl apply -f k8s/apps/web/
kubectl get all,ingress -n apps
```

Validación previa sin aplicar:

```bash
kubectl apply --dry-run=server -f k8s/apps/web/
```

Actualización solo del Deployment (sin tocar el resto):

```bash
kubectl apply -f k8s/apps/web/deployment.yaml
kubectl rollout status deploy/kubelab-web -n apps --timeout=180s
```

## 5. Publicación de la imagen en GHCR

La imagen se construye y publica automáticamente con **GitHub Actions** (`.github/workflows/web-ghcr.yml`):

- **Disparador:** push a `feature/roger-web` que modifique `apps/web/**` (o ejecución manual con `workflow_dispatch`).
- **Contexto de build:** `apps/web/` con `apps/web/Dockerfile` (build de producción con Vite + Nginx).
- **Nombre de imagen:** `ghcr.io/<repo-en-minúsculas>/web` → `ghcr.io/vyncenlara10/proyecto-vg5/web` (GHCR rechaza mayúsculas; en el workflow se aplica `tr '[:upper:]' '[:lower:]'`).
- **Etiquetas:** `dev` (referencia estable) y `sha-<commit>` (trazabilidad).
- **Autenticación:** el `GITHUB_TOKEN` automático de Actions con permisos `contents: read` y `packages: write` — no se necesita PAT ni secretos en el repositorio.
- **Visibilidad:** el paquete se crea como privado; se cambia a **público** en GitHub → Packages → `proyecto-vg5/web` → *Package settings* → *Change visibility*. Si queda privado, los nodos no pueden descargarlo sin un `imagePullSecret` (no usado en este proyecto).

Verificación de que la imagen está publicada y es descargable sin credenciales:

```bash
docker manifest inspect ghcr.io/vyncenlara10/proyecto-vg5/web:dev
# → devuelve el manifiesto JSON (sin login)
```

Historial: antes de GHCR la imagen `kubelab-web:dev` se cargaba a mano en cada worker con `docker save` + `k3s ctr images import` por SSH; GHCR elimina ese procedimiento manual.

## 6. Verificación

```bash
export KUBECONFIG=$HOME/.kube/kubelab-k3s/config

# Pods corriendo y en qué nodos
kubectl get pods -n apps -o wide

# La API es alcanzable desde DENTRO del clúster (viaje real por red del pod)
kubectl exec deploy/kubelab-web -n apps -- wget -qO- http://192.168.50.114:8000/health
# → {"status":"ok"}   (cuando la API de Rocío esté arriba)

# Prueba por NodePort (desde cualquier máquina de la red)
curl -s http://192.168.50.11:30080/health
curl -s http://192.168.50.11:30080/products

# Prueba por Ingress (Traefik)
curl -sI http://192.168.50.240/
```

CRUD completo por el mismo origen que usa el navegador (201/200/204):

```bash
curl -s -X POST http://192.168.50.11:30080/products -H 'Content-Type: application/json' \
  -d '{"nombre":"Prueba k8s","cantidad":5}'                       # → 201
curl -s -X PUT http://192.168.50.11:30080/products/<id> -H 'Content-Type: application/json' \
  -d '{"nombre":"Prueba k8s 2","cantidad":6}'                     # → 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -X DELETE http://192.168.50.11:30080/products/<id>              # → 204
```

Tolerancia a fallos (el Deployment debe recrear el pod):

```bash
kubectl delete pod -l app=kubelab-web -n apps
kubectl get pods -n apps -w
```

## 7. kubeconfig del clúster

- Archivo: `~/.kube/kubelab-k3s/config` (fuera del repositorio, permisos `600`).
- Origen: `/etc/rancher/k3s/k3s.yaml` del nodo `kube-cp01` (`192.168.50.11`), con `server` cambiado de `https://127.0.0.1:6443` a `https://192.168.50.11:6443`.
- Los manifiestos de este directorio **no** incluyen credenciales.

## 8. Estado al cierre de la sesión

| Comprobación | Resultado |
|---|---|
| YAMLs validados (`--dry-run=server`) y aplicados | ✅ Verificado |
| Namespace `apps` + ConfigMap + Service + Ingress | ✅ Creados |
| Workflow `Web GHCR` en GitHub Actions | ✅ Success |
| Paquete `proyecto-vg5/web` en GHCR, visibilidad pública | ✅ Verificado (`docker manifest inspect` sin credenciales) |
| Deployment con imagen `ghcr.io/…/web:dev` + `Always` | ✅ Aplicado |
| Rollout + 2 pods `Running 1/1` (`kuberworker01`, `kuberworker02`) | ✅ Verificado |
| UI por NodePort `30080` e Ingress `192.168.50.240` | ✅ `index.html` + assets con HTTP 200 |
| `/health` y CRUD (API) | ⚂ Pendiente — **504: la API no está desplegada en este clúster** (no hay namespace `apps` ni Service `api`); el ConfigMap apunta a `http://192.168.50.114:8000` hasta que Rocío la despliegue |
| UI por dominio `app.grupo5.lab` | ⚂ Listo en Ingress + NodePort `30080`; requiere entrada en `/etc/hosts` (`192.168.50.240 app.grupo5.lab`) — ver `docs/hosts-web.txt` |
| Prueba de recreación de pod | ⚂ Pendiente |
| Capturas | ⚂ Pendiente (§10) |
| Doppler (Kubernetes Operator) | ⚂ Archivos preparados (`k8s/platform/doppler/doppler-secret.yaml` + `docs/plataforma/doppler.md`), operador no instalado |

## 9. Notas y pendientes

- **API no desplegada aún en este clúster:** no existe el namespace `apps` ni el Service `api` (`http://api.apps.svc.cluster.local` no resuelve hasta que Rocío la despliegue). Por eso el ConfigMap **sigue apuntando a `http://192.168.50.114:8000`** y el front devuelve 504 en `/health` y `/products`. Cuando Rocío aplique su manifiesto, cambiar el ConfigMap a `http://api.apps.svc.cluster.local` y hacer `kubectl rollout restart deploy/kubelab-web -n apps`.
- **Dominio `app.grupo5.lab`:** ya está agregado como regla de host al Ingress (junto a la regla sin host, que mantiene el acceso por IP `192.168.50.240`). Como el archivo de zonas general aún no existe, se resuelve vía `/etc/hosts` en cada máquina que quiera navegar por ese nombre — ver `docs/hosts-web.txt` (`192.168.50.240 app.grupo5.lab`).
- **CORS:** no aplica en el despliegue de K8s (el navegador habla con el mismo origen y Nginx hace el proxy de forma servidor-a-servidor); solo es relevante en desarrollo local con Vite (`localhost:5173`).
- **Workers sin carga manual de imagen:** desde GHCR cualquier nodo puede bajar la imagen; ya no es necesario `ctr import` en `.14` ni en los demás.
- **Ingress**: Traefik está expuesto en `192.168.50.240` (pool MetalLB `192.168.50.240-249`).
- `monitoring-vyll` no se usa (pertenece a otro proyecto).

## 10. Capturas pendientes

**[CAPTURA PENDIENTE: `k8s-web-pods.png`]**

Descripción: Terminal con `kubectl get pods,svc,ingress -n apps -o wide` mostrando los 2 pods `Running 1/1`, el Service `NodePort 30080` y el Ingress con `ADDRESS 192.168.50.240`.
Ubicación: `docs/evidencias/k8s-web-pods.png`
Procedimiento: ejecutar los comandos del §6 en una terminal limpia y capturar.

**[CAPTURA PENDIENTE: `k8s-web-crud.png`]**

Descripción: Terminal con la secuencia CRUD del §6 (`POST → 201`, `PUT → 200`, `DELETE → 204`) contra `http://192.168.50.11:30080`, junto al `curl .../health` que devuelve `{"status":"ok"}`.
Ubicación: `docs/evidencias/k8s-web-crud.png`
Procedimiento: requiere la API activa (§9); ejecutar la secuencia completa del §6 en una sola terminal y capturar.

## 11. Checklist para retomar

1. Confirmar con el responsable de la API que `http://192.168.50.114:8000/health` responde.
2. Ejecutar las pruebas de verificación del §6 (NodePort e Ingress) y el CRUD completo.
3. Prueba de recreación de pod (§6).
4. Capturar las 2 imágenes del §10 y sustituir los marcadores.
5. Revisar y commitear/pushear (Roger).
