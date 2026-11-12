import { Client } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDatabasePoolConfig } from "@/lib/database/pool-config";

const DATABASE_URL =
  "postgresql://postgres.abcdef:secret-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres";

// Only the PEM shape matters here: node-postgres hands the text to Node's TLS
// stack when it connects, which these tests never do.
const ROOT_CA = [
  "-----BEGIN CERTIFICATE-----",
  "MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL",
  "BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l",
  "o/bKiIz+Fq8=",
  "-----END CERTIFICATE-----",
].join("\n");

const NEXT_ROOT_CA = [
  "-----BEGIN CERTIFICATE-----",
  "MIIDazCCAlOgAwIBAgIUHuY2zrXsvBZ6ZqJxV8o0xP3vWwYwDQYJKoZIhvcNAQEL",
  "Zm9vYmFy",
  "-----END CERTIFICATE-----",
].join("\n");

describe("buildDatabasePoolConfig", () => {
  describe("without a CA certificate", () => {
    it("passes the connection string through unchanged", () => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate: undefined,
      });

      // Assert
      expect(config).toStrictEqual({ connectionString: DATABASE_URL });
    });

    it("leaves ssl unset, so node-postgres still reads PGSSLMODE", () => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate: undefined,
      });

      // Assert
      expect(config).not.toHaveProperty("ssl");
    });

    // `.env.example` leaves DATABASE_CA_CERT empty, so a local `.env.local`
    // copied from it sets it to "".
    it.each([
      ["an empty value", ""],
      ["only spaces", "   "],
      ["only a line break", "\n"],
    ])("treats %s as no CA certificate", (_label, caCertificate) => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate,
      });

      // Assert
      expect(config).toStrictEqual({ connectionString: DATABASE_URL });
    });

    it("leaves a connection string with sslmode alone", () => {
      // Arrange
      const connectionString = `${DATABASE_URL}?sslmode=no-verify`;

      // Act
      const config = buildDatabasePoolConfig({
        connectionString,
        caCertificate: undefined,
      });

      // Assert
      expect(config).toStrictEqual({ connectionString });
    });
  });

  describe("with a CA certificate", () => {
    it("verifies the server certificate against that CA", () => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate: ROOT_CA,
      });

      // Assert
      expect(config).toStrictEqual({
        connectionString: DATABASE_URL,
        ssl: { ca: ROOT_CA, rejectUnauthorized: true },
      });
    });

    // Node checks the hostname against the certificate unless
    // checkServerIdentity is replaced (sslmode=verify-ca does that in pg).
    it("keeps the hostname check", () => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate: ROOT_CA,
      });

      // Assert
      expect(config.ssl).not.toHaveProperty("checkServerIdentity");
    });

    it("keeps the CA when DATABASE_URL is unset", () => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: undefined,
        caCertificate: ROOT_CA,
      });

      // Assert
      expect(config).toStrictEqual({
        connectionString: undefined,
        ssl: { ca: ROOT_CA, rejectUnauthorized: true },
      });
    });

    // Env var forms often take one line, so the PEM gets pasted with "\n"
    // written out. Base64 never contains a backslash, so this is unambiguous.
    it.each([
      ["literal \\n sequences", ROOT_CA.replaceAll("\n", "\\n")],
      ["literal \\r\\n sequences", ROOT_CA.replaceAll("\n", "\\r\\n")],
      ["CRLF line breaks", ROOT_CA.replaceAll("\n", "\r\n")],
      ["surrounding whitespace", `  \n${ROOT_CA}\n\n  `],
    ])("accepts a certificate pasted with %s", (_label, caCertificate) => {
      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate,
      });

      // Assert
      expect(config.ssl).toStrictEqual({
        ca: ROOT_CA,
        rejectUnauthorized: true,
      });
    });

    it("keeps several certificates, so a new root can be added before the old one is retired", () => {
      // Arrange
      const bundle = `${ROOT_CA}\n${NEXT_ROOT_CA}`;

      // Act
      const config = buildDatabasePoolConfig({
        connectionString: DATABASE_URL,
        caCertificate: bundle,
      });

      // Assert
      expect(config.ssl).toStrictEqual({
        ca: bundle,
        rejectUnauthorized: true,
      });
    });

    it.each([
      ["plain text", "not a certificate"],
      ["line breaks replaced by spaces", ROOT_CA.replaceAll("\n", " ")],
      ["no end line", ROOT_CA.replace("-----END CERTIFICATE-----", "")],
      ["a private key", ROOT_CA.replaceAll("CERTIFICATE", "PRIVATE KEY")],
      ["text after the certificate", `${ROOT_CA}\nextra`],
    ])(
      "rejects %s with an error naming DATABASE_CA_CERT",
      (_label, caCertificate) => {
        // Act
        const build = () =>
          buildDatabasePoolConfig({
            connectionString: DATABASE_URL,
            caCertificate,
          });

        // Assert
        expect(build).toThrow(/DATABASE_CA_CERT/);
      }
    );

    // node-postgres lets SSL settings in the connection string replace the
    // ssl option, which would drop the CA without a word.
    it.each([
      "sslmode=no-verify",
      "sslmode=require",
      "ssl=true",
      "sslrootcert=/tmp/root.crt",
      "sslnegotiation=direct",
    ])("rejects a DATABASE_URL with %s", (parameter) => {
      // Act
      const build = () =>
        buildDatabasePoolConfig({
          connectionString: `${DATABASE_URL}?pgbouncer=true&${parameter}`,
          caCertificate: ROOT_CA,
        });

      // Assert
      expect(build).toThrow(/DATABASE_URL/);
    });

    it("leaves the connection string and its password out of the error", () => {
      // Act
      let message = "";
      try {
        buildDatabasePoolConfig({
          connectionString: `${DATABASE_URL}?sslmode=require`,
          caCertificate: ROOT_CA,
        });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      // Assert
      expect(message).toContain("sslmode");
      expect(message).not.toContain("secret-password");
    });

    it("accepts other connection string parameters", () => {
      // Arrange
      const connectionString = `${DATABASE_URL}?pgbouncer=true&connection_limit=1`;

      // Act
      const config = buildDatabasePoolConfig({
        connectionString,
        caCertificate: ROOT_CA,
      });

      // Assert
      expect(config).toStrictEqual({
        connectionString,
        ssl: { ca: ROOT_CA, rejectUnauthorized: true },
      });
    });
  });

  // node-postgres reads PGSSLMODE only when the ssl option is undefined
  // (pg/lib/connection-parameters.js). Building a Client parses the config
  // without connecting.
  describe("with node-postgres", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses the CA even when PGSSLMODE is no-verify", () => {
      // Arrange
      vi.stubEnv("PGSSLMODE", "no-verify");

      // Act
      const client = new Client(
        buildDatabasePoolConfig({
          connectionString: DATABASE_URL,
          caCertificate: ROOT_CA,
        })
      );

      // Assert
      expect(client.ssl).toStrictEqual({
        ca: ROOT_CA,
        rejectUnauthorized: true,
      });
    });

    it("still follows PGSSLMODE without a CA certificate", () => {
      // Arrange
      vi.stubEnv("PGSSLMODE", "no-verify");

      // Act
      const client = new Client(
        buildDatabasePoolConfig({
          connectionString: DATABASE_URL,
          caCertificate: undefined,
        })
      );

      // Assert
      expect(client.ssl).toStrictEqual({ rejectUnauthorized: false });
    });

    it("connects without TLS when neither is set, as local Docker and CI do", () => {
      // Arrange
      vi.stubEnv("PGSSLMODE", "");

      // Act
      const client = new Client(
        buildDatabasePoolConfig({
          connectionString:
            "postgresql://postgres:postgres@localhost:5432/sprintproof",
          caCertificate: undefined,
        })
      );

      // Assert
      expect(client.ssl).toBe(false);
    });
  });
});
