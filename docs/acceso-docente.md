# Instructor Access and Read-Only Accounts

This guide describes what must be provided to the instructor **separately from the repository** to evaluate KubeLab. It intentionally contains no actual usernames or passwords.

## Network access

1. Invite the instructor to the tailnet containing `kube-cp01` and authorize their account under the Tailscale access policies.
2. Confirm that the `192.168.50.0/24` route advertised by `kube-cp01` has been approved.
3. Provide `docs/hosts.txt` and the `docs/vpn.md` guide.
4. Verify connectivity from the instructor's own computer to Traefik at `.240` and PostgreSQL at `.241:5432`.

## URLs available through the VPN

| Service | Destination |
|---|---|
| Web | `http://app.grupo5.lab/` |
| API | `http://api.grupo5.lab/health` |
| Grafana | `http://grafana.grupo5.lab/login` |
| Prometheus | `http://prometheus.grupo5.lab/-/ready` |
| Argo CD | `https://argocd.grupo5.lab/` |
| PostgreSQL | `db.grupo5.lab:5432` (IP `192.168.50.241`) |

## Accounts to prepare before the demonstration

**Do not mark this requirement as complete until these accounts have been created and tested.** Credentials must be delivered through a private channel only.

- **PostgreSQL:** create a role with **LOGIN**, `CONNECT` permission on the `app` database, `USAGE` on the `public` schema, and `SELECT` on the tables the instructor needs to inspect. Do not grant write permissions or `SUPERUSER`. Test a read-only query and confirm that `INSERT` and `UPDATE` are denied.
- **Grafana:** create an organization user with the **Viewer** role. Confirm that the user can view dashboards but cannot edit them or manage data sources.
- **Argo CD:** configure an inspection-only RBAC policy allowing `get` on Applications and their resources, without permissions to sync, modify, or delete resources. Test that account through the UI.

Illustrative SQL example. Run it **only as a PostgreSQL administrator** and replace the placeholders with private temporary values; never commit credentials:

```sql
CREATE ROLE instructor_readonly LOGIN PASSWORD '<PRIVATE_TEMPORARY_PASSWORD>';
GRANT CONNECT ON DATABASE app TO instructor_readonly;
GRANT USAGE ON SCHEMA public TO instructor_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO instructor_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO instructor_readonly;
```

The Argo CD RBAC policy must be checked against the active authentication mechanism and Helm installation. Do not share the administrator account or reuse it as the instructor's account.

## Verification and cleanup

- [ ] The VPN provides access to `192.168.50.240:80` and `192.168.50.241:5432`.
- [ ] `docs/hosts.txt` matches the actual MetalLB IP assignments.
- [ ] Web, API, Grafana, Prometheus, and Argo CD open from the remote computer.
- [ ] The PostgreSQL user can read data but cannot modify it.
- [ ] The Grafana user has the Viewer role.
- [ ] The Argo CD user has read-only access.
- [ ] Credentials are provided privately and revoked after evaluation.
