import { get, getActiveLive, getAll, put, requestToPromise, transactionDone, tx } from "./db.js";
import { autosave } from "./backup.js";
import { queueSync } from "./sync.js";
import { normalizeName, uid } from "./utils.js";

export async function getDashboardData() {
  const [live, categorias, pedidos, items, clientes] = await Promise.all([
    getActiveLive(),
    getAll("categorias"),
    getAll("pedidos"),
    getAll("items"),
    getAll("clientes")
  ]);
  return {
    live,
    categorias: categorias.sort((a, b) => a.orden - b.orden),
    pedidos,
    items,
    clientes
  };
}

export async function createSale({ categoriaId, clienteNombre, precio, descuento = 0 }) {
  const live = await getActiveLive();
  if (!live) throw new Error("No hay live activo");

  const category = await get("categorias", categoriaId);
  if (!category) throw new Error("Categoria no encontrada");

  const clientName = normalizeName(clienteNombre);
  if (!clientName) throw new Error("Ingresa el cliente");

  const client = await findOrCreateClient(clientName);
  const nextNumber = Number(category.contador || 1);
  const code = `${category.prefijo}${nextNumber}`;
  const now = new Date().toISOString();
  const total = Math.max(0, Number(precio || 0) - Number(descuento || 0));

  const pedido = {
    id: uid("ped"),
    clienteId: client.id,
    liveId: live.id,
    estado: "pendiente_pago",
    subtotal: Number(precio || 0),
    descuento: Number(descuento || 0),
    total,
    createdAt: now,
    updatedAt: now
  };
  const item = {
    id: uid("item"),
    pedidoId: pedido.id,
    categoriaId,
    code,
    precio: Number(precio || 0),
    ordinalCliente: await nextOrdinalForClient(client.id, live.id),
    estado: "reservado",
    createdAt: now
  };

  const { transaction, stores } = tx(["categorias", "pedidos", "items", "statusEvents"], "readwrite");
  stores.categorias.put({ ...category, contador: nextNumber + 1 });
  stores.pedidos.put(pedido);
  stores.items.put(item);
  stores.statusEvents.put({
    id: uid("status"),
    entityType: "pedido",
    entityId: pedido.id,
    from: null,
    to: pedido.estado,
    createdAt: now
  });
  await transactionDone(transaction);

  const sale = { live, category: { ...category, contador: nextNumber + 1 }, client, pedido, item };
  await queueSync("sale_created", sale);
  await autosave("sale_created", live.id);
  return sale;
}

export async function findOrCreateClient(name) {
  const clientes = await getAll("clientes");
  const existing = clientes.find((client) => client.nombre.toLowerCase() === name.toLowerCase() || client.alias?.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const client = {
    id: uid("cli"),
    nombre: name,
    alias: name.toLowerCase().replace(/\s+/g, "_"),
    telefono: "",
    comuna: "",
    direccion: "",
    notas: "",
    vip: false,
    bloqueado: false,
    createdAt: new Date().toISOString()
  };
  await put("clientes", client);
  await queueSync("client_created", client);
  return client;
}

async function nextOrdinalForClient(clienteId, liveId) {
  const pedidos = (await getAll("pedidos")).filter((pedido) => pedido.clienteId === clienteId && pedido.liveId === liveId);
  return pedidos.length + 1;
}

export async function updatePedidoEstado(pedidoId, estado) {
  const pedido = await get("pedidos", pedidoId);
  if (!pedido) return null;
  const updated = { ...pedido, estado, updatedAt: new Date().toISOString() };
  await put("pedidos", updated);
  await put("statusEvents", {
    id: uid("status"),
    entityType: "pedido",
    entityId: pedidoId,
    from: pedido.estado,
    to: estado,
    createdAt: updated.updatedAt
  });
  await queueSync("pedido_status_changed", updated);
  return updated;
}

export async function logPrint(itemId) {
  const event = {
    id: uid("print"),
    itemId,
    status: "mock",
    createdAt: new Date().toISOString()
  };
  await put("printEvents", event);
  await queueSync("label_printed", event);
  return event;
}

export async function clearAllData() {
  const names = ["clientes", "lives", "pedidos", "items", "backups", "syncQueue", "printEvents", "statusEvents"];
  const { transaction, stores } = tx(names, "readwrite");
  names.forEach((name) => stores[name].clear());
  await transactionDone(transaction);
}
