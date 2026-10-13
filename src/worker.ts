import { DurableObject } from 'cloudflare:workers';
import { applyCommand, auditExport, baselineState, boardExport, CommandError, isValidStoredState, LIMITS, summaryMarkdown, viewModel } from './engine/index.ts';
import type { State } from './engine/index.ts';

export interface Env {
  WORKSPACE: DurableObjectNamespace<Workspace>;
  ASSETS: Fetcher;
}

const COOKIE = 'ocp_vid';
const IDLE_PURGE_MS = 7 * 24 * 60 * 60 * 1000;
const COMMANDS_PER_MINUTE = 120;

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra } });
}

function errorResponse(e: unknown): Response {
  if (e instanceof CommandError) return json({ error: { code: e.code, message: e.message, details: e.details ?? null } }, e.status);
  return json({ error: { code: 'internal', message: 'Unexpected error.' } }, 500);
}

function readCookie(req: Request): string | null {
  const raw = req.headers.get('Cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) {
      const val = v.join('=');
      return /^[a-f0-9]{64}$/.test(val) ? val : null;
    }
  }
  return null;
}

function newVisitorId(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function workspaceName(visitorId: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ocp-workspace:' + visitorId));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function readBoundedBody(req: Request): Promise<string> {
  const declared = req.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > LIMITS.maxBodyBytes)) throw new CommandError(413, 'body_too_large', `Request body must be at most ${LIMITS.maxBodyBytes} bytes.`);
  if (!req.body) throw new CommandError(400, 'empty_body', 'Request body is required.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITS.maxBodyBytes) { await reader.cancel(); throw new CommandError(413, 'body_too_large', `Request body must be at most ${LIMITS.maxBodyBytes} bytes.`); }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(all); } catch { throw new CommandError(400, 'invalid_encoding', 'Request body must be UTF-8.'); }
}

