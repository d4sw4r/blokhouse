# Helm Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Helm chart `charts/blokhouse` that installs Blokhouse with an optional bundled PostgreSQL or an external one, tested in a kind cluster in CI and published as an OCI chart with every release.

**Architecture:** Plain Helm templates (no subcharts). The app Deployment runs the image's `start.sh` unchanged; the seed gets an advisory lock so replicas can start together. Generated secrets are kept across upgrades with `lookup` + `helm.sh/resource-policy: keep`. Render behaviour is pinned by vitest tests that run `helm template`; real behaviour by a kind install job in CI.

**Tech Stack:** Helm 3 (chart `apiVersion: v2`, must also work with Helm 4), Kubernetes ≥ 1.29, official `postgres:16-alpine`, vitest + `yaml` for render tests, kubeconform, kind, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-26-helm-chart-design.md`

## Global Constraints

- Chart path `charts/blokhouse`; `Chart.yaml` `version` and `appVersion` equal `package.json` `version` (currently `0.3.0`); the release PR bumps all three by hand.
- Image `ghcr.io/d4sw4r/blokhouse`, tag defaults to `.Chart.AppVersion`; app UID/GID 1001, port 3000; health path `/api/health`.
- Bundled database: one-replica StatefulSet, official `postgres:16.<pinned patch>-alpine`, database and user `blokhouse`, PVC `8Gi` by default, never deleted by `helm uninstall`.
- No third-party subcharts, no CRDs of our own, no CloudNativePG resources.
- Generated secrets: never in logs, `NOTES.txt` or values; reused on upgrade via `lookup`; Secret annotated `helm.sh/resource-policy: keep`.
- `NEXTAUTH_URL` default: `blokhouse.url` → first Ingress/HTTPRoute host (`https://` if that host is in an Ingress `tls` entry, else `http://`) → `http://localhost:8080`.
- Pods must pass the Kubernetes `restricted` Pod Security Standard by default; `openshift: true` drops `runAsUser`, `runAsGroup`, `fsGroup` for app and PostgreSQL.
- OCI destination: `oci://ghcr.io/d4sw4r/charts`, chart name `blokhouse`.
- Docs and code comments in English; no model identifiers anywhere in the repo.

## Review Focus

1. A user-supplied PostgreSQL password with URL-special characters (`p@ss/w:rd%`) must still give a working `DATABASE_URL` (owned by Task 2: render test `encodes special characters in the bundled database password`).
2. `helm upgrade` with unchanged or changed values must keep `NEXTAUTH_SECRET`, the admin password and the DB password, so existing sessions stay valid and the app still reaches its database (Task 4: CI step "Upgrade keeps secrets and sessions").
3. `postgresql.enabled=false` with no external database configured must fail at render time with a clear message, not crash-loop at runtime (Task 2: render test `fails without any database`).
4. Several replicas starting on an empty database must end with exactly one admin and no crash loop (Task 1: integration test `concurrent seeds create one admin`; Task 4 installs with `replicaCount=2`).
5. A fresh install into a namespace enforcing `restricted` with `readOnlyRootFilesystem` must start: every path the app and PostgreSQL write to is an emptyDir or the PVC (Task 4: install into a namespace labelled `pod-security.kubernetes.io/enforce=restricted`).

## Local tooling

`get.helm.sh` is not reachable from the dev container; install Helm with
`go install helm.sh/helm/v3/cmd/helm@v3.19.0` (Go 1.24 is installed; put
`$(go env GOPATH)/bin` on `PATH`), kubeconform from its GitHub release
tarball. Docker has no daemon locally: the kind install (Task 4) is verified
in CI only. Integration tests: PostgreSQL on `127.0.0.1:5433`, database
`bh_test` (`DATABASE_URL=postgresql://postgres@127.0.0.1:5433/bh_test`; start
with `pg_ctl -D /var/tmp/bhpg -o '-p 5433 -k /tmp' start` if it is down).

---

### Task 1: Seed under an advisory lock

**Files:**
- Modify: `prisma/seed.ts`
- Test: `__tests__/integration/seed.test.ts`

**Interfaces:**
- Produces: `prisma db seed` is safe to run concurrently; behaviour otherwise unchanged (idempotent, password file only when generated).

