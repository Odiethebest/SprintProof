# 002. Host the database on Supabase

**Date:** 2026-11-05 · **Status:** Accepted · **Issue:** #17, #53 (TLS, 2026-11-11)
**Deciders:** Ziqi (Odie) Yang, Yunhong Huang

## Context
Local development and CI use PostgreSQL in Docker (#5, #36). Vercel needs a hosted database, and the README asks for a separate database for PR previews and for production. Both of us had used Supabase before.

## Options considered
1. **Supabase** — pros: free plan, both of us know it, Session pooler works over IPv4 / cons: a free project pauses after about a week of low activity; its auth, storage and realtime features overlap with Auth.js and Pusher, so we only use the database.
2. **Neon** — pros: database branching per preview, compute resumes on request / cons: new to both of us.
3. **One database for previews and production** — pros: one less project to manage / cons: previews could change real data; rejected.

## Decision
Two Supabase projects on the free plan, in a dedicated SprintProof organization in East US (North Virginia): sprintproof-prod for Vercel Production and sprintproof-preview for Vercel Preview. The app connects only through Prisma on the server, using the Session pooler (port 5432) for both runtime and migrations. The app connects over TLS and verifies the server certificate against Supabase's root CA (see [Connecting over TLS](#connecting-over-tls)).

## Consequences
- The Supabase Data API is turned off on both projects, so no table is exposed through Supabase's REST API.
- Until #98, migrations were applied with `prisma migrate deploy` by hand after each merged migration. As of 2026-11-10, every migration through #56 is applied to both databases. #16's reached production about three hours after #64 merged, and production's Settings page failed until then; #56's reached it about six hours after #69 merged.
- Since #98, the Database workflow (`.github/workflows/database.yml`) runs `migrate deploy` after every push to `main`: on preview, then on production, one run per database at a time. Each job reads a `DATABASE_URL` secret from the GitHub environment `preview` or `production`, and skips with a notice while the secret is missing. A smoke test then waits up to 10 minutes for production's `/api/health` to answer ok with the new commit. Vercel builds the same push in parallel, so a deployment can still go live a minute or two before its migration is applied.
- Connection strings live in Vercel environment variables and in those two GitHub environment secrets. Whoever applies migrations by hand keeps the two database passwords in their local, git-ignored `.env` as `SUPABASE_PROD_DB_PASSWORD` and `SUPABASE_PREVIEW_DB_PASSWORD`, next to each project's Session pooler URI as `SUPABASE_PROD_DB_URL` and `SUPABASE_PREVIEW_DB_URL`, with `[YOUR-PASSWORD]` left in. Passwords are shared between partners privately, never in the repo, PRs or docs.
- A paused project must be resumed from the Supabase dashboard; the data is kept. To keep both projects active (#98), the Database workflow runs `SELECT 1` on both databases daily once the secrets exist, and the production guard calls production's `/api/health` daily, which runs `SELECT 1` without any secret.
- Supabase runs PostgreSQL 17.11. CI moved to 17 in #17 so the check that gates merges matches production; local Docker stays on 16. The schema uses no version-specific features.
- All PR previews share one preview database, so they can see each other's data.
- If connection limits become a problem, switch the runtime to the Transaction pooler (port 6543) and keep the Session pooler for migrations.

## Connecting over TLS
Added 2026-11-11 for #53.

### Context
Until Nov 7 the app connected to Supabase in plaintext: `src/server/db.ts` built the `pg` pool from `DATABASE_URL` alone, the Supabase URI has no `sslmode`, and node-postgres sends no SSLRequest unless told to. Vercel Production and Preview then set `PGSSLMODE=no-verify`, which encrypts the connection but accepts any certificate, so someone on the network path could still intercept it.

The pooler presents `*.pooler.supabase.com`, signed by Supabase Intermediate 2021 CA, which Supabase Root 2021 CA signs. That root isn't in Node's CA store, so `sslmode=require` or `verify-full` fail with `SELF_SIGNED_CERT_IN_CHAIN` unless we pass the root ourselves.

### Options considered
1. **Keep `PGSSLMODE=no-verify`** — pros: no work / cons: no protection against interception.
2. **`sslmode=verify-full&sslrootcert=<file>` in `DATABASE_URL`** — pros: the libpq form / cons: pg reads the file from disk, so it must ship with every Vercel function at a path that differs per machine; local and deployed URLs no longer have the same shape.
3. **`NODE_EXTRA_CA_CERTS`** — pros: no code change / cons: Node reads it only at startup and only from a file, and it trusts Supabase's root for every TLS connection the app makes (GitHub, Pusher), not just the database.
4. **The root CA as PEM text in `DATABASE_CA_CERT`, passed to the pool as `ssl: { ca, rejectUnauthorized: true }`** — pros: one variable, scoped to the database pool, same `DATABASE_URL` everywhere / cons: the PEM is pasted into Vercel by hand.

### Decision
Option 4. `buildDatabasePoolConfig()` in `src/lib/database/pool-config.ts` builds the pool options from `DATABASE_URL` and `DATABASE_CA_CERT`, which `src/server/db.ts` reads.

- **With `DATABASE_CA_CERT` set,** the server's chain must end at that root, and its certificate must match the host in `DATABASE_URL` (Node's default host name check; pg sends the host as SNI). `ca` replaces Node's default CA list for this connection, so only Supabase's root is trusted. pg reads `PGSSLMODE` only when `ssl` is unset, so it no longer applies. A server that refuses TLS gets no plaintext fallback: pg fails with "The server does not support SSL connections".
- **A `DATABASE_URL` with `sslmode`, `ssl` or another `ssl*` parameter** stops the app at startup while `DATABASE_CA_CERT` is set, because pg would let it replace the CA without a word. The error names the parameter, never the URL.
- **The value** is one or more PEM certificates. Pasted on one line with each line break written as `\n` also works, since base64 has no backslash. Anything else stops the app at startup with an error naming `DATABASE_CA_CERT`.
- **Without `DATABASE_CA_CERT`** (or with it empty, as `.env.example` leaves it), nothing changes: local Docker and CI connect without TLS, and pg still follows `PGSSLMODE`.
- **"Enforce SSL on incoming connections"** is on for sprintproof-prod and sprintproof-preview, so Supabase refuses plaintext connections from anything.

### The certificate
Supabase's `prod-ca-2021.crt`, from the Supabase dashboard (Database settings → SSL Configuration → Download certificate) or https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. A copy lives in [`docs/certs/supabase-prod-ca-2021.crt`](../certs/supabase-prod-ca-2021.crt). The app doesn't read that file: it's there so the value set on Vercel can be checked against a reviewed copy, and so a rotation shows up as a diff. It is public, like any CA certificate. `tests/unit/docs/supabase-root-ca.test.ts` checks its fingerprint.

| | |
|---|---|
| Subject and issuer (self-signed) | `C=US, ST=Delware, L=New Castle, O=Supabase Inc, CN=Supabase Root 2021 CA` ("Delware" is Supabase's spelling) |
| Valid | 2021-04-28 10:56:53 UTC to 2031-04-26 10:56:53 UTC |
| Serial | `6C:BC:4C:A1:DE:B6:3F:69:2D:0A:20:24:C6:72:89:C2:D1:3D:54:F6` |
| SHA-256 fingerprint | `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA` |
| Chain served by the pooler (2026-11-11) | `*.pooler.supabase.com` (until 2030-03-11) → Supabase Intermediate 2021 CA (until 2033-10-21) → this root |

Checked on 2026-11-11 without credentials, against `aws-0-us-east-1.pooler.supabase.com` and `aws-1-us-east-1.pooler.supabase.com`, ports 5432 and 6543 (Session and Transaction pooler):

```bash
openssl s_client -starttls postgres -connect aws-0-us-east-1.pooler.supabase.com:5432 \
  -servername aws-0-us-east-1.pooler.supabase.com -CAfile docs/certs/supabase-prod-ca-2021.crt </dev/null
```

With `-CAfile` this ends with "Verify return code: 0 (ok)"; without it, "Verify return code: 19 (self-signed certificate in certificate chain)".

### Rotating the CA
- A new pooler or intermediate certificate under the same root needs no change. The root itself expires on 2031-04-26, before the intermediate: rotate before then, or as soon as the certificate behind "Download certificate" in the Supabase dashboard changes.
- To rotate: download the new root and read it with `openssl x509 -in <file> -noout -subject -dates -fingerprint -sha256`. Set `DATABASE_CA_CERT` on Vercel Production and Preview to the old and the new PEM, one after the other, and redeploy; the app then accepts a chain that ends at either. Once the `openssl s_client` command above verifies with the new root alone, remove the old PEM and redeploy again. In the same PR, replace the copy in `docs/certs/`, the fingerprint in `tests/unit/docs/supabase-root-ca.test.ts` and the table above.
- If connections fail with `SELF_SIGNED_CERT_IN_CHAIN` or `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, the chain no longer ends at the configured root: add the new root as above. As a last resort, unsetting `DATABASE_CA_CERT` and setting `PGSSLMODE=no-verify` restores an encrypted but unverified connection until then.

### Consequences
- Someone on the network path between Vercel and Supabase can no longer read or change queries unless they hold a certificate for the pooler's host name issued under Supabase's root.
- The Database workflow doesn't go through `src/server/db.ts`. `prisma migrate deploy` and `psql` default to `sslmode=prefer`: they use TLS, which "Enforce SSL" now requires, but don't verify the certificate. Verifying there too needs the root as a file and `sslmode=verify-full&sslrootcert=...` in those secrets; that's left for a follow-up.
