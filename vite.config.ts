import { readFileSync } from "fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Read here (Node context) rather than importing package.json into src/ --
// keeps the whole file out of the bundle, exposing only the one field the
// landing page footer needs.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8"))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __CREATE_GRIST_WIDGET_VERSION__: JSON.stringify(pkg.createGristWidgetVersion ?? null),
  },
})
