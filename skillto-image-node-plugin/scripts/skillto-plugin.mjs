#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

if (!command || command === "help" || command === "--help" || command === "-h") {
  usage(0);
}

if (command === "preflight") {
  const baseURL = resolveBaseURL(args);
  assertProductionSafeURL(baseURL, args);
  const result = await preflight(baseURL);
  printPreflight(result);
  process.exit(result.ok ? 0 : 1);
}

if (command === "upload") {
  const zipPath = args._[1];
  if (!zipPath) usage(1, "Missing plugin zip path.");
  const baseURL = resolveBaseURL(args);
  assertProductionSafeURL(baseURL, args);
  if (!truthy(args["skip-preflight"])) {
    const result = await preflight(baseURL);
    printPreflight(result);
    if (!result.ok) {
      console.error("Upload stopped because the SkillTo.ai endpoint preflight failed.");
      process.exit(1);
    }
  }
  await runUpload(zipPath, baseURL, args);
  process.exit(0);
}

usage(1, `Unknown command: ${command}`);

async function preflight(baseURL) {
  const discoveryURL = `${baseURL}/api/skillto-v2/public/skill-apps/image-node`;
  const uploadURL = `${baseURL}/api/skillto-v2/creator-agent/skill-apps/packages`;
  const discovery = await probeDiscovery(discoveryURL);
  if (!discovery.ok) {
    return {
      ok: false,
      baseURL,
      discovery,
      message: classifyDiscoveryFailure(discovery)
    };
  }
  const upload = await probeUpload(uploadURL);
  const uploadRouteExists = [400, 401, 403, 405].includes(upload.status) || upload.status === 200;
  return {
    ok: uploadRouteExists,
    baseURL,
    discovery,
    upload,
    message: uploadRouteExists
      ? "SkillTo.ai plugin upload endpoint is reachable."
      : classifyUploadFailure(upload)
  };
}

async function probeDiscovery(url) {
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual" });
    const text = await response.text();
    return {
      finalURL: response.url,
      location: response.headers.get("location") || "",
      ok: response.ok,
      status: response.status,
      text: text.slice(0, 500)
    };
  } catch (error) {
    return { error: error.message, ok: false, status: 0 };
  }
}

async function probeUpload(url) {
  try {
    const form = new FormData();
    form.set("deploy", "false");
    const response = await fetch(url, {
      body: form,
      headers: {
        Authorization: "Bearer skap_preflight_probe"
      },
      method: "POST",
      redirect: "manual"
    });
    const text = await response.text();
    return {
      finalURL: response.url,
      location: response.headers.get("location") || "",
      ok: response.ok,
      status: response.status,
      text: text.slice(0, 500)
    };
  } catch (error) {
    return { error: error.message, ok: false, status: 0 };
  }
}

function classifyDiscoveryFailure(result) {
  if (result.status >= 300 && result.status < 400) {
    return `Endpoint redirected to ${result.location || "another URL"}. Use the canonical HTTPS production domain.`;
  }
  if (result.status === 404) {
    return "Plugin discovery API is missing on this deployment.";
  }
  if (result.status === 502 || result.status === 521 || result.status === 522 || result.status === 523) {
    return "Production CDN/origin is unhealthy. Fix Cloudflare or origin routing before uploading.";
  }
  if (result.status === 0) {
    return `Could not reach SkillTo.ai endpoint: ${result.error || "network error"}`;
  }
  return `Plugin discovery API failed with HTTP ${result.status}.`;
}

function classifyUploadFailure(result) {
  if (result.status >= 300 && result.status < 400) {
    return `Upload endpoint redirected to ${result.location || "another URL"}. Use the canonical HTTPS production domain.`;
  }
  if (result.status === 404) {
    return "Plugin upload API is missing on this deployment.";
  }
  if (result.status === 502 || result.status === 521 || result.status === 522 || result.status === 523) {
    return "Production CDN/origin is unhealthy. Fix Cloudflare or origin routing before uploading.";
  }
  if (result.status === 0) {
    return `Could not reach SkillTo.ai upload endpoint: ${result.error || "network error"}`;
  }
  return `Plugin upload endpoint failed with HTTP ${result.status}.`;
}

