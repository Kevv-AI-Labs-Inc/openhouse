import {
  evaluateRuntimeSchemaSnapshot,
} from "@/lib/schema-drift";

function createCompleteSnapshot() {
  return {
    databaseName: "openhouse",
    tables: new Set([
      "oh_sign_ins",
      "oh_public_funnel_events",
      "oh_public_chat_access_grants",
      "oh_rate_limit_windows",
    ]),
    columnsByTable: new Map<string, Set<string>>([
      [
        "oh_sign_ins",
        new Set(["clientSubmissionId", "crmSyncStatus", "kevvContactId", "followUpSent"]),
      ],
      [
        "oh_public_funnel_events",
        new Set(["eventId", "visitorId", "stage", "createdAt"]),
      ],
      [
        "oh_public_chat_access_grants",
        new Set(["eventId", "signInId", "tokenHash", "expiresAt"]),
      ],
      [
        "oh_rate_limit_windows",
        new Set(["keyHash", "scope", "hitCount", "resetAt"]),
      ],
    ]),
    indexesByTable: new Map<string, Set<string>>([
      ["oh_sign_ins", new Set(["uq_oh_sign_ins_clientSubmissionId"])],
      ["oh_public_funnel_events", new Set(["uniq_oh_public_funnel_stage"])],
      [
        "oh_public_chat_access_grants",
        new Set(["idx_oh_public_chat_access_eventId", "idx_oh_public_chat_access_signInId"]),
      ],
      [
        "oh_rate_limit_windows",
        new Set(["idx_oh_rate_limit_windows_resetAt", "idx_oh_rate_limit_windows_updatedAt"]),
      ],
    ]),
  };
}

describe("schema drift smoke", () => {
  it("passes when the runtime schema has every required table, column, and index", () => {
    const report = evaluateRuntimeSchemaSnapshot(createCompleteSnapshot());

    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("flags missing columns and indexes on high-risk runtime tables", () => {
    const snapshot = createCompleteSnapshot();
    snapshot.columnsByTable.set(
      "oh_sign_ins",
      new Set(["crmSyncStatus", "kevvContactId", "followUpSent"])
    );
    snapshot.indexesByTable.set("oh_public_funnel_events", new Set());

    const report = evaluateRuntimeSchemaSnapshot(snapshot);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "oh_sign_ins",
          kind: "missing_column",
          name: "clientSubmissionId",
        }),
        expect.objectContaining({
          table: "oh_public_funnel_events",
          kind: "missing_index",
          name: "uniq_oh_public_funnel_stage",
        }),
      ])
    );
  });
});
