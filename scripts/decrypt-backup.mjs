import { createDecipheriv } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const key = process.env.BACKUP_ENCRYPTION_KEY;
if (!/^[a-f0-9]{64}$/i.test(key ?? ""))
  throw new Error("Set the original 64-hex BACKUP_ENCRYPTION_KEY");
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output)
  throw new Error(
    "Usage: node scripts/decrypt-backup.mjs input.enc output.json",
  );
const bytes = await readFile(input);
if (bytes.subarray(0, 4).toString() !== "GYM1")
  throw new Error("Unsupported backup format");
const decipher = createDecipheriv(
  "aes-256-gcm",
  Buffer.from(key, "hex"),
  bytes.subarray(4, 16),
);
decipher.setAuthTag(bytes.subarray(16, 32));
const plain = Buffer.concat([
  decipher.update(bytes.subarray(32)),
  decipher.final(),
]);
JSON.parse(plain.toString());
await writeFile(output, plain, { mode: 0o600, flag: "wx" });
console.log("Decrypted. Keep this file private; never commit it to Git.");
