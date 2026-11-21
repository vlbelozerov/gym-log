import { addDays, localDate, makeExercise, newSet, uid } from "./model";
import type { AppData, PlannedSession, PlannedBlock, Workout, RunSegment } from "./model";

const minutes = [
  [25,25,30],[25,30,35],[30,30,40],[20,25,30],
  [30,30,40],[30,35,45],[30,35,50],[20,30,35],
];
function strength(d: AppData, id: string, sets: number, reps: number, weight = 0, restSeconds = 120): PlannedBlock | null {
  const exercise = d.exercises.find((e) => e.id === id);
  return exercise ? { id: uid(), type: "strength", exercise: structuredClone(exercise), sets, reps, weight, restSeconds, note: "" } : null;
}
const intervals = ["3 мин бег / 2 мин ходьба", "4 / 2 мин", "5 / 2 мин", "3 / 2 мин",
  "6 / 2 мин", "8 / 2 мин", "10 / 2 мин", "Легко по самочувствию"];
const runMinutes=[3,4,5,3,6,8,10,3];
function run(minutes: number, week: number): PlannedBlock {
  const makeSegment=(kind:RunSegment["kind"],amount:number,speedKmh:number):RunSegment =>
    ({id:uid(),kind,basis:"time",amount,speedKmh,repeats:1});
  return { id: uid(), type: "run",mode:"run_walk", minutes, speedKmh: 6,
    cycles: Math.max(1,Math.floor(minutes/(runMinutes[week]+2))),
    segments:[makeSegment("run",runMinutes[week],6),makeSegment("walk",2,5)],
    note: `Бег/ходьба: ${intervals[week]}. Подстрой последнюю пару отрезков под общую длительность ${minutes} мин. Темп разговорный, отдельно разминка и заминка по 5 мин.` };
}
export function eightWeekPlan(d: AppData, start = "2026-11-23"): PlannedSession[] {
  const sessions: PlannedSession[] = [];
  minutes.forEach(([monday,wednesday,saturday], week) => {
    const offset = week * 7;
    const light = week === 3 || week === 7;
    const blocksA = [
      strength(d, "pullup", light ? 3 : 5, 3, 0, 240),
      strength(d, "legpress", 2, 9),
      strength(d, "rdl", 2, 9),
      strength(d, "dbbench", light ? 2 : 3, 9),
      strength(d, "row", 2, 10),
      strength(d, "plank", 2, 30),
      run(monday,week),
    ].filter((b): b is PlannedBlock => b !== null);
    const blocksB = [
      run(wednesday,week),
      strength(d, "assisted", light ? 2 : 3, light ? 6 : 8, 20, 180),
      strength(d, "split", 2, 8),
      strength(d, "shoulder", 2, 9),
      strength(d, "legcurl", 2, 11),
      strength(d, "calves", 2, 14),
      strength(d, "pallof", 2, 10),
    ].filter((b): b is PlannedBlock => b !== null);
    const entries: [number,string,PlannedBlock[]][] = [
      [0,"Сила A + лёгкий бег",blocksA],
      [2,"Лёгкий бег + сила B",blocksB],
      [5,"Длительный лёгкий бег",[run(saturday,week)]],
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
      id: uid(), targetMinutes: b.minutes, speedKmh: b.speedKmh, mode:b.mode, cycles:b.cycles,
      segments:b.segments ? structuredClone(b.segments) : undefined,
      actualMinutes: 0, distanceKm: 0, done: false, note: b.note,
    })),
  };
}
export function nextPlanned(data: AppData, today = localDate()) {
  return [...(data.plans ?? [])].filter((p) =>
    p.date >= today && !data.workouts.some((w) => w.planId === p.id)
  ).sort((a,b) => a.date.localeCompare(b.date))[0];
}
