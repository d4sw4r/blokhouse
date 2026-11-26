# Helm chart

Status: design for approval (2026-11-26)

## Intent

Companies that run Kubernetes want to install Blokhouse the way they install
everything else: `helm install`, values in Git, upgrades with `helm upgrade`.
Today Blokhouse ships a Docker image, a `docker-compose.yml` and guides for
nginx/systemd, but nothing for Kubernetes. The chart should serve two
audiences (decided): someone trying Blokhouse with one command, including a
database, and a company that puts it into its cluster next to the PostgreSQL
it already runs.

## Goals

- One chart, `charts/blokhouse`, published with every release.
- `helm install blokhouse <chart>` with no values gives a working instance
  with its own PostgreSQL (for trying out and small installations).
- Production: point the chart at an existing PostgreSQL (CloudNativePG, RDS,
  a central server) and turn the bundled one off.
- Every Blokhouse setting (SSO, signup, discovery, webhooks, session lifetime)
  can be set through values; secrets can come from existing Secrets.
- Tested in CI by installing it into a real cluster.

## Non-goals

- High availability of the bundled PostgreSQL, backups of it, or upgrades
  across PostgreSQL major versions. It is a single instance (decided).
- Built-in CloudNativePG `Cluster` resources (possible later if asked for;
  the docs show how to use CNPG as the external database).
- Third-party subcharts (Bitnami etc.; decided against: the free Bitnami
  images were largely discontinued in 2025).
- Kubernetes operators, CRDs of our own, Kustomize bases.
- Network discovery inside Kubernetes beyond passing its variables through
  (it needs nmap and raw sockets; off by default, documented as such).

## Anti-goals

- Losing the generated admin password, `NEXTAUTH_SECRET` or the bundled
  database password on `helm upgrade` (all sessions logged out, or the app
  can no longer reach its own database).
- Deleting the bundled database's data on `helm uninstall` or upgrade.
- Generated secrets printed in logs, `NOTES.txt` or the values. (They do
  appear, base64-encoded, in the rendered manifest Helm stores in its release
  Secret; that is accepted, see "Configuration and secrets".)
- A chart that only works in one kind of cluster (kind, k3s, EKS, AKS, and
  namespaces enforcing the Kubernetes `restricted` Pod Security Standard must
  all work; OpenShift's random UIDs are supported through a values switch,
  see "Blokhouse Deployment").

## Current state

- Image `ghcr.io/d4sw4r/blokhouse:<version>` (and `latest`), amd64 and arm64,
  built by `.github/workflows/publish.yml` on `v*` tags. Runs as UID 1001,
  port 3000.
- `scripts/start.sh` (image CMD): checks `NEXTAUTH_SECRET` and
  `DATABASE_URL`, runs `prisma migrate deploy` with retries, `prisma db seed`
  (creates the first admin only if none exists), then `next start`.
- The seed takes `ADMIN_EMAIL` / `ADMIN_PASSWORD`; without a password it
  writes a random one to `ADMIN_PASSWORD_FILE` (`/app/data/…`), which in a
  pod is lost with the container.
- `GET /api/health` checks the database (usable as readiness probe).
- The webhook worker runs in every app process and claims deliveries with
  `FOR UPDATE SKIP LOCKED`: several replicas are safe.
  `prisma migrate deploy` takes a PostgreSQL advisory lock: concurrent
  migrations of several replicas are safe. `prisma db seed` takes no lock:
  its `findFirst` + `upsert` can race when several replicas start at once
  (fixed by this work, see "App changes").
- The seed ignores `ADMIN_EMAIL` / `ADMIN_PASSWORD` when an admin already
  exists (e.g. an external database moved over from compose).
- `publish.yml` has no version check today: image tags come from the git
  tag, release notes from CHANGELOG.md. Versions in `package.json` are bumped
  by hand in the release PR.
- Configuration is environment variables only (`docs/configuration.md`).

## Approaches considered (for the bundled database)

