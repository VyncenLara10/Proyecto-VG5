# Infraestructura Kubernetes 

## 1. Distribución del clúster

El proyecto utiliza K3s sobre cuatro máquinas virtuales
Ubuntu Server desplegadas en Proxmox VE.

| Nodo | Dirección IP | Función |
|---|---|---|
| kube-cp01 | 192.168.50.11 | Control Plane |
| kuberworker01 | 192.168.50.12 | Worker |
| kuberworker02 | 192.168.50.13 | Worker |
| kuberworker03 | 192.168.50.14 | Worker |

## 2. Versiones

- Sistema operativo: Ubuntu Server 26.04.1 LTS
- Kubernetes: K3s v1.36.5+k3s1
- Runtime: containerd 2.3.4-k3s1.36

## 3. Configuración del Control Plane

El nodo kube-cp01 tiene la siguiente restricción:

node-role.kubernetes.io/control-plane=true:NoSchedule

Esto evita programar Pods normales en el nodo de control.

## 4. Componentes instalados

| Componente | Estado |
|---|---|
| CoreDNS | Running |
| Local Path Provisioner | Running |
| Metrics Server | Running |
| Traefik | Running |

## 5. Estado de los nodos

Los cuatro nodos fueron verificados mediante:

kubectl get nodes -o wide

Todos aparecen en estado Ready.

## 6. Observaciones

- Traefik fue instalado por la distribución K3s.
- ServiceLB de K3s fue deshabilitado para utilizar MetalLB
  posteriormente.
- El almacenamiento persistente distribuido todavía está
  pendiente de configuración.
