import { chromium } from 'playwright-core';
// Deterministic walkthrough flow. Drives the real UI against a local `wrangler dev`, with a visible pointer,
// holding each step for the length of its narration line in SCRIPT.md. Fails loudly if any expected state is not reached.
// Usage: npx wrangler dev   then   CHROME=/path/to/chrome node video/walkthrough-flow.mjs   (HEADLESS=1 to run without a window)
// Needs playwright-core: npm i --no-save playwright-core
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787/';
const HOLD = {"s01": 9.08, "s02": 8.02, "s03": 5.01, "s04": 5.64, "s05": 6.74, "s06": 7.99, "s07": 4.25, "s08": 2.72, "s09": 3.45, "s10": 4.04, "s11": 6.83, "s12": 5.85, "s13": 5.96, "s14": 3.58, "s15": 5.91, "s16": 6.24};
const b = await chromium.launch({ executablePath: process.env.CHROME, headless: process.env.HEADLESS === '1', args: ['--window-size=1280,800'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, bypassCSP: true, acceptDownloads: true, locale: 'en-GB' });
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const d = document.createElement('div');
    d.id = '__ptr';
    Object.assign(d.style, { position: 'fixed', left: '640px', top: '360px', width: '22px', height: '22px', margin: '-11px 0 0 -11px', borderRadius: '50%', background: 'rgba(23,23,23,.55)', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4)', zIndex: 99999, pointerEvents: 'none', transition: 'background .08s' });
    document.body.append(d);
    addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { d.style.background = 'rgba(255,196,0,.95)'; d.style.transform = 'scale(1.35)'; }, true);
    addEventListener('mouseup', () => { setTimeout(() => { d.style.background = 'rgba(23,23,23,.55)'; d.style.transform = ''; }, 180); }, true);
  });
});
const p = await ctx.newPage();
await p.goto(BASE); await p.waitForSelector('#kpis .kpi'); await p.waitForTimeout(400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mx = 640, my = 360;
async function move(x, y, steps = 18) { await p.mouse.move(x, y, { steps }); mx = x; my = y; }
async function scrollTo(sel, offset = 96) {
  const target = await p.evaluate(([s, o]) => Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, document.querySelector(s).getBoundingClientRect().top + scrollY - o)), [sel, offset]);
  const start = await p.evaluate(() => scrollY);
  if (Math.abs(target - start) < 4) return;
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const k = i / N, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await p.evaluate((y) => new Promise((r) => { scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(r)); }), start + (target - start) * e);
  }
}
async function box(sel) { const bb = await p.locator(sel).first().boundingBox(); if (!bb) throw new Error('no box ' + sel); return bb; }
async function point(sel, fx = 0.5, fy = 0.5) { const bb = await box(sel); await move(bb.x + bb.width * fx, bb.y + bb.height * fy); }
async function click(sel, fx = 0.5) { const bb = await box(sel); if (bb.y < 90 || bb.y + bb.height > 700) await scrollTo(sel, 360); await point(sel, fx); await sleep(120); await p.mouse.down(); await sleep(110); await p.mouse.up(); }
const waitText = (sel, txt) => p.waitForFunction(([s, t]) => document.querySelector(s)?.textContent.includes(t), [sel, txt], { timeout: 5000 });
const log = [];
async function scene(sid, fn) {
  const t0 = Date.now(); log.push({ sid, t0 });
  const dur = HOLD[sid];
  await fn();
  const left = t0 + dur * 1000 + 250 - Date.now();
  if (left > 0) await sleep(left); console.log(sid, 'ok');
}
const T0 = Date.now();
await scene('s01', async () => { await sleep(600); await point('.identity .product', 0.3); await sleep(2600); await point('.brand-secondary .unofficial', 0.5); await sleep(2000); await point('.banner', 0.3); });
await scene('s02', async () => { await scrollTo('#h-vendor', 90); await point('#gate-chip'); await sleep(1600); await point('#gate-frac'); await sleep(1500); await point('#blockers li', 0.3); });
await scene('s03', async () => { await scrollTo('#checklist', 300); await click('label[for="chk-bank_callback"]', 0.25); await waitText('#gate-chip', 'Ready'); await sleep(900); await point('#gate-chip'); });
await scene('s04', async () => { await click('#onboard'); await waitText('#onboarding-state', 'SIM-ONB'); await sleep(600); await point('#onboarding-state', 0.4); });
await scene('s05', async () => { await scrollTo('#vendor-form', 160); await click('input[name=amount]'); await p.locator('input[name=amount]').selectText(); await p.keyboard.type('2450.00', { delay: 110 }); await sleep(300); await click('#save-vendor'); await waitText('#onboarding-state', 'Invalidated'); });
await scene('s06', async () => { await point('#gate-frac'); await sleep(1200); await point('#blockers li', 0.3); await sleep(2400); await point('#blockers li:nth-child(2)', 0.3); await sleep(1800); await point('#onboarding-state', 0.3); });
await scene('s07', async () => { await scrollTo('#approval-form', 260); await point('select[name=role]'); await p.selectOption('#approval-form select[name=role]', 'budget_owner'); await sleep(300); await point('#approval-form select[name=approverId]'); await p.selectOption('#approval-form select[name=approverId]', 'P-AO'); await sleep(500); await click('#approve'); await waitText('#toast', 'cannot give'); });
await scene('s08', async () => { await point('#approval-form select[name=approverId]'); await p.selectOption('#approval-form select[name=approverId]', 'P-TB'); await sleep(400); await click('#approve'); await waitText('#toast', 'Tom Brennan gave'); });
await scene('s09', async () => { await point('#approval-form select[name=role]'); await p.selectOption('#approval-form select[name=role]', 'finance_lead'); await sleep(250); await point('#approval-form select[name=approverId]'); await p.selectOption('#approval-form select[name=approverId]', 'P-JW'); await sleep(300); await click('#approve'); await waitText('#gate-chip', 'Ready'); await point('#gate-chip'); });
await scene('s10', async () => { await click('#onboard'); await waitText('#onboarding-state', 'SIM-ONB-0101'); await sleep(400); await point('#onboarding-state', 0.4); });
await scene('s11', async () => { await scrollTo('#h-cadence', 90); await point('#kpis .kpi:nth-child(1) .frac'); await sleep(3000); await point('#kpis .kpi:nth-child(1) .den', 0.4); });
await scene('s12', async () => { await scrollTo('#follow', 200); await point('#follow tbody tr:nth-child(1) .chip'); await sleep(2500); await point('#follow tbody tr:nth-child(4) td:last-child', 0.2); });
await scene('s13', async () => { await scrollTo('#h-brief', 100); await point('#unknowns li', 0.3); await sleep(1600); await point('#decisions li', 0.3); await sleep(1600); await click('#issue'); await waitText('#brief-chip', 'Issued'); });
await scene('s14', async () => { await scrollTo('#h-export', 100); await click('[data-export="/api/export/board.json"]'); await waitText('#export-preview', 'board-material'); await point('#export-preview', 0.3, 0.2); });
await scene('s15', async () => { await scrollTo('#actions', 100); await click('#actions tbody tr:nth-child(4) td:last-child button'); await waitText('#toast', 'A-04 closed'); await scrollTo('#h-export', 100); await click('[data-export="/api/export/board.json"]'); await waitText('#export-preview', 'Refused'); await point('#export-preview', 0.3, 0.2); });
await scene('s16', async () => { await scrollTo('.site-footer', 500); await point('.site-footer .wrap', 0.4); });
console.log('walkthrough complete in', ((Date.now() - T0) / 1000).toFixed(1), 's');
await b.close();
