# Kubernetes (Helm)

The Helm chart in [`charts/blokhouse`](../../charts/blokhouse) runs Blokhouse in Kubernetes. Without any values it also starts its own PostgreSQL, so you can try Blokhouse with one command. For production, turn the bundled database off and use your own PostgreSQL. Every value is listed in the [chart README](../../charts/blokhouse/README.md).

Requirements: a Kubernetes cluster and Helm 3. The chart is tested on kind with the restricted Pod Security Standard and targets any conformant cluster. OpenShift is supported through `openshift: true` but is untested.

## Quick start

The chart is published to `oci://ghcr.io/d4sw4r/charts/blokhouse` with every Blokhouse release (from 0.4.0 on), with the same version as the release:

```bash
helm install blokhouse oci://ghcr.io/d4sw4r/charts/blokhouse --version 0.5.0 \
  --namespace blokhouse --create-namespace
```

To try an unreleased version, install from a git checkout:

```bash
git clone https://github.com/d4sw4r/blokhouse.git
cd blokhouse
helm install blokhouse ./charts/blokhouse --namespace blokhouse --create-namespace
```

A checkout installs the image of the chart's `appVersion`, i.e. the last release, not the code of the checkout.

The first start applies the database migrations and can take a few minutes. Then open Blokhouse through a port-forward:

```bash
kubectl --namespace blokhouse rollout status deployment/blokhouse
kubectl --namespace blokhouse port-forward svc/blokhouse 8080:80
```

