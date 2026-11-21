import { addDays, localDate, makeExercise, newSet, uid } from "./model";
import type { AppData, PlannedSession, PlannedBlock, Workout } from "./model";

const minutes = [
  [20,25,30],[22,25,35],[25,28,38],[20,25,30],
  [25,30,40],[28,30,45],[30,32,50],[22,25,35],
];
function strength(d: AppData, id: string, sets: number, reps: number, weight = 0, restSeconds = 120): PlannedBlock | null {
  const exercise = d.exercises.find((e) => e.id === id);
  return exercise ? { id: uid(), type: "strength", exercise: structuredClone(exercise), sets, reps, weight, restSeconds, note: "" } : null;
}
function run(minutes: number): PlannedBlock {
  return { id: uid(), type: "run", minutes, speedKmh: 6, note: "Легко, разговорный темп. Можно чередовать бег и ходьбу." };
}
export function eightWeekPlan(d: AppData, start = "2026-11-23"): PlannedSession[] {
  const sessions: PlannedSession[] = [];
  minutes.forEach(([monday,wednesday,saturday], week) => {
    const offset = week * 7;
    const light = week === 3 || week === 7;
    const blocksA = [
      strength(d, "pullup", light ? 3 : 5, 3, 0, 240),
      strength(d, "legpress", 2, 9),
      strength(d, "bench", light ? 2 : 3, 9),
      strength(d, "row", 2, 10),
      run(monday),
    ].filter((b): b is PlannedBlock => b !== null);
    const blocksB = [
      run(wednesday),
      strength(d, "assisted", light ? 2 : 3, light ? 6 : 8, 20, 180),
      strength(d, "shoulder", 2, 9),
      strength(d, "legpress", 2, 9),
    ].filter((b): b is PlannedBlock => b !== null);
    const entries: [number,string,PlannedBlock[]][] = [
      [0,"Сила A + лёгкий бег",blocksA],
      [2,"Лёгкий бег + сила B",blocksB],
      [5,"Длительный лёгкий бег",[run(saturday)]],
    ];
    entries.forEach(([day,name,blocks]) =>
      sessions.push({ id: uid(), date: addDays(start, offset+day), name: `Неделя ${week+1} · ${name}`, blocks, note: light ? "Облегчённая неделя: не наращивать нагрузку." : "Не тренироваться до отказа; корректировать по самочувствию." }));
  });
  return sessions;
}
export function createFromPlan(data: AppData, plan: PlannedSession): Workout {
  return {
    id: uid(), planId: plan.id, name: plan.name, date: plan.date,
    startedAt: new Date().toISOString(), note: plan.note,
    exercises: plan.blocks.filter((b) => b.type === "strength").map((b) => {
      const entry = makeExercise(b.exercise, data.workouts, b.sets);
      entry.sets = Array.from({ length: b.sets }, () => newSet(b.weight,b.reps));
      return entry;
    }),
    runs: plan.blocks.filter((b) => b.type === "run").map((b) => ({
      id: uid(), targetMinutes: b.minutes, speedKmh: b.speedKmh,
      actualMinutes: 0, distanceKm: 0, done: false, note: b.note,
    })),
  };
}
export function nextPlanned(data: AppData, today = localDate()) {
  return [...(data.plans ?? [])].filter((p) =>
    p.date >= today && !data.workouts.some((w) => w.planId === p.id)
  ).sort((a,b) => a.date.localeCompare(b.date))[0];
}
