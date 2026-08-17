#!/usr/bin/env node
import { openAsBlob } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const zipArg = args._[0];
if (!zipArg) usage("Missing plugin zip path.");
const zipPath = resolve(process.cwd(), zipArg);
if (!existsSync(zipPath)) usage(`Zip file does not exist: ${zipPath}`);
const pluginRoot = resolvePluginRoot(zipPath, args["plugin-root"]);
const statePath = resolve(pluginRoot, ".skillto/skill-app.json");
const state = await readState(statePath);
const skillProductKey = String(args["skill-product-key"] || state.skill_product_key || `skill_product_key_${randomUUID()}`);
state.skill_product_key = skillProductKey;
state.plugin_root = pluginRoot;
await writeState(statePath, state);

const apiKey = process.env.SKILLTO_CREATOR_API_KEY || "";
if (!apiKey) {
  console.error("Missing SKILLTO_CREATOR_API_KEY. Create a skap_ key in /account/creator/api-keys and export it locally.");
  process.exit(1);
}
if (!apiKey.startsWith("skap_")) {
  console.error("SKILLTO_CREATOR_API_KEY must be a creator Agent key beginning with skap_.");
  process.exit(1);
}

const baseURL = resolveBaseURL(args);
if (truthy(args["insecure-tls"])) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.error("Warning: TLS certificate verification is disabled for this upload process.");
}
const endpoint = `${baseURL}/api/skillto-v2/creator-agent/skill-apps/packages`;
const form = new FormData();
form.set("package", await openAsBlob(zipPath, { type: "application/zip" }), basename(zipPath));
form.set("release_note", String(args["release-note"] || ""));
form.set("deploy", String(args.deploy ?? "true"));
form.set("skill_product_key", skillProductKey);

const productPayload = await resolveProductPayload(args, pluginRoot);
if (productPayload) {
  form.set("product_payload", JSON.stringify(productPayload));
}

let response;
let text = "";
try {
  if (args["host-header"]) {
    const curlResponse = await uploadWithCurl({
      apiKey,
      deploy: String(args.deploy ?? "true"),
      endpoint,
      hostHeader: String(args["host-header"]),
      insecureTLS: truthy(args["insecure-tls"]),
      packagePath: zipPath,
      productPayload,
      releaseNote: String(args["release-note"] || ""),
      skillProductKey
    });
    response = { ok: curlResponse.status >= 200 && curlResponse.status < 300, status: curlResponse.status, statusText: "curl" };
    text = curlResponse.text;
  } else {
    response = await fetch(endpoint, {
      body: form,
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      method: "POST"
    });
    text = await response.text();
  }
} catch (error) {
  console.error(`Could not reach SkillTo.ai plugin upload API at ${endpoint}. Local zip remains unchanged.`);
  console.error(error.message);
  process.exit(1);
}

let parsed = null;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = null;
}

if (!response.ok || parsed?.success === false) {
  const reason = stringifyReason(parsed?.message || parsed?.error || text || response.statusText);
  if (response.status === 404) {
    console.error("Plugin upload API is not available on this SkillTo.ai deployment yet. Local zip remains unchanged.");
  }
  console.error(`Upload failed (${response.status}): ${reason}`);
  process.exit(1);
}

console.log(JSON.stringify(parsed || { success: true, raw: text }, null, 2));
const data = parsed?.data || parsed;
if (data && typeof data === "object") {
  const nextState = {
    ...state,
    skill_product_key: data.skill_product_key || skillProductKey,
    skill_app_uuid: data.skill_app_uuid || state.skill_app_uuid,
    last_version_uuid: data.version_uuid || state.last_version_uuid,
    status: data.status || state.status,
    panel_url: data.panel_url || state.panel_url,
    reasoning_url: data.reasoning_url || state.reasoning_url,
    debug_url: data.debug_url || state.debug_url,
    product: data.product || state.product,
    last_upload_at: new Date().toISOString()
  };
  await writeState(statePath, nextState);
  console.error(`Recorded Skill product key and deployment state at ${statePath}`);
}
console.error(`Skill product key: ${data?.skill_product_key || skillProductKey}`);

function resolvePluginRoot(packagePath, explicitRoot) {
  if (explicitRoot) return resolve(process.cwd(), explicitRoot);
  const maybeDist = dirname(packagePath);
  if (basename(maybeDist) === "dist") return dirname(maybeDist);
  return maybeDist;
}

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

