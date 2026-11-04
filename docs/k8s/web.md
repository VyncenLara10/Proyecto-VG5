# Frontend en Kubernetes — KubeLab

Despliegue del frontend (`kubelab-web`) en el clúster K3s, con conexión a la API de Rocío a través del proxy de Nginx.

## 1. Alcance

- Namespace propio: **`kubelab-dev`**.
- La API sigue en **`http://192.168.50.114:8000`** (IP/puerto centralizados en un ConfigMap, no en el bundle).
- El navegador llama a su **mismo origen** (`/products`, `/health`, `/metrics`); Nginx dentro del pod los reenvía a `API_UPSTREAM`.
- Exposición: **NodePort `30080`** para pruebas inmediatas e **Ingress (Traefik)** como mecanismo definitivo.

## 2. Archivos

| Archivo | Contenido |
|---|---|
| `k8s/apps/web/namespace.yaml` | Namespace `kubelab-dev` |
| `k8s/apps/web/configmap.yaml` | `API_UPSTREAM=http://192.168.50.114:8000` |
| `k8s/apps/web/deployment.yaml` | 2 réplicas, `kubelab-web:dev`, probes, resources |
| `k8s/apps/web/service.yaml` | `NodePort 30080 → 80` |
| `k8s/apps/web/ingress.yaml` | Ingress `traefik`, ruta `/` Prefix → `kubelab-web:80` |

## 3. Decisiones de configuración

- **Imagen `kubelab-web:dev` + `imagePullPolicy: IfNotPresent`**: no hay registry en el proyecto; la imagen se carga manualmente en cada worker con `ctr images import` (§5).
- **Probes sobre `GET /` (puerto 80), nunca `/health`**: el pod no debe reiniciarse si la API o la BD caen; la salud de la API es una señal separada.
- **Resources acotados** (los workers tienen ~830 MiB y 1 CPU): `requests: 25m/32Mi`, `limits: 200m/96Mi`.
- **`API_UPSTREAM` en ConfigMap**: la dirección de la API se cambia en un solo lugar, sin reconstruir la imagen.
- **2 réplicas** para tolerar la caída de un pod.

## 4. Despliegue

```bash
export KUBECONFIG=$HOME/.kube/kubelab-k3s/config   # generado desde el nodo (§7)

kubectl apply -f k8s/apps/web/namespace.yaml       # primero: el resto depende del namespace
kubectl apply -f k8s/apps/web/
kubectl get all,ingress -n kubelab-dev
```

Validación previa sin aplicar:

```bash
kubectl apply --dry-run=server -f k8s/apps/web/
```

## 5. Carga de imagen en los workers

Sin registry: se exporta la imagen local y se importa en cada worker (1 conexión SSH por nodo).

```bash
docker save kubelab-web:dev -o /tmp/kubelab-web-dev.tar

# Repetir por cada worker (192.168.50.12, .13, .14):
# sudo pide contraseña por stdin cuando no hay tty: la primera línea del stdin es la contraseña
{ printf '<contraseña-admin>\n'; cat /tmp/kubelab-web-dev.tar; } | ssh <usuario>@<worker> \
  'sudo -S k3s ctr -n k8s.io images import - && sudo -n k3s ctr -n k8s.io images ls | grep kubelab-web'
```

Las credenciales SSH del clúster las facilita el responsable y **no se almacenan en el repositorio**.

Comprobación de la imagen en un nodo:

```bash
ssh <usuario>@<worker> 'echo <contraseña> | sudo -S k3s ctr -n k8s.io images ls | grep kubelab-web'
```

## 6. Verificación

```bash
export KUBECONFIG=$HOME/.kube/kubelab-k3s/config

# Pods corriendo y en qué nodos
kubectl get pods -n kubelab-dev -o wide

# La API es alcanzable desde DENTRO del clúster (viaje real por red del pod)
kubectl exec deploy/kubelab-web -n kubelab-dev -- wget -qO- http://192.168.50.114:8000/health
# → {"status":"ok"}

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
kubectl delete pod -l app=kubelab-web -n kubelab-dev
kubectl get pods -n kubelab-dev -w
```