- [ ] **Step 1: Write the failing test** `concurrent seeds create one admin`: `resetDb()`, then spawn two `npx tsx prisma/seed.ts` child processes at the same time with `DATABASE_URL` of the test DB, `ADMIN_EMAIL=seed@test.io`, `ADMIN_PASSWORD=seed-password-1`; await both. Assert both exit codes are `0` and `prisma.user.count({ where: { role: "ADMIN" } })` is `1`. Second test `seed is a no-op when an admin exists`: create an ADMIN, run one seed with `ADMIN_PASSWORD=other-password`, assert exit `0` and the existing admin's password hash unchanged. Timeout 60 s per test.
- [ ] **Step 2: Run** `DATABASE_URL=… npx vitest run --config vitest.integration.config.js __tests__/integration/seed.test.ts`. Expected: the concurrent test FAILS (a process exits 1 with a unique-constraint error, or two admins). To make the race reliable, the test runs the concurrent pair 5 times in a loop (`resetDb()` before each round) and asserts every round.
- [ ] **Step 3: Implement** in `prisma/seed.ts`: hash the password before opening a transaction, then do the admin check, password-file write and upsert inside `prisma.$transaction(async (tx) => { await tx.$executeRaw\`SELECT pg_advisory_xact_lock(724300001)\`; … }, { timeout: 30_000 })`. The lock key `724300001` is a constant with a comment. Keep "write the password file before creating the user".
- [ ] **Step 4: Run** the seed test and the full integration suite. Expected: all PASS.
- [ ] **Step 5: Commit** `fix(seed): take an advisory lock so replicas can seed concurrently`.

### Task 2: Chart core (app, secrets, bundled and external database)

**Files:**
- Create: `charts/blokhouse/Chart.yaml`, `values.yaml`, `values.schema.json`, `.helmignore`, `templates/_helpers.tpl`, `templates/deployment.yaml`, `templates/service.yaml`, `templates/configmap.yaml`, `templates/secret.yaml`, `templates/serviceaccount.yaml`, `templates/postgresql-statefulset.yaml`, `templates/postgresql-service.yaml`, `templates/postgresql-secret.yaml`, `templates/NOTES.txt`
- Create: `vitest.helm.config.js`, `__tests__/helm/render.ts` (helper), `__tests__/helm/chart.test.ts`
- Modify: `vitest.config.js` (exclude `__tests__/helm/**`), `package.json` (script `"test:helm": "vitest run --config vitest.helm.config.js"`, devDependency `yaml`)

