# Doppler — Gestión de secretos (preparado, pendiente de activación)

## 1. Qué es y para qué lo tenemos

Doppler es un gestor de secretos en la nube: en lugar de guardar contraseñas (credenciales de BD, tokens) en Git o en archivos sueltos, se guardan en Doppler y:

- **Kubernetes** las sincroniza automáticamente hacia un `Secret` del clúster mediante el **Doppler Kubernetes Operator**.
- Cuando el valor cambia en Doppler, el clúster lo refleja en ~60 segundos sin redeploy manual.
- **Nada de esto vive en Git**: solo los manifiestos de orquestación; los valores y el token nunca se commitean.

**Uso previsto en KubeLab:** credenciales de la base de datos cuando la API de Rocío use BD dentro del clúster (hoy la API no las necesita todavía). Por eso los archivos están **preparados pero NO instalados**.

## 2. Arquitectura

```
Doppler (nube)  --sync-->  Operator (ns doppler-operator-system)
                                |
                                v
                     Secret "doppler-apps" (ns apps)
                                |
                                v
                     Pods que lo referencian (envFrom/secretKeyRef)
```

## 3. Archivos del proyecto

| Archivo | Contenido |
|---|---|
| `k8s/platform/doppler/doppler-secret.yaml` | Manifiesto `DopplerSecret` listo: proyecto `kubelab`, config `dev` → Secret `doppler-apps` en `apps` |

## 4. Activación (cuando se decida usar)

### 4.1 Cuenta y proyecto (navegador, una vez)

1. Crear cuenta en https://app.doppler.com (plan Free).
2. Crear proyecto **`kubelab`** (config `dev` por defecto).
3. Agregar los secretos necesarios (p. ej. `DB_PASSWORD`).
4. *Project Settings → Service Tokens →* crear token de solo lectura para config `dev` → **copiarlo (solo se muestra una vez)**.

### 4.2 Operador en el clúster (requiere acceso kubectl)

```bash
helm repo add doppler https://helm.doppler.com
helm repo update
helm install --generate-name doppler/doppler-kubernetes-operator
kubectl get pods -n doppler-operator-system   # debe quedar Running
```

Crea el namespace propio `doppler-operator-system` (no toca otros namespaces del proyecto).

### 4.3 Token al clúster (comando local, el token NO va a Git)

```bash
kubectl create secret generic doppler-token-secret \
  --namespace doppler-operator-system \
  --from-literal=serviceToken=PEGA_AQUI_EL_TOKEN
```

### 4.4 Aplicar el manifiesto

```bash
kubectl apply -f k8s/platform/doppler/doppler-secret.yaml
```

### 4.5 Verificación

```bash
kubectl get secret doppler-apps -n apps
kubectl describe dopplersecret apps -n doppler-operator-system   # Conditions: OK
```

## 5. Consumo desde un Deployment

```yaml
envFrom:
  - configMapRef:
      name: kubelab-web-config      # configuración no sensible
  - secretRef:
      name: doppler-apps      # secretos sincronizados desde Doppler
```

## 6. Reglas de seguridad

- El token de Doppler y los valores de los secretos **nunca** se escriben en este repositorio.
- El manifiesto `doppler-secret.yaml` solo referencia nombres; no contiene credenciales.
- Permisos del token: **solo lectura** del config `dev`.
