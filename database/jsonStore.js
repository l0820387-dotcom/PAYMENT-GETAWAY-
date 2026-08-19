// database/jsonStore.js
// A tiny local JSON-file database engine. Each "table" is one JSON file in /data.
// Uses an in-process write queue per file to avoid corrupting the file when
// multiple writes happen close together (Node is single-threaded, but async
// fs writes can still interleave without this).

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// One write-queue promise per file, so writes to the same file never overlap.
const writeQueues = {};

function filePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function ensureFile(table) {
  const p = filePath(table);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, "{}", "utf-8");
  }
  return p;
}

/**
 * Reads the entire table (an object keyed by record id) into memory.
 */
function readTable(table) {
  const p = ensureFile(table);
  const raw = fs.readFileSync(p, "utf-8");
  try {
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.error(`[jsonStore] Corrupt JSON in ${table}.json, resetting to {}`, err.message);
    return {};
  }
}

/**
 * Writes the entire table object back to disk, queued so concurrent
 * writes to the same table serialize instead of racing.
 */
function writeTable(table, data) {
  ensureFile(table);
  const prev = writeQueues[table] || Promise.resolve();

  const next = prev
    .catch(() => {}) // don't let a prior failure block future writes
    .then(
      () =>
        new Promise((resolve, reject) => {
          const p = filePath(table);
          const tmpPath = `${p}.tmp`;
          fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8", (err) => {
            if (err) return reject(err);
            fs.rename(tmpPath, p, (err2) => {
              if (err2) return reject(err2);
              resolve();
            });
          });
        })
    );

  writeQueues[table] = next;
  return next;
}

/** Get one record by id. Returns null if not found. */
function get(table, id) {
  const data = readTable(table);
  return Object.prototype.hasOwnProperty.call(data, id) ? data[id] : null;
}

/** Get the whole table as { id: record, ... } */
function getAll(table) {
  return readTable(table);
}

/** Set/overwrite one record by id. */
async function set(table, id, record) {
  const data = readTable(table);
  data[id] = record;
  await writeTable(table, data);
  return record;
}

/** Shallow-merge an update into an existing record. */
async function update(table, id, updates) {
  const data = readTable(table);
  data[id] = { ...(data[id] || {}), ...updates };
  await writeTable(table, data);
  return data[id];
}

/** Remove a record by id. */
async function remove(table, id) {
  const data = readTable(table);
  delete data[id];
  await writeTable(table, data);
}

/** Find all records matching a predicate function. Returns array of records (with id attached). */
function find(table, predicateFn) {
  const data = readTable(table);
  return Object.entries(data)
    .filter(([, record]) => predicateFn(record))
    .map(([id, record]) => ({ id, ...record }));
}

module.exports = { get, getAll, set, update, remove, find, readTable, writeTable };
