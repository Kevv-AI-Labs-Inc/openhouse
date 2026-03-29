import type { PublicSignInPayload } from "@/lib/public-signin";

const EVENT_CACHE_PREFIX = "oh-kiosk-event";
const QUEUE_PREFIX = "oh-kiosk-queue";
const LAST_SYNC_PREFIX = "oh-kiosk-last-sync";

const KIOSK_DB_NAME = "openhouse-kiosk";
const KIOSK_STORE_NAME = "offline";

type StoredRecord = {
  key: string;
  value: unknown;
};

export type QueuedKioskSignIn = {
  clientSubmissionId: string;
  payload: PublicSignInPayload & { clientSubmissionId: string };
  queuedAt: string;
  syncAttempts: number;
  status: "pending" | "failed";
  lastError: string | null;
};

let openDbPromise: Promise<IDBDatabase | null> | null = null;

function getIndexedDb() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.indexedDB ?? null;
  } catch {
    return null;
  }
}

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

async function openDb() {
  if (openDbPromise) {
    return openDbPromise;
  }

  const indexedDb = getIndexedDb();

  if (!indexedDb) {
    return null;
  }

  openDbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDb.open(KIOSK_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(KIOSK_STORE_NAME)) {
          db.createObjectStore(KIOSK_STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onclose = () => {
          openDbPromise = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        openDbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        openDbPromise = null;
        resolve(null);
      };
    } catch {
      openDbPromise = null;
      resolve(null);
    }
  });

  return openDbPromise;
}

function readLocalJson<T>(key: string, fallback: T) {
  const storage = getStorage();

  if (!storage) {
    return { found: false, value: fallback };
  }

  try {
    const raw = storage.getItem(key);

    if (!raw) {
      return { found: false, value: fallback };
    }

    return {
      found: true,
      value: JSON.parse(raw) as T,
    };
  } catch {
    return { found: false, value: fallback };
  }
}

function writeLocalJson(key: string, value: unknown) {
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

function removeLocalValue(key: string) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

async function readStoredValue<T>(key: string, fallback: T): Promise<T> {
  const db = await openDb();

  if (!db) {
    return readLocalJson(key, fallback).value;
  }

  const indexedValue = await new Promise<T | undefined>((resolve) => {
    try {
      const transaction = db.transaction(KIOSK_STORE_NAME, "readonly");
      const store = transaction.objectStore(KIOSK_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result as StoredRecord | undefined;
        resolve(record ? (record.value as T) : undefined);
      };

      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });

  if (indexedValue !== undefined) {
    return indexedValue;
  }

  const localValue = readLocalJson(key, fallback);

  if (localValue.found) {
    await writeStoredValue(key, localValue.value);
    return localValue.value;
  }

  return fallback;
}

async function writeStoredValue(key: string, value: unknown) {
  const db = await openDb();
  const localOk = writeLocalJson(key, value);

  if (!db) {
    return localOk;
  }

  const indexedOk = await new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(KIOSK_STORE_NAME, "readwrite");
      const store = transaction.objectStore(KIOSK_STORE_NAME);
      const request = store.put({ key, value } satisfies StoredRecord);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });

  return indexedOk || localOk;
}

async function removeStoredValue(key: string) {
  const db = await openDb();
  const localOk = removeLocalValue(key);

  if (!db) {
    return localOk;
  }

  const indexedOk = await new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(KIOSK_STORE_NAME, "readwrite");
      const store = transaction.objectStore(KIOSK_STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });

  return indexedOk || localOk;
}

function isQueuedKioskSignIn(item: unknown): item is QueuedKioskSignIn {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<QueuedKioskSignIn>;

  return Boolean(
    typeof candidate.clientSubmissionId === "string" &&
      candidate.payload &&
      typeof candidate.queuedAt === "string"
  );
}

export async function requestPersistentKioskStorage() {
  if (typeof navigator === "undefined" || !("storage" in navigator)) {
    return false;
  }

  try {
    if (typeof navigator.storage.persist !== "function") {
      return false;
    }

    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function readCachedKioskEvent<T>(uuid: string) {
  return readStoredValue<T | null>(getEventCacheKey(uuid), null);
}

export async function writeCachedKioskEvent(uuid: string, event: unknown) {
  return writeStoredValue(getEventCacheKey(uuid), event);
}

export async function listQueuedKioskSignIns(uuid: string) {
  const items = await readStoredValue<QueuedKioskSignIn[]>(getQueueKey(uuid), []);

  return Array.isArray(items) ? items.filter(isQueuedKioskSignIn) : [];
}

export async function queueKioskSignIn(uuid: string, item: QueuedKioskSignIn) {
  const existing = (await listQueuedKioskSignIns(uuid)).filter(
    (entry) => entry.clientSubmissionId !== item.clientSubmissionId
  );

  existing.push(item);

  return writeStoredValue(getQueueKey(uuid), existing);
}

async function updateQueuedKioskSignIn(
  uuid: string,
  clientSubmissionId: string,
  updater: (item: QueuedKioskSignIn) => QueuedKioskSignIn
) {
  const items = await listQueuedKioskSignIns(uuid);
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

  return writeStoredValue(getQueueKey(uuid), nextItems);
}

export async function markKioskSignInPending(
  uuid: string,
  clientSubmissionId: string,
  error: string
) {
  return updateQueuedKioskSignIn(uuid, clientSubmissionId, (item) => ({
    ...item,
    status: "pending",
    syncAttempts: item.syncAttempts + 1,
    lastError: error,
  }));
}

export async function markKioskSignInFailed(
  uuid: string,
  clientSubmissionId: string,
  error: string
) {
  return updateQueuedKioskSignIn(uuid, clientSubmissionId, (item) => ({
    ...item,
    status: "failed",
    syncAttempts: item.syncAttempts + 1,
    lastError: error,
  }));
}

export async function removeQueuedKioskSignIn(uuid: string, clientSubmissionId: string) {
  const nextItems = (await listQueuedKioskSignIns(uuid)).filter(
    (item) => item.clientSubmissionId !== clientSubmissionId
  );

  return writeStoredValue(getQueueKey(uuid), nextItems);
}

export async function readLastKioskSyncAt(uuid: string) {
  return readStoredValue<string | null>(getLastSyncKey(uuid), null);
}

export async function writeLastKioskSyncAt(uuid: string, value: string) {
  return writeStoredValue(getLastSyncKey(uuid), value);
}

export async function getKioskQueueSummary(uuid: string) {
  const items = await listQueuedKioskSignIns(uuid);
  const pending = items.filter((item) => item.status === "pending");
  const failed = items.filter((item) => item.status === "failed");

  return {
    pendingCount: pending.length,
    failedCount: failed.length,
    lastError: failed[0]?.lastError ?? pending.find((item) => item.lastError)?.lastError ?? null,
  };
}

export async function clearKioskOfflineState(uuid: string) {
  await Promise.all([
    removeStoredValue(getEventCacheKey(uuid)),
    removeStoredValue(getQueueKey(uuid)),
    removeStoredValue(getLastSyncKey(uuid)),
  ]);
}
