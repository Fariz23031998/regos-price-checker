const base = "http://127.0.0.1:54032";

async function readAdmin() {
  const response = await fetch(`${base}/api/admin`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function putAdmin(config, settings) {
  const response = await fetch(`${base}/api/admin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, settings }),
  });
  const text = await response.text();
  return { status: response.status, body: text };
}

const original = await readAdmin();
const badSqlite = await putAdmin(
  { ...original.config, sqlite_path: "data/prices.sqlite/nope.sqlite" },
  original.settings,
);
console.log(`badSqlite=${badSqlite.status} ${badSqlite.body}`);

const afterBadSqlite = await readAdmin();
console.log(`sqliteUnchanged=${afterBadSqlite.config.sqlite_path === original.config.sqlite_path}`);

const badPort = await putAdmin({ ...original.config, listen_port: 1 }, original.settings);
console.log(`badPort=${badPort.status} ${badPort.body}`);

const afterBadPort = await readAdmin();
console.log(`portUnchanged=${afterBadPort.config.listen_port === original.config.listen_port}`);
console.log(`stillListening=${afterBadPort.listeningPort === original.listeningPort}`);

try {
  const saved = await putAdmin(
    { ...original.config, check_time: 12 },
    { ...original.settings, sync_time: 11, name_font_size: 71 },
  );
  console.log(`saved=${saved.status}`);
  const parsed = JSON.parse(saved.body);
  console.log(`appliedCheck=${parsed.config.check_time}`);
  console.log(`appliedSync=${parsed.settings.sync_time}`);
  console.log(`appliedFont=${parsed.settings.name_font_size}`);
  console.log(`warning=${parsed.warning}`);
  const live = await fetch(`${base}/api/settings`).then((response) => response.json());
  console.log(`liveFont=${live.name_font_size}`);
  console.log(`liveSync=${live.sync_time}`);
  const status = await fetch(`${base}/api/status`).then((response) => response.json());
  console.log(`statusItems=${status.counts.items}`);
} finally {
  const restored = await putAdmin(original.config, original.settings);
  console.log(`restored=${restored.status}`);
  const finalState = await readAdmin();
  console.log(`finalFont=${finalState.settings.name_font_size}`);
  console.log(`finalSync=${finalState.settings.sync_time}`);
  console.log(`finalCheck=${finalState.config.check_time}`);
}
