// vite.config.ts
import { defineConfig } from "file:///D:/Infoyashonand_Technology/Insumitra17072026/Frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Infoyashonand_Technology/Insumitra17072026/Frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///D:/Infoyashonand_Technology/Insumitra17072026/Frontend/vite.config.ts";
var r = (p) => fileURLToPath(new URL(p, __vite_injected_original_import_meta_url));
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": r("src"),
      "@api": r("src/services"),
      "@hooks": r("src/hooks"),
      "@pages": r("src/pages"),
      "@comps": r("src/components"),
      "@store": r("src/store"),
      "@utils": r("src/utils")
    }
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3000/",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxJbmZveWFzaG9uYW5kX1RlY2hub2xvZ3lcXFxcSW5zdW1pdHJhMTcwNzIwMjZcXFxcRnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEluZm95YXNob25hbmRfVGVjaG5vbG9neVxcXFxJbnN1bWl0cmExNzA3MjAyNlxcXFxGcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovSW5mb3lhc2hvbmFuZF9UZWNobm9sb2d5L0luc3VtaXRyYTE3MDcyMDI2L0Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJztcclxuXHJcbmNvbnN0IHIgPSAocDogc3RyaW5nKSA9PiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwocCwgaW1wb3J0Lm1ldGEudXJsKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6ICAgICAgcignc3JjJyksXHJcbiAgICAgICdAYXBpJzogICByKCdzcmMvc2VydmljZXMnKSxcclxuICAgICAgJ0Bob29rcyc6IHIoJ3NyYy9ob29rcycpLFxyXG4gICAgICAnQHBhZ2VzJzogcignc3JjL3BhZ2VzJyksXHJcbiAgICAgICdAY29tcHMnOiByKCdzcmMvY29tcG9uZW50cycpLFxyXG4gICAgICAnQHN0b3JlJzogcignc3JjL3N0b3JlJyksXHJcbiAgICAgICdAdXRpbHMnOiByKCdzcmMvdXRpbHMnKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzQsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8nLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFYsU0FBUyxvQkFBb0I7QUFDelgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZSxXQUFXO0FBRndMLElBQU0sMkNBQTJDO0FBSTVRLElBQU0sSUFBSSxDQUFDLE1BQWMsY0FBYyxJQUFJLElBQUksR0FBRyx3Q0FBZSxDQUFDO0FBRWxFLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFVLEVBQUUsS0FBSztBQUFBLE1BQ2pCLFFBQVUsRUFBRSxjQUFjO0FBQUEsTUFDMUIsVUFBVSxFQUFFLFdBQVc7QUFBQSxNQUN2QixVQUFVLEVBQUUsV0FBVztBQUFBLE1BQ3ZCLFVBQVUsRUFBRSxnQkFBZ0I7QUFBQSxNQUM1QixVQUFVLEVBQUUsV0FBVztBQUFBLE1BQ3ZCLFVBQVUsRUFBRSxXQUFXO0FBQUEsSUFDekI7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFhO0FBQUEsUUFDYixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
