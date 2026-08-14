// vite.config.ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "file:///Users/julienthibeaut/code/mesurer/node_modules/.pnpm/vite@5.4.21_lightningcss@1.32.0/node_modules/vite/dist/node/index.js";
import react from "file:///Users/julienthibeaut/code/mesurer/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_lightningcss@1.32.0_/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///Users/julienthibeaut/code/mesurer/node_modules/.pnpm/@tailwindcss+vite@4.2.2_vite@5.4.21_lightningcss@1.32.0_/node_modules/@tailwindcss/vite/dist/index.mjs";
var __vite_injected_original_import_meta_url = "file:///Users/julienthibeaut/code/mesurer/apps/site/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      mesurer: fileURLToPath(
        new URL("../../packages/mesurer/index.ts", __vite_injected_original_import_meta_url)
      )
    }
  },
  optimizeDeps: {
    exclude: ["mesurer"]
  },
  server: {
    strictPort: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvanVsaWVudGhpYmVhdXQvY29kZS9tZXN1cmVyL2FwcHMvc2l0ZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2p1bGllbnRoaWJlYXV0L2NvZGUvbWVzdXJlci9hcHBzL3NpdGUvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2p1bGllbnRoaWJlYXV0L2NvZGUvbWVzdXJlci9hcHBzL3NpdGUvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tIFwibm9kZTp1cmxcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt0YWlsd2luZGNzcygpLCByZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBtZXN1cmVyOiBmaWxlVVJMVG9QYXRoKFxuICAgICAgICBuZXcgVVJMKFwiLi4vLi4vcGFja2FnZXMvbWVzdXJlci9pbmRleC50c1wiLCBpbXBvcnQubWV0YS51cmwpLFxuICAgICAgKSxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbXCJtZXN1cmVyXCJdLFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNULFNBQVMsZUFBZSxXQUFXO0FBQ3pWLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUh3SyxJQUFNLDJDQUEyQztBQUtqUCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQztBQUFBLEVBQ2hDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFNBQVM7QUFBQSxRQUNQLElBQUksSUFBSSxtQ0FBbUMsd0NBQWU7QUFBQSxNQUM1RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUztBQUFBLEVBQ3JCO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixZQUFZO0FBQUEsRUFDZDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
