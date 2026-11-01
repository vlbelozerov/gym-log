import { useEffect, useState } from "react";
import {
  Plus,
  Check,
  Trash2,
  ChevronUp,
  ChevronDown,
  Timer,
  ArrowLeft,
} from "lucide-react";
import type { AppData, Workout, SetEntry } from "./model";
import { makeExercise, newSet, validSet, loadLabels } from "./model";
import { setCount, volume, exerciseHistory } from "./metrics";
import { number, Modal } from "./ui";
export function WorkoutEditor({
  workout,
  data,
  update,
  close,
  remove,
}: {
  workout: Workout;
  data: AppData;
  update: (w: Workout) => void;
  close: () => void;
  remove: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [restUntil, setRestUntil] = useState(() =>
    Number(localStorage.getItem("gym-rest-" + workout.id) || 0),
  );
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((restUntil - now) / 1000));
  function startRest() {
    const until = Date.now() + data.restSeconds * 1000;
    setRestUntil(until);
    setNow(Date.now());
    localStorage.setItem("gym-rest-" + workout.id, String(until));
  }
  function setValue(exId: string, setId: string, patch: Partial<SetEntry>) {
    update({
      ...workout,
      exercises: workout.exercises.map((e) =>
        e.id === exId
          ? {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    });
  }
  function finish() {
    if (!setCount(workout)) {
      setError("Отметь хотя бы один выполненный рабочий подход.");
      return;
    }
    if (
      workout.exercises.some((e) => e.sets.some((s) => s.done && !validSet(s)))
    ) {
      setError("Проверь вес и повторения выполненных подходов.");
      return;
    }
    update({
      ...workout,
      finishedAt: workout.finishedAt ?? new Date().toISOString(),
    });
    close();
  }
  return (
    <div className="workout-editor">
      <button className="back-button" onClick={close}>
        <ArrowLeft size={18} />{" "}
        {workout.finishedAt ? "Вернуться в журнал" : "Свернуть тренировку"}
      </button>
      <div className="section-title">
        <div>
          <div className="eyebrow">
            {workout.finishedAt
              ? "РЕДАКТИРОВАНИЕ ЗАПИСИ"
              : "ТРЕНИРОВКА В ПРОЦЕССЕ"}
          </div>
          <h1>{workout.name}</h1>
        </div>
        <span className="pill">
          {setCount(workout)} подходов · {number(volume(workout))} кг*
        </span>
      </div>
      <div className="workout-meta">
        <label>
          Название
          <input
            value={workout.name}
            maxLength={100}
            onChange={(e) => update({ ...workout, name: e.target.value })}
          />
        </label>
        <label>
          Дата
          <input
            type="date"
            required
            value={workout.date}
            onChange={(e) => {
              if (e.target.value) update({ ...workout, date: e.target.value });
            }}
          />
        </label>
      </div>
      {!workout.exercises.length && (
        <div className="empty">
          <p>Добавь первое упражнение из своего каталога.</p>
        </div>
      )}
      {workout.exercises.map((ex, index) => {
        const past = exerciseHistory(
          {
            ...data,
            workouts: data.workouts.filter(
              (w) => w.id !== workout.id && w.date <= workout.date,
            ),
          },
          ex.exercise.id,
        ).at(-1);
        return (
          <section className="exercise-card" key={ex.id}>
            <div className="exercise-heading">
              <div className="exercise-number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="exercise-heading-name">
                <h2>{ex.exercise.name}</h2>
                <span>
                  {ex.exercise.muscle} · {ex.exercise.equipment}
                </span>
              </div>
              <div className="inline-actions">
                <button
                  className="icon-button"
                  disabled={index === 0}
                  aria-label="Переместить выше"
                  onClick={() => {
                    const list = [...workout.exercises];
                    [list[index - 1], list[index]] = [
                      list[index],
                      list[index - 1],
                    ];
                    update({ ...workout, exercises: list });
                  }}
                >
                  <ChevronUp size={17} />
                </button>
                <button
                  className="icon-button"
                  disabled={index === workout.exercises.length - 1}
                  aria-label="Переместить ниже"
                  onClick={() => {
                    const list = [...workout.exercises];
                    [list[index + 1], list[index]] = [
                      list[index],
                      list[index + 1],
                    ];
                    update({ ...workout, exercises: list });
                  }}
                >
                  <ChevronDown size={17} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Удалить упражнение"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Удалить упражнение вместе с его подходами?",
                      )
                    )
                      update({
                        ...workout,
                        exercises: workout.exercises.filter(
                          (e) => e.id !== ex.id,
                        ),
                      });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="previous">
              В прошлый раз:{" "}
              {past
                ? past.sets.map((s) => `${s.weight} × ${s.reps}`).join(" / ")
                : "первая запись — начнём историю"}
            </div>
            <small className="load-hint">
              {loadLabels[ex.exercise.loadMode]}
              {ex.exercise.note && " · " + ex.exercise.note}
            </small>
            <div className="sets-header">
              <span>Подход</span>
              <span>Кг</span>
              <span>Повторы</span>
              <span>Готово</span>
              <span />
            </div>
            {ex.sets.map((s, i) => (
              <div
                key={s.id}
                className={"set-row " + (s.done ? "is-done" : "")}
              >
                <label className="set-kind">
                  <span className="sr-only">Тип подхода {i + 1}</span>
                  <select
                    aria-label={"Тип подхода " + (i + 1)}
                    value={s.kind}
                    onChange={(e) =>
                      setValue(ex.id, s.id, {
                        kind: e.target.value as SetEntry["kind"],
                      })
                    }
                  >
                    <option value="work">{i + 1}</option>
                    <option value="warmup">Р</option>
                  </select>
                </label>
                <input
                  aria-label={"Вес, подход " + (i + 1)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999"
                  step="0.5"
                  value={s.weight}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0 && n <= 9999)
                      setValue(ex.id, s.id, { weight: n });
                  }}
                />
                <input
                  aria-label={"Повторы, подход " + (i + 1)}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="999"
                  step="1"
                  value={s.reps}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 999)
                      setValue(ex.id, s.id, { reps: n });
                  }}
                />
                <button
                  className="check-button"
                  aria-label={
                    (s.done ? "Отменить" : "Выполнить") + " подход " + (i + 1)
                  }
                  aria-pressed={s.done}
                  onClick={() => {
                    if (!s.done && !validSet(s)) {
                      setError(
                        "Вес не может быть отрицательным; повторения — целое число от 1.",
                      );
                      return;
                    }
                    setValue(ex.id, s.id, { done: !s.done });
                    if (!s.done && !workout.finishedAt) startRest();
                  }}
                >
                  <Check size={21} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={"Удалить подход " + (i + 1)}
                  onClick={() => {
                    if (
                      s.done &&
                      !window.confirm("Удалить выполненный подход?")
                    )
                      return;
                    update({
                      ...workout,
                      exercises: workout.exercises.map((e) =>
                        e.id === ex.id
                          ? { ...e, sets: e.sets.filter((x) => x.id !== s.id) }
                          : e,
                      ),
                    });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="add-set"
              onClick={() => {
                const prev = ex.sets.at(-1);
                update({
                  ...workout,
                  exercises: workout.exercises.map((e) =>
                    e.id === ex.id
                      ? {
                          ...e,
                          sets: [...e.sets, newSet(prev?.weight, prev?.reps)],
                        }
                      : e,
                  ),
                });
              }}
            >
              <Plus size={16} /> Добавить подход
            </button>
          </section>
        );
      })}
      <button className="secondary full" onClick={() => setPicker(true)}>
        <Plus size={18} /> Добавить упражнение
      </button>
      <label className="workout-note">
        Заметка к тренировке
        <textarea
          rows={2}
          maxLength={2000}
          placeholder="Самочувствие, техника, настройки тренажёра…"
          value={workout.note}
          onChange={(e) => update({ ...workout, note: e.target.value })}
        />
      </label>
      <p className="muted small">
        Р — разминка. *Тоннаж включает только рабочие подходы с внешним весом;
        упражнения со своим весом и противовесом исключены.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-footer">
        {!workout.finishedAt && (
          <div className="rest-timer">
            <Timer size={19} />
            <strong>
              {remaining
                ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                : "Отдых"}
            </strong>
            <button className="text-button" onClick={startRest}>
              Заново
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRestUntil(0);
                localStorage.removeItem("gym-rest-" + workout.id);
              }}
            >
              Сброс
            </button>
          </div>
        )}
        <button className="primary" onClick={finish}>
          {workout.finishedAt ? "Сохранить и закрыть" : "Завершить тренировку"}
          <Check size={18} />
        </button>
        <button
          className="text-button danger"
          onClick={() => setDeleteOpen(true)}
        >
          Удалить тренировку
        </button>
      </div>
      {picker && (
        <Modal title="Добавить упражнение" close={() => setPicker(false)}>
          <input
            autoFocus
            placeholder="Найти упражнение"
            aria-label="Поиск упражнения"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="picker-list">
            {data.exercises
              .filter((e) =>
                (e.name + " " + e.muscle)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    update({
                      ...workout,
                      exercises: [
                        ...workout.exercises,
                        makeExercise(
                          e,
                          data.workouts.filter((w) => w.id !== workout.id),
                        ),
                      ],
                    });
                    setPicker(false);
                  }}
                >
                  <span>
                    {e.name}
                    <small>
                      {e.muscle} · {e.equipment}
                    </small>
                  </span>
                  <Plus size={18} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {deleteOpen && (
        <Modal title="Удалить тренировку?" close={() => setDeleteOpen(false)}>
          <p>Запись и все её подходы будут удалены из журнала.</p>
          <button
            className="primary full destructive"
            onClick={() => {
              remove();
              close();
            }}
          >
            Удалить тренировку
          </button>
        </Modal>
      )}
    </div>
  );
}
