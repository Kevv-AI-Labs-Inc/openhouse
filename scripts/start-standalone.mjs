import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const candidates = [
  path.join(process.cwd(), ".next/standalone/server.js"),
  path.join(process.cwd(), ".next/standalone/openhouse/server.js"),
];

const entrypoint = candidates.find((candidate) => existsSync(candidate));

if (!entrypoint) {
  console.error("Standalone server entrypoint not found.");
  console.error(`Checked: ${candidates.join(", ")}`);
  process.exit(1);
}

const child = spawn(process.execPath, [entrypoint], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: "0.0.0.0",
  },
});

child.on("error", (error) => {
  console.error("Failed to launch standalone server.", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
