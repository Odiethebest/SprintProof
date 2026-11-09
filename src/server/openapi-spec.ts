import { readFile } from "node:fs/promises";
import path from "node:path";

// docs/api/openapi.yaml is the one copy of the spec; /api-docs serves it as is.
const SPEC_PATH = path.join(process.cwd(), "docs", "api", "openapi.yaml");

export async function readOpenApiSpec(): Promise<string> {
  return readFile(SPEC_PATH, "utf8");
}
