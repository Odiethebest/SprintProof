import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "src/app/api/v1");
const SPEC_PATH = path.join(ROOT, "docs/api/openapi.yaml");
const HTTP_METHOD = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

interface Operation {
  key: string;
  lines: string[];
}

function readSpec(): string {
  // Windows checkouts with core.autocrlf=true give CRLF; the regexes below expect LF (#68)
  return fs.readFileSync(SPEC_PATH, "utf8").replace(/\r\n/g, "\n");
}

// "teams/[teamId]/sprints/route.ts" → "/teams/{teamId}/sprints"
function toSpecPath(routeFile: string): string {
  const dir = path.dirname(routeFile).split(path.sep).join("/");
  return `/${dir}`.replace(/\[(\w+)\]/g, "{$1}");
}

// Every exported HTTP method of every route handler under /api/v1, as "GET /teams/{teamId}/sprints".
function listRouteOperations(): string[] {
  const files = fs
    .readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "route.ts");
  return files.flatMap((file) => {
    const source = fs.readFileSync(path.join(API_DIR, file), "utf8");
    return [...source.matchAll(HTTP_METHOD)].map(
      ([, method]) => `${method} ${toSpecPath(file)}`
    );
  });
}

// The spec keeps paths at two spaces and methods at four (the YAML Prettier
// writes), so a line scan finds every operation without a YAML parser.
function listSpecOperations(spec: string): Operation[] {
  const operations: Operation[] = [];
  let isInPaths = false;
  let currentPath: string | null = null;
  let current: Operation | null = null;
  for (const line of spec.split("\n")) {
    if (/^paths:\s*$/.test(line)) {
      isInPaths = true;
      continue;
    }
    if (isInPaths && /^\S/.test(line)) {
      isInPaths = false;
    }
    if (!isInPaths) {
      continue;
    }
    const pathMatch = /^ {2}(\/\S*):\s*$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      current = null;
      continue;
    }
    const methodMatch = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
    if (methodMatch && currentPath !== null) {
      current = { key: `${methodMatch[1].toUpperCase()} ${currentPath}`, lines: [] };
      operations.push(current);
      continue;
    }
    if (/^ {4}\S/.test(line)) {
      // A path-level key such as `parameters:` ends the operation above it.
      current = null;
      continue;
    }
    current?.lines.push(line);
  }
  return operations;
}

describe("docs/api/openapi.yaml", () => {
  it("is an OpenAPI 3.1 document served from /api/v1", () => {
    // Act
    const spec = readSpec();

    // Assert
    expect(spec).toMatch(/^openapi: 3\.1\.\d+$/m);
    expect(spec).toMatch(/^servers:\n {2}- url: \/api\/v1$/m);
  });

  it("documents every /api/v1 route handler", () => {
    // Arrange
    const routes = listRouteOperations();

    // Act
    const documented = listSpecOperations(readSpec()).map((op) => op.key);

    // Assert
    expect(routes.length).toBeGreaterThan(0);
    expect(documented).toEqual(expect.arrayContaining(routes));
  });

  it("documents no endpoint the app doesn't have", () => {
    // Arrange
    const routes = listRouteOperations();

    // Act
    const documented = listSpecOperations(readSpec()).map((op) => op.key);

    // Assert
    expect(routes).toEqual(expect.arrayContaining(documented));
  });

  it("documents a 401 response for every endpoint, since all of them need a session or a token", () => {
    // Act
    const operations = listSpecOperations(readSpec());

    // Assert
    const missing = operations
      .filter((op) => !op.lines.some((line) => /^\s+["']?401["']?:/.test(line)))
      .map((op) => op.key);
    expect(operations.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("describes errors with the shared error shape", () => {
    // Act
    const spec = readSpec();

    // Assert: one Error schema in components.schemas for
    // { "error": { "code", "message" } } (AGENTS.md §1 Key patterns)
    expect(spec).toMatch(/^components:$/m);
    expect(spec).toMatch(/^ {2}schemas:$/m);
    expect(spec).toMatch(/^ {4}Error:$/m);
  });
});
