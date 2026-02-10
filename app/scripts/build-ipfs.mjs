/**
 * Build script for IPFS static export.
 * Temporarily renames API route files and middleware so Next.js
 * static export doesn't pick them up, then restores after build.
 */
import { execSync } from "child_process";
import { existsSync, readdirSync, renameSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");

const renamed = [];

function disableFile(filePath) {
  if (existsSync(filePath)) {
    const bakPath = filePath + ".ipfs-bak";
    console.log(`  disable: ${filePath}`);
    renameSync(filePath, bakPath);
    renamed.push({ original: filePath, backup: bakPath });
  }
}

function findRouteFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findRouteFiles(full);
    } else if (entry === "route.ts" || entry === "route.js") {
      disableFile(full);
    }
  }
}

try {
  console.log("Preparing for static export...");

  // Disable all API route files
  const apiDir = resolve(appDir, "src", "app", "api");
  findRouteFiles(apiDir);

  // Disable middleware
  disableFile(resolve(appDir, "src", "middleware.ts"));

  console.log(`Disabled ${renamed.length} files.`);
  console.log("Building static site (STATIC_EXPORT=true)...\n");

  execSync("npx next build", {
    cwd: appDir,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, STATIC_EXPORT: "true" },
  });

  console.log("\nStatic export complete! Output in: app/out/");
} catch (err) {
  console.error("\nBuild failed:", err.message);
  process.exitCode = 1;
} finally {
  console.log("Restoring files...");
  for (const { original, backup } of renamed) {
    if (existsSync(backup)) {
      renameSync(backup, original);
      console.log(`  restore: ${original}`);
    }
  }
  console.log("Done.");
}
