import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api-docs/openapi.yaml/route";

const SPEC_PATH = path.join(process.cwd(), "docs/api/openapi.yaml");

describe("GET /api-docs/openapi.yaml", () => {
  it("serves docs/api/openapi.yaml as YAML, for Swagger UI and API clients", async () => {
    // Act
    const res = await GET();

    // Assert
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/yaml; charset=utf-8"
    );
    expect(await res.text()).toBe(fs.readFileSync(SPEC_PATH, "utf8"));
  });
});
