import { spawn } from "node:child_process";

/** What happened when one hook command ran. */
export interface HookRun {
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  ms: number;
  stdout: string;
  stderr: string;
  /** Timeout actually applied, in seconds (after --max-timeout). */
  timeoutSec: number;
  /** True when --max-timeout shortened the configured timeout. */
  capped: boolean;
}

export interface RunOptions {
  cwd: string;
  env: Record<string, string>;
  timeoutSec: number;
  capped?: boolean;
}

const MAX_CAPTURE = 1024 * 1024;

/**
 * Run a hook command with `/bin/sh -c`, feed it the JSON fixture on stdin and
 * kill its whole process group when the timeout expires.
 */
export function runHook(command: string, stdin: unknown, opts: RunOptions): Promise<HookRun> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("/bin/sh", ["-c", command], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      detached: true, // own process group so a timeout can kill grandchildren too
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const killGroup = (): void => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const finish = (code: number | null, signal: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      resolve({
        code,
        signal,
        timedOut,
        ms: Date.now() - started,
        stdout,
        stderr,
        timeoutSec: opts.timeoutSec,
        capped: opts.capped ?? false,
      });
    };

    let grace: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
      // If a stray descendant keeps the pipes open, do not wait for 'close' forever.
      grace = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        finish(null, "SIGKILL");
      }, 500);
    }, opts.timeoutSec * 1000);

    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < MAX_CAPTURE) stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < MAX_CAPTURE) stderr += d.toString("utf8");
    });
    child.stdin.on("error", () => {
      /* the hook may exit without reading stdin (EPIPE) */
    });
    child.on("error", (err) => {
      stderr += String(err);
      finish(127, null);
    });
    child.on("close", (code, signal) => finish(code, signal));
    child.stdin.end(JSON.stringify(stdin));
  });
}
