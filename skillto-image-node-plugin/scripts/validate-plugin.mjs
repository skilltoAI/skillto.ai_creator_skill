#!/usr/bin/env node
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const args = parseArgs(process.argv.slice(2));
const rootArg = args._[0];
if (!rootArg) usage("Missing plugin directory.");
const root = resolve(process.cwd(), rootArg);
const errors = [];
const warnings = [];

await validateRoot(root);
if (errors.length) {
  console.error(`Validation failed for ${root}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
for (const warning of warnings) console.warn(`Warning: ${warning}`);
console.log(`Validated SkillTo.ai image node plugin at ${root}`);

async function validateRoot(rootPath) {
  if (!existsSync(rootPath)) {
    fail(`Directory does not exist: ${rootPath}`);
    return;
  }
  const manifestPath = resolve(rootPath, "skillto.skill.json");
  if (!existsSync(manifestPath)) fail("Missing skillto.skill.json");
  const manifest = readJSON(manifestPath);
  if (manifest.manifest_version !== "2026-08-sandbox-js") fail("manifest_version must be 2026-08-sandbox-js");
  if (manifest.ui_slots?.panel?.entry !== "panel/index.html") fail("ui_slots.panel.entry must be panel/index.html");
  if (manifest.ui_slots?.reasoning?.entry !== "reasoning/index.html") fail("ui_slots.reasoning.entry must be reasoning/index.html");
  if (!manifest.output_schema?.required?.includes("modified_prompt")) fail("output_schema must require modified_prompt");
  if (!manifest.permissions?.includes("llm.responses.sync")) fail("permissions must include llm.responses.sync");
  if (!manifest.permissions?.includes("write.prompt_patch")) fail("permissions must include write.prompt_patch");

  for (const entry of ["panel/index.html", "reasoning/index.html", "shared/sdk.js", "shared/sdk.d.ts"]) {
    if (!existsSync(resolve(rootPath, entry))) fail(`Missing ${entry}`);
  }

  await validateFiles(rootPath, rootPath);
  await validateHTML(resolve(rootPath, "panel/index.html"));
  await validateHTML(resolve(rootPath, "reasoning/index.html"));
}

async function validateFiles(rootPath, dir) {
  for (const entry of await readdir(dir)) {
    const fullPath = resolve(dir, entry);
    const relative = fullPath.slice(rootPath.length + 1).split(sep).join("/");
    const info = await lstat(fullPath);
    if (relative.split("/").includes("..") || relative.startsWith("/") || /^[a-z]:/i.test(relative)) fail(`Unsafe path: ${relative}`);
    if (info.isSymbolicLink()) fail(`Symlink is not allowed: ${relative}`);
    if (info.isDirectory()) {
      await validateFiles(rootPath, fullPath);
      continue;
    }
    if (!info.isFile()) continue;
    if (info.size > 2 * 1024 * 1024) fail(`File is too large: ${relative}`);
    if ([".env", ".pem", ".key", ".p12"].includes(extname(entry).toLowerCase())) fail(`Secret-like file extension is not allowed: ${relative}`);
    if (isTextFile(entry)) {
      const content = await readFile(fullPath, "utf8");
      validateText(content, relative);
    }
  }
}

async function validateHTML(path) {
  const content = await readFile(path, "utf8");
  if (!content.includes("Content-Security-Policy")) fail(`${path} is missing CSP`);
  if (!/connect-src\s+'none'/.test(content)) fail(`${path} CSP must include connect-src 'none'`);
  if (!content.includes("../shared/sdk.js")) fail(`${path} must load ../shared/sdk.js`);
}

function validateText(content, relative) {
  const secretPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{20,}/,
    /\bskap_[A-Za-z0-9_-]{12,}/,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}/,
    /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{16,}["']/i
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) fail(`Potential secret in ${relative}`);
  }
  if (/fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(content) && !relative.endsWith("upload-plugin.mjs")) {
    fail(`Direct network API is not allowed in packaged plugin file: ${relative}`);
  }
  if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(content)) {
    fail(`Browser storage/cookie access is not allowed: ${relative}`);
  }
}

function readJSON(path) {
  try {
    return JSON.parse(requireRead(path));
  } catch (error) {
    fail(`Invalid JSON ${path}: ${error.message}`);
    return {};
  }
}

function requireRead(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function isTextFile(name) {
  return /\.(css|html|js|json|md|svg|ts|txt)$/i.test(name);
}

function fail(message) {
  errors.push(message);
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) result._.push(item);
  }
  return result;
}

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/validate-plugin.mjs <plugin-dir>");
  process.exit(1);
}
