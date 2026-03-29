import type mysql from "mysql2/promise";
import { getPool } from "@/lib/db";

type RuntimeSchemaRequirement = {
  table: string;
  columns: string[];
  indexes: string[];
};

type DatabaseNameRow = mysql.RowDataPacket & { databaseName: string | null };
type TableRow = mysql.RowDataPacket & { tableName: string };
type ColumnRow = mysql.RowDataPacket & { tableName: string; columnName: string };
type IndexRow = mysql.RowDataPacket & { tableName: string; indexName: string };

export type RuntimeSchemaIssue = {
  table: string;
  kind: "missing_table" | "missing_column" | "missing_index";
  name: string;
  message: string;
};

export type RuntimeSchemaTableReport = {
  table: string;
  present: boolean;
  missingColumns: string[];
  missingIndexes: string[];
};

export type RuntimeSchemaReport = {
  ok: boolean;
  databaseName: string;
  checkedAt: string;
  tables: RuntimeSchemaTableReport[];
  issues: RuntimeSchemaIssue[];
};

const runtimeSchemaRequirements: RuntimeSchemaRequirement[] = [
  {
    table: "oh_sign_ins",
    columns: ["clientSubmissionId", "crmSyncStatus", "kevvContactId", "followUpSent"],
    indexes: ["uq_oh_sign_ins_clientSubmissionId"],
  },
  {
    table: "oh_public_funnel_events",
    columns: ["eventId", "visitorId", "stage", "createdAt"],
    indexes: ["uniq_oh_public_funnel_stage"],
  },
  {
    table: "oh_public_chat_access_grants",
    columns: ["eventId", "signInId", "tokenHash", "expiresAt"],
    indexes: ["idx_oh_public_chat_access_eventId", "idx_oh_public_chat_access_signInId"],
  },
  {
    table: "oh_rate_limit_windows",
    columns: ["keyHash", "scope", "hitCount", "resetAt"],
    indexes: ["idx_oh_rate_limit_windows_resetAt", "idx_oh_rate_limit_windows_updatedAt"],
  },
];

type RuntimeSchemaSnapshot = {
  databaseName: string;
  tables: Set<string>;
  columnsByTable: Map<string, Set<string>>;
  indexesByTable: Map<string, Set<string>>;
};

function buildIssue(
  table: string,
  kind: RuntimeSchemaIssue["kind"],
  name: string
): RuntimeSchemaIssue {
  const suffix =
    kind === "missing_table"
      ? `table \`${name}\` is missing`
      : kind === "missing_column"
        ? `column \`${name}\` is missing`
        : `index \`${name}\` is missing`;

  return {
    table,
    kind,
    name,
    message: `Runtime schema drift detected: ${suffix} on \`${table}\`.`,
  };
}

export function evaluateRuntimeSchemaSnapshot(
  snapshot: RuntimeSchemaSnapshot
): RuntimeSchemaReport {
  const tables: RuntimeSchemaTableReport[] = [];
  const issues: RuntimeSchemaIssue[] = [];

  for (const requirement of runtimeSchemaRequirements) {
    const tablePresent = snapshot.tables.has(requirement.table);
    const columnSet = snapshot.columnsByTable.get(requirement.table) ?? new Set<string>();
    const indexSet = snapshot.indexesByTable.get(requirement.table) ?? new Set<string>();
    const missingColumns = tablePresent
      ? requirement.columns.filter((column) => !columnSet.has(column))
      : [...requirement.columns];
    const missingIndexes = tablePresent
      ? requirement.indexes.filter((index) => !indexSet.has(index))
      : [...requirement.indexes];

    tables.push({
      table: requirement.table,
      present: tablePresent,
      missingColumns,
      missingIndexes,
    });

    if (!tablePresent) {
      issues.push(buildIssue(requirement.table, "missing_table", requirement.table));
      continue;
    }

    missingColumns.forEach((column) => {
      issues.push(buildIssue(requirement.table, "missing_column", column));
    });
    missingIndexes.forEach((index) => {
      issues.push(buildIssue(requirement.table, "missing_index", index));
    });
  }

  return {
    ok: issues.length === 0,
    databaseName: snapshot.databaseName,
    checkedAt: new Date().toISOString(),
    tables,
    issues,
  };
}

export async function inspectRuntimeSchemaDrift(
  pool: mysql.Pool = getPool()
): Promise<RuntimeSchemaReport> {
  const [databaseRows] = await pool.query<DatabaseNameRow[]>(
    "SELECT DATABASE() AS databaseName"
  );
  const databaseName = databaseRows[0]?.databaseName;

  if (!databaseName) {
    throw new Error("No database selected for schema drift check");
  }

  const tableNames = runtimeSchemaRequirements.map((requirement) => requirement.table);
  const placeholders = tableNames.map(() => "?").join(", ");

  const [tableRows] = await pool.query<TableRow[]>(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name IN (${placeholders})`,
    [databaseName, ...tableNames]
  );
  const [columnRows] = await pool.query<ColumnRow[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name IN (${placeholders})`,
    [databaseName, ...tableNames]
  );
  const [indexRows] = await pool.query<IndexRow[]>(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName
     FROM information_schema.statistics
     WHERE table_schema = ? AND table_name IN (${placeholders})`,
    [databaseName, ...tableNames]
  );

  const columnsByTable = new Map<string, Set<string>>();
  const indexesByTable = new Map<string, Set<string>>();

  for (const row of columnRows) {
    if (!columnsByTable.has(row.tableName)) {
      columnsByTable.set(row.tableName, new Set<string>());
    }

    columnsByTable.get(row.tableName)?.add(row.columnName);
  }

  for (const row of indexRows) {
    if (!indexesByTable.has(row.tableName)) {
      indexesByTable.set(row.tableName, new Set<string>());
    }

    indexesByTable.get(row.tableName)?.add(row.indexName);
  }

  return evaluateRuntimeSchemaSnapshot({
    databaseName,
    tables: new Set(tableRows.map((row) => row.tableName)),
    columnsByTable,
    indexesByTable,
  });
}
