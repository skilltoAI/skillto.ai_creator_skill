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
const PLATFORM_SLOT_LIMITS = {
  panel: { width: 680, height: 760 },
  reasoning: { width: 1260, height: 820 }
};

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
  validateManifestSlotSize(manifest, "panel");
  validateManifestSlotSize(manifest, "reasoning");
  if (!manifest.output_schema?.required?.includes("modified_prompt")) fail("output_schema must require modified_prompt");
  if (!manifest.permissions?.includes("llm.responses.sync")) fail("permissions must include llm.responses.sync");
  if (!manifest.permissions?.includes("write.prompt_patch")) fail("permissions must include write.prompt_patch");

  for (const entry of ["panel/index.html", "reasoning/index.html", "shared/sdk.js", "shared/sdk.d.ts"]) {
    if (!existsSync(resolve(rootPath, entry))) fail(`Missing ${entry}`);
  }

  await validateFiles(rootPath, rootPath);
  await validateHTML(resolve(rootPath, "panel/index.html"));
  await validateHTML(resolve(rootPath, "reasoning/index.html"));
  await validateSlotContentDimensions(rootPath, manifest, "panel");
  await validateSlotContentDimensions(rootPath, manifest, "reasoning");
}

function validateManifestSlotSize(manifest, slotName) {
  const slot = manifest.ui_slots?.[slotName] || {};
  const limits = PLATFORM_SLOT_LIMITS[slotName];
  const width = Number(slot.width);
  const height = Number(slot.height);
  if (!Number.isFinite(width) || width <= 0) fail(`ui_slots.${slotName}.width must be a positive number`);
  if (!Number.isFinite(height) || height <= 0) fail(`ui_slots.${slotName}.height must be a positive number`);
  if (width > limits.width) fail(`ui_slots.${slotName}.width ${width}px exceeds platform limit ${limits.width}px`);
  if (height > limits.height) fail(`ui_slots.${slotName}.height ${height}px exceeds platform limit ${limits.height}px`);
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

async function validateSlotContentDimensions(rootPath, manifest, slotName) {
  const slot = manifest.ui_slots?.[slotName] || {};
  const width = Number(slot.width);
  const height = Number(slot.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  await validateSlotDirectoryDimensions(rootPath, resolve(rootPath, slotName), slotName, { width, height });
}

async function validateSlotDirectoryDimensions(rootPath, dir, slotName, slotSize) {
  if (!existsSync(dir)) return;
  for (const entry of await readdir(dir)) {
    const fullPath = resolve(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      await validateSlotDirectoryDimensions(rootPath, fullPath, slotName, slotSize);
      continue;
    }
    if (!info.isFile() || !isTextFile(entry)) continue;
    const relative = fullPath.slice(rootPath.length + 1).split(sep).join("/");
    const content = await readFile(fullPath, "utf8");
    validateDimensionDeclarations(content, relative, slotName, slotSize);
  }
}

function validateDimensionDeclarations(content, relative, slotName, slotSize) {
  const cssDeclarationPattern = /(?:^|[;{\s])((?:min-|max-)?(?:width|height))\s*:\s*([^;{}]+)/gi;
  for (const match of content.matchAll(cssDeclarationPattern)) {
    const property = match[1].toLowerCase();
    const value = match[2];
    validatePixelValues(property, value, relative, slotName, slotSize);
  }

  const htmlAttributePattern = /\b(width|height)\s*=\s*["']?(\d+(?:\.\d+)?)["']?/gi;
  for (const match of content.matchAll(htmlAttributePattern)) {
    validatePixelValue(match[1].toLowerCase(), Number(match[2]), relative, slotName, slotSize);
  }

  const jsStylePattern = /\b(width|height|minWidth|minHeight|maxWidth|maxHeight)\s*=\s*["'`](\d+(?:\.\d+)?)px["'`]/g;
  for (const match of content.matchAll(jsStylePattern)) {
    validatePixelValue(match[1].replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), Number(match[2]), relative, slotName, slotSize);
  }
}

function validatePixelValues(property, value, relative, slotName, slotSize) {
  const pixelPattern = /(-?\d+(?:\.\d+)?)px/gi;
  for (const match of value.matchAll(pixelPattern)) {
    validatePixelValue(property, Number(match[1]), relative, slotName, slotSize);
  }
}

function validatePixelValue(property, value, relative, slotName, slotSize) {
  if (!Number.isFinite(value) || value <= 0) return;
  const axis = property.toLowerCase().includes("height") ? "height" : "width";
  const limit = slotSize[axis];
  if (value > limit) {
    fail(`${relative} declares ${property}: ${value}px, exceeding ${slotName} iframe ${axis} ${limit}px`);
  }
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
