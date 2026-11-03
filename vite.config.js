import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// Each <!-- illos:name --> comment in index.html becomes the inline SVG from illos/name.svg,
// so the animated assets read the page's --illos-* colours.
// It runs after Vite's own HTML pass, so the assets' inline styles reach the page untouched.
const inlineIllos = {
  name: "inline-illos",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html.replace(/<!--\s*illos:([\w-]+)\s*-->/g, (_, name) =>
        readFileSync(new URL(`./illos/${name}.svg`, import.meta.url), "utf8").trim()
      ),
  },
};

export default defineConfig({ plugins: [inlineIllos] });
