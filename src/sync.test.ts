import { afterEach, describe, expect, it } from "vitest";
import { JournalSync } from "./sync";
import type { Cache, Snapshot, SyncView, Remote } from "./sync";
import { emptyData } from "./model";
const clients: JournalSync[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.stop()));
function setup() {
  let cloud: Snapshot | null = null;
  let disk: Cache | undefined;
  const views: SyncView[] = [];
  let writes = 0;
  const remote: Remote = {
    read: async () => structuredClone(cloud),
    write: async (data, revision, mutationId) => {
      writes++;
      if (revision !== (cloud?.revision ?? 0)) return null;
      cloud = {
        data: structuredClone(data),
        revision: revision + 1,
        mutationId,
      };
      return structuredClone(cloud);
    },
  };
  const storage = {
    get: async () => structuredClone(disk),
    set: async (d: Cache) => {
      disk = structuredClone(d);
    },
  };
  const client = new JournalSync("test", remote, (v) => views.push(v), storage);
  clients.push(client);
  return {
    client,
    views,
    remote,
    storage,
    get cloud() {
      return cloud;
    },
    set cloud(v: Snapshot | null) {
      cloud = v;
    },
    get disk() {
      return disk;
    },
    get writes() {
      return writes;
    },
  };
}
describe("durable cloud synchronization", () => {
  it("initializes cloud and saves local changes", async () => {
    const s = setup();
    await s.client.start();
    s.client.change((d) => ({ ...d, restSeconds: 120 }));
    await s.client.flush();
    expect(s.cloud?.data.restSeconds).toBe(120);
    expect(s.disk?.dirty).toBe(false);
    expect(s.views.at(-1)?.status).toBe("saved");
  });
  it("persists offline changes without claiming cloud confirmation", async () => {
    const s = setup();
    await s.client.start();
    s.remote.read = async () => {
      throw new Error("offline");
    };
    s.client.change((d) => ({ ...d, restSeconds: 150 }));
    await s.client.flush();
    expect(s.disk?.data.restSeconds).toBe(150);
    expect(s.disk?.dirty).toBe(true);
    expect(s.cloud?.data.restSeconds).toBe(90);
    expect(s.views.at(-1)?.status).not.toBe("saved");
  });
  it("detects another-device change without overwriting either version", async () => {
    const s = setup();
    await s.client.start();
    s.cloud = {
      data: { ...emptyData(), restSeconds: 200 },
      revision: 2,
      mutationId: "other",
    };
    s.client.change((d) => ({ ...d, restSeconds: 130 }));
    await s.client.flush();
    expect(s.views.at(-1)?.status).toBe("conflict");
    expect(s.cloud.data.restSeconds).toBe(200);
    expect(s.disk?.data.restSeconds).toBe(130);
    await s.client.resolve("local");
    expect(s.cloud.data.restSeconds).toBe(130);
    expect(s.cloud.revision).toBe(3);
  });
  it("recovers a lost server acknowledgement idempotently", async () => {
    const s = setup();
    await s.client.start();
    const write = s.remote.write;
    s.remote.write = async (...args) => {
      await write(...args);
      throw new Error("response lost");
    };
    s.client.change((d) => ({ ...d, restSeconds: 140 }));
    await s.client.flush();
    expect(s.disk?.dirty).toBe(true);
    const writes = s.writes;
    await s.client.flush();
    expect(s.views.at(-1)?.status).toBe("saved");
    expect(s.disk?.dirty).toBe(false);
    expect(s.writes).toBe(writes);
  });
  it("preserves changes made while an upload is in progress", async () => {
    const s = setup();
    await s.client.start();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = s.remote.write;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    s.remote.write = async (...args) => {
      entered();
      await gate;
      return original(...args);
    };
    s.client.change((d) => ({ ...d, restSeconds: 100 }));
    const pending = s.client.flush();
    await started;
    s.client.change((d) => ({ ...d, restSeconds: 110 }));
    release();
    await pending;
    expect(s.disk?.data.restSeconds).toBe(110);
    expect(s.disk?.dirty).toBe(true);
    s.remote.write = original;
    await s.client.flush();
    expect(s.cloud?.data.restSeconds).toBe(110);
    expect(s.disk?.dirty).toBe(false);
  });
  it("reloads offline queue after restarting the app", async () => {
    const s = setup();
    await s.client.start();
    s.client.change((d) => ({ ...d, restSeconds: 180 }));
    s.remote.read = async () => {
      throw new Error("offline");
    };
    await s.client.flush();
    s.client.stop();
    const second = new JournalSync(
      "test",
      { ...s.remote, read: async () => s.cloud },
      (v) => s.views.push(v),
      s.storage,
    );
    clients.push(second);
    await second.start();
    expect(s.cloud?.data.restSeconds).toBe(180);
    expect(s.views.at(-1)?.status).toBe("saved");
  });
  it("never sends writes when the local cache cannot be committed", async () => {
    const s = setup();
    await s.client.start();
    const count = s.writes;
    s.storage.set = async () => {
      throw new Error("storage full");
    };
    s.client.change((d) => ({ ...d, restSeconds: 190 }));
    await s.client.flush();
    expect(s.writes).toBe(count);
    expect(s.views.at(-1)?.status).toBe("error");
  });
});
