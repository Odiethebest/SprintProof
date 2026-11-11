import { connection } from "next/server";
import { db } from "@/server/db";
import { checkHealth } from "@/server/health";

// GET: Whether this deployment reaches its database, and the Git commit it
// runs. Public: no sign-in and no team data. The Database workflow polls it
// after a push to main; the production guard checks it daily.
export async function GET(): Promise<Response> {
  // Wait for a real request, so cacheComponents never prerenders the answer
  // or queries the database during `next build`.
  await connection();
  return checkHealth({ database: db });
}
