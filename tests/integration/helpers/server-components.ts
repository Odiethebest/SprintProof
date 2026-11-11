import { Suspense, isValidElement, type ReactNode } from "react";
import {
  getAccessFallbackHTTPStatus,
  isHTTPAccessFallbackError,
} from "next/dist/client/components/http-access-fallback/http-access-fallback";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";

type AsyncComponent = (props: unknown) => Promise<ReactNode>;

// Pages and layouts wrap their request-time work in <Suspense> (Cache
// Components). This calls the async component inside, the way React would, so
// a redirect() or notFound() it calls reaches the test as a thrown error.
export async function renderSuspended(element: ReactNode): Promise<ReactNode> {
  if (
    !isValidElement<{ children: ReactNode }>(element) ||
    element.type !== Suspense
  ) {
    throw new Error("Expected the <Suspense> element a page or layout returns");
  }
  const content = element.props.children;
  if (!isValidElement(content) || typeof content.type !== "function") {
    throw new Error("Expected an async component inside <Suspense>");
  }
  return (content.type as AsyncComponent)(content.props);
}

// The URLs the renders redirected to. A render that finishes without a
// redirect adds nothing; any other error fails the test.
export async function collectRedirects(
  renders: Array<Promise<unknown>>
): Promise<string[]> {
  const results = await Promise.allSettled(renders);
  return results.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [];
    }
    if (isRedirectError(result.reason)) {
      return [getURLFromRedirectError(result.reason)];
    }
    throw result.reason;
  });
}

export type RenderOutcome =
  | { kind: "RENDERED" }
  | { kind: "REDIRECT"; url: string }
  | { kind: "NOT_FOUND" };

// What a render did: finished, redirected, or called notFound(). Any other
// error fails the test.
export async function getRenderOutcome(
  render: Promise<unknown>
): Promise<RenderOutcome> {
  try {
    await render;
    return { kind: "RENDERED" };
  } catch (error) {
    if (isRedirectError(error)) {
      return { kind: "REDIRECT", url: getURLFromRedirectError(error) };
    }
    if (
      isHTTPAccessFallbackError(error) &&
      getAccessFallbackHTTPStatus(error) === 404
    ) {
      return { kind: "NOT_FOUND" };
    }
    throw error;
  }
}
