const DB_NAME = "mesurer-recordings";
const STORE_NAME = "recordings";

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open recording storage"));
  });

export const saveRecording = async (id: string, blob: Blob) => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save recording"));
  });
  db.close();
};

export const readRecording = async (id: string) => {
  const db = await openDatabase();
  const blob = await new Promise<Blob>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("Recording not found"));
    request.onerror = () => reject(request.error ?? new Error("Could not read recording"));
  });
  db.close();
  return blob;
};

export const deleteRecording = async (id: string) => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not delete recording"));
  });
  db.close();
};
