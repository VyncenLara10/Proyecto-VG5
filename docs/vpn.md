# Remote Laboratory Access with Tailscale

## Network topology

The Steren router operates in **WISP mode**, providing a local `192.168.50.0/24` LAN with gateway `192.168.50.1`. The K3s nodes and MetalLB IP addresses cannot be accessed directly from mobile or other external networks. Tailscale provides VPN connectivity and advertises **the entire subnet** without exposing router ports to the public Internet.

- **Tailscale subnet router:** `kube-cp01`, LAN IP `192.168.50.11`, observed Tailscale IP `100.85.225.42`.
- **Advertised route:** `192.168.50.0/24`.
- **Traefik / web services:** `192.168.50.240` (ports 80 and 443).
- **External PostgreSQL:** `192.168.50.241:5432`.
- **Example test client:** laptop connected through mobile data, observed Tailscale IP `100.114.253.81` (this address may change).

## Configuring the subnet router (`kube-cp01`)

IPv4 forwarding was enabled on the control plane, and the subnet route was advertised:

```bash
sudo sysctl net.ipv4.ip_forward
# Observed: net.ipv4.ip_forward = 1
sudo tailscale set --advertise-routes=192.168.50.0/24
sudo tailscale status
sudo tailscale ip -4
```

To make IP forwarding persistent on a new installation:

```bash
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
```

In the Tailscale admin console, open **Machines → kube-cp01 → Subnets** and approve/enable `192.168.50.0/24`. To permit an evaluation from another account, **invite the instructor to the same tailnet**, subject to the configured access policies. Sharing only the `kube-cp01` machine does not grant access to its subnet routes.

## Instructions for the instructor

1. Request and accept an invitation to the laboratory's Tailscale tailnet.
2. Install Tailscale on Windows, Linux, or macOS, and sign in to the **shared tailnet**, rather than another personal tailnet.
3. Confirm that Tailscale is connected and that `kube-cp01` appears in the peer list.
4. Confirm that the route announced by `kube-cp01` is approved in the administrator's console.
5. Add the entries in `docs/hosts.txt` to the operating system's hosts file using administrator privileges, or run the `curl --resolve` checks below.
6. Open the web app, Grafana, Prometheus, and Argo CD through the URLs in the main README. Read-only credentials are provided **through a private channel**.

### Verification from Windows

```powershell
$ts = 'C:\Program Files\Tailscale\tailscale.exe'
& $ts status
& $ts ping 100.85.225.42
& $ts set --accept-routes=true
Test-NetConnection 192.168.50.240 -Port 80
Test-NetConnection 192.168.50.241 -Port 5432
curl.exe -I --resolve grafana.grupo5.lab:80:192.168.50.240 http://grafana.grupo5.lab/login
curl.exe -k -I --resolve argocd.grupo5.lab:443:192.168.50.240 https://argocd.grupo5.lab/
```

During the test from a laptop using mobile data, Tailscale reached `kube-cp01` through DERP. The connection tests returned **`TcpTestSucceeded: True`** for ports 80 and 5432 and **HTTP 200** for Grafana. A DERP relay does not prevent connectivity: Tailscale can use a relay when a direct peer-to-peer connection is unavailable.

### Hosts file

The repository includes `docs/hosts.txt`. On Windows, edit the following file as an administrator:

```text
C:\Windows\System32\drivers\etc\hosts
```

On Linux/macOS, edit `/etc/hosts`. The entries are:

```text
192.168.50.240 app.grupo5.lab
192.168.50.240 api.grupo5.lab
192.168.50.240 grafana.grupo5.lab
192.168.50.240 prometheus.grupo5.lab
192.168.50.240 argocd.grupo5.lab
192.168.50.241 db.grupo5.lab
```

**Alternative when the hosts file is not resolving names on Windows:** use `curl --resolve` with an explicit IP address to test a service without changing DNS. For browser access and SQL clients, configure name resolution correctly or use the IP address and port directly. A hosts file does not establish network connectivity; connect to the VPN first.

## Access and security

- Grafana: `http://grafana.grupo5.lab/login`.
- Prometheus: `http://prometheus.grupo5.lab/-/ready`.
- Argo CD: `https://argocd.grupo5.lab/` (internal certificate; a client may need to trust it).
- API: `http://api.grupo5.lab/health`.
- Web: `http://app.grupo5.lab/`.
- PostgreSQL: `192.168.50.241:5432`, using a SQL client and private read-only credentials.

Do not publish admin invitations, passwords, Tailscale tokens, the Doppler Secret, or the instructor's real credentials on GitHub. Remove access and revoke temporary credentials once the evaluation ends. See [instructor access](acceso-docente.md).