**Interfaces:**
- Produces (values, exact keys; defaults in brackets):
  - `image.repository` [`ghcr.io/d4sw4r/blokhouse`], `image.tag` [`""` → appVersion], `image.pullPolicy` [`IfNotPresent`], `imagePullSecrets` [`[]`], `replicaCount` [`1`]
  - `blokhouse.url` [`""`], `blokhouse.existingSecret` [`""`; keys `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, `OIDC_CLIENT_SECRET`, each optional], `blokhouse.nextauthSecret` [`""`], `blokhouse.allowSignup` [`false`], `blokhouse.passwordLogin` [`true`], `blokhouse.sessionMaxAge` [`""`], `blokhouse.webhookWorker` [`true`]
  - `blokhouse.admin.email` [`admin@example.com`], `blokhouse.admin.password` [`""`]
  - `blokhouse.discovery.enabled` [`false`], `blokhouse.discovery.subnet` [`""`]
  - `blokhouse.sso.issuer`, `clientId`, `clientSecret`, `name`, `scopes`, `roleClaim`, `roleMap`, `defaultRole`, `trustEmail`, `tokenMaxDays` [all `""`; emitted as `OIDC_*` only when non-empty]
  - `postgresql.enabled` [`true`], `postgresql.image.repository` [`postgres`], `postgresql.image.tag` [`16.<patch>-alpine`], `postgresql.auth.database` / `username` [`blokhouse`], `postgresql.auth.password` [`""`], `postgresql.auth.existingSecret` [`""`; key `password`], `postgresql.persistence.size` [`8Gi`], `.storageClass` [`""`], `.existingClaim` [`""`], `postgresql.resources` [`{}`]
  - `externalDatabase.url` [`""`], `externalDatabase.existingSecret` [`""`], `externalDatabase.existingSecretKey` [`DATABASE_URL`]
  - `service.type` [`ClusterIP`], `service.port` [`80`]
  - `openshift` [`false`], `podSecurityContext`, `securityContext`, `resources`, `nodeSelector`, `tolerations`, `affinity`, `podAnnotations`, `podLabels`, `extraEnv`, `extraEnvFrom`, `extraVolumes`, `extraVolumeMounts`, `serviceAccount.create` [`true`] / `.name` / `.annotations`
- Produces (helpers): `blokhouse.fullname`, `blokhouse.labels`, `blokhouse.selectorLabels`, `blokhouse.url` (returns the effective `NEXTAUTH_URL`; this task implements only `blokhouse.url` → `http://localhost:8080`, Task 3 adds the host rules), `blokhouse.postgresql.fullname` (= `<fullname>-postgresql`).
- Produces (objects): Secret `<fullname>` with keys `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, `OIDC_CLIENT_SECRET` (only those not taken from `existingSecret`; the last only when set) and `DATABASE_URL` (unless `externalDatabase.existingSecret`); Secret `<fullname>-postgresql` key `password`; ConfigMap `<fullname>` with the plain variables.
- Produces (test helper): `renderChart(values: object, release = "bh"): Array<object>` (runs `helm template <release> charts/blokhouse -f <tmpfile>`, parses all docs with `yaml`), `renderError(values): string` (stderr of a failing render), `find(docs, kind, name?)`.

- [ ] **Step 1: Write the failing render tests** in `__tests__/helm/chart.test.ts`:
  - `defaults`: kinds include Deployment `bh-blokhouse`, Service, ConfigMap, Secret `bh-blokhouse`, StatefulSet `bh-blokhouse-postgresql`, Service `bh-blokhouse-postgresql`, Secret `bh-blokhouse-postgresql`; container image `ghcr.io/d4sw4r/blokhouse:0.3.0`; ConfigMap `NEXTAUTH_URL` = `http://localhost:8080`, `ADMIN_EMAIL` = `admin@example.com`, `ALLOW_SIGNUP` = `"false"`; both Secrets carry annotation `helm.sh/resource-policy: keep`; decoded `NEXTAUTH_SECRET` length ≥ 32; decoded `DATABASE_URL` matches `^postgresql://blokhouse:[A-Za-z0-9]+@bh-blokhouse-postgresql:5432/blokhouse$` and its password equals the decoded `password` of the postgresql Secret; the StatefulSet has a `volumeClaimTemplates` entry of `8Gi`.
  - `security context`: app container has `runAsNonRoot: true`, `runAsUser: 1001`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `seccompProfile.type: RuntimeDefault`, `readOnlyRootFilesystem: true`; emptyDir mounts at `/app/data`, `/app/.next/cache`, `/tmp`; env `HOME=/tmp` and `npm_config_cache=/tmp/.npm`; PostgreSQL container `runAsNonRoot: true`, `runAsUser: 70`, `readOnlyRootFilesystem: true`, emptyDir at `/var/run/postgresql` and `/tmp`, env `PGDATA=/var/lib/postgresql/data/pgdata`.
  - `probes`: startup, readiness and liveness probes on `/api/health` port `http` (3000); startup probe allows ≥ 300 s.
  - `encodes special characters in the bundled database password`: `postgresql.auth.password: "p@ss/w:rd%"` → `DATABASE_URL` contains `p%40ss%2Fw%3Ard%25`.
  - `external database url`: `postgresql.enabled: false`, `externalDatabase.url: postgresql://u:p@db:5432/x` → no StatefulSet, Secret `DATABASE_URL` equals it.
  - `external database secret`: `externalDatabase.existingSecret: pg-app` → env `DATABASE_URL` has `valueFrom.secretKeyRef {name: pg-app, key: DATABASE_URL}`; chart Secret has no `DATABASE_URL`.
  - `fails without any database`: `postgresql.enabled: false` alone → `renderError` contains `Set externalDatabase.url or externalDatabase.existingSecret when postgresql.enabled=false`.
  - `existing app secret`: `blokhouse.existingSecret: bh-keys` → env `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, `OIDC_CLIENT_SECRET` reference `bh-keys` (`optional: true` for the last two); chart Secret has none of them.
  - `sso`: issuer/clientId/clientSecret/roleMap set → ConfigMap has `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_ROLE_MAP`; no `OIDC_NAME` key when `name` is empty; `OIDC_CLIENT_SECRET` only in the Secret.
  - `config checksum rolls pods`: the Deployment pod annotation `checksum/config` differs between renders with `allowSignup` false and true.
  - `schema rejects a typo`: `{ replicaCount: "two" }` → render error mentions `replicaCount`.
- [ ] **Step 2: Run** `npm run test:helm`. Expected: FAIL (chart missing).
- [ ] **Step 3: Implement the chart.** Notes the tests leave open:
  - Generated values: `randAlphaNum 48` for `NEXTAUTH_SECRET`, `randAlphaNum 24` for admin and DB passwords; read the existing Secret with `lookup "v1" "Secret" .Release.Namespace <name>` and reuse its `data` keys when present.
  - Build `DATABASE_URL` with `urlquery` on user and password; `required`/`fail` for the no-database message.
  - Secret keys are injected with `env[].valueFrom.secretKeyRef` (not `envFrom`), so `existingSecret` can override single keys; the ConfigMap via `envFrom`.
  - PostgreSQL: `fsGroup: 70`, readiness `pg_isready -U blokhouse -d blokhouse`, env `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (from its Secret), `PGDATA` as above; `existingClaim` replaces the `volumeClaimTemplates` with a plain volume.
  - `values.schema.json`: types for every key above, `additionalProperties: false` at top level.
  - `NOTES.txt`: port-forward command `kubectl port-forward svc/<fullname> 8080:80`, the `kubectl get secret <fullname> -o jsonpath='{.data.ADMIN_PASSWORD}' | base64 -d` command (or the `existingSecret` name), and the sentence "This password only applies if the database had no administrator yet."
- [ ] **Step 4: Run** `npm run test:helm`, `helm lint charts/blokhouse`, `npm test` (unit suite must still exclude helm tests). Expected: all PASS, lint `0 chart(s) failed`.
- [ ] **Step 5: Commit** `feat(helm): chart with app, secrets and optional bundled PostgreSQL`.

### Task 3: Networking, URL derivation and optional extras

**Files:**
- Create: `charts/blokhouse/templates/ingress.yaml`, `httproute.yaml`, `pdb.yaml`, `hpa.yaml`
- Modify: `charts/blokhouse/values.yaml`, `values.schema.json`, `templates/_helpers.tpl` (`blokhouse.url`), `templates/deployment.yaml`, `templates/postgresql-statefulset.yaml`
- Test: `__tests__/helm/chart.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers and test helper.
- Produces (values): `ingress.enabled` [`false`], `ingress.className`, `ingress.annotations`, `ingress.hosts` [`[{host: blokhouse.local, paths: [{path: /, pathType: Prefix}]}]`], `ingress.tls` [`[]`]; `httpRoute.enabled` [`false`], `httpRoute.parentRefs` [`[]`], `httpRoute.hostnames` [`[]`], `httpRoute.annotations`; `podDisruptionBudget.enabled` [`false`], `.minAvailable` [`1`]; `autoscaling.enabled` [`false`], `.minReplicas` [`1`], `.maxReplicas` [`3`], `.targetCPUUtilizationPercentage` [`80`].

- [ ] **Step 1: Write the failing tests:**
  - `url from ingress with tls`: ingress host `cmdb.example.com` listed in `tls[0].hosts` → `NEXTAUTH_URL` `https://cmdb.example.com`; without tls → `http://cmdb.example.com`.
  - `url from httproute`: `httpRoute.enabled`, `hostnames: [cmdb.example.com]` → `NEXTAUTH_URL` `https://cmdb.example.com` (Gateway TLS is not visible to the chart; https assumed, documented).
  - `explicit url wins`: `blokhouse.url: https://x.example.com` plus ingress → `https://x.example.com`.
  - `ingress`: Ingress with `ingressClassName`, rule backend Service `bh-blokhouse` port `http`.
  - `httproute`: `gateway.networking.k8s.io/v1` HTTPRoute with given `parentRefs` and `hostnames`, backendRef `bh-blokhouse` port `80`.
  - `hpa`: `autoscaling.enabled` → HPA `autoscaling/v2` with min/max/CPU target, Deployment has no `replicas` field.
  - `pdb`: enabled → PodDisruptionBudget `minAvailable: 1` with the app selector labels.
  - `openshift`: `openshift: true` → neither app nor PostgreSQL pod/container security contexts contain `runAsUser`, `runAsGroup` or `fsGroup`; `runAsNonRoot` and `readOnlyRootFilesystem` remain.
- [ ] **Step 2: Run** `npm run test:helm`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** templates and the `blokhouse.url` order from Global Constraints.
- [ ] **Step 4: Run** `npm run test:helm` and `helm lint charts/blokhouse`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(helm): ingress, HTTPRoute, PDB, HPA and OpenShift switch`.

### Task 4: CI: lint, schema validation and a real install in kind

**Files:**
- Create: `charts/blokhouse/ci/default-values.yaml`, `external-db-values.yaml`, `existing-secrets-values.yaml`, `ingress-values.yaml`, `httproute-values.yaml`, `sso-values.yaml`, `openshift-values.yaml`; `scripts/helm/kind-test.sh`
- Modify: `.github/workflows/ci.yml` (new job `helm`); chart or `Dockerfile` only where the install shows a writable path is missing

**Interfaces:**
- Consumes: the chart (Tasks 2–3), `scripts/smoke-test.sh` (needs `BASE_URL`, `ADMIN_PASSWORD`, `node`, `curl`).
- Produces: `scripts/helm/kind-test.sh <image>` runs against the current kube context; exits non-zero on any failure.

- [ ] **Step 1: Write the CI value files** (one per scenario named above, each minimal and valid on its own) and `kind-test.sh` doing, in order:
  1. `kubectl create namespace bh` and label it `pod-security.kubernetes.io/enforce=restricted`.
  2. `helm install bh charts/blokhouse -n bh --set image.repository=<repo> --set image.tag=<tag> --set image.pullPolicy=Never --set replicaCount=2 --wait --timeout 10m`.
  3. Port-forward `svc/bh-blokhouse 8080:80`, read `ADMIN_PASSWORD` from Secret `bh-blokhouse`, run `BASE_URL=http://localhost:8080 sh scripts/smoke-test.sh`.
  4. Assert exactly one ADMIN: `kubectl exec bh-blokhouse-postgresql-0 -- psql -U blokhouse -tAc "select count(*) from \"User\" where role='ADMIN'"` = `1`.
  5. "Upgrade keeps secrets and sessions": save the Secret's `data` and a logged-in cookie jar (csrf + credentials login as in `smoke-test.sh`); `helm upgrade bh … --reuse-values --set blokhouse.allowSignup=true --wait`; assert the Secret `data` is byte-identical, `GET /api/dashboard` with the old cookie jar is `200`, and a fresh login still works.
  6. `helm uninstall bh -n bh`; assert PVC `data-bh-blokhouse-postgresql-0` still exists.
  On failure print `kubectl get pods,events -n bh` and the logs of all pods.
- [ ] **Step 2: Add the `helm` job** to `ci.yml` (`needs: build`, ubuntu-latest), pinned actions: `azure/setup-helm` (Helm 3.19.x), `helm/kind-action` (pinned kind and node image ≥ 1.29), Node 24 setup, `npm ci`. Steps: `helm lint charts/blokhouse`; `helm lint` with each `ci/*-values.yaml`; `npm run test:helm`; `helm template` with each value file piped into `kubeconform -strict -summary -ignore-missing-schemas -kubernetes-version <node version>` (HTTPRoute is then skipped or validated with the Gateway API schema location; either is fine); `docker build -t ghcr.io/d4sw4r/blokhouse:ci .`; `kind load docker-image ghcr.io/d4sw4r/blokhouse:ci`; `sh scripts/helm/kind-test.sh ghcr.io/d4sw4r/blokhouse:ci`.
- [ ] **Step 3: Push the branch and open the PR** (needed to run the job; see Execution notes). Expected first result: the install either passes or fails on a missing writable path or PSA violation.
- [ ] **Step 4: Fix what the run shows** — add emptyDirs or image changes for writable paths, never weaken the `restricted` label or drop `readOnlyRootFilesystem`; for an image change keep docker compose behaviour identical (the `docker` job must stay green). Add a render-test assertion for every mount you add. Repeat until the `helm` job is green.
- [ ] **Step 5: Commit** each fix with a message naming the path, e.g. `fix(helm): writable <path> for read-only root filesystem`.

### Task 5: Publishing and the release version check

**Files:**
- Create: `scripts/check-release-version.mjs`, `__tests__/release-version.test.js`
- Modify: `.github/workflows/publish.yml`, `CONTRIBUTING.md` (section "Releasing")

**Interfaces:**
- Produces: `checkReleaseVersion(tag: string, pkgVersion: string, chartVersion: string, appVersion: string): string[]` (exported, returns error messages, empty when all equal `tag` without `v`); CLI `node scripts/check-release-version.mjs <tag>` reads `package.json` and `charts/blokhouse/Chart.yaml` (via `yaml`), prints errors, exits 1 on any.

- [ ] **Step 1: Write the failing tests:** `v0.4.0` with all three `0.4.0` → `[]`; `package.json` `0.3.0` → one message containing `package.json version 0.3.0 does not match tag v0.4.0`; chart `version` and `appVersion` mismatches give one message each naming `Chart.yaml version` / `Chart.yaml appVersion`; tag without `v` (`0.4.0`) → message `tag must look like vX.Y.Z`.
- [ ] **Step 2: Run** `npx vitest run __tests__/release-version.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the script; in `publish.yml` add a first step to `build_publish`, only for tag pushes: `node scripts/check-release-version.mjs "$GITHUB_REF_NAME"`. Add job `chart` (`needs: build_publish`, tag pushes only, `packages: write`): `azure/setup-helm`, `helm registry login ghcr.io -u ${{ github.actor }} --password-stdin` with `GITHUB_TOKEN`, `helm package charts/blokhouse`, `helm push blokhouse-<version>.tgz oci://ghcr.io/${{ github.repository_owner }}/charts`. `release` additionally `needs: chart` with the same `always()` guard extended so a failed chart push fails the release.
- [ ] **Step 4: Run** the test file and `npm test`. Expected: PASS. Validate the workflow YAML parses (`node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/publish.yml','utf8'))"`).
- [ ] **Step 5: Write the release checklist** in `CONTRIBUTING.md`: bump `package.json`, `charts/blokhouse/Chart.yaml` `version` and `appVersion`, move the CHANGELOG `Unreleased` section to `## [X.Y.Z] - date`, merge, tag `vX.Y.Z`; the workflow refuses mismatched versions.
- [ ] **Step 6: Commit** `ci: version check and OCI chart publishing on release`.

### Task 6: Documentation

**Files:**
- Create: `charts/blokhouse/README.md`, `docs/deployment/kubernetes.md`
- Modify: `README.md` (deployment section), `CHANGELOG.md` (`Unreleased` → `Added`), `docs/configuration.md` (pointer to the chart values)

- [ ] **Step 1: Write `charts/blokhouse/README.md`**: quick start `helm install blokhouse oci://ghcr.io/d4sw4r/charts/blokhouse --version <version>`, values table for every key from Tasks 2–3 with default and meaning, mapping to the env variables.
- [ ] **Step 2: Write `docs/deployment/kubernetes.md`** covering, in this order:
  - quick start with port-forward and reading the admin password (and that it only applies to an empty database);
  - what the bundled PostgreSQL is for (trying out, small installations; single instance, no HA or backup) and a backup command (`kubectl exec … pg_dump`);
  - production with an external database, including a CloudNativePG example (`Cluster` manifest and `externalDatabase.existingSecret: <cluster>-app` with key `uri`);
  - Ingress/TLS and HTTPRoute (https is assumed for HTTPRoute hosts; set `blokhouse.url` otherwise);
  - SSO values with the callback URL `<url>/api/auth/callback/oidc`;
  - secrets: generated once and kept, visible in Helm's release data, `existingSecret` to keep them out of Helm, and `helm template`/GitOps needing explicit values or `existingSecret`;
  - OpenShift (`openshift: true`);
  - upgrading;
  - uninstall and the PVC that stays, with the delete command;
  - the `restricted` Pod Security default.
- [ ] **Step 3: Update** `README.md`, `CHANGELOG.md` (one `Added` entry: Helm chart with optional bundled PostgreSQL, published to `oci://ghcr.io/d4sw4r/charts/blokhouse`; one `Fixed` entry: concurrent seeds no longer race), `docs/configuration.md`.
- [ ] **Step 4: Check links** with `grep -o '](\S*)' docs/deployment/kubernetes.md charts/blokhouse/README.md` and confirm each relative target exists.
- [ ] **Step 5: Commit** `docs: Kubernetes deployment with the Helm chart`.

## Execution notes

- Branch: `feat/helm-chart` (exists, holds the design commit).
- Task 4 needs CI: push after Task 3 and open the PR to `main` then (CI runs only on PRs to main and pushes to main); later tasks push onto the same PR.
