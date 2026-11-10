// ============================================================
// Environment-Safe Writable Storage Directory Helper
// - Local dev / self-hosted: `<project>/data/...` (persistent disk)
// - Cloud Serverless (Vercel/Lambda): `<os.tmpdir()>/durian-winkin-data/...`
// ============================================================
import fs from "fs";
import os from "os";
import path from "path";

export function isCloudServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getWritableDataDir(...subpaths: string[]): string {
  const base = isCloudServerless()
    ? path.join(os.tmpdir(), "durian-winkin-data")
    : path.join(process.cwd(), "data");
  const target = path.join(base, ...subpaths);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}
