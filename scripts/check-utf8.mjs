import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const TARGET_DIRS = ["app", "lib", "scripts", "components"]; // components exists if added later
const ROOT_FILES = ["README.md", "PRD.md", "PERF_OPTIMIZATION.md"];
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md"]);

const decoder = new TextDecoder("utf-8", { fatal: true });

const shouldScan = (file) => TARGET_EXTENSIONS.has(extname(file));

const collectFiles = async (dir, root) => {
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath, root)));
    } else if (entry.isFile() && shouldScan(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
};

const main = async () => {
  const root = process.cwd();
  const files = [];
  for (const dir of TARGET_DIRS) {
    files.push(...(await collectFiles(dir, root)));
  }
  for (const file of ROOT_FILES) {
    if (shouldScan(file)) {
      files.push(file);
    }
  }

  const invalid = [];

  for (const file of files) {
    const data = await readFile(join(root, file));
    try {
      decoder.decode(data);
    } catch {
      invalid.push(file);
    }
  }

  if (invalid.length) {
    console.error("Invalid UTF-8 detected:");
    invalid.forEach((file) => console.error(`- ${file}`));
    console.error("Fix: VSCode 'Save with Encoding' -> UTF-8 (or re-create the file)." );
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("UTF-8 check failed.", error);
  process.exit(1);
});
