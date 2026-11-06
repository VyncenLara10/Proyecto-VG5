# KubeLab Final Submission Checklist

This checklist distinguishes verified results from outstanding tasks. It does not require restarting nodes, deleting PVCs, or performing destructive tests.

## Confirmed

- [x] K3s control plane and worker both `Ready`.
- [x] API and web: two available replicas each; PostgreSQL `1/1`.
- [x] Grafana, Prometheus, and Loki `1/1`; real `up=1` metrics and API/web logs.
- [x] API, web, database, and observability Argo CD Applications: `Synced / Healthy`.
- [x] Tailscale reaches the WISP LAN from a mobile-data connection.
- [x] Grafana, Argo CD, and Prometheus respond through Traefik.
- [x] PostgreSQL: LoadBalancer `192.168.50.241:5432`, with TCP connectivity verified through Tailscale.
- [x] Infrastructure, observability, VPN, persistence, and CI/CD evidence recorded in the repository.
- [x] Successful API and web GitHub Actions workflow runs.

## Outstanding before submission

- [ ] Create and test **read-only** accounts for PostgreSQL, Grafana, and Argo CD. Send credentials through a private channel.
- [ ] Inspect the Diff for `kubelab-root`, which remains `OutOfSync / Healthy`, before synchronizing. Do not use `Force`, `Replace`, or `Prune` without checking the effects.
- [ ] Check that the README and image links render correctly on GitHub.
- [ ] Add all documentation in this package and document the team's design decisions.
- [ ] Merge the branch containing integration and documentation into `main` through a PR.
- [ ] Provide the final repository URL, `docs/hosts.txt`, VPN instructions, and private access credentials to the instructor.

## Differences observed in `kubelab-root`

The following resources were reported as `OutOfSync`: the `kubelab-api` and `kubelab-database` Applications, the `argocd` IngressRoute, the `grafana-grupo5` IngressRoute, and the `argocd-transport` ServersTransport. Child Applications were verified as healthy; avoid indiscriminate synchronization.

## Do not claim as demonstrated without evidence

- HPA scaling under load without a specific test.
- Survival of a complete worker outage or destructive node-removal test.
- NFS usage by Prometheus and Loki; their final PVCs are `local-path`.
- GitHub Actions obtaining credentials from Doppler: the reviewed workflows use `GITHUB_TOKEN` for GHCR/GitHub.
- Auto-sync and self-heal enabled on all Argo CD Applications.

## Quick checks on `kube-cp01`

```bash
K='sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml'
$K get applications -n argocd
$K get deployments,statefulsets -n kubelab-dev
$K get deployments -n kubelab-monitoring
$K get svc postgres-external -n kubelab-dev
```
