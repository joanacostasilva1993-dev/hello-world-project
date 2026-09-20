#!/usr/bin/env node

import http from "node:http";

const HOST = process.env.LOCAL_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.LOCAL_BRIDGE_PORT || 4317);
const VERSION = "0.1.0";
const jobs = new Map();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://localhost:5173",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(data);
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

function makeJob(plan) {
  const id = `drift-job-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
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
  };
  jobs.set(id, { ...job, plan });
  return job;
}

function runDryJob(id) {
  const entry = jobs.get(id);
  if (!entry || entry.status !== "queued") return;
  entry.status = "running";
  entry.updatedAt = now();

  const tick = () => {
    if (!jobs.has(id)) return;
    if (entry.status === "cancelled") return;
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
      return json(res, 200, {
        type: "health",
        bridgeVersion: VERSION,
        driftConnected: false,
        capabilities: ["health", "dry-run", "job-status", "job-cancel"],
      });
    }

    if (body.command === "start") {
      if (!body.plan || body.plan.version !== 1 || !Array.isArray(body.plan.steps)) {
        return json(res, 400, { type: "error", code: "INVALID_PLAN", message: "Plano Drift inválido ou incompatível." });
      }
      const job = makeJob(body.plan);
      runDryJob(job.id);
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
  console.log("Modo: DRY RUN — nenhuma alteração é feita no Drift.");
});