## 7. kubeconfig del clúster

- Archivo: `~/.kube/kubelab-k3s/config` (fuera del repositorio, permisos `600`).
- Origen: `/etc/rancher/k3s/k3s.yaml` del nodo `kube-cp01` (`192.168.50.11`), con `server` cambiado de `https://127.0.0.1:6443` a `https://192.168.50.11:6443`.
- Los manifiestos de este directorio **no** incluyen credenciales.

## 8. Estado al cierre de la sesión

| Comprobación | Resultado |
|---|---|
| YAMLs validados (`--dry-run=server`) y aplicados | ✅ Verificado |
| Namespace `kubelab-dev` + ConfigMap + Service + Ingress | ✅ Creados |
| 2 pods `Running 1/1` (en `kuberworker01` y `kuberworker02`) | ✅ Verificado |
| Service `NodePort 30080` | ✅ Verificado |
| Ingress con dirección `192.168.50.240` (MetalLB) | ✅ Verificado |
| Imagen importada en `.12` y `.13` | ✅ Verificado |
| Imagen importada en `.14` | ⚂ Pendiente (ver §9) |
| `/health` y CRUD por NodePort/Ingress | ⚂ Pendiente |
| Prueba de recreación de pod | ⚂ Pendiente |
| Capturas | ⚂ Pendiente |

## 9. Notas y pendientes

- **Worker `.14` (`kuberworker03`)**: `k3s ctr` quedó sin respuesta tras un `images import` interrumpido por timeout (bloqueo transitorio de containerd; se recuperó para `images ls`, pero el import no completó). Ese nodo ya venía inestable (reinicios de `argocd-server`, `argocd-repo-server` y `metallb-system/speaker`, que son workloads de otros integrantes). Acción pendiente: reintentar el import (§5); si `ctr` sigue sin responder, valorar `sudo systemctl restart k3s-agent` en ese nodo **previa autorización**, porque reinicia todos sus pods.
- **Riesgo mientras `.14` no tenga la imagen**: si un pod se agenda ahí queda en `ImagePullBackOff`. Hoy ambas réplicas corren en `.12`/`.13`.
- **Ingress**: Traefik está expuesto en `192.168.50.240` (pool MetalLB `192.168.50.240-249`); la ruta `/` del Ingress responde sin host definido.
- El acceso definitivo con dominios quedará para cuando exista el archivo de zonas (mientras tanto: IP + puerto, §1).

## 10. Capturas pendientes

**[CAPTURA PENDIENTE: `k8s-web-pods.png`]**

Descripción: Terminal con `kubectl get pods,svc,ingress -n kubelab-dev -o wide` mostrando los 2 pods `Running 1/1`, el Service `NodePort 30080` y el Ingress con `ADDRESS 192.168.50.240`.
Ubicación: `docs/evidencias/k8s-web-pods.png`
Procedimiento: ejecutar los comandos del §6 en una terminal limpia y capturar.

**[CAPTURA PENDIENTE: `k8s-web-crud.png`]**

Descripción: Terminal con la secuencia CRUD del §6 (`POST → 201`, `PUT → 200`, `DELETE → 204`) contra `http://192.168.50.11:30080`, junto al `curl .../health` que devuelve `{"status":"ok"}`.
Ubicación: `docs/evidencias/k8s-web-crud.png`
Procedimiento: ejecutar la secuencia completa del §6 en una sola terminal y capturar.

## 11. Checklist para retomar

1. Reintentar el import de la imagen en `.14` (§5) y comprobarlo.
2. Ejecutar las pruebas de verificación del §6 (NodePort e Ingress).
3. Prueba de recreación de pod.
4. Capturar las 2 imágenes del §10 y sustituir los marcadores.
5. Revisar y commitear/pushear (Roger).
