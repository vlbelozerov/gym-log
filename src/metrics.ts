import { addDays, weekStart } from "./model";
import type {
  AppData,
  Workout,
  WorkoutExercise,
  SetEntry,
  LoadMode,
} from "./model";
export const workSets = (e: WorkoutExercise) =>
  e.sets.filter((s) => s.done && s.kind === "work");
export function setVolume(s: SetEntry, mode: LoadMode) {
  return mode === "assisted" || mode === "bodyweight"
    ? 0
    : s.weight * s.reps * (mode === "dumbbell" ? 2 : 1);
}
export const volume = (w: Workout) =>
  w.exercises.reduce(
    (sum, e) =>
      sum +
      workSets(e).reduce((v, s) => v + setVolume(s, e.exercise.loadMode), 0),
    0,
  );
export const setCount = (w: Workout) =>
  w.exercises.reduce((sum, e) => sum + workSets(e).length, 0);
export function goalAt(data: AppData, date: string) {
  const goals = data.goals
    .filter((g) => g.week <= weekStart(date))
    .sort((a, b) => b.week.localeCompare(a.week));
  return goals[0]?.count ?? 0;
}
export function weeks(data: AppData, today: string, count = 8) {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(current, -7 * (count - 1 - i));
    const end = addDays(start, 6);
    return {
      start,
      end,
      goal: goalAt(data, start),
      count: data.workouts.filter(
        (w) => w.finishedAt && w.date >= start && w.date <= end,
      ).length,
      current: start === current,
    };
  });
}
export function exerciseHistory(data: AppData, id: string) {
  return data.workouts
    .filter((w) => w.finishedAt)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt),
    )
    .flatMap((w) =>
      w.exercises
        .filter((e) => e.exercise.id === id && workSets(e).length)
        .map((e) => ({
          workoutId: w.id,
          date: w.date,
          sets: workSets(e),
          volume: workSets(e).reduce(
            (v, s) => v + setVolume(s, e.exercise.loadMode),
            0,
          ),
          name: e.exercise.name,
          mode: e.exercise.loadMode,
        })),
    );
}
export function sameWeightReps(sets: SetEntry[], weight: number) {
  return sets
    .filter((s) => s.weight === weight)
    .reduce((n, s) => n + s.reps, 0);
}
