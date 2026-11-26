// Verifies that a release tag matches package.json and the Helm chart versions.
// Usage: node scripts/check-release-version.mjs vX.Y.Z
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export function checkReleaseVersion(tag, pkgVersion, chartVersion, appVersion) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) return ["tag must look like vX.Y.Z"];
  const expected = tag.slice(1);
  const errors = [];
  const check = (label, actual) => {
    if (String(actual) !== expected) {
      errors.push(`${label} ${actual} does not match tag ${tag}`);
    }
  };
  check("package.json version", pkgVersion);
  check("Chart.yaml version", chartVersion);
  check("Chart.yaml appVersion", appVersion);
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.argv[2] ?? "";
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const chart = parse(readFileSync("charts/blokhouse/Chart.yaml", "utf8"));
  const errors = checkReleaseVersion(tag, pkg.version, chart.version, chart.appVersion);
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(errors.length ? 1 : 0);
}
