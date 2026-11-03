import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const runsDir = join(import.meta.dirname, '..', 'runs');

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into 5 rows and 1 bad line', () => {
    const night = readNight(runsDir, '2026-10-28');
    expect(night).not.toBeNull();
    if (!night) return;
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const byJob = Object.fromEntries(night.rows.map((r) => [r.job, r]));

    expect(byJob['fixtures/refresh']).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(byJob['notes/backup']).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
    expect(byJob['digest/render']).toMatchObject({ owner: null, runs: 1, lastError: null });
    expect(byJob['lane/sync']).toMatchObject({
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
      retries: 1,
    });
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(runsDir, '1999-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight(runsDir, '../runs/2026-10-28')).toBeNull();
    expect(readNight(runsDir, '2026-10-28.jsonl')).toBeNull();
  });

  it('reads an empty file as a night where nothing ran', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
    writeFileSync(join(dir, '2026-11-01.jsonl'), '');
    expect(readNight(dir, '2026-11-01')).toEqual({
      night: '2026-11-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('skips blank lines and counts shape errors as bad lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
    const lines = [
      '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      '',
      '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"maybe","owner":"rook"}',
      '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"ok"}',
      '[]',
      '{"at":"2026-11-02T02:00:00+01:00","job":"a","status":"retry","owner":null,"error":"x"}',
    ];
    writeFileSync(join(dir, '2026-11-02.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-11-02');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 2,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'x',
        firstAt: '2026-11-02T01:00:00+01:00',
        lastAt: '2026-11-02T02:00:00+01:00',
      },
    ]);
  });
});
