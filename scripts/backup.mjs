import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_ENCRYPTION_KEY } =
  process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !/^[a-f0-9]{64}$/i.test(BACKUP_ENCRYPTION_KEY ?? "")
)
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a 64-hex BACKUP_ENCRYPTION_KEY.",
  );
const origin = new URL(SUPABASE_URL);
if (origin.protocol !== "https:") throw new Error("HTTPS is required");
const rows = [];
for (let offset = 0; ; offset += 100) {
  const url = new URL("/rest/v1/journals", origin);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "user_id.asc");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`Backup fetch failed: HTTP ${response.status}`);
  const page = await response.json();
  if (!Array.isArray(page)) throw new Error("Invalid database response");
  rows.push(...page);
  if (page.length < 100) break;
}
const iv = randomBytes(12);
const cipher = createCipheriv(
  "aes-256-gcm",
  Buffer.from(BACKUP_ENCRYPTION_KEY, "hex"),
  iv,
);
const encrypted = Buffer.concat([
  cipher.update(
    JSON.stringify({
      format: 1,
      createdAt: new Date().toISOString(),
      journals: rows,
    }),
    "utf8",
  ),
  cipher.final(),
]);
await mkdir("backups", { recursive: true });
await writeFile(
  "backups/journals.enc",
  Buffer.concat([Buffer.from("GYM1"), iv, cipher.getAuthTag(), encrypted]),
  { mode: 0o600 },
);
console.log(
  `Encrypted backup created (${rows.length} journals). No plaintext written to disk.`,
);