1. **Own small StatefulSet with the official `postgres` image** (chosen).
   `postgresql.enabled=true` by default, PVC, generated password, Service;
   the equivalent of the compose file. No outside dependency, works in every
   cluster; single instance, no HA or backup.
2. CloudNativePG `Cluster` as an option. Real HA and backups, but needs the
   CNPG operator in the cluster, so it does not fit the one-command trial.
3. Bitnami (or other) PostgreSQL subchart. Rejected: dependency we do not
   control and whose images are no longer freely maintained.

## Design

### Layout

`charts/blokhouse/` with `Chart.yaml` (`version` and `appVersion` equal to
the Blokhouse release, e.g. `0.4.0`), `values.yaml`, `values.schema.json`,
`templates/` and `README.md`. The chart version follows the app version; a
chart-only fix still gets a Blokhouse patch release.

### Blokhouse Deployment

- Deployment, `replicaCount: 1` by default; image
  `ghcr.io/d4sw4r/blokhouse`, tag defaults to `Chart.appVersion`.
- The container runs the image's normal `start.sh` (migrations and seed on
  start; safe with several replicas once the seed takes a lock, see "App
  changes"). No separate
  migration Job: it would duplicate `start.sh` and complicate `helm install
  --wait`.
- Probes on `/api/health`: startup probe with a generous budget (migrations
  on first start), readiness, liveness.
- Security context: non-root (UID 1001), `allowPrivilegeEscalation: false`,
  all capabilities dropped, `seccompProfile: RuntimeDefault`,
  `readOnlyRootFilesystem: true` with `emptyDir` mounts where the app writes
  (`/app/data`, `/app/.next/cache`, `/tmp`); the builder verifies which paths
  need to be writable (including `$HOME` / the npm cache, since `start.sh`
  runs `npx prisma`; set `HOME` and `npm_config_cache` to an `emptyDir`).
- OpenShift (my call): `podSecurityContext` / `securityContext` are fully
  overridable values; `openshift: true` (default false) leaves `runAsUser`,
  `runAsGroup` and `fsGroup` unset for the app and the bundled PostgreSQL so
  the `restricted-v2` SCC can assign a UID. All writable paths are emptyDirs
  or the PVC, so an arbitrary UID works. Documented; not tested on a real
  OpenShift in CI.
- Usual knobs: `resources`, `nodeSelector`, `tolerations`, `affinity`,
  `podAnnotations`, `podLabels`, `extraEnv`, `extraEnvFrom`, `extraVolumes`,
  `extraVolumeMounts`, `imagePullSecrets`, `serviceAccount`.
- Pod annotation with a checksum of the chart's ConfigMap/Secret so changed
  values roll the pods.

### Configuration and secrets

- `blokhouse.url` becomes `NEXTAUTH_URL` (my call on the default): if empty,
  it is the first Ingress/HTTPRoute host (`https://` if TLS is configured for
  it, else `http://`); with neither enabled, `http://localhost:8080`, matching
  the `kubectl port-forward svc/<release> 8080:80` command that `NOTES.txt`
  prints. Plain http there keeps NextAuth's cookies non-Secure, so the
  port-forward login works.
- Plain settings in values map 1:1 to the documented variables:
  `blokhouse.allowSignup`, `passwordLogin`, `sessionMaxAge`,
  `webhookWorker`, `discovery.*`, `admin.email`, and `sso.*` for all `OIDC_*`
  variables. They go into a ConfigMap.
- Secrets (`NEXTAUTH_SECRET`, admin password, `OIDC_CLIENT_SECRET`) go into a
  chart-managed Secret, each with an `existingSecret` + key alternative.
- **Generated values survive upgrades:** when not given, `NEXTAUTH_SECRET`,
  the admin password and the bundled database password are generated once and
  kept: the template reads the existing Secret with `lookup` and reuses its
  values; the Secret carries `helm.sh/resource-policy: keep`. (`lookup` returns
  nothing under `helm template` / dry-run; that is accepted and documented,
  GitOps users set the values or use `existingSecret`.)
