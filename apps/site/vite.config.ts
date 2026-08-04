import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      mesurer: fileURLToPath(
        new URL("../../packages/mesurer/index.ts", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    exclude: ["mesurer"],
  },
  server: {
    strictPort: true,
  },
});
