import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    rpmLimit: row.rpmLimit ?? null,
    tpmLimit: row.tpmLimit ?? null,
    dailyTokensLimit: row.dailyTokensLimit ?? null,
    dailyCostLimit: row.dailyCostLimit ?? null,
    quotaPoolId: row.quotaPoolId ?? null,
  };
}

async function getKeyRow(key) {
  const db = await getAdapter();
  return db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
}

export { getKeyRow };

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, limits = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    rpmLimit: limits.rpmLimit ?? null,
    tpmLimit: limits.tpmLimit ?? null,
    dailyTokensLimit: limits.dailyTokensLimit ?? null,
    dailyCostLimit: limits.dailyCostLimit ?? null,
    quotaPoolId: limits.quotaPoolId ?? null,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, rpmLimit, tpmLimit, dailyTokensLimit, dailyCostLimit, quotaPoolId) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt, apiKey.rpmLimit, apiKey.tpmLimit, apiKey.dailyTokensLimit, apiKey.dailyCostLimit, apiKey.quotaPoolId]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, rpmLimit = ?, tpmLimit = ?, dailyTokensLimit = ?, dailyCostLimit = ?, quotaPoolId = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, merged.rpmLimit ?? null, merged.tpmLimit ?? null, merged.dailyTokensLimit ?? null, merged.dailyCostLimit ?? null, merged.quotaPoolId ?? null, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const row = await getKeyRow(key);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}

// Full key record incl. limits — used by the auth gate to enforce per-key caps.
export async function getApiKeyByKey(key) {
  if (!key) return null;
  const row = await getKeyRow(key);
  return rowToKey(row);
}
