const DB_NAME = "live-commerce-db";
const DB_VERSION = 1;

let database;

const stores = {
  settings: { keyPath: "key" },
  categorias: { keyPath: "id" },
  clientes: { keyPath: "id", indexes: ["nombre", "alias"] },
  lives: { keyPath: "id", indexes: ["fecha", "estado"] },
  pedidos: { keyPath: "id", indexes: ["clienteId", "liveId", "estado", "createdAt"] },
  items: { keyPath: "id", indexes: ["pedidoId", "categoriaId", "code", "estado"] },
  backups: { keyPath: "id", indexes: ["createdAt", "liveId"] },
  syncQueue: { keyPath: "id", indexes: ["createdAt", "status"] },
  printEvents: { keyPath: "id", indexes: ["itemId", "createdAt"] },
  statusEvents: { keyPath: "id", indexes: ["entityId", "createdAt"] }
};

export async function initDB() {
  database = await openDB();
  await seedDefaults();
  return database;
}

export function db() {
  if (!database) throw new Error("Base de datos no inicializada");
  return database;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const next = request.result;
      Object.entries(stores).forEach(([name, config]) => {
        if (!next.objectStoreNames.contains(name)) {
          const store = next.createObjectStore(name, { keyPath: config.keyPath });
          (config.indexes || []).forEach((index) => store.createIndex(index, index));
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function tx(storeNames, mode = "readonly") {
  const transaction = db().transaction(storeNames, mode);
  const access = {};
  storeNames.forEach((name) => {
    access[name] = transaction.objectStore(name);
  });
  return { transaction, stores: access };
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getAll(storeName) {
  const { stores } = tx([storeName]);
  return requestToPromise(stores[storeName].getAll());
}

export async function get(storeName, key) {
  const { stores } = tx([storeName]);
  return requestToPromise(stores[storeName].get(key));
}

export async function put(storeName, value) {
  const { transaction, stores } = tx([storeName], "readwrite");
  stores[storeName].put(value);
  await transactionDone(transaction);
  return value;
}

export async function remove(storeName, key) {
  const { transaction, stores } = tx([storeName], "readwrite");
  stores[storeName].delete(key);
  await transactionDone(transaction);
}

export async function getByIndex(storeName, indexName, value) {
  const { stores } = tx([storeName]);
  return requestToPromise(stores[storeName].index(indexName).getAll(value));
}

async function seedDefaults() {
  const categorias = await getAll("categorias");
  if (categorias.length === 0) {
    const defaults = [
      { id: "cat_poleras", nombre: "Poleras", prefijo: "P", contador: 1, color: "#ff4fa3", icono: "shirt", orden: 1 },
      { id: "cat_pantalones", nombre: "Pantalones", prefijo: "J", contador: 1, color: "#4f8fff", icono: "pants", orden: 2 },
      { id: "cat_chaquetas", nombre: "Chaquetas", prefijo: "C", contador: 1, color: "#ff9f4f", icono: "jacket", orden: 3 },
      { id: "cat_polrones", nombre: "Polerones", prefijo: "H", contador: 1, color: "#a66cff", icono: "hoodie", orden: 4 },
      { id: "cat_accesorios", nombre: "Accesorios", prefijo: "A", contador: 1, color: "#3acb73", icono: "bag", orden: 5 }
    ];
    const { transaction, stores: localStores } = tx(["categorias"], "readwrite");
    defaults.forEach((category) => localStores.categorias.put(category));
    await transactionDone(transaction);
  }

  const live = await getActiveLive();
  if (!live) {
    await put("lives", {
      id: `live_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}_01`,
      fecha: new Date().toISOString().slice(0, 10),
      estado: "activo",
      inicio: new Date().toTimeString().slice(0, 5),
      fin: null,
      createdAt: new Date().toISOString()
    });
  }
}

export async function getActiveLive() {
  const active = await getByIndex("lives", "estado", "activo");
  return active[0] || null;
}

export async function exportDatabase() {
  const result = {};
  for (const name of Object.keys(stores)) {
    result[name] = await getAll(name);
  }
  return {
    app: "live-commerce",
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: result
  };
}
