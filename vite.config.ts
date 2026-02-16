import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            "/api": {
                target: "https://api.seekkrr.com",
                changeOrigin: true,
                secure: true,
            },
        },
    },
    build: {
        outDir: "dist",
        sourcemap: false,
        minify: "esbuild",
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom"],
                    router: ["react-router-dom"],
                    query: ["@tanstack/react-query"],
                    mapbox: ["mapbox-gl"],
                },
                entryFileNames: "js/[name]-[hash].js",
                chunkFileNames: "js/[name]-[hash].js",
                assetFileNames: (assetInfo) => {
                    const name = assetInfo.name ?? "";
                    const info = name.split(".");
                    const ext = info[info.length - 1] ?? "";
                    if (/png|jpe?g|gif|svg|webp/.test(ext)) {
                        return "images/[name]-[hash][extname]";
                    } else if (/woff|woff2|eot|ttf|otf/.test(ext)) {
                        return "fonts/[name]-[hash][extname]";
                    } else if (ext === "css") {
                        return "css/[name]-[hash][extname]";
                    }
                    return "[name]-[hash][extname]";
                },
            },
        },
        target: "ES2020",
        cssCodeSplit: true,
        reportCompressedSize: true,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@app": path.resolve(__dirname, "./src/app"),
            "@features": path.resolve(__dirname, "./src/features"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@layouts": path.resolve(__dirname, "./src/layouts"),
            "@hooks": path.resolve(__dirname, "./src/hooks"),
            "@services": path.resolve(__dirname, "./src/services"),
            "@store": path.resolve(__dirname, "./src/store"),
            "@routes": path.resolve(__dirname, "./src/routes"),
            "@config": path.resolve(__dirname, "./src/config"),
            "@types": path.resolve(__dirname, "./src/types"),
            "@utils": path.resolve(__dirname, "./src/utils"),
            "@styles": path.resolve(__dirname, "./src/styles"),
        },
    },
    optimizeDeps: {
        include: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
    },
});