- My call: generated secrets end up base64-encoded in the release manifest
  Helm stores (`helm get manifest`). Accepted: whoever can read Helm's release
  Secrets in the namespace can read the app's Secrets anyway. Documented, with
  `existingSecret` as the way to keep them out of Helm entirely.
- The admin password is passed as `ADMIN_PASSWORD`, so it is never written to
  a file; `NOTES.txt` prints the `kubectl get secret …` command to read it,
  with the note that it only applies when the database had no admin yet
  (an existing admin keeps its password; the seed does not change it).

### Database

- `postgresql.enabled: true` (default): StatefulSet `<release>-postgresql`,
  one replica, image `postgres:<pinned 16.x>-alpine` (same major as compose),
  PVC from `postgresql.persistence` (`size: 8Gi`, `storageClass`,
  `existingClaim`), Service, Secret with the generated password, readiness
  via `pg_isready`, non-root security context. The PVC comes from a
  `volumeClaimTemplate`, so `helm uninstall` does not delete it (documented,
  with the command to delete it).
- `postgresql.enabled: false`: `externalDatabase.url` (stored in the Secret)
  or `externalDatabase.existingSecret` + key holding a full `DATABASE_URL`.
  Rendering fails with a clear message when neither is set.
- The app gets `DATABASE_URL` from a Secret in both cases.

### Networking

- Service (ClusterIP, port 80 → 3000).
- `ingress.enabled` (default false): `className`, `annotations`, `hosts`,
  `tls`. Gateway API `HTTPRoute` as `httpRoute.enabled` (default false), since
  newer clusters move to it.

### Optional extras

- `podDisruptionBudget.enabled`, `autoscaling.enabled` (HPA). Both off by
  default.
- No ServiceMonitor: Blokhouse has no metrics endpoint.

### App changes (my call: allowed where the chart needs them)

- `prisma/seed.ts` runs under a PostgreSQL advisory lock
  (`pg_advisory_lock`), so replicas starting together cannot race on
  creating the first admin.
- Image tweaks only if `readOnlyRootFilesystem` needs them (e.g. a writable
  cache location); behaviour under docker compose stays the same.

### Publishing

- `publish.yml` on `v*` tags also packages the chart and pushes it as OCI
  artifact to `oci://ghcr.io/d4sw4r/charts/blokhouse` with the release
  version. Install: `helm install blokhouse oci://ghcr.io/d4sw4r/charts/blokhouse --version 0.4.0`.
- New (my call): `publish.yml` on tag pushes first checks that the tag equals
  `package.json` `version` and `Chart.yaml` `version` and `appVersion`, and
  fails before building otherwise. All three are bumped by hand in the
  release PR, as `package.json` is today; `docs/` or CONTRIBUTING gets a
  short release checklist saying so.

### Tests

- CI (PRs and main): `helm lint`, `helm template` with several value sets
  (defaults, external DB, existing secrets, ingress, HTTPRoute, SSO) checked
  against the schema, plus `kubeconform` validation of the rendered manifests.
- CI install test: a `kind` cluster, the image built from the PR, `helm
  install --wait` with the bundled PostgreSQL, then the existing
  `scripts/smoke-test.sh` against the port-forwarded Service with the admin
  password read from the Secret; then `helm upgrade` with a changed value and
  a check that the admin can still sign in (secrets survived).
- No unit-test framework for templates (helm-unittest) unless the builder
  finds the `helm template` checks insufficient.

### Docs

- `charts/blokhouse/README.md`: values table, quick start, production setup.
- `docs/deployment/kubernetes.md`: quick start, external PostgreSQL (with a
  CloudNativePG example), SSO values, Ingress/TLS, upgrading, uninstall and
  data, backup pointer for the bundled DB (`pg_dump` via `kubectl exec`).
- README deployment section and CHANGELOG entry.

## Left to the builder

- Exact template structure and helper names, values naming details within
  the shape above.
- Which paths must be writable for `readOnlyRootFilesystem`.
- Pinned versions (PostgreSQL patch, kind, helm, kubeconform actions).
- How the CI install job gets the PR image into kind (`kind load`).
