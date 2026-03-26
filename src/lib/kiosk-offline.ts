import type { PublicSignInPayload } from "@/lib/public-signin";

const EVENT_CACHE_PREFIX = "oh-kiosk-event";
const QUEUE_PREFIX = "oh-kiosk-queue";
const LAST_SYNC_PREFIX = "oh-kiosk-last-sync";

export type QueuedKioskSignIn = {
  clientSubmissionId: string;
  payload: PublicSignInPayload & { clientSubmissionId: string };
  queuedAt: string;
  syncAttempts: number;
  status: "pending" | "failed";
  lastError: string | null;
};

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getEventCacheKey(uuid: string) {
  return `${EVENT_CACHE_PREFIX}:${uuid}`;
}

function getQueueKey(uuid: string) {
  return `${QUEUE_PREFIX}:${uuid}`;
}

function getLastSyncKey(uuid: string) {
  return `${LAST_SYNC_PREFIX}:${uuid}`;
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readCachedKioskEvent<T>(uuid: string) {
  return readJson<T | null>(getEventCacheKey(uuid), null);
}

export function writeCachedKioskEvent(uuid: string, event: unknown) {
  return writeJson(getEventCacheKey(uuid), event);
}

export function listQueuedKioskSignIns(uuid: string) {
  const items = readJson<QueuedKioskSignIn[]>(getQueueKey(uuid), []);

  return Array.isArray(items)
    ? items.filter(
        (item) =>
          item &&
          typeof item.clientSubmissionId === "string" &&
          item.payload &&
          typeof item.queuedAt === "string"
      )
    : [];
}

export function queueKioskSignIn(uuid: string, item: QueuedKioskSignIn) {
  const existing = listQueuedKioskSignIns(uuid).filter(
    (entry) => entry.clientSubmissionId !== item.clientSubmissionId
  );

  existing.push(item);

  return writeJson(getQueueKey(uuid), existing);
}

function updateQueuedKioskSignIn(
  uuid: string,
  clientSubmissionId: string,
  updater: (item: QueuedKioskSignIn) => QueuedKioskSignIn
) {
  const items = listQueuedKioskSignIns(uuid);
  let found = false;

  const nextItems = items.map((item) => {
    if (item.clientSubmissionId !== clientSubmissionId) {
      return item;
    }

    found = true;
    return updater(item);
  });

  if (!found) {
    return false;
  }

  return writeJson(getQueueKey(uuid), nextItems);
}

export function markKioskSignInPending(uuid: string, clientSubmissionId: string, error: string) {
  return updateQueuedKioskSignIn(uuid, clientSubmissionId, (item) => ({
    ...item,
    status: "pending",
    syncAttempts: item.syncAttempts + 1,
    lastError: error,
  }));
}

export function markKioskSignInFailed(uuid: string, clientSubmissionId: string, error: string) {
  return updateQueuedKioskSignIn(uuid, clientSubmissionId, (item) => ({
    ...item,
    status: "failed",
    syncAttempts: item.syncAttempts + 1,
    lastError: error,
  }));
}

export function removeQueuedKioskSignIn(uuid: string, clientSubmissionId: string) {
  const nextItems = listQueuedKioskSignIns(uuid).filter(
    (item) => item.clientSubmissionId !== clientSubmissionId
  );

  return writeJson(getQueueKey(uuid), nextItems);
}

export function readLastKioskSyncAt(uuid: string) {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  return storage.getItem(getLastSyncKey(uuid));
}

export function writeLastKioskSyncAt(uuid: string, value: string) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(getLastSyncKey(uuid), value);
    return true;
  } catch {
    return false;
  }
}

export function getKioskQueueSummary(uuid: string) {
  const items = listQueuedKioskSignIns(uuid);
  const pending = items.filter((item) => item.status === "pending");
  const failed = items.filter((item) => item.status === "failed");

  return {
    pendingCount: pending.length,
    failedCount: failed.length,
    lastError: failed[0]?.lastError ?? pending.find((item) => item.lastError)?.lastError ?? null,
  };
}
