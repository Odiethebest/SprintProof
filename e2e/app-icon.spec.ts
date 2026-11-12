import { test, expect, type Page } from "@playwright/test";

// The tab icon is the SprintProof mark (#112): the same --primary rounded square
// with a white check as AppMark, instead of Next's default favicon.ico. The root
// layout sets it, so any page shows it; these two need no sign-in.
const PAGES = ["/signin", "/api-docs"];
const PRIMARY = "#0f766e";
const PRIMARY_FG = "#ffffff";

async function iconHrefs(page: Page): Promise<string[]> {
  return page
    .locator('head link[rel~="icon"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? "")
    );
}

for (const path of PAGES) {
  test(`${path} links the SprintProof mark as an SVG icon`, async ({
    page,
    request,
  }) => {
    await page.goto(path);

    const svgIcon = page.locator('head link[rel="icon"][type="image/svg+xml"]');
    await expect(svgIcon).toHaveCount(1);
    const href = await svgIcon.getAttribute("href");
    expect(href).toBeTruthy();

    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
    const svg = await response.text();
    expect(svg).toContain(`fill="${PRIMARY}"`);
    expect(svg).toContain(`stroke="${PRIMARY_FG}"`);
  });

  test(`${path} no longer links Next's default favicon.ico`, async ({
    page,
  }) => {
    await page.goto(path);

    const hrefs = await iconHrefs(page);
    expect(hrefs.filter((href) => href.startsWith("/favicon.ico"))).toEqual([]);
  });
}
