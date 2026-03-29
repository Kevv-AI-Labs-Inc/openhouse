import { syncPendingKevvSignIns } from "../src/lib/kevv-sync";
import { closeDb } from "../src/lib/db";

async function main() {
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  const includeFailed = !process.argv.includes("--pending-only");
  const result = await syncPendingKevvSignIns({
    limit,
    includeFailed,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
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
