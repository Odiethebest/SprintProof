export type DatabaseTlsConfig = {
  ca: string;
  rejectUnauthorized: true;
};

export type DatabasePoolConfig = {
  connectionString: string | undefined;
  ssl?: DatabaseTlsConfig;
};

// One or more PEM certificates and nothing else. Several are allowed so a new
// root can sit next to the old one during a rotation (decision 002).
// Tested with a line break appended, so every certificate ends with one.
const PEM_CERTIFICATE_BUNDLE =
  /^(?:-----BEGIN CERTIFICATE-----\n(?:[A-Za-z0-9+/=]+\n)+-----END CERTIFICATE-----\n+)+$/;

// Env var forms often take one line, so the PEM arrives with "\n" written out.
// Base64 has no backslash, so turning those back into line breaks is safe.
const LINE_BREAK = /\\r\\n|\\n|\r\n/g;

function normalizeCertificate(value: string): string {
  return value.replace(LINE_BREAK, "\n").trim();
}

// node-postgres applies any of these from the connection string in place of
// the ssl option (pg-connection-string), which would drop the CA silently.
function findSslParameter(connectionString: string): string | undefined {
  const queryStart = connectionString.indexOf("?");
  if (queryStart === -1) {
    return undefined;
  }
  const query = connectionString.slice(queryStart + 1).split("#")[0];
  return [...new URLSearchParams(query).keys()].find((name) =>
    name.startsWith("ssl")
  );
}

// Pool options for node-postgres. With a CA, the server certificate must chain
// to it and match the host name; that wins over PGSSLMODE, which pg reads only
// when `ssl` is undefined. Without one, nothing changes: local Docker and CI
// connect without TLS, and Vercel follows PGSSLMODE.
export function buildDatabasePoolConfig({
  connectionString,
  caCertificate,
}: {
  connectionString: string | undefined;
  caCertificate: string | undefined;
}): DatabasePoolConfig {
  const ca = normalizeCertificate(caCertificate ?? "");
  if (ca === "") {
    return { connectionString };
  }
  if (!PEM_CERTIFICATE_BUNDLE.test(`${ca}\n`)) {
    throw new Error(
      "DATABASE_CA_CERT must hold PEM certificates (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----) with their line breaks, or with each line break written as \\n."
    );
  }
  const sslParameter = connectionString
    ? findSslParameter(connectionString)
    : undefined;
  if (sslParameter) {
    throw new Error(
      `DATABASE_URL sets ${sslParameter}, which node-postgres would use in place of DATABASE_CA_CERT. Remove it from DATABASE_URL.`
    );
  }
  return { connectionString, ssl: { ca, rejectUnauthorized: true } };
}
