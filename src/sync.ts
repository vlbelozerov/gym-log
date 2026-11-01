import { get, set } from "idb-keyval";
import type { AppData } from "./model";
import { emptyData, isAppData, uid } from "./model";
export interface Snapshot {
  data: AppData;
  revision: number;
  mutationId?: string;
}
export interface Cache extends Snapshot {
  dirty: boolean;
  generation: number;
  pending?: { generation: number; mutationId: string; data: AppData };
}
export interface Remote {
  read: () => Promise<Snapshot | null>;
  write: (
    data: AppData,
    revision: number,
    mutationId: string,
  ) => Promise<Snapshot | null>;
}
export type SyncState =
  "loading" | "saved" | "pending" | "offline" | "error" | "conflict";
export interface SyncView {
  data: AppData;
  status: SyncState;
  message: string;
  remote?: Snapshot;
}
export class JournalSync {
  private cache: Cache = {
    data: emptyData(),
    revision: 0,
    dirty: false,
    generation: 0,
  };
  private busy = false;
  private stopped = false;
  private persistChain: Promise<unknown> = Promise.resolve();
  private conflict?: Snapshot;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(
    key: string,
    private remote: Remote,
    private notify: (view: SyncView) => void,
    private storage = {
      get: () => get<Cache>(key),
      set: (cache: Cache) => set(key, cache),
    },
  ) {}
  private emit(status: SyncState, message = "") {
    if (!this.stopped)
      this.notify({
        data: structuredClone(this.cache.data),
        status,
        message,
        remote: this.conflict,
      });
  }
  private persist() {
    const copy = structuredClone(this.cache);
    this.persistChain = this.persistChain
      .catch(() => {})
      .then(() => this.storage.set(copy));
    return this.persistChain;
  }
  async start() {
    try {
      const saved = await this.storage.get();
      if (this.stopped) return;
      if (saved) {
        if (!isAppData(saved.data))
          throw new Error(
            "Локальный журнал повреждён. Обратитесь к разработчику; кэш не перезаписан.",
          );
        this.cache = saved;
      }
      this.emit(this.cache.dirty ? "pending" : "loading");
      await this.flush();
    } catch (e) {
      this.emit("error", String(e));
    }
  }
  change(updater: (d: AppData) => AppData) {
    if (this.stopped) return;
    this.cache = {
      ...this.cache,
      data: updater(structuredClone(this.cache.data)),
      dirty: true,
      generation: this.cache.generation + 1,
    };
    this.emit(this.conflict ? "conflict" : "pending");
    void this.persist()
      .then(() => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.flush(), 600);
      })
      .catch(() =>
        this.emit(
          "error",
          "Не удалось сохранить запись на устройстве. Не закрывайте приложение.",
        ),
      );
  }
  async flush() {
    if (this.stopped || this.busy || this.conflict) return;
    this.busy = true;
    let reschedule = false;
    try {
      await this.persistChain;
      if (this.stopped) return;
      const latest = await this.remote.read();
      if (this.stopped) return;
      // Recover the acknowledgement when the previous response was lost after the server committed.
      if (
        latest &&
        this.cache.pending &&
        this.cache.pending.mutationId === latest.mutationId
      ) {
        const sent = this.cache.pending;
        this.cache.revision = latest.revision;
        this.cache.dirty = this.cache.generation !== sent.generation;
        this.cache.pending = undefined;
        await this.persist();
      }
      if (
        latest &&
        this.cache.dirty &&
        latest.revision !== this.cache.revision
      ) {
        this.conflict = latest;
        this.emit("conflict");
        return;
      }
      if (!this.cache.dirty) {
        if (latest) this.cache = { ...this.cache, ...latest, dirty: false };
        else if (this.cache.revision !== 0)
          throw new Error(
            "Облачная запись отсутствует. Локальная копия сохранена.",
          );
        else {
          this.cache.dirty = true;
        }
        await this.persist();
        if (!this.cache.dirty) {
          this.emit("saved");
          return;
        }
      }
      const pending = {
        generation: this.cache.generation,
        mutationId: uid(),
        data: structuredClone(this.cache.data),
      };
      this.cache.pending = pending;
      await this.persist();
      if (this.stopped) return;
      const saved = await this.remote.write(
        pending.data,
        this.cache.revision,
        pending.mutationId,
      );
      if (this.stopped) return;
      if (!saved) {
        this.conflict = (await this.remote.read()) ?? undefined;
        this.emit(
          this.conflict ? "conflict" : "error",
          "Данные изменились на другом устройстве.",
        );
        return;
      }
      this.cache = {
        ...this.cache,
        revision: saved.revision,
        mutationId: saved.mutationId,
        dirty: this.cache.generation !== pending.generation,
        pending: undefined,
      };
      await this.persist();
      this.emit(this.cache.dirty ? "pending" : "saved");
      reschedule = this.cache.dirty;
    } catch (e) {
      this.emit(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "error",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      this.busy = false;
      if (reschedule && !this.stopped)
        this.timer = setTimeout(() => void this.flush(), 100);
    }
  }
  async resolve(choice: "local" | "remote") {
    if (!this.conflict) return;
    const latest = this.conflict;
    this.conflict = undefined;
    if (choice === "remote")
      this.cache = {
        ...latest,
        dirty: false,
        generation: this.cache.generation + 1,
      };
    else
      this.cache = {
        ...this.cache,
        revision: latest.revision,
        dirty: true,
        pending: undefined,
      };
    await this.persist();
    this.emit(this.cache.dirty ? "pending" : "saved");
    await this.flush();
  }
  get dirty() {
    return this.cache.dirty;
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}
