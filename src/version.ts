import { readFileSync } from "node:fs";

/** Version from package.json (works from both src/ and dist/, one level below the package root). */
export function packageVersion(): string {
  const file = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(readFileSync(file, "utf8")) as { version: string };
  return pkg.version;
}
