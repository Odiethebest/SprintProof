import { X509Certificate } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDatabasePoolConfig } from "@/lib/database/pool-config";

// The copy that DATABASE_CA_CERT is set from on Vercel (decision 002).
const CERTIFICATE_PATH = path.join(
  process.cwd(),
  "docs/certs/supabase-prod-ca-2021.crt"
);

// Recorded in decision 002 when the certificate was checked against the
// pooler's chain on 2026-11-11.
const SHA256_FINGERPRINT =
  "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA";

function readCertificate(): string {
  // Windows checkouts with core.autocrlf=true give CRLF (#68).
  return fs.readFileSync(CERTIFICATE_PATH, "utf8").replace(/\r\n/g, "\n");
}

describe("committed Supabase root CA", () => {
  it("is Supabase Root 2021 CA with the fingerprint in decision 002", () => {
    // Act
    const certificate = new X509Certificate(readCertificate());

    // Assert
    expect(certificate.subject).toContain("CN=Supabase Root 2021 CA");
    expect(certificate.fingerprint256).toBe(SHA256_FINGERPRINT);
  });

  it("is accepted as DATABASE_CA_CERT", () => {
    // Arrange
    const pem = readCertificate();

    // Act
    const config = buildDatabasePoolConfig({
      connectionString: undefined,
      caCertificate: pem,
    });

    // Assert
    expect(config.ssl).toStrictEqual({
      ca: pem.trim(),
      rejectUnauthorized: true,
    });
  });

  it("is accepted as DATABASE_CA_CERT when pasted on one line with \\n", () => {
    // Arrange
    const pem = readCertificate();

    // Act
    const config = buildDatabasePoolConfig({
      connectionString: undefined,
      caCertificate: pem.trim().replaceAll("\n", "\\n"),
    });

    // Assert
    expect(config.ssl).toStrictEqual({
      ca: pem.trim(),
      rejectUnauthorized: true,
    });
  });
});
