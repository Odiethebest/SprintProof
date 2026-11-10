import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const css = readFileSync("src/app/globals.css", "utf8");
function luminance(hex: string) {
  const rgb = hex.match(/[a-f0-9]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
it.each([0, 1])("form-control borders have at least 3:1 contrast in theme %i", theme => {
  const borders = [...css.matchAll(/--form-control-border:\s*(#[a-f0-9]{6})/gi)];
  const surfaces = [...css.matchAll(/--surface:\s*(#[a-f0-9]{6})/gi)];
  expect(borders).toHaveLength(2);
  const a = luminance(borders[theme][1]), b = luminance(surfaces[theme][1]);
  expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(3);
  expect(css).toContain("--color-form-control-border: var(--form-control-border)");
});
