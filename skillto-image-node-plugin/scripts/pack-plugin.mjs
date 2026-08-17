#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const rootArg = args._[0];
if (!rootArg) usage("Missing plugin directory.");
const root = resolve(process.cwd(), rootArg);
const slug = root.split(/[\\/]/).filter(Boolean).pop();
const outPath = resolve(process.cwd(), args.output || `${root}/dist/${slug}.zip`);
const table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const validation = spawnSync(process.execPath, [resolve(scriptDir, "validate-plugin.mjs"), root], { encoding: "utf8" });
if (validation.status !== 0) {
  process.stderr.write(validation.stdout || "");
  process.stderr.write(validation.stderr || "");
  process.exit(validation.status || 1);
}

const files = await collectFiles(root);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, await createZip(root, files));
console.log(`Packed ${files.length} files into ${outPath}`);

async function collectFiles(dir) {
  const result = [];
  for (const entry of await readdir(dir)) {
    if (entry === "dist" || entry === ".skillto-preview" || entry === ".skillto") continue;
    const fullPath = resolve(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      result.push(...await collectFiles(fullPath));
    } else if (info.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

async function createZip(rootPath, files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const data = await readFile(file);
    const name = relative(rootPath, file).split(sep).join("/");
    if (name.startsWith("../") || name.includes("/../") || /^[a-z]:/i.test(name)) {
      throw new Error(`Unsafe zip path: ${name}`);
    }
    const nameBuffer = Buffer.from(name);
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  }
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      result._.push(item);
      continue;
    }
    result[item.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/pack-plugin.mjs <plugin-dir> [--output dist/plugin.zip]");
  process.exit(1);
}
