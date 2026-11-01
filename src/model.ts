export type Muscle =
  "Грудь" | "Спина" | "Ноги" | "Плечи" | "Бицепс" | "Трицепс" | "Пресс";
export const muscles: Muscle[] = [
  "Грудь",
  "Спина",
  "Ноги",
  "Плечи",
  "Бицепс",
  "Трицепс",
  "Пресс",
];
export type LoadMode = "total" | "dumbbell" | "bodyweight" | "assisted";
export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: string;
  loadMode: LoadMode;
  note: string;
}
export interface SetEntry {
  id: string;
  weight: number;
  reps: number;
  kind: "work" | "warmup";
  done: boolean;
}
export interface WorkoutExercise {
  id: string;
  exercise: Exercise;
  sets: SetEntry[];
}
export interface Template {
  id: string;
  name: string;
  exerciseIds: string[];
  sets: number;
  rest: number;
}
export interface Workout {
  id: string;
  name: string;
  date: string;
  startedAt: string;
  finishedAt?: string;
  exercises: WorkoutExercise[];
  note: string;
}
export interface Goal {
  id: string;
  week: string;
  count: number;
}
export interface AppData {
  schema: 1;
  exercises: Exercise[];
  templates: Template[];
  workouts: Workout[];
  goals: Goal[];
  restSeconds: number;
}
export const uid = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekStart(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDate(d);
}
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export const loadLabels: Record<LoadMode, string> = {
  total: "Общий вес",
  dumbbell: "Вес одной гантели (пара)",
  bodyweight: "Свой вес + отягощение",
  assisted: "Противовес",
};
const seed: Exercise[] = [
  {
    id: "bench",
    name: "Жим штанги лёжа",
    muscle: "Грудь",
    equipment: "Штанга",
    loadMode: "total",
    note: "Вес вместе с грифом",
  },
  {
    id: "incline",
    name: "Жим гантелей на наклонной",
    muscle: "Грудь",
    equipment: "Гантели",
    loadMode: "dumbbell",
    note: "Вводи вес одной гантели; повторения пары",
  },
  {
    id: "pulldown",
    name: "Тяга верхнего блока",
    muscle: "Спина",
    equipment: "Тренажёр",
    loadMode: "total",
    note: "Для другого тренажёра создай отдельное упражнение",
  },
  {
    id: "row",
    name: "Горизонтальная тяга",
    muscle: "Спина",
    equipment: "Тренажёр",
    loadMode: "total",
    note: "",
  },
  {
    id: "squat",
    name: "Приседания со штангой",
    muscle: "Ноги",
    equipment: "Штанга",
    loadMode: "total",
    note: "Вес вместе с грифом",
  },
  {
    id: "legpress",
    name: "Жим ногами",
    muscle: "Ноги",
    equipment: "Тренажёр",
    loadMode: "total",
    note: "Используй одинаковый способ учёта платформы",
  },
  {
    id: "shoulder",
    name: "Жим гантелей сидя",
    muscle: "Плечи",
    equipment: "Гантели",
    loadMode: "dumbbell",
    note: "",
  },
  {
    id: "raise",
    name: "Махи гантелями в стороны",
    muscle: "Плечи",
    equipment: "Гантели",
    loadMode: "dumbbell",
    note: "",
  },
  {
    id: "curl",
    name: "Сгибания рук с гантелями",
    muscle: "Бицепс",
    equipment: "Гантели",
    loadMode: "dumbbell",
    note: "Повторения на каждую руку; для раздельного учёта создай варианты",
  },
  {
    id: "triceps",
    name: "Разгибания рук на блоке",
    muscle: "Трицепс",
    equipment: "Тренажёр",
    loadMode: "total",
    note: "",
  },
  {
    id: "pullup",
    name: "Подтягивания",
    muscle: "Спина",
    equipment: "Турник",
    loadMode: "bodyweight",
    note: "Вес — только дополнительное отягощение",
  },
  {
    id: "assisted",
    name: "Подтягивания в гравитроне",
    muscle: "Спина",
    equipment: "Гравитрон",
    loadMode: "assisted",
    note: "Вес — помощь тренажёра; меньше помощи = сложнее",
  },
];
export function emptyData(): AppData {
  return {
    schema: 1,
    exercises: structuredClone(seed),
    templates: [
      {
        id: "a",
        name: "Грудь и спина",
        exerciseIds: ["bench", "incline", "pulldown", "row", "curl", "triceps"],
        sets: 3,
        rest: 90,
      },
      {
        id: "b",
        name: "Ноги и плечи",
        exerciseIds: ["squat", "legpress", "shoulder", "raise"],
        sets: 3,
        rest: 120,
      },
    ],
    workouts: [],
    goals: [{ id: "initial", week: weekStart(localDate()), count: 2 }],
    restSeconds: 90,
  };
}
export function newSet(weight = 0, reps = 10): SetEntry {
  return { id: uid(), weight, reps, kind: "work", done: false };
}
export function makeExercise(
  exercise: Exercise,
  history: Workout[],
  setCount = 3,
): WorkoutExercise {
  const previous = history
    .filter((w) => w.finishedAt)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt),
    )
    .flatMap((w) => w.exercises)
    .find((e) => e.exercise.id === exercise.id);
  const sets = previous?.sets.filter((s) => s.done && s.kind === "work");
  return {
    id: uid(),
    exercise: structuredClone(exercise),
    sets: Array.from({ length: setCount }, (_, i) =>
      newSet(
        sets?.[i]?.weight ?? sets?.[0]?.weight ?? 0,
        sets?.[i]?.reps ?? 10,
      ),
    ),
  };
}
export function createWorkout(data: AppData, template?: Template): Workout {
  return {
    id: uid(),
    name: template?.name ?? "Свободная тренировка",
    date: localDate(),
    startedAt: new Date().toISOString(),
    note: "",
    exercises: (template?.exerciseIds ?? []).flatMap((id) => {
      const e = data.exercises.find((x) => x.id === id);
      return e ? [makeExercise(e, data.workouts, template?.sets)] : [];
    }),
  };
}
export function validSet(s: SetEntry) {
  return (
    Number.isFinite(s.weight) &&
    s.weight >= 0 &&
    Number.isInteger(s.reps) &&
    s.reps >= 1 &&
    s.reps <= 999 &&
    s.weight <= 9999
  );
}
export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const d = value as AppData;
  const exercise = (e: Exercise) =>
    e &&
    typeof e.id === "string" &&
    typeof e.name === "string" &&
    typeof e.equipment === "string" &&
    typeof e.note === "string" &&
    muscles.includes(e.muscle) &&
    Object.hasOwn(loadLabels, e.loadMode);
  return (
    d.schema === 1 &&
    Array.isArray(d.exercises) &&
    d.exercises.every(exercise) &&
    Array.isArray(d.templates) &&
    d.templates.every(
      (t) =>
        typeof t.id === "string" &&
        typeof t.name === "string" &&
        Array.isArray(t.exerciseIds) &&
        t.exerciseIds.every((x) => typeof x === "string") &&
        Number.isInteger(t.sets) &&
        t.sets > 0 &&
        t.sets <= 20 &&
        Number.isFinite(t.rest) &&
        t.rest >= 0,
    ) &&
    Array.isArray(d.goals) &&
    d.goals.length > 0 &&
    d.goals.every(
      (g) =>
        typeof g.id === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(g.week) &&
        Number.isInteger(g.count) &&
        g.count >= 1 &&
        g.count <= 7,
    ) &&
    Number.isFinite(d.restSeconds) &&
    d.restSeconds >= 0 &&
    Array.isArray(d.workouts) &&
    d.workouts.every(
      (w) =>
        typeof w.id === "string" &&
        typeof w.name === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(w.date) &&
        Number.isFinite(Date.parse(w.startedAt)) &&
        (!w.finishedAt || Number.isFinite(Date.parse(w.finishedAt))) &&
        typeof w.note === "string" &&
        Array.isArray(w.exercises) &&
        w.exercises.every(
          (e) =>
            typeof e.id === "string" &&
            exercise(e.exercise) &&
            Array.isArray(e.sets) &&
            e.sets.every(
              (s) =>
                typeof s.id === "string" &&
                typeof s.done === "boolean" &&
                ["work", "warmup"].includes(s.kind) &&
                validSet(s),
            ),
        ),
    )
  );
}
export function demoData(): AppData {
  const d = emptyData();
  const today = localDate();
  for (let i = 15; i >= 0; i--) {
    const t = d.templates[i % 2];
    const w = createWorkout(d, t);
    w.date = addDays(today, -i * 3 - 2);
    w.startedAt = w.date + "T15:00:00";
    w.finishedAt = w.date + "T16:08:00";
    w.exercises.forEach((e, j) =>
      e.sets.forEach((s, k) => {
        s.weight = Math.max(5, [60, 22, 50, 45, 12, 25][j] - (i > 6 ? 5 : 0));
        s.reps = 10 - (k === 2 ? 2 : 0);
        s.done = true;
      }),
    );
    d.workouts.push(w);
  }
  d.goals = [{ id: "initial", week: weekStart(addDays(today, -70)), count: 2 }];
  return d;
}
