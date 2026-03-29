import { inspectRuntimeSchemaDrift } from "../src/lib/schema-drift";
import { closeDb } from "../src/lib/db";

async function main() {
  const report = await inspectRuntimeSchemaDrift();
  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
