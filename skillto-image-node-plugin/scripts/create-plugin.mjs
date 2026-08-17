#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const rawName = args._[0];
if (!rawName) usage("Missing plugin name.");

const slug = slugify(rawName);
const outputRoot = resolve(process.cwd(), args.output || "work");
const target = resolve(outputRoot, slug);
const templateName = args.template || "static-image-node-plugin";
const templateRoot = resolve(skillRoot, "assets/templates", templateName);

if (!existsSync(templateRoot)) usage(`Unknown template: ${templateName}`);
if (existsSync(target) && !args.force) usage(`Target already exists: ${target}. Use --force to overwrite.`);

await mkdir(outputRoot, { recursive: true });
await cp(templateRoot, target, { recursive: true, force: Boolean(args.force) });
await replaceInFiles(target, {
  __CREATOR_NAME__: args.creator || "SkillTo.ai Creator",
  __PLUGIN_NAME_EN__: titleCase(slug),
  __PLUGIN_NAME_ZH__: args.zh || titleCase(slug),
  __PLUGIN_SLUG__: slug,
  __PLUGIN_UUID__: `creator.${slug}`
});
const stateDir = resolve(target, ".skillto");
const skillProductKey = String(args["skill-product-key"] || `skill_product_key_${randomUUID()}`);
await mkdir(stateDir, { recursive: true });
await writeFile(resolve(stateDir, "skill-app.json"), `${JSON.stringify({
  skill_product_key: skillProductKey,
  slug,
  created_at: new Date().toISOString()
}, null, 2)}\n`);

console.log(`Created SkillTo.ai image node plugin at ${target}`);
console.log(`Skill product key: ${skillProductKey}`);

async function replaceInFiles(root, replacements) {
  for (const entry of await readdir(root)) {
    const fullPath = resolve(root, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      await replaceInFiles(fullPath, replacements);
    } else if (info.isFile() && isTextFile(fullPath)) {
      let content = await readFile(fullPath, "utf8");
      for (const [key, value] of Object.entries(replacements)) {
        content = content.split(key).join(value);
      }
      await writeFile(fullPath, content);
    }
  }
}

function isTextFile(path) {
  return /\.(css|html|js|json|md|svg|ts)$/i.test(path);
}

function slugify(value) {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) usage(`Invalid plugin name: ${value}`);
  return slug.slice(0, 64);
}

function titleCase(value) {
  return basename(value).split("-").filter(Boolean).map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      result._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/create-plugin.mjs <name> [--output ./work] [--template static-image-node-plugin] [--creator name] [--zh 中文名] [--skill-product-key skill_product_key_xxx] [--force]");
  process.exit(1);
}
