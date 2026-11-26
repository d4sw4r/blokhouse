# Blokhouse Helm chart

Installs [Blokhouse](https://github.com/d4sw4r/blokhouse), a simple, automation-first open source CMDB, into Kubernetes. By default the chart also starts a single-instance PostgreSQL, so one command gives you a working installation. For production, point it at your own PostgreSQL.

The full guide (production database, Ingress, SSO, OpenShift, upgrading, uninstall) is [docs/deployment/kubernetes.md](../../docs/deployment/kubernetes.md).

## Quick start

```bash
helm install blokhouse oci://ghcr.io/d4sw4r/charts/blokhouse --version <version> \
  --namespace blokhouse --create-namespace
```

The chart is published to `oci://ghcr.io/d4sw4r/charts/blokhouse` from the next Blokhouse release on, with the same version as the release. Until then, install from a git checkout:

```bash
git clone https://github.com/d4sw4r/blokhouse.git
helm install blokhouse ./blokhouse/charts/blokhouse --namespace blokhouse --create-namespace
```

A git checkout installs the released Blokhouse 0.3.0 image (the chart `appVersion`), which has no SSO and no seed lock. Until the next release, `blokhouse.sso.*`, `blokhouse.passwordLogin` and `blokhouse.sessionMaxAge` are ignored, and you should keep `replicaCount: 1`.

The notes printed after the install show the port-forward command and how to read the initial administrator password.

## Values

Pass values with `--set key=value` or `-f my-values.yaml`. Empty strings mean "not set". Settings that map to a Blokhouse environment variable are described in [docs/configuration.md](../../docs/configuration.md).

### Image and pods

| Key | Default | Description |
| --- | --- | --- |
| `image.repository` | `ghcr.io/d4sw4r/blokhouse` | Image repository. |
| `image.tag` | `""` | Image tag. Empty: the chart's `appVersion`. |
| `image.pullPolicy` | `IfNotPresent` | Image pull policy. |
| `imagePullSecrets` | `[]` | Secrets for pulling the image. |
| `replicaCount` | `1` | Number of app pods. Several replicas are safe once the next release is installed (see above). Ignored when `autoscaling.enabled` is true. |
| `resources` | `{}` | Resource requests and limits of the app container. |
| `nodeSelector`, `tolerations`, `affinity` | `{}`, `[]`, `{}` | Pod scheduling. |
| `podAnnotations`, `podLabels` | `{}` | Extra annotations and labels of the app pods. |
| `podSecurityContext`, `securityContext` | non-root UID 1001, read-only root filesystem, all capabilities dropped, `RuntimeDefault` seccomp | Pod and container security context. The defaults pass the `restricted` Pod Security Standard. |
| `openshift` | `false` | `true` drops `runAsUser`, `runAsGroup` and `fsGroup` from the app and the bundled PostgreSQL so OpenShift's `restricted-v2` SCC assigns the UID. |
| `extraEnv` | `[]` | Extra container environment entries, e.g. `[{name: TZ, value: Europe/Berlin}]`. |
| `extraEnvFrom` | `[]` | Extra `envFrom` sources, e.g. `[{secretRef: {name: more-settings}}]`. |
| `extraVolumes`, `extraVolumeMounts` | `[]` | Extra volumes and mounts of the app container. |
| `serviceAccount.create` | `true` | Create a ServiceAccount. |
| `serviceAccount.name` | `""` | ServiceAccount name. Empty: the release's full name (`default` when `create` is false). |
| `serviceAccount.annotations` | `{}` | ServiceAccount annotations. |

### Blokhouse settings

| Key | Default | Environment variable | Description |
| --- | --- | --- | --- |
| `blokhouse.url` | `""` | `NEXTAUTH_URL` | Public URL. Empty: the first Ingress host (`https://` if the host is in an Ingress `tls` entry, else `http://`), else the first `httpRoute.hostnames` entry (always `https://`), else `http://localhost:8080`. |
| `blokhouse.existingSecret` | `""` | | Existing Secret with the keys `NEXTAUTH_SECRET` (required), `ADMIN_PASSWORD` and `OIDC_CLIENT_SECRET` (both optional). The chart then manages none of these three; `blokhouse.nextauthSecret`, `blokhouse.admin.password` and `blokhouse.sso.clientSecret` are ignored. |
| `blokhouse.nextauthSecret` | `""` | `NEXTAUTH_SECRET` | Empty: generated once and kept on upgrades. |
| `blokhouse.allowSignup` | `false` | `ALLOW_SIGNUP` | Public self-registration. |
| `blokhouse.passwordLogin` | `true` | `PASSWORD_LOGIN` | `false` turns off password login (requires SSO). |
| `blokhouse.sessionMaxAge` | `""` | `SESSION_MAX_AGE` | Session lifetime in seconds. Empty: the app default (30 days). |
| `blokhouse.webhookWorker` | `true` | `WEBHOOK_WORKER` | Send webhooks from this release's pods. |
| `blokhouse.admin.email` | `admin@example.com` | `ADMIN_EMAIL` | Initial administrator. Only used while the database has no administrator. |
| `blokhouse.admin.password` | `""` | `ADMIN_PASSWORD` | Empty: generated once and kept on upgrades. |
| `blokhouse.discovery.enabled` | `false` | `DISCOVERY_ENABLED` | Network discovery. Needs `nmap` and raw sockets, which the image and the default security context do not provide. |
| `blokhouse.discovery.subnet` | `""` | `NETWORK_SUBNET` | Default discovery subnet. |
| `blokhouse.sso.issuer` | `""` | `OIDC_ISSUER` | OIDC issuer URL. |
| `blokhouse.sso.clientId` | `""` | `OIDC_CLIENT_ID` | OIDC client ID. |
| `blokhouse.sso.clientSecret` | `""` | `OIDC_CLIENT_SECRET` | OIDC client secret, stored in the chart's Secret. Use `blokhouse.existingSecret` to keep it out of Helm. |
| `blokhouse.sso.name` | `""` | `OIDC_NAME` | Label of the sign-in button. |
| `blokhouse.sso.scopes` | `""` | `OIDC_SCOPES` | Scopes to request. |
| `blokhouse.sso.roleClaim` | `""` | `OIDC_ROLE_CLAIM` | ID token claim with groups or roles. |
| `blokhouse.sso.roleMap` | `""` | `OIDC_ROLE_MAP` | `value=ROLE,...` mapping of claim values to roles. |
| `blokhouse.sso.defaultRole` | `""` | `OIDC_DEFAULT_ROLE` | Role of new users when `roleMap` is empty. |
| `blokhouse.sso.trustEmail` | `""` | `OIDC_TRUST_EMAIL` | Treat the `email` claim as verified. |
| `blokhouse.sso.tokenMaxDays` | `""` | `OIDC_TOKEN_MAX_DAYS` | Maximum lifetime of API tokens of SSO users. |

Each `blokhouse.sso.*` value that is empty is not passed to the app, so its default from [docs/configuration.md](../../docs/configuration.md) applies.

### Database

| Key | Default | Description |
| --- | --- | --- |
| `postgresql.enabled` | `true` | Run the bundled single-instance PostgreSQL (StatefulSet). Set to `false` to use `externalDatabase`. |
| `postgresql.image.repository` | `postgres` | PostgreSQL image repository. |
| `postgresql.image.tag` | `16.16-alpine` | PostgreSQL image tag. Do not change the major version in place. |
| `postgresql.auth.database` | `blokhouse` | Database name. |
| `postgresql.auth.username` | `blokhouse` | Database user. |
| `postgresql.auth.password` | `""` | Empty: generated once and kept on upgrades. PostgreSQL sets the password only when it initialises the data directory, so changing this value later does not change the password inside the database. |
| `postgresql.auth.existingSecret` | `""` | Existing Secret with the key `password`. The password must be URL-safe (letters, digits, `-`, `.`, `_`, `~`): it is inserted into `DATABASE_URL` unencoded. |
| `postgresql.persistence.size` | `8Gi` | Size of the data volume. |
| `postgresql.persistence.storageClass` | `""` | StorageClass. Empty: the cluster default. |
| `postgresql.persistence.existingClaim` | `""` | Existing PersistentVolumeClaim, used instead of the one the chart creates. |
| `postgresql.resources` | `{}` | Resource requests and limits of the PostgreSQL container. |
| `externalDatabase.url` | `""` | Full `postgresql://` URL. Stored in the chart's Secret. Only used with `postgresql.enabled=false`. |
| `externalDatabase.existingSecret` | `""` | Existing Secret holding the URL. Only used with `postgresql.enabled=false`; takes precedence over `url`. |
| `externalDatabase.existingSecretKey` | `DATABASE_URL` | Key in that Secret (`uri` for a CloudNativePG `<cluster>-app` Secret). |

With `postgresql.enabled=false`, rendering fails unless `externalDatabase.url` or `externalDatabase.existingSecret` is set.

### Networking and availability

| Key | Default | Description |
| --- | --- | --- |
| `service.type` | `ClusterIP` | Service type. |
| `service.port` | `80` | Service port (the app listens on 3000). |
| `ingress.enabled` | `false` | Create an Ingress. |
| `ingress.className` | `""` | IngressClass. |
| `ingress.annotations` | `{}` | Ingress annotations. |
| `ingress.hosts` | one host `blokhouse.local`, path `/`, `Prefix` | Hosts and paths. |
| `ingress.tls` | `[]` | TLS entries, e.g. `[{secretName: blokhouse-tls, hosts: [cmdb.example.com]}]`. |
| `httpRoute.enabled` | `false` | Create a Gateway API HTTPRoute (needs the Gateway API CRDs and a Gateway). |
| `httpRoute.parentRefs` | `[]` | Gateways to attach to, e.g. `[{name: my-gateway, namespace: infra}]`. |
| `httpRoute.hostnames` | `[]` | Hostnames. The first one becomes the default `NEXTAUTH_URL`, assumed to be `https`. |
| `httpRoute.annotations` | `{}` | HTTPRoute annotations. |
| `podDisruptionBudget.enabled` | `false` | Create a PodDisruptionBudget. |
| `podDisruptionBudget.minAvailable` | `1` | Pods that must stay available. With one replica, `1` blocks node drains. |
| `autoscaling.enabled` | `false` | Create a HorizontalPodAutoscaler. Needs `resources.requests.cpu`. |
| `autoscaling.minReplicas` | `1` | Minimum replicas. |
| `autoscaling.maxReplicas` | `3` | Maximum replicas. |
| `autoscaling.targetCPUUtilizationPercentage` | `80` | CPU target. |

## What stays after `helm uninstall`

The Secrets the chart generates (annotated `helm.sh/resource-policy: keep`) and the bundled PostgreSQL's PersistentVolumeClaim are not deleted. Without them a reinstall would not be able to open the old data. See [Uninstall](../../docs/deployment/kubernetes.md#uninstall) for the commands to remove everything.
