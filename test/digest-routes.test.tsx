import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const JOBS = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

let tmp: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-'));
  fs.writeFileSync(path.join(tmp, '2026-10-28.jsonl'), fs.readFileSync('runs/2026-10-28.jsonl'));
  fs.writeFileSync(path.join(tmp, '2026-11-01.jsonl'), '');
  fs.writeFileSync(
    path.join(tmp, '2026-10-30.jsonl'),
    '{"at":"2026-10-30T02:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\nnot json\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tmp });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('digest page', () => {
  it('shows all jobs, warn rows, dashes for null owner and offsets as logged', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of JOBS) expect(html).toContain(job);
    expect(html).toContain('warn');
    const start = html.indexOf('digest/render');
    const row = html.slice(start, html.indexOf('</tr>', start));
    expect(row).toContain('—');
    expect(html).toContain('2026-10-29T01:30:00+01:00');
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the valid job when a line is bad', async () => {
    const res = await app.request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('lane/sync');
  });
});

describe('digest json', () => {
  it('returns the night with 5 rows and 1 bad line', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.night).toBe('2026-10-28');
    expect(night.rows.length).toBe(5);
    expect(night.badLines).toBe(1);
  });

  it('lists jobs in the same order as the page', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    const night = (await (await app.request('/api/digest/2026-10-28')).json()) as Night;
    const jobs = night.rows.map((r) => r.job);
    const byPage = [...jobs].sort((a, b) => html.indexOf(a) - html.indexOf(b));
    expect(jobs).toEqual(byPage);
  });

  it('404s with a JSON error for an unknown night', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2026-01-01' });
  });

  it('has no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(((await res.json()) as Night).rows).toEqual([]);
  });

  it('counts the bad line and keeps the valid row', async () => {
    const night = (await (await app.request('/api/digest/2026-10-30')).json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.length).toBe(1);
  });
});
