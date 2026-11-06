/**
 * Runs the unit tests (src/**\/*.test.ts(x)) with Node's built-in test runner.
 * Vite (already a dev dependency) loads each test file the way the app is
 * built: TypeScript and JSX compiled, "@/…" aliases resolved, import.meta.env
 * filled. Tests use node:test and node:assert; nothing runs in a browser.
 *
 *   npm test                     every test file
 *   npm test -- chatModel        only files whose path contains "chatModel"
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filters = process.argv.slice(2);

function findTests(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...findTests(full));
        else if (/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

const files = findTests(path.join(root, "src"))
    .filter((f) => !filters.length || filters.some((q) => f.replaceAll("\\", "/").includes(q)))
    .sort();

if (!files.length) {
    console.error(filters.length ? `No test files match: ${filters.join(", ")}` : "No test files found.");
    process.exit(1);
}

const server = await createServer({
    root,
    mode: "test",
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
});

try {
    // Each file registers its tests with node:test as it loads; they run (and report) once all are in.
    for (const file of files) await server.ssrLoadModule(file);
} catch (e) {
    console.error(e);
    process.exitCode = 1;
} finally {
    await server.close();
}
