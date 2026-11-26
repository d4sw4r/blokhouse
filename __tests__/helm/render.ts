// Renders charts/blokhouse with `helm template` for the chart tests.
// Helm is taken from $HELM_BIN, else from PATH.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseAllDocuments } from "yaml";

const CHART = path.resolve(__dirname, "../../charts/blokhouse");
const HELM = process.env.HELM_BIN || "helm";

// Kubernetes objects are loosely typed here; tests navigate them freely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type K8sObject = Record<string, any>;

function helmTemplate(values: object, release: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bh-helm-"));
    const file = path.join(dir, "values.json");
    try {
        // JSON is valid YAML, so Helm reads it as a values file.
        fs.writeFileSync(file, JSON.stringify(values));
        return execFileSync(HELM, ["template", release, CHART, "-f", file], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

export function renderChart(values: object = {}, release = "bh"): K8sObject[] {
    const out = helmTemplate(values, release);
    return parseAllDocuments(out)
        .map((doc) => {
            if (doc.errors.length) throw doc.errors[0];
            return doc.toJS() as K8sObject | null;
        })
        .filter((doc): doc is K8sObject => doc !== null);
}

export function renderError(values: object = {}, release = "bh"): string {
    try {
        helmTemplate(values, release);
    } catch (err) {
        const e = err as { stderr?: string; message: string };
        return e.stderr || e.message;
    }
    throw new Error("expected helm template to fail, but it succeeded");
}

export function find(docs: K8sObject[], kind: string, name?: string): K8sObject | undefined {
    return docs.find((d) => d.kind === kind && (name === undefined || d.metadata?.name === name));
}
