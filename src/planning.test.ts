import { describe, expect, it } from "vitest";
import { emptyData, isAppData } from "./model";
import { createFromPlan, eightWeekPlan, nextPlanned } from "./planning";
describe("training planner", () => {
  it("creates 24 sessions across 8 weeks with lighter fourth and eighth weeks", () => {
    const d = emptyData();
    const p = eightWeekPlan(d);
    expect(p).toHaveLength(24);
    expect(p[0].date).toBe("2026-11-23");
    expect(p[23].date).toBe("2027-01-16");
    expect(p[2].blocks).toMatchObject([{type:"run",minutes:30,speedKmh:6}]);
    expect(p[20].blocks).toMatchObject([{type:"run",minutes:50,speedKmh:6}]);
    expect(p[9].note).toContain("Облегчённая");
    d.plans=p;
    expect(isAppData(d)).toBe(true);
  });
  it("copies a planned session into a separate editable workout", () => {
    const d=emptyData(), p=eightWeekPlan(d)[0];
    const w=createFromPlan(d,p);
    expect(w.planId).toBe(p.id);
    expect(w.exercises.find(x=>x.exercise.id==="pullup")?.sets).toHaveLength(5);
    expect(w.exercises.find(x=>x.exercise.id==="pullup")?.sets[0].reps).toBe(3);
    expect(w.runs?.[0].targetMinutes).toBe(20);
    expect(w.runs?.[0].done).toBe(false);
    d.workouts=[w];
    d.plans=[p];
    expect(isAppData(d)).toBe(true);
    w.exercises[0].sets[0].reps=100;
    expect((p.blocks.find(b=>b.type==="strength" && b.exercise.id==="pullup") as {reps:number}).reps).toBe(3);
  });
  it("accepts legacy documents without plans or cardio", () => {
    const d=emptyData();
    delete d.plans;
    expect(isAppData(d)).toBe(true);
  });
  it("rejects malformed planned run and cardio measurements", () => {
    const d=emptyData();
    d.plans=eightWeekPlan(d);
    (d.plans[0].blocks.find(b=>b.type==="run") as {minutes:number}).minutes=-1;
    expect(isAppData(d)).toBe(false);
    d.plans=eightWeekPlan(d);
    const w=createFromPlan(d,d.plans[0]);
    w.runs![0].distanceKm=-2;
    d.workouts=[w];
    expect(isAppData(d)).toBe(false);
  });
  it("finds the next scheduled session not yet started", () => {
    const d=emptyData();
    d.plans=eightWeekPlan(d);
    const p=nextPlanned(d,"2026-11-23");
    expect(p?.date).toBe("2026-11-23");
    d.workouts=[createFromPlan(d,p!)];
    expect(nextPlanned(d,"2026-11-23")?.date).toBe("2026-11-25");
  });
});
