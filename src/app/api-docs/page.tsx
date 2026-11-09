import type { Metadata } from "next";
import Link from "next/link";
import { FileCode } from "lucide-react";
import { SwaggerUi } from "@/components/api-docs/swagger-ui";
import { PageHeader } from "@/components/layout/page-header";
import { AppMark } from "@/components/ui/app-mark";

export const metadata: Metadata = { title: "API docs · SprintProof" };

const SPEC_URL = "/api-docs/openapi.yaml";

const LINK_CLASSES =
  "rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

// Public, like the spec it shows: anyone can read how the API works, and every
// endpoint still checks a session or a token.
export default function ApiDocsPage() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-2 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <AppMark size="sm" />
            <span className="text-sm font-semibold">SprintProof</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title="API docs"
          meta={
            <>
              <span>
                Base URL <code className="font-mono text-xs">/api/v1</code>
              </span>
              <span className="inline-flex items-center gap-1">
                <FileCode size={16} aria-hidden="true" />
                <a href={SPEC_URL} className={LINK_CLASSES}>
                  openapi.yaml
                </a>
              </span>
            </>
          }
          action={null}
        />
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Create a personal API token in your team&apos;s Settings, under API
            tokens, and send it with each request:
          </p>
          <code className="w-fit max-w-full overflow-x-auto rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs">
            Authorization: Bearer spk_live_…
          </code>
        </div>
        <SwaggerUi specUrl={SPEC_URL} />
      </main>
    </>
  );
}
