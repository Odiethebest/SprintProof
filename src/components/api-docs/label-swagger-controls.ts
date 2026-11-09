// Swagger UI leaves some controls without an accessible name (axe: label,
// select-name), and its code samples scroll without taking keyboard focus
// (axe: scrollable-region-focusable). This fills those gaps after each render.
// Running it again changes nothing unless Swagger changed the page.

// "teamId (path)". An opened operation first shows placeholder rows with no
// name while Swagger resolves shared parameters, so those get a generic name
// until the real row arrives.
function parameterLabel(row: Element | null): string {
  const name = row
    ?.querySelector(".parameter__name")
    ?.firstChild?.textContent?.trim();
  if (!name) {
    return "Parameter";
  }
  const location = row?.querySelector(".parameter__in")?.textContent?.trim();
  return location ? `${name} ${location}` : name;
}

function setAttributeIfChanged(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

export function labelSwaggerControls(root: HTMLElement): void {
  for (const field of root.querySelectorAll(
    ".parameters input, .parameters select, .parameters textarea"
  )) {
    setAttributeIfChanged(
      field,
      "aria-label",
      parameterLabel(field.closest("tr"))
    );
  }
  for (const select of root.querySelectorAll(
    "select.examples-select-element:not([aria-label])"
  )) {
    select.setAttribute("aria-label", "Example");
  }
  for (const textarea of root.querySelectorAll(
    "textarea.body-param__text:not([aria-label])"
  )) {
    textarea.setAttribute("aria-label", "Request body");
  }
  for (const sample of root.querySelectorAll(
    "pre.microlight:not([tabindex])"
  )) {
    sample.setAttribute("tabindex", "0");
  }
  // Swagger renders its own <main>; inside the page's <main> it's a region.
  for (const main of root.querySelectorAll("main:not([role])")) {
    main.setAttribute("role", "region");
    main.setAttribute("aria-label", "Endpoints");
  }
}
