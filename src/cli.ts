#!/usr/bin/env node
import { run } from "./app.js";

const code = await run(process.argv.slice(2), {
  env: process.env,
  cwd: process.cwd(),
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
  isTTY: Boolean(process.stdout.isTTY),
});
process.exitCode = code;