async function writeState(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function resolveProductPayload(parsedArgs, root) {
  if (parsedArgs["product-payload"]) {
    const raw = String(parsedArgs["product-payload"]);
    const payloadText = existsSync(resolve(process.cwd(), raw)) ? await readFile(resolve(process.cwd(), raw), "utf8") : raw;
    return JSON.parse(payloadText);
  }
  if (!truthy(parsedArgs["create-product"]) && !truthy(parsedArgs["submit-review"])) {
    return null;
  }
  const manifest = await readManifest(root);
  const fallbackTitle = manifest?.name?.["zh-CN"] || manifest?.name?.["en-US"] || basename(root);
  return {
    enabled: true,
    submit_review: truthy(parsedArgs["submit-review"]),
    confirm_review_fee: truthy(parsedArgs["confirm-review-fee"]),
    procurement_agreement_accepted: truthy(parsedArgs["procurement-agreement-accepted"]),
    procurement_contract_accepted: truthy(parsedArgs["procurement-contract-accepted"]),
    product: {
      public_slug: String(parsedArgs["product-slug"] || ""),
      title: String(parsedArgs["product-title"] || fallbackTitle),
      subtitle: String(parsedArgs["product-subtitle"] || ""),
      cover_image_url: String(parsedArgs["cover-image-url"] || ""),
      header_video_url: String(parsedArgs["header-video-url"] || ""),
      review_content_type: String(parsedArgs["review-content-type"] || "")
    },
    revision: {
      title: String(parsedArgs["revision-title"] || parsedArgs["product-title"] || fallbackTitle),
      subtitle: String(parsedArgs["revision-subtitle"] || parsedArgs["product-subtitle"] || ""),
      description_html: String(parsedArgs["description-html"] || "")
    }
  };
}

async function readManifest(root) {
  try {
    return JSON.parse(await readFile(resolve(root, "skillto.skill.json"), "utf8"));
  } catch {
    return null;
  }
}

function uploadWithCurl({ apiKey, deploy, endpoint, hostHeader, insecureTLS, packagePath, productPayload, releaseNote, skillProductKey }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const curlArgs = [
      "--silent",
      "--show-error",
      "--location",
      "--request",
      "POST",
      endpoint,
      "--header",
      `Authorization: Bearer ${apiKey}`,
      "--header",
      `Host: ${hostHeader}`,
      "--form",
      `package=@${packagePath};type=application/zip`,
      "--form",
      `release_note=${releaseNote}`,
      "--form",
      `deploy=${deploy}`,
      "--form",
      `skill_product_key=${skillProductKey}`,
      "--write-out",
      "\n__HTTP_STATUS__:%{http_code}"
    ];
    if (insecureTLS) {
      curlArgs.unshift("--insecure");
    }
    if (productPayload) {
      curlArgs.push("--form", `product_payload=${JSON.stringify(productPayload)}`);
    }
    const child = spawn("curl", curlArgs, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr || `curl exited with ${code}`));
        return;
      }
      const match = stdout.match(/\n__HTTP_STATUS__:(\d{3})\s*$/);
      const status = match ? Number(match[1]) : 0;
      const body = match ? stdout.slice(0, match.index) : stdout;
      resolvePromise({ status, text: body });
    });
  });
}

function stringifyReason(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truthy(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function resolveBaseURL(parsedArgs) {
  if (parsedArgs["base-url"]) {
    return String(parsedArgs["base-url"]).replace(/\/+$/, "");
  }
  const target = String(parsedArgs.env || "prod").toLowerCase();
  if (target === "prod" || target === "production") {
    return "https://www.skillto.ai";
  }
  if (target === "local" || target === "debug" || target === "wsl2") {
    return String(process.env.SKILLTO_LOCAL_BASE_URL || "https://172.29.186.238:5200").replace(/\/+$/, "");
  }
  usage(`Unknown --env value: ${parsedArgs.env}. Use local, prod, or --base-url.`);
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
  console.error("Usage: SKILLTO_CREATOR_API_KEY=skap_xxx node scripts/upload-plugin.mjs <dist/plugin.zip> [--env local|prod] [--base-url https://host] [--host-header host] [--insecure-tls] [--release-note text] [--deploy true] [--skill-product-key skill_product_key_xxx] [--create-product] [--submit-review]");
  process.exit(1);
}
