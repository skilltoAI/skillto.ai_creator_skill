#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const rootArg = args._[0];
if (!rootArg) usage("Missing plugin directory.");
const root = resolve(process.cwd(), rootArg);
const hostPath = resolve(root, ".skillto-preview/host.html");

const validation = spawnSync(process.execPath, [resolve(scriptDir, "validate-plugin.mjs"), root], { encoding: "utf8" });
if (validation.status !== 0) {
  process.stderr.write(validation.stdout || "");
  process.stderr.write(validation.stderr || "");
  process.exit(validation.status || 1);
}

await mkdir(dirname(hostPath), { recursive: true });
await writeFile(hostPath, hostHTML());

if (args.smoke) {
  const checks = [
    "panel/index.html",
    "reasoning/index.html",
    "shared/sdk.js",
    "shared/mock-host.js",
    ".skillto-preview/host.html"
  ];
  for (const file of checks) {
    if (!existsSync(resolve(root, file))) throw new Error(`Smoke check failed, missing ${file}`);
  }
  const panel = await readFile(resolve(root, "panel/panel.js"), "utf8");
  const reasoning = await readFile(resolve(root, "reasoning/reasoning.js"), "utf8");
  const mock = await readFile(resolve(root, "shared/mock-host.js"), "utf8");
  for (const required of ["inputs.getPrompt", "llm.responsesSync", "prompt.setDraft", "prompt.commit"]) {
    if (!panel.includes(required)) throw new Error(`Panel smoke check missing ${required}`);
  }
  if (!reasoning.includes("metadata") || !reasoning.includes("host.onUpdate")) {
    throw new Error("Reasoning smoke check missing metadata host update handling.");
  }
  if (!mock.includes("mockLLMResult") || !mock.includes("ui.openReasoning")) {
    throw new Error("Mock host smoke check is incomplete.");
  }
  console.log(`Preview smoke passed for ${root}`);
  process.exit(0);
}

const port = Number(args.port || 4177);
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  const filePath = resolve(root, url.pathname === "/" ? ".skillto-preview/host.html" : `.${decodeURIComponent(url.pathname)}`);
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": contentType(filePath) });
  response.end(await readFile(filePath));
});

server.listen(port, () => {
  console.log(`Preview: http://127.0.0.1:${port}/`);
});

function hostHTML() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>SkillTo.ai Plugin Preview</title>
  <style>
    body{margin:0;background:#080a09;color:#fff;font-family:Inter,Arial,sans-serif}
    header{height:56px;display:flex;align-items:center;padding:0 20px;border-bottom:1px solid rgba(255,255,255,.12)}
    main{display:grid;grid-template-columns:680px 1fr;gap:20px;padding:20px}
    iframe{border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#151816}
    #reasoningWrap{display:none;position:fixed;inset:40px;background:#101614;border:1px solid rgba(55,252,48,.28);border-radius:18px;padding:18px;box-shadow:0 28px 90px rgba(0,0,0,.55)}
    body.show-reasoning #reasoningWrap{display:block}
    #close{position:absolute;right:18px;top:18px}
  </style>
</head>
<body>
  <header><strong>SkillTo.ai image node plugin preview</strong></header>
  <main>
    <iframe id="panel" src="/panel/index.html?nonce=dev" width="680" height="760"></iframe>
    <section><p>Use the panel to run the mock LLM and open the reasoning modal.</p></section>
  </main>
  <section id="reasoningWrap">
    <button id="close">Close</button>
    <iframe id="reasoning" src="/reasoning/index.html?nonce=dev" width="100%" height="760"></iframe>
  </section>
  <script src="/shared/mock-host.js"></script>
  <script>
    SkillToMockHost.attach(document.getElementById("panel"), document.getElementById("reasoning"));
    document.getElementById("close").onclick = () => document.body.classList.remove("show-reasoning");
  </script>
</body>
</html>`;
}

function contentType(filePath) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[extname(filePath).toLowerCase()] || "application/octet-stream";
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
  console.error("Usage: node scripts/preview-plugin.mjs <plugin-dir> [--port 4177] [--smoke]");
  process.exit(1);
}
