#!/usr/bin/env node

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

const HOST = process.env.LOCAL_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.LOCAL_BRIDGE_PORT || 4317);
const VERSION = "0.2.0";
const DRIFT_COMMAND = process.env.DRIFT_COMMAND || "drift";
const DRIFT_ARGS = process.env.DRIFT_MCP_ARGS ? JSON.parse(process.env.DRIFT_MCP_ARGS) : ["--mcp-stdio"];
const REAL_EXECUTION = process.env.VIRALFLOW_DRIFT_REAL === "1";
const jobs = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://localhost:5173",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}
function now() { return new Date().toISOString(); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(new Error("Payload demasiado grande."));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("JSON inválido.")); }
    });
    req.on("error", reject);
  });
}

function makeJob(plan, mode) {
  const id = `drift-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    type: "drift-execution",
    status: "queued",
    createdAt: now(),
    updatedAt: now(),
    planVersion: plan?.version,
    projectId: plan?.projectId || "unknown",
    title: plan?.title || "Untitled",
    currentStep: 0,
    totalSteps: Array.isArray(plan?.steps) ? plan.steps.length : 0,
    mode,
  };
  jobs.set(id, { ...job, plan });
  return job;
}

function createRpcSession() {
  const child = spawn(DRIFT_COMMAND, DRIFT_ARGS, { stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  let nextId = 1;
  const pending = new Map();
  let stderr = "";

  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  child.stdout.on("data", chunk => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.id != null && pending.has(message.id)) {
          const waiter = pending.get(message.id);
          pending.delete(message.id);
          waiter(message);
        }
      } catch {}
    }
  });

  function request(method, params = {}, timeoutMs = 15000) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Drift MCP timeout em ${method}.`));
      }, timeoutMs);
      pending.set(id, message => {
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message || `Drift MCP error em ${method}.`));
        else resolve(message.result);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  function notify(method, params = {}) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async function initialize() {
    const result = await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "viralflow-local-bridge", version: VERSION },
    });
    notify("notifications/initialized", {});
    return result;
  }

  async function callTool(name, args = {}) {
    return request("tools/call", { name, arguments: args }, 30000);
  }

  function close() {
    try { child.stdin.end(); } catch {}
    setTimeout(() => child.kill(), 500);
  }

  return {
    initialize,
    callTool,
    close,
    getStderr: () => stderr,
  };
}

function extractStructured(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  for (const item of result.content || []) {
    if (item.type === "text" && typeof item.text === "string") {
      try { return JSON.parse(item.text); } catch {}
    }
  }
  return result;
}

