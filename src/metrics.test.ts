import { describe, it, expect } from "vitest";
import {
  emptyData,
  newSet,
  createWorkout,
  makeExercise,
  isAppData,
  weekStart,
} from "./model";
import { volume, setCount, weeks, goalAt, sameWeightReps } from "./metrics";
describe("training records and calculations", () => {
  it("counts completed work sets, excludes warmup and uncompleted sets", () => {
    const d = emptyData();
    const w = createWorkout(d, d.templates[0]);
    w.exercises = w.exercises.slice(0, 1);
    w.exercises[0].sets = [
      { ...newSet(60, 10), done: true },
      { ...newSet(20, 10), kind: "warmup", done: true },
      newSet(60, 10),
    ];
    expect(volume(w)).toBe(600);
    expect(setCount(w)).toBe(1);
  });
  it("counts a pair of dumbbells but excludes bodyweight and assisted tonnage", () => {
    const d = emptyData();
    const w = createWorkout(d);
    w.exercises = ["incline", "pullup", "assisted"].map((id) =>
      makeExercise(
        d.exercises.find((e) => e.id === id)!,
        [],
      ),
    );
    w.exercises.forEach((e) => (e.sets = [{ ...newSet(20, 10), done: true }]));
    expect(volume(w)).toBe(400);
    expect(setCount(w)).toBe(3);
  });
  it("copies the last actual results as planned, unchecked sets", () => {
    const d = emptyData();
    const w = createWorkout(d, d.templates[0]);
    w.finishedAt = new Date().toISOString();
    w.exercises[0].sets = [{ ...newSet(65, 9), done: true }];
    const e = makeExercise(d.exercises[0], [w]);
    expect(e.sets[0]).toMatchObject({ weight: 65, reps: 9, done: false });
    expect(e.sets[0].id).not.toBe(w.exercises[0].sets[0].id);
  });
  it("keeps exercise snapshots independent of the catalog", () => {
    const d = emptyData();
    const w = createWorkout(d, d.templates[0]);
    d.exercises[0].name = "Changed";
    expect(w.exercises[0].exercise.name).toBe("Жим штанги лёжа");
  });
  it("uses Monday and keeps historical weekly goals", () => {
    const d = emptyData();
    d.goals = [
      { id: "one", week: "2026-10-05", count: 2 },
      { id: "two", week: "2026-10-19", count: 3 },
    ];
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(goalAt(d, "2026-10-11")).toBe(2);
    expect(goalAt(d, "2026-10-20")).toBe(3);
    expect(weeks(d, "2026-11-02", 2).at(-1)?.current).toBe(true);
  });
  it("compares repetitions only at the selected weight", () => {
    expect(
      sameWeightReps(
        [
          { ...newSet(60, 10), done: true },
          { ...newSet(55, 12), done: true },
        ],
        60,
      ),
    ).toBe(10);
  });
  it("rejects corrupt imported data and invalid sets", () => {
    const d = emptyData();
    expect(isAppData(d)).toBe(true);
    expect(isAppData({ ...d, goals: [] })).toBe(false);
    const w = createWorkout(d, d.templates[0]);
    w.exercises[0].sets[0].reps = -1;
    d.workouts.push(w);
    expect(isAppData(d)).toBe(false);
  });
});
