import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import { testPrisma } from "./prisma.mock";

const workspace = fileURLToPath(new URL("..", import.meta.url));

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [
      path.join(workspace, "node_modules/prisma/build/index.js"),
      "db",
      "push",
      "--schema",
      "prisma/schema.test.prisma",
      "--force-reset",
      "--skip-generate"
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        DATABASE_URL: "file:./test.db",
        RUST_BACKTRACE: "1",
        RUST_LOG: "info"
      },
      stdio: "pipe"
    }
  );
  await testPrisma.$connect();
});

afterAll(async () => {
  await testPrisma.$disconnect();
  rmSync(path.join(workspace, "prisma/test.db"), { force: true });
  rmSync(path.join(workspace, "prisma/test.db-journal"), { force: true });
});