Open [http://localhost:8080](http://localhost:8080) and sign in as `admin@example.com` (`blokhouse.admin.email`). The chart generates the initial administrator password; read it with:

```bash
kubectl --namespace blokhouse get secret blokhouse -o jsonpath='{.data.ADMIN_PASSWORD}' | base64 -d
```

This password only applies to an empty database. If the database already has an administrator (for example an external database you moved over), that administrator keeps their password and `ADMIN_EMAIL` and `ADMIN_PASSWORD` are ignored. The same command is printed by `helm status blokhouse`.

The examples below use the release name `blokhouse`; with another name, the object names change accordingly.

## The bundled PostgreSQL

`postgresql.enabled` is `true` by default. The chart starts a one-replica StatefulSet with the official `postgres` image and an 8Gi volume (`postgresql.persistence.*`). It is meant for trying out Blokhouse and for small installations. It is a single instance: no high availability, no automatic backups, and no upgrades across PostgreSQL major versions.

Back it up with `pg_dump` (see also [backup.md](backup.md)):

```bash
kubectl --namespace blokhouse exec blokhouse-postgresql-0 -- \
  pg_dump -U blokhouse -Fc blokhouse > blokhouse-$(date +%Y%m%d-%H%M%S).dump
```

Restore into an empty database:

```bash
kubectl --namespace blokhouse scale deployment/blokhouse --replicas=0
kubectl --namespace blokhouse exec -i blokhouse-postgresql-0 -- \
  pg_restore -U blokhouse --clean --if-exists -d blokhouse < blokhouse-20260101-020000.dump
kubectl --namespace blokhouse scale deployment/blokhouse --replicas=1
```

Afterwards scale back to your `replicaCount` (or let the HorizontalPodAutoscaler do it).

The database password is generated once and kept. Changing `postgresql.auth.password` after the first install does **not** change the password inside the database: PostgreSQL only sets it when it initialises the data directory, so Blokhouse could no longer connect. To change it, run `ALTER USER` in the database first, then update the value or Secret.

## Production with an external database

Turn the bundled PostgreSQL off and give the chart a full connection URL. `externalDatabase.*` only applies with `postgresql.enabled=false`; without a URL or Secret, rendering fails.

With the URL in a Secret (recommended, the URL contains the password):

```bash
kubectl --namespace blokhouse create secret generic blokhouse-db \
  --from-literal=DATABASE_URL='postgresql://blokhouse:<password>@db.example.com:5432/blokhouse?sslmode=require'
```

```yaml
# values.yaml
postgresql:
  enabled: false
externalDatabase:
  existingSecret: blokhouse-db
  # existingSecretKey: DATABASE_URL
```

Or directly in the values with `externalDatabase.url`; it is then stored in the chart's Secret. Blokhouse needs PostgreSQL 14 or newer. The database user must be allowed to create tables, because migrations run on start.

### CloudNativePG

[CloudNativePG](https://cloudnative-pg.io) gives you a highly available PostgreSQL with backups. Install its operator first (see its documentation), then create a cluster. The chart does not create CloudNativePG resources.

```yaml
# cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: blokhouse-db
spec:
  instances: 3
  storage:
    size: 20Gi
  bootstrap:
    initdb:
      database: blokhouse
      owner: blokhouse
```

```bash
kubectl --namespace blokhouse apply -f cluster.yaml
```

CloudNativePG creates the Secret `<cluster>-app`, which has the key `uri` with a complete connection URL:

```yaml
# values.yaml
postgresql:
  enabled: false
externalDatabase:
  existingSecret: blokhouse-db-app
  existingSecretKey: uri
```

```bash
helm install blokhouse ./charts/blokhouse --namespace blokhouse -f values.yaml
```

## Ingress and TLS

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  hosts:
    - host: cmdb.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: blokhouse-tls
      hosts:
        - cmdb.example.com
```

`NEXTAUTH_URL` is taken from `blokhouse.url` if set, else from the first Ingress host: `https://cmdb.example.com` here, because the host is listed in `tls`; without a `tls` entry the chart uses `http://`. If TLS ends in front of the Ingress (a cloud load balancer, for example), set `blokhouse.url: https://cmdb.example.com` yourself. A wrong `NEXTAUTH_URL` breaks sign-in.

### Gateway API (HTTPRoute)

```yaml
httpRoute:
  enabled: true
  parentRefs:
    - name: my-gateway
      namespace: infra
  hostnames:
    - cmdb.example.com
```

This needs the Gateway API CRDs and a Gateway. The chart cannot see the Gateway's TLS settings, so it assumes `https://` for the first hostname. If the Gateway serves plain http, set `blokhouse.url` explicitly.

## Single sign-on

The `blokhouse.sso.*` values map to the `OIDC_*` variables, see [docs/configuration.md](../configuration.md#single-sign-on-oidc) and [docs/authentication.md](../authentication.md).

```yaml
blokhouse:
  url: https://cmdb.example.com
  sso:
    issuer: https://keycloak.example.com/realms/company
    clientId: blokhouse
    roleMap: "cmdb-admins=ADMIN,cmdb-users=USER,cmdb-read=READONLY"
  sessionMaxAge: 28800
```

Register this redirect (callback) URL with your provider: `<url>/api/auth/callback/oidc`, here `https://cmdb.example.com/api/auth/callback/oidc`.

Do not put the client secret into a values file you commit. Put it, together with `NEXTAUTH_SECRET`, into an existing Secret, see the next section.

## Secrets

The chart needs `NEXTAUTH_SECRET`, an initial admin password, the bundled database password (if used) and, with SSO, the client secret.

- **Generated once and kept.** If you do not set `blokhouse.nextauthSecret`, `blokhouse.admin.password` or `postgresql.auth.password`, the chart generates them on the first install and reuses the stored values on every `helm upgrade`. The Secrets carry `helm.sh/resource-policy: keep`, so they survive `helm uninstall`, too. The values are never printed in logs or the install notes.
- **Visible in Helm's release data.** Generated and given values end up base64-encoded in the manifest Helm stores in its release Secret (`helm get manifest`). Whoever can read Secrets in the namespace can read them anyway. To keep them out of Helm entirely, use existing Secrets.
- **Existing Secrets.** `blokhouse.existingSecret` names a Secret with the keys `NEXTAUTH_SECRET` (required), `ADMIN_PASSWORD` and `OIDC_CLIENT_SECRET` (optional). The chart then manages none of these three, and the matching values are ignored.

  ```bash
  kubectl --namespace blokhouse create secret generic blokhouse-secrets \
    --from-literal=NEXTAUTH_SECRET="$(openssl rand -hex 32)" \
    --from-literal=ADMIN_PASSWORD="$(openssl rand -hex 16)" \
    --from-literal=OIDC_CLIENT_SECRET='<client secret>'
  ```

  Put `ADMIN_PASSWORD` into that Secret. Without it, the first start generates a password and writes it to a file inside the pod (an `emptyDir`); it is lost with the pod, and you cannot read it back from the Secret.
- **Bundled database password.** `postgresql.auth.existingSecret` names a Secret with the key `password`. The password is inserted into `DATABASE_URL` unencoded, so it must be URL-safe: letters, digits, `-`, `.`, `_`, `~` (`openssl rand -hex 16` is fine).
- **`helm template` and GitOps.** The chart finds the kept Secrets with `lookup`, which returns nothing under `helm template`, `--dry-run` or when Argo CD renders the chart. Generated values would then change at every render. With such tools, set the values explicitly or use existing Secrets.

## OpenShift

OpenShift assigns a random UID to each pod. Set `openshift: true` so the chart leaves out `runAsUser`, `runAsGroup` and `fsGroup` for the app and the bundled PostgreSQL, and the `restricted-v2` SCC can choose them:

```yaml
openshift: true
```

All writable paths are `emptyDir` volumes or the data volume, so an arbitrary UID works. Expose Blokhouse with a Route or with `ingress.*`. This is not tested on a real OpenShift cluster in CI.

## Upgrading

```bash
helm upgrade blokhouse oci://ghcr.io/d4sw4r/charts/blokhouse --version <new version> \
  --namespace blokhouse -f values.yaml
```

Or from a checkout: `helm upgrade blokhouse ./charts/blokhouse --namespace blokhouse -f values.yaml`. The chart version equals the Blokhouse version, and the image tag defaults to it. Read the release notes in [CHANGELOG.md](../../CHANGELOG.md) and [docs/upgrading.md](../upgrading.md) first. Database migrations run when the new pods start. Generated secrets are kept. Take a backup before every upgrade.

Always pass your values file with `-f values.yaml`. Plain `--reuse-values` keeps the values of the old release and drops defaults that a newer chart adds, which breaks the render. If you do not keep a values file, use `--reset-then-reuse-values` (Helm 3.14 or later), which applies the new chart defaults and then your previous overrides. The bundled PostgreSQL's major version is not upgraded by the chart; do not change `postgresql.image.tag` to another major version.

## Autoscaling and disruption budgets

- `autoscaling.enabled` needs `resources.requests.cpu`: the HorizontalPodAutoscaler scales on CPU utilisation, which is measured against the request. Without it the HPA cannot compute a value.
- `podDisruptionBudget.minAvailable: 1` with a single replica blocks node drains, because the only pod may never be evicted. Use it with at least two replicas, or lower `podDisruptionBudget.minAvailable` to `0`.
- The liveness probe only checks that the port is open; `/api/health` (which checks the database) is used for the startup and readiness probes. A database outage therefore takes pods out of service but does not restart them.

## Uninstall

```bash
helm uninstall blokhouse --namespace blokhouse
```

This keeps your data. The bundled PostgreSQL's PersistentVolumeClaim and the generated Secrets (`helm.sh/resource-policy: keep`) stay, so a reinstall with the same release name finds the old database and its password. To remove everything for good (this deletes the database):

```bash
kubectl --namespace blokhouse delete pvc data-blokhouse-postgresql-0
kubectl --namespace blokhouse delete secret blokhouse blokhouse-postgresql
```

Without the bundled database, only the Secret `blokhouse` stays. A PVC you passed as `postgresql.persistence.existingClaim` is yours and is never touched.

## Pod Security

By default the pods pass the Kubernetes `restricted` Pod Security Standard: non-root (UID 1001), no privilege escalation, all capabilities dropped, `RuntimeDefault` seccomp profile and a read-only root filesystem. Namespaces that enforce `restricted` work without changes:

```bash
kubectl label namespace blokhouse pod-security.kubernetes.io/enforce=restricted
```

If you override `podSecurityContext` or `securityContext`, keep these settings. Network discovery (`blokhouse.discovery.enabled`) needs `nmap` and raw sockets, which the image and the default security context do not provide, so it is off by default.
