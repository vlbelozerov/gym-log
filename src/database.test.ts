import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyData } from "./model";
const db = new PGlite();
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
let mutation = 0;
async function asUser(id: string) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated;");
}
async function save(revision: number, data = emptyData(), id?: string) {
  const result = await db.query<{
    saved: { revision: number; data: unknown } | null;
  }>("select public.save_journal($1::jsonb,$2::bigint,$3::uuid) as saved", [
    JSON.stringify(data),
    revision,
    id ?? `10000000-0000-4000-8000-${String(++mutation).padStart(12, "0")}`,
  ]);
  return result.rows[0].saved;
}
beforeAll(async () => {
  await db.exec(
    `create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; insert into auth.users values ('${a}'),('${b}');`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611020001_journal.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("actual PostgreSQL permissions and optimistic concurrency", () => {
  it("creates the first journal atomically and rejects a stale revision", async () => {
    await asUser(a);
    expect((await save(0))?.revision).toBe(1);
    expect(await save(0)).toBeNull();
    expect((await save(1))?.revision).toBe(2);
  });
  it("allows only the owner to read their journal", async () => {
    await asUser(b);
    expect((await db.query("select * from public.journals")).rows).toHaveLength(
      0,
    );
    await save(0);
    expect((await db.query("select * from public.journals")).rows).toHaveLength(
      1,
    );
  });
  it("does not allow direct updates that bypass the revision check", async () => {
    await asUser(a);
    await expect(
      db.exec("update public.journals set revision=99"),
    ).rejects.toThrow(/permission denied/);
  });
  it("retries the same mutation without incrementing revision twice", async () => {
    await asUser(a);
    const id = "20000000-0000-4000-8000-000000000001";
    const first = await save(2, emptyData(), id);
    const repeat = await save(2, emptyData(), id);
    expect(first?.revision).toBe(3);
    expect(repeat?.revision).toBe(3);
  });
  it("refuses anonymous writes", async () => {
    await db.exec("reset role;set role anon;");
    await expect(save(0)).rejects.toThrow(/permission denied/);
  });
});
