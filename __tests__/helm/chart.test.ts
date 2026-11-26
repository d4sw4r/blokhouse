// Render tests for charts/blokhouse (`npm run test:helm`, needs helm).
import { describe, expect, it } from "vitest";
import { find, K8sObject, renderChart, renderError } from "./render";

const decode = (secret: K8sObject, key: string): string =>
    Buffer.from(secret.data[key], "base64").toString("utf8");

const appContainer = (docs: K8sObject[]): K8sObject =>
    find(docs, "Deployment", "bh-blokhouse")!.spec.template.spec.containers[0];

const pgContainer = (docs: K8sObject[]): K8sObject =>
    find(docs, "StatefulSet", "bh-blokhouse-postgresql")!.spec.template.spec.containers[0];

const env = (container: K8sObject, name: string): K8sObject | undefined =>
    container.env?.find((e: K8sObject) => e.name === name);

// Paths of the container's volume mounts that are backed by an emptyDir.
function emptyDirMounts(podSpec: K8sObject, container: K8sObject): string[] {
    const emptyDirs = new Set(
        podSpec.volumes.filter((v: K8sObject) => v.emptyDir).map((v: K8sObject) => v.name),
    );
    return container.volumeMounts
        .filter((m: K8sObject) => emptyDirs.has(m.name))
        .map((m: K8sObject) => m.mountPath);
}

