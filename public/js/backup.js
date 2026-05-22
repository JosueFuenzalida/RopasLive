import { exportDatabase, put } from "./db.js";
import { queueSync } from "./sync.js";
import { downloadJson, todayISO, uid } from "./utils.js";

export async function createBackup(reason = "manual", liveId = null) {
  const backup = await exportDatabase();
  const record = {
    id: uid("backup"),
    liveId,
    reason,
    createdAt: new Date().toISOString(),
    payload: backup
  };
  await put("backups", record);
  await queueSync("backup_created", { id: record.id, reason, liveId, createdAt: record.createdAt });
  return record;
}

export async function exportBackup(reason = "manual", liveId = null) {
  const record = await createBackup(reason, liveId);
  const filename = `backup-live-${todayISO()}-${record.id}.json`;
  downloadJson(filename, record.payload);
  try {
    await fetch("/api/backups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename, backup: record.payload })
    });
  } catch {
    await queueSync("backup_upload_pending", { filename, backupId: record.id });
  }
  return record;
}

export async function autosave(reason, liveId = null) {
  return createBackup(reason, liveId);
}
