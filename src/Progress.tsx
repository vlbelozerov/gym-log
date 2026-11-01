import { useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { AppData } from "./model";
import { addDays, localDate, muscles } from "./model";
import { exerciseHistory, weeks, workSets, sameWeightReps } from "./metrics";
import { SectionTitle, Stat, Empty, number, dateLabel } from "./ui";
export function Progress({ data }: { data: AppData }) {
  const [exerciseId, setExerciseId] = useState(data.exercises[0]?.id ?? "");
  const [metric, setMetric] = useState<"weight" | "reps" | "volume">("weight");
  const [filter, setFilter] = useState(10);
  const history = exerciseHistory(data, exerciseId);
  const mode =
    history.at(-1)?.mode ??
    data.exercises.find((e) => e.id === exerciseId)?.loadMode;
  const noVolume = mode === "bodyweight" || mode === "assisted";
  const trend = history.map((h) => {
    const matching = h.sets.filter((s) => s.reps === filter);
    return {
      date: h.date,
      label: dateLabel(h.date),
      value:
        metric === "volume"
          ? h.volume
          : metric === "reps"
            ? sameWeightReps(h.sets, filter)
            : matching.length
              ? mode === "assisted"
                ? Math.min(...matching.map((s) => s.weight))
                : Math.max(...matching.map((s) => s.weight))
              : null,
    };
  });
  const weekly = weeks(data, localDate(), 8);
  const weekMax = Math.max(
    4,
    ...weekly.map((w) => w.count),
    ...weekly.map((w) => w.goal),
  );
  const completed = weekly.filter((w) => !w.current && w.goal > 0);
  const totalGoal = completed.reduce((n, w) => n + w.goal, 0);
  const totalDone = completed.reduce(
    (n, w) => n + Math.min(w.count, w.goal),
    0,
  );
  const since = addDays(localDate(), -27);
  return (
    <>
      <SectionTitle eyebrow="ЗАМЕЧАЙ ИЗМЕНЕНИЯ" title="Твой прогресс" />
      <div className="stats-grid">
        <Stat
          label="Выполнение плана"
          value={`${totalGoal ? Math.round((totalDone / totalGoal) * 100) : 0}%`}
          detail="Завершённые недели с заданной целью"
        />
        <Stat
          label="Недели с выполненной целью"
          value={`${completed.filter((w) => w.count >= w.goal).length} / ${completed.length}`}
          detail="Текущая неделя не учитывается"
        />
        <Stat
          label="Тренировок за 28 дней"
          value={
            data.workouts.filter(
              (w) => w.finishedAt && w.date >= since && w.date <= localDate(),
            ).length
          }
          detail="Только завершённые занятия"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Ритм тренировок</h2>
          <span className="muted small">8 недель</span>
        </div>
        <div className="weekly-chart" aria-label="Занятия по неделям">
          {weekly.map((w) => (
            <div key={w.start} className="week-column">
              <strong>
                {w.count}
                <small>/{w.goal}</small>
              </strong>
              <div className="week-track">
                <span
                  style={{
                    height: Math.min((w.count / weekMax) * 100, 100) + "%",
                  }}
                />
              </div>
              <small>{dateLabel(w.start)}</small>
              {w.current && <span className="current-week">Сейчас</span>}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Динамика упражнения</h2>
        </div>
        <label>
          Упражнение
          <select
            value={exerciseId}
            onChange={(e) => {
              setExerciseId(e.target.value);
              setMetric("weight");
              setFilter(10);
            }}
          >
            {data.exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="chart-controls">
          <div className="segmented">
            <button
              className={metric === "weight" ? "selected" : ""}
              onClick={() => {
                setMetric("weight");
                setFilter(10);
              }}
            >
              Вес
            </button>
            <button
              className={metric === "reps" ? "selected" : ""}
              onClick={() => {
                setMetric("reps");
                setFilter(history.at(-1)?.sets[0]?.weight ?? 0);
              }}
            >
              Повторы
            </button>
            <button
              disabled={noVolume}
              className={metric === "volume" ? "selected" : ""}
              onClick={() => setMetric("volume")}
            >
              Объём
            </button>
          </div>
          {metric !== "volume" && (
            <label>
              {metric === "weight" ? "При повторах" : "При весе, кг"}
              <input
                type="number"
                min={metric === "weight" ? 1 : 0}
                step={metric === "weight" ? 1 : 0.5}
                value={filter}
                onChange={(e) => setFilter(Number(e.target.value))}
              />
            </label>
          )}
        </div>
        <p className="small muted">
          {metric === "weight"
            ? mode === "assisted"
              ? "Противовес: меньше помощи при тех же повторах — прогресс."
              : mode === "bodyweight"
                ? "Показан дополнительный вес."
                : "Лучший вес подхода при выбранном числе повторений."
            : metric === "reps"
              ? "Сумма повторений во всех рабочих подходах с выбранным весом."
              : "Рабочий тоннаж этого упражнения, кг."}
        </p>
        {history.length ? (
          <div
            className="chart-box"
            role="img"
            aria-label="График прогресса упражнения; точные значения доступны в таблице ниже"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 12, right: 20, left: 0, bottom: 4 }}
              >
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  minTickGap={24}
                />
                <YAxis
                  width={50}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                  }}
                  formatter={(v) => [v, metric === "reps" ? "Повторы" : "Кг"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--green)"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            title="Здесь появится твой прогресс"
            text="Заверши тренировку с этим упражнением — начнём строить историю."
          />
        )}
        <div className="table-wrap">
          <table>
            <caption className="sr-only">История упражнения</caption>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Рабочие подходы</th>
                <th>{noVolume ? "Повторы" : "Объём"}</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h, i) => (
                <tr key={h.workoutId + "-" + i}>
                  <td>{dateLabel(h.date)}</td>
                  <td>
                    {h.sets
                      .map((s) => `${number(s.weight)} × ${s.reps}`)
                      .join(" / ")}
                  </td>
                  <td>
                    {noVolume
                      ? h.sets.reduce((n, s) => n + s.reps, 0)
                      : number(h.volume) + " кг"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Рабочие подходы по мышцам</h2>
        <p className="muted small">
          Последние 28 дней · учитывается основная группа упражнения
        </p>
        <div className="muscle-list">
          {muscles.map((m) => {
            const count = data.workouts
              .filter(
                (w) => w.finishedAt && w.date >= since && w.date <= localDate(),
              )
              .reduce(
                (n, w) =>
                  n +
                  w.exercises
                    .filter((e) => e.exercise.muscle === m)
                    .reduce((x, e) => x + workSets(e).length, 0),
                0,
              );
            return (
              <div key={m}>
                <span>{m}</span>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
