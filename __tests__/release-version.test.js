import { describe, it, expect } from "vitest";
import { checkReleaseVersion } from "../scripts/check-release-version.mjs";

describe("checkReleaseVersion", () => {
  it("accepts matching versions", () => {
    expect(checkReleaseVersion("v0.4.0", "0.4.0", "0.4.0", "0.4.0")).toEqual([]);
  });

  it("reports a package.json mismatch", () => {
    const errors = checkReleaseVersion("v0.4.0", "0.3.0", "0.4.0", "0.4.0");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("package.json version 0.3.0 does not match tag v0.4.0");
  });

  it("reports chart version and appVersion mismatches separately", () => {
    const errors = checkReleaseVersion("v0.4.0", "0.4.0", "0.3.0", "0.3.1");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("Chart.yaml version");
    expect(errors[1]).toContain("Chart.yaml appVersion");
  });

  it("rejects a tag without the v prefix", () => {
    expect(checkReleaseVersion("0.4.0", "0.4.0", "0.4.0", "0.4.0")).toEqual([
      "tag must look like vX.Y.Z",
    ]);
  });
});