describe("helm chart", () => {
    it("defaults", () => {
        const docs = renderChart({});
        for (const [kind, name] of [
            ["Deployment", "bh-blokhouse"],
            ["Service", "bh-blokhouse"],
            ["ConfigMap", "bh-blokhouse"],
            ["Secret", "bh-blokhouse"],
            ["StatefulSet", "bh-blokhouse-postgresql"],
            ["Service", "bh-blokhouse-postgresql"],
            ["Secret", "bh-blokhouse-postgresql"],
        ]) {
            expect(find(docs, kind, name), `${kind} ${name}`).toBeDefined();
        }

        expect(appContainer(docs).image).toBe("ghcr.io/d4sw4r/blokhouse:0.5.0");

        const config = find(docs, "ConfigMap", "bh-blokhouse")!.data;
        expect(config.NEXTAUTH_URL).toBe("http://localhost:8080");
        expect(config.ADMIN_EMAIL).toBe("admin@example.com");
        expect(config.ALLOW_SIGNUP).toBe("false");

        const secret = find(docs, "Secret", "bh-blokhouse")!;
        const pgSecret = find(docs, "Secret", "bh-blokhouse-postgresql")!;
        for (const s of [secret, pgSecret]) {
            expect(s.metadata.annotations["helm.sh/resource-policy"]).toBe("keep");
        }
        expect(decode(secret, "NEXTAUTH_SECRET").length).toBeGreaterThanOrEqual(32);

        const url = decode(secret, "DATABASE_URL");
        const match = url.match(/^postgresql:\/\/blokhouse:([A-Za-z0-9]+)@bh-blokhouse-postgresql:5432\/blokhouse$/);
        expect(match, url).not.toBeNull();
        expect(match![1]).toBe(decode(pgSecret, "password"));

        const sts = find(docs, "StatefulSet", "bh-blokhouse-postgresql")!;
        expect(sts.spec.volumeClaimTemplates).toHaveLength(1);
        expect(sts.spec.volumeClaimTemplates[0].metadata.name).toBe("data");
        expect(sts.spec.volumeClaimTemplates[0].spec.resources.requests.storage).toBe("8Gi");
    });

    it("security context", () => {
        const docs = renderChart({});
        const app = appContainer(docs);
        expect(app.securityContext).toMatchObject({
            runAsNonRoot: true,
            runAsUser: 1001,
            allowPrivilegeEscalation: false,
            capabilities: { drop: ["ALL"] },
            seccompProfile: { type: "RuntimeDefault" },
            readOnlyRootFilesystem: true,
        });
        const appPod = find(docs, "Deployment", "bh-blokhouse")!.spec.template.spec;
        expect(emptyDirMounts(appPod, app)).toEqual(
            expect.arrayContaining(["/app/data", "/app/.next/cache", "/tmp"]),
        );
        expect(env(app, "HOME")?.value).toBe("/tmp");
        expect(env(app, "npm_config_cache")?.value).toBe("/tmp/.npm");

        const pg = pgContainer(docs);
        expect(pg.securityContext).toMatchObject({
            runAsNonRoot: true,
            runAsUser: 70,
            readOnlyRootFilesystem: true,
        });
        const pgPod = find(docs, "StatefulSet", "bh-blokhouse-postgresql")!.spec.template.spec;
        expect(emptyDirMounts(pgPod, pg)).toEqual(expect.arrayContaining(["/var/run/postgresql", "/tmp"]));
        expect(env(pg, "PGDATA")?.value).toBe("/var/lib/postgresql/data/pgdata");
    });

    it("probes", () => {
        const app = appContainer(renderChart({}));
        expect(app.ports).toContainEqual(expect.objectContaining({ name: "http", containerPort: 3000 }));
        for (const probe of ["startupProbe", "readinessProbe"]) {
            expect(app[probe]?.httpGet, probe).toMatchObject({ path: "/api/health", port: "http" });
        }
        // Liveness must not depend on the database, or an outage restarts every pod.
        expect(app.livenessProbe.tcpSocket).toMatchObject({ port: "http" });
        expect(app.livenessProbe.httpGet).toBeUndefined();
        const startup = app.startupProbe;
        expect((startup.initialDelaySeconds ?? 0) + startup.periodSeconds * startup.failureThreshold)
            .toBeGreaterThanOrEqual(300);
    });

    it("encodes special characters in the bundled database password", () => {
        const docs = renderChart({ postgresql: { auth: { password: "p@ss/w:rd%" } } });
        const url = decode(find(docs, "Secret", "bh-blokhouse")!, "DATABASE_URL");
        expect(url).toContain("p%40ss%2Fw%3Ard%25");
        expect(decode(find(docs, "Secret", "bh-blokhouse-postgresql")!, "password")).toBe("p@ss/w:rd%");
    });

    it("encodes spaces in the bundled database credentials as %20", () => {
        const docs = renderChart({ postgresql: { auth: { username: "u s", password: "p w+" } } });
        const url = decode(find(docs, "Secret", "bh-blokhouse")!, "DATABASE_URL");
        expect(url).toContain("postgresql://u%20s:p%20w%2B@");
    });

    it("postgresql pod template labels carry no chart version", () => {
        const sts = find(renderChart({}), "StatefulSet", "bh-blokhouse-postgresql")!;
        const labels = sts.spec.template.metadata.labels;
        expect(labels["helm.sh/chart"]).toBeUndefined();
        expect(labels).toMatchObject(sts.spec.selector.matchLabels);
        expect(sts.metadata.labels["helm.sh/chart"]).toBeDefined();
    });

    it("rejects a too short admin password", () => {
        expect(renderError({ blokhouse: { admin: { password: "short" } } })).toMatch(/admin|password|minLength/);
        expect(() => renderChart({ blokhouse: { admin: { password: "longenough" } } })).not.toThrow();
        expect(() => renderChart({ blokhouse: { admin: { password: "" } } })).not.toThrow();
    });

    it("existing bundled database password secret", () => {
        const docs = renderChart({ postgresql: { auth: { existingSecret: "pg-pass" } } });
        expect(find(docs, "Secret", "bh-blokhouse-postgresql")).toBeUndefined();
        expect(find(docs, "Secret", "bh-blokhouse")!.data.DATABASE_URL).toBeUndefined();

        const app = appContainer(docs);
        const names = app.env.map((e: K8sObject) => e.name);
        expect(names.indexOf("BLOKHOUSE_DB_PASSWORD")).toBeGreaterThanOrEqual(0);
        expect(names.indexOf("BLOKHOUSE_DB_PASSWORD")).toBeLessThan(names.indexOf("DATABASE_URL"));
        expect(env(app, "BLOKHOUSE_DB_PASSWORD")!.valueFrom.secretKeyRef).toEqual({ name: "pg-pass", key: "password" });
        expect(env(app, "DATABASE_URL")!.value).toBe(
            "postgresql://blokhouse:$(BLOKHOUSE_DB_PASSWORD)@bh-blokhouse-postgresql:5432/blokhouse",
        );
        expect(env(pgContainer(docs), "POSTGRES_PASSWORD")!.valueFrom.secretKeyRef).toEqual({
            name: "pg-pass",
            key: "password",
        });
    });

    it("external database url", () => {
        const docs = renderChart({
            postgresql: { enabled: false },
            externalDatabase: { url: "postgresql://u:p@db:5432/x" },
        });
        expect(find(docs, "StatefulSet")).toBeUndefined();
        expect(find(docs, "Secret", "bh-blokhouse-postgresql")).toBeUndefined();
        expect(decode(find(docs, "Secret", "bh-blokhouse")!, "DATABASE_URL")).toBe("postgresql://u:p@db:5432/x");
    });

    it("external database secret", () => {
        const docs = renderChart({ postgresql: { enabled: false }, externalDatabase: { existingSecret: "pg-app" } });
        expect(env(appContainer(docs), "DATABASE_URL")!.valueFrom.secretKeyRef).toEqual({
            name: "pg-app",
            key: "DATABASE_URL",
        });
        expect(find(docs, "Secret", "bh-blokhouse")!.data.DATABASE_URL).toBeUndefined();
    });

    it("fails without any database", () => {
        expect(renderError({ postgresql: { enabled: false } })).toContain(
            "Set externalDatabase.url or externalDatabase.existingSecret when postgresql.enabled=false",
        );
    });

    it("existing app secret", () => {
        const docs = renderChart({ blokhouse: { existingSecret: "bh-keys", sso: { clientSecret: "ignored" } } });
        const app = appContainer(docs);
        expect(env(app, "NEXTAUTH_SECRET")!.valueFrom.secretKeyRef).toEqual({ name: "bh-keys", key: "NEXTAUTH_SECRET" });
        expect(env(app, "ADMIN_PASSWORD")!.valueFrom.secretKeyRef).toEqual({
            name: "bh-keys",
            key: "ADMIN_PASSWORD",
            optional: true,
        });
        expect(env(app, "OIDC_CLIENT_SECRET")!.valueFrom.secretKeyRef).toEqual({
            name: "bh-keys",
            key: "OIDC_CLIENT_SECRET",
            optional: true,
        });
        const data = find(docs, "Secret", "bh-blokhouse")!.data;
        for (const key of ["NEXTAUTH_SECRET", "ADMIN_PASSWORD", "OIDC_CLIENT_SECRET"]) {
            expect(data[key], key).toBeUndefined();
        }
    });

    it("sso", () => {
        const docs = renderChart({
            blokhouse: {
                sso: {
                    issuer: "https://idp.example.com/realms/x",
                    clientId: "blokhouse",
                    clientSecret: "s3cret",
                    roleMap: "admins=ADMIN",
                },
            },
        });
        const config = find(docs, "ConfigMap", "bh-blokhouse")!.data;
        expect(config.OIDC_ISSUER).toBe("https://idp.example.com/realms/x");
        expect(config.OIDC_CLIENT_ID).toBe("blokhouse");
        expect(config.OIDC_ROLE_MAP).toBe("admins=ADMIN");
        expect(config).not.toHaveProperty("OIDC_NAME");
        expect(config).not.toHaveProperty("OIDC_CLIENT_SECRET");

        const secret = find(docs, "Secret", "bh-blokhouse")!;
        expect(decode(secret, "OIDC_CLIENT_SECRET")).toBe("s3cret");
        expect(env(appContainer(docs), "OIDC_CLIENT_SECRET")!.valueFrom.secretKeyRef).toEqual({
            name: "bh-blokhouse",
            key: "OIDC_CLIENT_SECRET",
        });
    });

    it("passes numeric settings as plain integers", () => {
        const docs = renderChart({ blokhouse: { sessionMaxAge: 2592000, sso: { tokenMaxDays: 30 } } });
        const config = find(docs, "ConfigMap", "bh-blokhouse")!.data;
        expect(config.SESSION_MAX_AGE).toBe("2592000");
        expect(config.OIDC_TOKEN_MAX_DAYS).toBe("30");
        expect(config).not.toHaveProperty("OIDC_TRUST_EMAIL");
    });

    it("omits OIDC_CLIENT_SECRET when no client secret is set", () => {
        const docs = renderChart({});
        expect(find(docs, "Secret", "bh-blokhouse")!.data.OIDC_CLIENT_SECRET).toBeUndefined();
        expect(env(appContainer(docs), "OIDC_CLIENT_SECRET")).toBeUndefined();
    });

    it("config checksum rolls pods", () => {
        const checksum = (allowSignup: boolean) =>
            find(renderChart({ blokhouse: { allowSignup } }), "Deployment", "bh-blokhouse")!.spec.template
                .metadata.annotations["checksum/config"];
        expect(checksum(false)).toBeTruthy();
        expect(checksum(false)).toBe(checksum(false));
        expect(checksum(false)).not.toBe(checksum(true));
    });

    it("existing claim replaces the volume claim template", () => {
        const docs = renderChart({ postgresql: { persistence: { existingClaim: "pg-data" } } });
        const sts = find(docs, "StatefulSet", "bh-blokhouse-postgresql")!;
        expect(sts.spec.volumeClaimTemplates).toBeUndefined();
        expect(sts.spec.template.spec.volumes).toContainEqual({
            name: "data",
            persistentVolumeClaim: { claimName: "pg-data" },
        });
    });

    describe("networking and extras", () => {
        const nextauthUrl = (values: object): string =>
            find(renderChart(values), "ConfigMap", "bh-blokhouse")!.data.NEXTAUTH_URL;
        const ingressHost = (tls: object[]) => ({
            ingress: {
                enabled: true,
                hosts: [{ host: "cmdb.example.com", paths: [{ path: "/", pathType: "Prefix" }] }],
                tls,
            },
        });

        it("url from ingress with tls", () => {
            const tls = [{ secretName: "cmdb-tls", hosts: ["cmdb.example.com"] }];
            expect(nextauthUrl(ingressHost(tls))).toBe("https://cmdb.example.com");
            expect(nextauthUrl(ingressHost([]))).toBe("http://cmdb.example.com");
        });

        it("url from httproute", () => {
            expect(nextauthUrl({ httpRoute: { enabled: true, hostnames: ["cmdb.example.com"] } })).toBe(
                "https://cmdb.example.com",
            );
        });

        it("explicit url wins", () => {
            expect(nextauthUrl({ blokhouse: { url: "https://x.example.com" }, ...ingressHost([]) })).toBe(
                "https://x.example.com",
            );
        });

        it("renders no networking objects by default", () => {
            const docs = renderChart({});
            for (const kind of ["Ingress", "HTTPRoute", "HorizontalPodAutoscaler", "PodDisruptionBudget"]) {
                expect(find(docs, kind)).toBeUndefined();
            }
        });

        it("ingress", () => {
            const docs = renderChart({
                ingress: { ...ingressHost([]).ingress, className: "nginx", annotations: { a: "b" } },
            });
            const ing = find(docs, "Ingress", "bh-blokhouse")!;
            expect(ing.spec.ingressClassName).toBe("nginx");
            expect(ing.metadata.annotations).toEqual({ a: "b" });
            expect(ing.spec.rules[0].host).toBe("cmdb.example.com");
            expect(ing.spec.rules[0].http.paths[0]).toEqual({
                path: "/",
                pathType: "Prefix",
                backend: { service: { name: "bh-blokhouse", port: { name: "http" } } },
            });
        });

        it("httproute", () => {
            const parentRefs = [{ name: "gw", namespace: "infra" }];
            const docs = renderChart({
                httpRoute: { enabled: true, parentRefs, hostnames: ["cmdb.example.com"] },
            });
            const route = find(docs, "HTTPRoute", "bh-blokhouse")!;
            expect(route.apiVersion).toBe("gateway.networking.k8s.io/v1");
            expect(route.spec.parentRefs).toEqual(parentRefs);
            expect(route.spec.hostnames).toEqual(["cmdb.example.com"]);
            expect(route.spec.rules[0].backendRefs).toEqual([{ name: "bh-blokhouse", port: 80 }]);
        });

        it("hpa", () => {
            const docs = renderChart({
                autoscaling: { enabled: true, minReplicas: 2, maxReplicas: 5, targetCPUUtilizationPercentage: 70 },
            });
            const hpa = find(docs, "HorizontalPodAutoscaler", "bh-blokhouse")!;
            expect(hpa.apiVersion).toBe("autoscaling/v2");
            expect(hpa.spec.scaleTargetRef).toEqual({
                apiVersion: "apps/v1",
                kind: "Deployment",
                name: "bh-blokhouse",
            });
            expect(hpa.spec.minReplicas).toBe(2);
            expect(hpa.spec.maxReplicas).toBe(5);
            expect(hpa.spec.metrics[0].resource.target.averageUtilization).toBe(70);
            expect(find(docs, "Deployment", "bh-blokhouse")!.spec).not.toHaveProperty("replicas");
        });

        it("pdb", () => {
            const docs = renderChart({ podDisruptionBudget: { enabled: true } });
            const pdb = find(docs, "PodDisruptionBudget", "bh-blokhouse")!;
            expect(pdb.spec.minAvailable).toBe(1);
            expect(pdb.spec.selector.matchLabels).toEqual({
                "app.kubernetes.io/name": "blokhouse",
                "app.kubernetes.io/instance": "bh",
                "app.kubernetes.io/component": "app",
            });
        });

        it("openshift drops fixed ids but keeps the hardening", () => {
            const docs = renderChart({ openshift: true });
            const appPod = find(docs, "Deployment", "bh-blokhouse")!.spec.template.spec;
            const pgPod = find(docs, "StatefulSet", "bh-blokhouse-postgresql")!.spec.template.spec;
            for (const [podCtx, ctx] of [
                [appPod.securityContext, appPod.containers[0].securityContext],
                [pgPod.securityContext, pgPod.containers[0].securityContext],
            ]) {
                for (const c of [podCtx, ctx]) {
                    for (const key of ["runAsUser", "runAsGroup", "fsGroup"]) expect(c).not.toHaveProperty(key);
                    expect(c.runAsNonRoot).toBe(true);
                }
                expect(ctx.readOnlyRootFilesystem).toBe(true);
            }
        });
    });

    it("schema rejects a typo", () => {
        expect(renderError({ replicaCount: "two" })).toContain("replicaCount");
    });
});
