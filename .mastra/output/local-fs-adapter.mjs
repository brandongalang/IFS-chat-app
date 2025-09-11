import fs from 'fs/promises';
import path from 'path';
import { e as MEMORY_LOCAL_ROOT } from './part-schemas.mjs';
import 'zod';

function resolveSafe(userPath) {
  const rootAbs = path.resolve(process.cwd(), MEMORY_LOCAL_ROOT);
  const full = path.resolve(rootAbs, userPath.replace(/^\/+/, ""));
  if (!full.startsWith(rootAbs + path.sep) && full !== rootAbs) {
    throw new Error("Path traversal detected");
  }
  return { rootAbs, full };
}
class LocalFsStorageAdapter {
  async putText(userPath, text) {
    const { full } = resolveSafe(userPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text, "utf8");
  }
  async getText(userPath) {
    const { full } = resolveSafe(userPath);
    try {
      return await fs.readFile(full, "utf8");
    } catch {
      return null;
    }
  }
  async exists(userPath) {
    const { full } = resolveSafe(userPath);
    try {
      await fs.access(full);
      return true;
    } catch {
      return false;
    }
  }
  async list(prefix) {
    const { rootAbs, full } = resolveSafe(prefix);
    const out = [];
    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else out.push(path.relative(rootAbs, p));
      }
    }
    try {
      await walk(full);
    } catch {
    }
    return out;
  }
  async delete(userPath) {
    const { full } = resolveSafe(userPath);
    try {
      await fs.unlink(full);
    } catch {
    }
  }
}

export { LocalFsStorageAdapter };
