import { getAll, put, remove } from "./db.js";
import { uid } from "./utils.js";

export async function queueSync(type, payload) {
  await put("syncQueue", {
    id: uid("sync"),
    type,
    payload,
    status: "pending",
    createdAt: new Date().toISOString()
  });
}

export async function flushSync() {
  const events = (await getAll("syncQueue")).filter((event) => event.status === "pending");
  if (events.length === 0) return { ok: true, sent: 0 };

  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events })
  });

  if (!response.ok) throw new Error("No se pudo sincronizar");
  await Promise.all(events.map((event) => remove("syncQueue", event.id)));
  return { ok: true, sent: events.length };
}

export function scheduleSync() {
  window.addEventListener("online", () => {
    flushSync().catch(() => {});
  });
  setInterval(() => {
    if (navigator.onLine) flushSync().catch(() => {});
  }, 30_000);
}
