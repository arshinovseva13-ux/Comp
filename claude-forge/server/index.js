import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const app = express();
const port = Number(process.env.PORT || 4173);
const workspace = path.resolve(process.env.WORKSPACE_DIR || path.join(root, "workspace"));
const enabled = process.env.ENABLE_AGENT === "true";
const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

app.disable("x-powered-by");
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || "")
      .split(",").map(x => x.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin) || /^https?:\/\/localhost(?::\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));

app.get("/api/status", (_q, r) => r.json({
  app: "Claude Forge",
  enabled,
  apiKeyPresent: Boolean(apiKey),
  model,
  workspace,
  platform: os.platform()
}));

app.post("/api/chat", async (q, r) => {
  if (!anthropic) return r.status(503).json({ error: "Claude API is not configured. Set ANTHROPIC_API_KEY on the backend." });
  const prompt = typeof q.body?.prompt === "string" ? q.body.prompt.trim() : "";
  if (!prompt || prompt.length > 12000) return r.status(400).json({ error: "Prompt must contain 1–12000 characters" });
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }]
    });
    const answer = response.content.filter(x => x.type === "text").map(x => x.text).join("\n");
    return r.json({ ok: true, model: response.model, answer, usage: response.usage });
  } catch (e) {
    return r.status(502).json({ error: "Claude API request failed", detail: String(e?.message || e).slice(0, 500) });
  }
});

app.get("/api/git/status", (_q, r) => {
  const c = spawn("git", ["status", "--short", "--branch"], { cwd: workspace, shell: false, windowsHide: true });
  let out = "", err = "";
  c.stdout.on("data", d => out += d);
  c.stderr.on("data", d => err += d);
  c.on("error", e => { if (!r.headersSent) r.status(500).json({ error: e.message }); });
  c.on("close", code => { if (!r.headersSent) r.json({ code, output: out || err || "No Git output" }); });
});

app.post("/api/agent/run", async (q, r) => {
  if (!enabled) return r.status(403).json({ error: "Agent execution is disabled. Review SECURITY.md first." });
  if (!apiKey) return r.status(400).json({ error: "Server API key is not configured" });
  const prompt = typeof q.body?.prompt === "string" ? q.body.prompt.trim() : "";
  if (!prompt || prompt.length > 12000) return r.status(400).json({ error: "Prompt must contain 1–12000 characters" });
  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const events = [];
    for await (const event of query({
      prompt,
      options: { cwd: workspace, maxTurns: 10, permissionMode: "default", allowedTools: ["Read", "Edit", "Write"] }
    })) {
      if (event?.type === "assistant" || event?.type === "result") events.push(event);
    }
    return r.json({ ok: true, events });
  } catch (e) {
    return r.status(500).json({ error: "Agent run failed", detail: String(e?.message || e).slice(0, 1000) });
  }
});

app.listen(port, "0.0.0.0", () => console.log(`Claude Forge backend listening on port ${port}; workspace=${workspace}; model=${model}`));