/** Rejects cross-site writes: same-origin Origin, custom header and JSON content type are all required. */
function checkWriteRequest(req: Request, url: URL) {
  const origin = req.headers.get('Origin');
  if (!origin || origin !== url.origin) throw new CommandError(403, 'bad_origin', 'Writes must come from this site.');
  const site = req.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') throw new CommandError(403, 'bad_origin', 'Writes must come from this site.');
  if (req.headers.get('X-OCP-Request') !== '1') throw new CommandError(403, 'missing_request_header', 'Missing X-OCP-Request header.');
  const ct = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/json') throw new CommandError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      const res = await env.ASSETS.fetch(req);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
      return out;
    }
    try {
      const route = `${req.method} ${url.pathname}`;
      const allowed = ['GET /api/state', 'POST /api/command', 'GET /api/export/audit.json', 'GET /api/export/board.json', 'GET /api/export/summary.md'];
      if (!allowed.includes(route)) {
        const known = allowed.some((r) => r.endsWith(' ' + url.pathname));
        return json({ error: { code: known ? 'method_not_allowed' : 'not_found', message: known ? 'Method not allowed.' : 'Not found.' } }, known ? 405 : 404);
      }
      let visitorId = readCookie(req);
      let setCookie: string | null = null;
      if (req.method === 'POST') {
        checkWriteRequest(req, url);
        if (!visitorId) throw new CommandError(401, 'no_workspace', 'No workspace cookie. Load the page first.');
      } else if (!visitorId) {
        visitorId = newVisitorId();
        setCookie = `${COOKIE}=${visitorId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
      }
      const stub = env.WORKSPACE.get(env.WORKSPACE.idFromName(await workspaceName(visitorId)));
      const extra: Record<string, string> = setCookie ? { 'Set-Cookie': setCookie } : {};
      if (route === 'POST /api/command') {
        const text = await readBoundedBody(req);
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { throw new CommandError(400, 'invalid_json', 'Request body is not valid JSON.'); }
        const r = (await stub.command(parsed)) as Reply;
        return json(r.body, r.status, extra);
      }
      const r = (await stub.read(url.pathname)) as Reply;
      if (url.pathname.endsWith('.md') && r.status === 200) {
        return new Response(r.body as string, { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="weekly-operating-brief.md"', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra } });
      }
      const disp: Record<string, string> = url.pathname.startsWith('/api/export/') && r.status === 200 ? { 'Content-Disposition': `attachment; filename="${url.pathname.endsWith('audit.json') ? 'audit-export' : 'board-material'}.json"` } : {};
      return json(r.body, r.status, { ...extra, ...disp });
    } catch (e) {
      return errorResponse(e);
    }
  },
} satisfies ExportedHandler<Env>;

interface Reply { status: number; body: unknown }

/** One SQLite-backed Durable Object per visitor. All reads and writes for that visitor are serialised here. */
export class Workspace extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL CHECK (revision >= 1),
      state_json TEXT NOT NULL CHECK (length(state_json) <= ${LIMITS.maxStateBytes}),
      updated_ms INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS rate (minute INTEGER PRIMARY KEY, count INTEGER NOT NULL)`);
  }

  private load(): State {
    const row = this.sql.exec<{ state_json: string }>('SELECT state_json FROM workspace WHERE id = 1').toArray()[0];
    if (row) {
      try {
        const s = JSON.parse(row.state_json);
        if (isValidStoredState(s)) return s;
      } catch { /* fall through to reseed */ }
    }
    const fresh = baselineState();
    this.save(fresh, null);
    return fresh;
  }

  /** Compare-and-set on revision so a write can only land on the revision it was computed from. */
  private save(next: State, expectedRevision: number | null) {
    const body = JSON.stringify(next);
    const now = Date.now();
    if (expectedRevision === null) {
      this.sql.exec('INSERT OR REPLACE INTO workspace (id, revision, state_json, updated_ms) VALUES (1, ?, ?, ?)', next.revision, body, now);
    } else {
      const cur = this.sql.exec('UPDATE workspace SET revision = ?, state_json = ?, updated_ms = ? WHERE id = 1 AND revision = ?', next.revision, body, now, expectedRevision);
      if (cur.rowsWritten !== 1) throw new CommandError(409, 'revision_conflict', 'The workspace changed while saving. Reload and try again.');
    }
  }

  private async touch() { await this.ctx.storage.setAlarm(Date.now() + IDLE_PURGE_MS); }

  async read(path: string): Promise<Reply> {
    try {
      const s = this.ctx.storage.transactionSync(() => this.load());
      await this.touch();
      if (path === '/api/state') return { status: 200, body: viewModel(s) };
      if (path === '/api/export/audit.json') return { status: 200, body: auditExport(s) };
      if (path === '/api/export/board.json') return { status: 200, body: boardExport(s) };
      return { status: 200, body: summaryMarkdown(s) };
    } catch (e) {
      return replyError(e);
    }
  }

  async command(envelope: unknown): Promise<Reply> {
    try {
      const minute = Math.floor(Date.now() / 60000);
      const used = this.ctx.storage.transactionSync(() => {
        this.sql.exec('DELETE FROM rate WHERE minute < ?', minute);
        this.sql.exec('INSERT INTO rate (minute, count) VALUES (?, 1) ON CONFLICT(minute) DO UPDATE SET count = count + 1', minute);
        return this.sql.exec<{ count: number }>('SELECT count FROM rate WHERE minute = ?', minute).one().count;
      });
      if (used > COMMANDS_PER_MINUTE) throw new CommandError(429, 'rate_limited', `At most ${COMMANDS_PER_MINUTE} change attempts per minute.`);
      const result = this.ctx.storage.transactionSync(() => {
        const current = this.load();
        const r = applyCommand(current, envelope);
        if (!r.replay) this.save(r.state, current.revision);
        return r;
      });
      await this.touch();
      return { status: 200, body: { ok: true, replay: result.replay, summary: result.summary, view: viewModel(result.state) } };
    } catch (e) {
      return replyError(e);
    }
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}

function replyError(e: unknown): Reply {
  if (e instanceof CommandError) return { status: e.status, body: { error: { code: e.code, message: e.message, details: e.details ?? null } } };
  return { status: 500, body: { error: { code: 'internal', message: 'Unexpected error.' } } };
}
