// vite.config.ts
import { defineConfig } from "file:///D:/Infoyashonand_Technology/InsuMitra_Testing/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Infoyashonand_Technology/InsuMitra_Testing/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///D:/Infoyashonand_Technology/InsuMitra_Testing/frontend/vite.config.ts";
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
    port: 5173,
    proxy: {
      "/api": {
        target: "https://insumitra-zpcy.onrender.com/",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxJbmZveWFzaG9uYW5kX1RlY2hub2xvZ3lcXFxcSW5zdU1pdHJhX1Rlc3RpbmdcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEluZm95YXNob25hbmRfVGVjaG5vbG9neVxcXFxJbnN1TWl0cmFfVGVzdGluZ1xcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovSW5mb3lhc2hvbmFuZF9UZWNobm9sb2d5L0luc3VNaXRyYV9UZXN0aW5nL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJztcclxuXHJcbmNvbnN0IHIgPSAocDogc3RyaW5nKSA9PiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwocCwgaW1wb3J0Lm1ldGEudXJsKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6ICAgICAgcignc3JjJyksXHJcbiAgICAgICdAYXBpJzogICByKCdzcmMvc2VydmljZXMnKSxcclxuICAgICAgJ0Bob29rcyc6IHIoJ3NyYy9ob29rcycpLFxyXG4gICAgICAnQHBhZ2VzJzogcignc3JjL3BhZ2VzJyksXHJcbiAgICAgICdAY29tcHMnOiByKCdzcmMvY29tcG9uZW50cycpLFxyXG4gICAgICAnQHN0b3JlJzogcignc3JjL3N0b3JlJyksXHJcbiAgICAgICdAdXRpbHMnOiByKCdzcmMvdXRpbHMnKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzMsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICAgICAgJ2h0dHBzOi8vaW5zdW1pdHJhLXpwY3kub25yZW5kZXIuY29tLycsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0VixTQUFTLG9CQUFvQjtBQUN6WCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlLFdBQVc7QUFGd0wsSUFBTSwyQ0FBMkM7QUFJNVEsSUFBTSxJQUFJLENBQUMsTUFBYyxjQUFjLElBQUksSUFBSSxHQUFHLHdDQUFlLENBQUM7QUFFbEUsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQVUsRUFBRSxLQUFLO0FBQUEsTUFDakIsUUFBVSxFQUFFLGNBQWM7QUFBQSxNQUMxQixVQUFVLEVBQUUsV0FBVztBQUFBLE1BQ3ZCLFVBQVUsRUFBRSxXQUFXO0FBQUEsTUFDdkIsVUFBVSxFQUFFLGdCQUFnQjtBQUFBLE1BQzVCLFVBQVUsRUFBRSxXQUFXO0FBQUEsTUFDdkIsVUFBVSxFQUFFLFdBQVc7QUFBQSxJQUN6QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQWE7QUFBQSxRQUNiLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