function printPreflight(result) {
  console.error(`SkillTo.ai endpoint: ${result.baseURL}`);
  if (result.discovery) {
    console.error(`Discovery API: HTTP ${result.discovery.status}${result.discovery.location ? ` -> ${result.discovery.location}` : ""}`);
  }
  if (result.upload) {
    console.error(`Upload API: HTTP ${result.upload.status}${result.upload.location ? ` -> ${result.upload.location}` : ""}`);
  }
  console.error(result.ok ? `OK: ${result.message}` : `FAILED: ${result.message}`);
}

async function runUpload(zipPath, baseURL, parsedArgs) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const uploadScript = resolve(scriptDir, "upload-plugin.mjs");
  const forwarded = [
    uploadScript,
    zipPath,
    "--base-url",
    baseURL
  ];
  const passthroughKeys = [
    "release-note",
    "deploy",
    "skill-product-key",
    "plugin-root",
    "product-payload",
    "create-product",
    "submit-review",
    "confirm-review-fee",
    "procurement-agreement-accepted",
    "procurement-contract-accepted",
    "product-slug",
    "product-title",
    "product-subtitle",
    "cover-image-url",
    "header-video-url",
    "review-content-type",
    "revision-title",
    "revision-subtitle",
    "description-html"
  ];
  for (const key of passthroughKeys) {
    if (!(key in parsedArgs)) continue;
    forwarded.push(`--${key}`);
    if (parsedArgs[key] !== true) forwarded.push(String(parsedArgs[key]));
  }
  await spawnNode(forwarded);
}

function spawnNode(argv) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, argv, { stdio: "inherit", windowsHide: true });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`upload-plugin exited with ${code}`));
    });
  });
}

function resolveBaseURL(parsedArgs) {
  if (parsedArgs["base-url"]) {
    return normalizeBaseURL(String(parsedArgs["base-url"]));
  }
  const target = String(parsedArgs.env || "prod").toLowerCase();
  if (target === "prod" || target === "production") {
    return "https://www.skillto.ai";
  }
  if (target === "local" || target === "debug" || target === "wsl2") {
    return normalizeBaseURL(process.env.SKILLTO_LOCAL_BASE_URL || "https://172.29.186.238:5200");
  }
  usage(1, `Unknown --env value: ${parsedArgs.env}. Use local, prod, or --base-url.`);
}

function assertProductionSafeURL(baseURL, parsedArgs) {
  const url = new URL(baseURL);
  if (url.protocol !== "https:") {
    usage(1, "SkillTo.ai plugin CLI requires HTTPS endpoints.");
  }
  const env = String(parsedArgs.env || (parsedArgs["base-url"] ? "custom" : "prod")).toLowerCase();
  const allowsLocalIP = env === "local" || env === "debug" || env === "wsl2";
  if (!allowsLocalIP && isIPAddress(url.hostname)) {
    usage(1, "Production/custom SkillTo.ai plugin CLI endpoints must use a domain name, not an IP address.");
  }
  if ("insecure-tls" in parsedArgs || "host-header" in parsedArgs) {
    usage(1, "The official SkillTo.ai plugin CLI does not allow --insecure-tls or --host-header. Fix the HTTPS domain endpoint instead.");
  }
}

function normalizeBaseURL(value) {
  return value.replace(/\/+$/, "");
}

function isIPAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function truthy(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
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

function usage(exitCode, message = "") {
  if (message) console.error(message);
  console.error(`Usage:
  node scripts/skillto-plugin.mjs preflight [--env prod|local] [--base-url https://domain]
  node scripts/skillto-plugin.mjs upload <dist/plugin.zip> [--env prod|local] [--release-note text] [--deploy true]

Rules:
  - Production uses https://www.skillto.ai by default.
  - Production/custom endpoints must be HTTPS domain names.
  - --insecure-tls, --host-header, and production IP uploads are intentionally rejected.`);
  process.exit(exitCode);
}
