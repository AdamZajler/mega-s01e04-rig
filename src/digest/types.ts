// Plan § 1. The digest contract: the reader (src/digest/read.ts), the page GET /digest/:night,
// the JSON GET /api/digest/:night and the board counts all build against these types.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl. A line that doesn't fit this shape is a bad line.
export type RunLine = {
  at: string; // as in the log, offset kept (e.g. 2026-10-29T01:30:00+01:00)
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job, from all its lines in file order.
export type DigestRow = {
  job: string;
  owner: string | null; // views render null as —
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus; // status of the job's last line
  lastError: string | null; // error of the last line that had one, else null
  firstAt: string; // `at` of the first line, exactly as in the log, never converted
  lastAt: string; // `at` of the last line, exactly as in the log, never converted
};

export type Night = {
  night: string; // YYYY-MM-DD, the file name without .jsonl
  rows: DigestRow[]; // sorted by job; [] for an empty file ("nothing ran")
  badLines: number; // lines that didn't parse: counted, never thrown
  counts: { ok: number; retry: number; fail: number }; // good LINES per status, for the board
};

// null = no runs/<night>.jsonl → 404. An existing empty file → a Night with rows [].
// Implemented as `export const readNight: ReadNight` in src/digest/read.ts (#2).
export type ReadNight = (runsDir: string, night: string) => Night | null;
