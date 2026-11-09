import { readOpenApiSpec } from "@/server/openapi-spec";

// GET: The OpenAPI spec for Swagger UI on /api-docs and for API clients. Public.
export async function GET() {
  return new Response(await readOpenApiSpec(), {
    headers: { "content-type": "application/yaml; charset=utf-8" },
  });
}
