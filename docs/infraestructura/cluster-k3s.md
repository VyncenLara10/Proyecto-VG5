# KubeLab Infrastructure: Proxmox, K3s, and Storage

## Purpose

Document the VMs, network configuration, and laboratory deployment sequence. This guide covers both the original four-node design and the November 2026 demonstration setup.

## Network and physical hardware

- **Hypervisor:** Proxmox VE 9.2.2 on an Intel i5-3470S, 1 TB SATA HDD, and approximately 15 GiB of RAM.
- **Hypervisor network interface:** `192.168.50.10/24` on `vmbr0`; gateway `192.168.50.1`.
- **Router:** Steren COM-890+ in WISP mode, providing a dedicated `192.168.50.0/24` LAN. Remote access is provided by Tailscale rather than forwarding router ports to the Internet.
- **MetalLB IPs:** reserved pool `192.168.50.240-192.168.50.249` with automatic assignment disabled. Traefik uses `.240`; the external PostgreSQL service uses `.241`.

## Virtual machine inventory

| VMID | Hostname | Address | Operating system | Role | CPU | Reference RAM | Disk |
|---|---|---|---|---|---|---|---|
| 100 | `kube-cp01` | `192.168.50.11` | Ubuntu Server 26.04.1 LTS | K3s control plane | 1 vCPU | 3 GiB | 32 GiB |
| 101 | `kuberworker01` | `192.168.50.12` | Ubuntu Server 26.04.1 LTS | K3s worker | 1 vCPU | 4 GiB | 32 GiB |
| 102 | `kuberworker02` | `192.168.50.13` | Ubuntu Server 26.04.1 LTS | Created worker, not part of final active setup | 1 vCPU | ~2 GiB | 32 GiB |
| 103 | `kuberworker03` | `192.168.50.14` | Ubuntu Server 26.04.1 LTS | Created worker, not part of final active setup | 1 vCPU | ~2 GiB | 32 GiB |

**Demonstration status:** `kube-cp01` and `kuberworker01` were verified as `Ready`. VMs 102 and 103 were left powered off, with the instructor informed about the available hardware resources. As agreed with the instructor, destructive node-failure simulations were not performed. The values listed here are reference allocations and should be checked in Proxmox if the hardware changes.

## Creating the VMs in Proxmox

1. Install Proxmox VE directly on the physical machine and configure `vmbr0` on the WISP router's LAN.
2. Upload the Ubuntu Server ISO to Proxmox.
3. Select **Create VM** and configure the VMID, hostname, ISO, a 32 GiB disk on the available storage, one vCPU, and the RAM shown in the table.
4. Attach a VirtIO network interface to `vmbr0`. Install Ubuntu Server, create a user with `sudo` privileges, and enable SSH.
5. Set a static IP on each VM with a `/24` subnet mask, gateway `192.168.50.1`, and reachable DNS servers (for example, the router and an external resolver).
6. Restart and check communication among the host, control plane, and worker using `ip addr`, `ip route`, and `ping`.
7. Update the operating system and configure hostnames before installing K3s.

## Installing K3s

**K3s** was chosen because of its relatively low resource requirements and its built-in Traefik, containerd, CoreDNS, and other components useful for this laboratory. Installed version observed: `v1.36.5+k3s1`; runtime: `containerd://2.3.4-k3s1.36`.

Example installation on a **new control-plane VM** (do not repeat on the active cluster):

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC='server --disable servicelb' sh -
sudo systemctl is-active k3s
sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml get nodes -o wide
```

An agent joins from another VM using the **private** token obtained from the control plane. Never include the token in version-controlled files:

```bash
# Replace the token locally. Never commit it or include it in screenshots.
export K3S_URL='https://192.168.50.11:6443'
export K3S_TOKEN='<PRIVATE_CONTROL_PLANE_TOKEN>'
curl -sfL https://get.k3s.io | sh -
```

Apply or inspect the `NoSchedule` taint to keep application workloads off the control plane. Do not change taints or reschedule workloads on the stable evaluation machine without a specific reason.

## MetalLB and Traefik

- Install MetalLB controllers and CRDs before applying `k8s/platform/metallb/` (the IPAddressPool and L2Advertisement).
- Traefik is installed by K3s. Its version-controlled `HelmChartConfig` is at `k8s/platform/traefik/helmchartconfig.yaml` and requests IP `192.168.50.240`.
- `k8s/platform/traefik/` includes the API, Grafana, and Argo CD IngressRoutes. The web IngressRoute is defined in `k8s/apps/web/ingressroute.yaml`, and the Prometheus IngressRoute in `k8s/observability/prometheus/ingressroute.yaml`.
- PostgreSQL uses an **additional LoadBalancer Service** defined in `k8s/apps/database/external-service.yaml`, without replacing its internal ClusterIP Service.

Verification:

```bash
K='sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml'
$K get ipaddresspool,l2advertisement -n metallb-system
$K get svc -A | grep -E 'traefik|postgres-external'
$K get ingressroute -A
```

## NFS and PVCs

Proxmox also acts as an NFS server, exporting `/srv/nfs/kubelab` to the K3s nodes. Mounts were verified from the nodes. In a production environment, the permissive settings used in this lab should be replaced with more restrictive export options, storage isolation, and regular backups.

**NFS Subdir External Provisioner** (chart version 4.0.18) and the `nfs-client` StorageClass were installed. Its Argo CD Application definition can be found in `k8s/argocd/nfs-subdir-external-provisioner.yaml`.

| Component | Storage in the evaluated setup |
|---|---|
| PostgreSQL | Dynamically provisioned PVC, `nfs-client` |
| Grafana | `kubelab-grafana-nfs`, `nfs-client` |
| Prometheus | `kubelab-prometheus-single`, `local-path` |
| Loki | `kubelab-loki-single`, `local-path` |

PostgreSQL recovered after its Pod was restarted and was subsequently verified to be responding. Older PVCs from troubleshooting were preserved without deleting their data. Do not run automated PV/PVC cleanup before the review.

## Argo CD, observability, and credentials

- Argo CD was installed through Helm (`argo-cd` chart `10.11.7`), using hardware-conscious values in `k8s/argocd/argocd-values.yaml`.
- The app-of-apps pattern is defined in `argocd/root-app.yaml`. The API, web, database, and observability Applications are declared in `k8s/argocd/`.
- Grafana provisions data sources and dashboards from Git, including Prometheus and Loki. Promtail collects Pod logs.
- The Doppler Operator is declared under `k8s/platform/doppler/`. Its `DopplerSecret` creates `db-credentials` for the API and PostgreSQL. The operator token must be supplied as a local Kubernetes Secret, not as text in Git.

## Status checks

```bash
K='sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml'
$K get nodes
$K get deployments,statefulsets -n kubelab-dev
$K get deployments -n kubelab-monitoring
$K get pvc -A
$K get applications -n argocd
curl -sS -H 'Host: api.grupo5.lab' http://192.168.50.240/health
```

At the latest verified checkpoint, API and web were `2/2`, PostgreSQL was `1/1`, and Grafana, Prometheus, and Loki were each `1/1`. The business and observability Applications were `Synced/Healthy`; the root Application still had non-destructive `OutOfSync` differences awaiting review.

## Documented limitations

This laboratory runs on resource-constrained hardware. Defining HPA manifests does not, by itself, demonstrate successful load-based scaling or destructive high-availability testing. The manifests are version-controlled, but service continuity and verifiable evidence were prioritized during the demonstration.
