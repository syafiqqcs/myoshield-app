import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const input = new URL("index.html", dist);
const output = new URL("MYOSHIELD.html", dist);

const mimeTypes = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const mimeFor = (file) => mimeTypes[extname(file).toLowerCase()] ?? "application/octet-stream";
const dataUri = (contents, mime) => `data:${mime};base64,${contents.toString("base64")}`;

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return files.flat();
}

async function inlineRemoteFonts(css) {
  const urls = [...css.matchAll(/url\((["']?)(https:\/\/[^"')]+)\1\)/g)].map((match) => match[2]);
  for (const url of new Set(urls)) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      css = css.replaceAll(
        url,
        dataUri(bytes, response.headers.get("content-type") || "font/woff2"),
      );
    } catch (error) {
      console.warn(`Could not inline font ${url}: ${error.message}`);
    }
  }
  return css;
}

let html = await readFile(input, "utf8");
const distPath = new URL(".", dist).pathname;
const allFiles = await filesUnder(distPath);

// Replace every public image reference used by runtime JSX or CSS. The Vite
// plugin has already embedded the generated JavaScript and CSS at this point.
for (const file of allFiles) {
  if (file === new URL(input).pathname || file === new URL(output).pathname) continue;
  if (file.endsWith(".js") || file.endsWith(".css")) continue;
  const path = `/${relative(distPath, file).replaceAll("\\", "/")}`;
  if (!html.includes(path) && !path.startsWith("/assets/")) continue;
  const encoded = dataUri(await readFile(file), mimeFor(file));
  html = html.replaceAll(path, encoded);
}

// Embed the remote project fonts when reachable so the file works offline.
html = await inlineRemoteFonts(html);

// Catch accidental local dependencies before calling the result standalone.
const unresolved = [
  ...html.matchAll(/(?:src|href)=["']\/(?!\/|data:)[^"']+["']/g),
  ...html.matchAll(/["'(]\/assets\/[^"'()]+/g),
];
if (unresolved.length) {
  throw new Error(
    `Standalone output still has local references: ${unresolved.slice(0, 5).join(", ")}`,
  );
}

await writeFile(output, html);
console.log(`Standalone MYOSHIELD written to ${output.pathname}`);
