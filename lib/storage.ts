export type LetterRecord = {
  id: string;
  title: string;
  sender: string;
  body: string;
  createdAt: string;
  url: string;
};

export type SavedThing = {
  id: string;
  kind: string;
  emoji: string;
  message: string;
  createdAt: string;
  url: string;
};

const DB_NAME = "our-little-world";
const DB_VERSION = 1;
const STORES = ["letters", "things", "games"] as const;

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function fallbackGet<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

function fallbackSet<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage write failures in private browsing
  }
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      STORES.forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

async function readAllFromStore<T>(storeName: "letters" | "things" | "games"): Promise<T[]> {
  if (!hasIndexedDb()) {
    return fallbackGet<T>(storeName);
  }

  try {
    const database = await openDatabase();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = database.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();

      request.onsuccess = () => resolve((request.result ?? []) as T[]);
      request.onerror = () => reject(request.error ?? new Error("Failed reading store"));
    });
  } catch {
    return fallbackGet<T>(storeName);
  }
}

async function putIntoStore<T>(storeName: "letters" | "things" | "games", value: T[]) {
  if (!hasIndexedDb()) {
    fallbackSet(storeName, value);
    return;
  }

  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      value.forEach((item) => store.put(item));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Write failed"));
    });
  } catch {
    fallbackSet(storeName, value);
  }
}

export async function readSavedLetters(): Promise<LetterRecord[]> {
  return readAllFromStore<LetterRecord>("letters");
}

export async function saveSavedLetter(letter: LetterRecord) {
  const records = await readSavedLetters();
  const next = [letter, ...records.filter((item) => item.id !== letter.id)].slice(0, 12);
  await putIntoStore("letters", next);
}

export async function readSavedThings(): Promise<SavedThing[]> {
  return readAllFromStore<SavedThing>("things");
}

export async function saveSavedThing(thing: SavedThing) {
  const records = await readSavedThings();
  const next = [thing, ...records.filter((item) => item.id !== thing.id)].slice(0, 12);
  await putIntoStore("things", next);
}

export async function readSavedGames<T = Record<string, unknown>>(): Promise<T[]> {
  return readAllFromStore<T>("games");
}

export async function saveSavedGame<T extends { id: string }>(game: T) {
  const records = await readSavedGames<T>();
  const next = [game, ...records.filter((item) => item.id !== game.id)].slice(0, 20);
  await putIntoStore("games", next);
}
