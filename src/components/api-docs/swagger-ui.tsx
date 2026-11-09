"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { labelSwaggerControls } from "./label-swagger-controls";
import "./swagger-overrides.css";

// Loaded from a CDN instead of npm (decided in #16): pinned to one version,
// with Subresource Integrity, so the browser refuses any other file.
const SWAGGER_UI_CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.0";
const SCRIPT_INTEGRITY =
  "sha384-9Td7MKiIr2S83E1kZyyVi8KdJw/S8CpAvu0llLyMeg0xq/hDGiZJfVn0fV4llCmK";
const STYLESHEET_INTEGRITY =
  "sha384-4c3vsE5f+trhFyHrFrLM1fFGUn531NIaC7dcqEWIJdoRQJ5CkJbSuSCwXLpaS1KF";

interface SwaggerUiOptions {
  url: string;
  domNode: HTMLElement;
  deepLinking: boolean;
  docExpansion: "list" | "full" | "none";
  defaultModelsExpandDepth: number;
}

declare global {
  interface Window {
    SwaggerUIBundle?: (options: SwaggerUiOptions) => unknown;
  }
}

type LoadState = "loading" | "ready" | "failed";

export function SwaggerUi({ specUrl }: { specUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  // Swagger renders on its own schedule (opening an operation, "Try it out"),
  // so label its controls whenever it adds elements. The observer runs right
  // after each render, before the browser paints or a screen reader reads it.
  useEffect(() => {
    const container = containerRef.current;
    if (loadState !== "ready" || container === null) {
      return;
    }
    const observer = new MutationObserver(() =>
      labelSwaggerControls(container)
    );
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    labelSwaggerControls(container);
    return () => observer.disconnect();
  }, [loadState]);

  function renderReference() {
    const container = containerRef.current;
    if (container === null || window.SwaggerUIBundle === undefined) {
      setLoadState("failed");
      return;
    }
    window.SwaggerUIBundle({
      url: specUrl,
      domNode: container,
      deepLinking: false,
      docExpansion: "list",
      defaultModelsExpandDepth: 0,
    });
    setLoadState("ready");
  }

  return (
    <>
      <link
        rel="stylesheet"
        href={`${SWAGGER_UI_CDN}/swagger-ui.css`}
        integrity={STYLESHEET_INTEGRITY}
        crossOrigin="anonymous"
        precedence="default"
      />
      <Script
        src={`${SWAGGER_UI_CDN}/swagger-ui-bundle.js`}
        integrity={SCRIPT_INTEGRITY}
        crossOrigin="anonymous"
        onReady={renderReference}
        onError={() => setLoadState("failed")}
      />
      {loadState === "loading" && (
        <p className="text-sm text-text-muted">Loading the API reference…</p>
      )}
      {loadState === "failed" && (
        <p role="status" className="text-sm text-text-muted">
          The API reference couldn&apos;t load. The openapi.yaml link above has
          the same content.
        </p>
      )}
      {/* Swagger UI has light styles only, so it keeps the light tokens in dark mode. */}
      <div
        ref={containerRef}
        className="swagger-host theme-light rounded-lg border border-border bg-surface text-text"
        hidden={loadState === "failed"}
      />
    </>
  );
}