async function materializeRemote(url, dir) {
  if (!/^https?:\\/\\//i.test(url)) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Não foi possível descarregar asset: HTTP ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const name = basename(new URL(url).pathname) || "asset.bin";
  const path = join(dir, name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  await writeFile(path, buffer);
  return path;
}

async function executeRealJob(id) {
  const entry = jobs.get(id);
  if (!entry) return;
  entry.status = "running";
  entry.updatedAt = now();

  let session;
  let tempDir;
  const importedAssets = new Map();

  try {
    session = createRpcSession();
    await session.initialize();
    entry.driftConnected = true;

    const catalog = await session.callTool("catalog", { brief: true });
    entry.catalog = extractStructured(catalog);

    for (let index = 0; index < entry.plan.steps.length; index += 1) {
      if (entry.status === "cancelled") return;
      const step = entry.plan.steps[index];
      entry.currentStep = index;
      entry.currentOperation = step.operation;
      entry.updatedAt = now();

      let tool = step.tool;
      let args = { ...step.args };

      if (step.operation === "catalog") {
        continue;
      }

      if (step.operation === "import_media") {
        tempDir ||= await mkdtemp(join(tmpdir(), "viralflow-drift-"));
        const localPath = await materializeRemote(args.paths[0], tempDir);
        args = { paths: [localPath] };
        const result = await session.callTool("import_media", args);
        const data = extractStructured(result);
        const importedId = data?.id ?? data?.asset?.id ?? data?.assetId;
        if (importedId != null) importedAssets.set(step.itemId, String(importedId));
        entry.lastResult = data;
        continue;
      }

      if (step.operation === "place_clip") {
        const imported = importedAssets.get(step.itemId);
        args.asset = imported || args.asset;
        const result = await session.callTool("place_clip", args);
        entry.lastResult = extractStructured(result);
        continue;
      }

      if (step.operation === "add_text") {
        const search = await session.callTool("search", { q: "text title caption" });
        const found = extractStructured(search);
        const names = Array.isArray(found?.hits) ? found.hits.map(hit => hit.name) : [];
        const textTool = names.find(name => /^(add_|create_)?(text|title|caption)$/.test(name)) || names.find(name => /text|title|caption/.test(name));
        if (!textTool) {
          entry.warnings = [...(entry.warnings || []), "Nenhuma operação de texto compatível foi descoberta no Drift."];
          continue;
        }
        tool = textTool;
        args = {
          text: args.text,
          at: args.at,
          duration: args.duration,
        };
        const result = await session.callTool(tool, args);
        entry.lastResult = extractStructured(result);
        continue;
      }

      if (step.operation === "add_marker") {
        const search = await session.callTool("search", { q: "bookmark marker" });
        const found = extractStructured(search);
        const names = Array.isArray(found?.hits) ? found.hits.map(hit => hit.name) : [];
        const markerTool = names.find(name => /bookmark|marker/i.test(name));
        if (!markerTool) {
          entry.warnings = [...(entry.warnings || []), "Nenhuma operação de marcador foi descoberta no Drift."];
          continue;
        }
        tool = markerTool;
        const result = await session.callTool(tool, args);
        entry.lastResult = extractStructured(result);
        continue;
      }

      if (tool === "inspect") {
        const result = await session.callTool("inspect", args);
        entry.lastResult = extractStructured(result);
        continue;
      }

      const result = await session.callTool(tool, args);
      entry.lastResult = extractStructured(result);
    }

    entry.currentStep = entry.totalSteps;
    entry.status = "completed";
    entry.updatedAt = now();
  } catch (error) {
    entry.status = "failed";
    entry.error = error instanceof Error ? error.message : "Erro desconhecido.";
    entry.stderr = session?.getStderr?.() || "";
    entry.updatedAt = now();
  } finally {
    session?.close();
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runJob(id) {
  if (REAL_EXECUTION) void executeRealJob(id);
  else {
    const entry = jobs.get(id);
    if (!entry || entry.status !== "queued") return;
    entry.status = "running";
    entry.updatedAt = now();
    const tick = () => {
      if (!jobs.has(id) || entry.status === "cancelled") return;
      if (entry.currentStep >= entry.totalSteps) {
        entry.status = "completed";
        entry.updatedAt = now();
        return;
      }
      entry.currentStep += 1;
      entry.updatedAt = now();
      setTimeout(tick, 40);
    };
    setTimeout(tick, 40);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "http://localhost:5173",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    return res.end();
  }
  if (req.method !== "POST" || req.url !== "/v1/bridge") {
    return json(res, 404, { type: "error", code: "NOT_FOUND", message: "Endpoint não encontrado." });
  }

  try {
    const body = await readBody(req);

    if (body.command === "health") {
      if (!REAL_EXECUTION) {
        return json(res, 200, {
          type: "health",
          bridgeVersion: VERSION,
          driftConnected: false,
          capabilities: ["health", "dry-run", "job-status", "job-cancel", "drift-mcp-adapter"],
          mode: "dry-run",
        });
      }
      let session;
      try {
        session = createRpcSession();
        const init = await session.initialize();
        return json(res, 200, {
          type: "health",
          bridgeVersion: VERSION,
          driftConnected: true,
          capabilities: ["health", "dry-run", "job-status", "job-cancel", "drift-mcp-adapter"],
          mode: "drift-mcp",
          driftProtocol: init?.protocolVersion || null,
          driftServer: init?.serverInfo || null,
        });
      } catch (error) {
        return json(res, 503, {
          type: "error",
          code: "DRIFT_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Drift MCP indisponível.",
        });
      } finally {
        session?.close();
      }
    }

    if (body.command === "start") {
      if (!body.plan || body.plan.version !== 1 || !Array.isArray(body.plan.steps)) {
        return json(res, 400, { type: "error", code: "INVALID_PLAN", message: "Plano Drift inválido ou incompatível." });
      }
      const mode = REAL_EXECUTION ? "drift-mcp" : "dry-run";
      const job = makeJob(body.plan, mode);
      runJob(job.id);
      return json(res, 202, { type: "job", job });
    }

    if (body.command === "status" || body.command === "cancel") {
      const entry = jobs.get(body.jobId);
      if (!entry) return json(res, 404, { type: "error", code: "JOB_NOT_FOUND", message: "Job não encontrado." });
      if (body.command === "cancel" && ["queued", "running"].includes(entry.status)) {
        entry.status = "cancelled";
        entry.updatedAt = now();
      }
      const { plan: _plan, ...job } = entry;
      return json(res, 200, { type: "job", job });
    }

    return json(res, 400, { type: "error", code: "INVALID_COMMAND", message: "Comando não suportado." });
  } catch (error) {
    return json(res, 400, {
      type: "error",
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Pedido inválido.",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ViralFlow Local Bridge ${VERSION} em http://${HOST}:${PORT}`);
  console.log(REAL_EXECUTION ? `Modo: DRIFT MCP · ${DRIFT_COMMAND} ${DRIFT_ARGS.join(" ")}` : "Modo: DRY RUN — nenhuma alteração é feita no Drift.");
});
