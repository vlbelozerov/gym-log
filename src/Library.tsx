import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { AppData, Exercise, LoadMode, Template } from "./model";
import { muscles, uid, loadLabels } from "./model";
import { Modal, SectionTitle } from "./ui";
export function ExerciseLibrary({
  data,
  change,
}: {
  data: AppData;
  change: (f: (d: AppData) => AppData) => void;
}) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("Все");
  const [editing, setEditing] = useState<Exercise | null>(null);
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    change((d) => ({
      ...d,
      exercises: d.exercises.some((e) => e.id === editing.id)
        ? d.exercises.map((e) =>
            e.id === editing.id ? { ...editing, name: editing.name.trim() } : e,
          )
        : [...d.exercises, { ...editing, name: editing.name.trim() }],
    }));
    setEditing(null);
  }
  return (
    <>
      <SectionTitle eyebrow="ТВОЯ БИБЛИОТЕКА" title="Упражнения">
        <button
          className="primary"
          onClick={() =>
            setEditing({
              id: uid(),
              name: "",
              muscle: "Грудь",
              equipment: "",
              loadMode: "total",
              note: "",
            })
          }
        >
          <Plus size={18} /> Добавить
        </button>
      </SectionTitle>
      <div className="search-row">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Поиск упражнений"
            placeholder="Название упражнения"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Группа мышц"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option>Все</option>
          {muscles.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="library-grid">
        {data.exercises
          .filter(
            (e) =>
              (muscle === "Все" || e.muscle === muscle) &&
              e.name.toLowerCase().includes(search.toLowerCase()),
          )
          .map((e) => (
            <div className="library-card" key={e.id}>
              <span className="pill">{e.muscle}</span>
              <h2>{e.name}</h2>
              <p>{e.equipment || "Без оборудования"}</p>
              <small>{loadLabels[e.loadMode]}</small>
              <div className="library-actions">
                <button className="text-button" onClick={() => setEditing(e)}>
                  <Pencil size={15} /> Изменить
                </button>
                <button
                  className="icon-button danger"
                  aria-label={"Удалить " + e.name}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Удалить из каталога? Прошлые тренировки сохранятся.",
                      )
                    )
                      change((d) => ({
                        ...d,
                        exercises: d.exercises.filter((x) => x.id !== e.id),
                        templates: d.templates.map((t) => ({
                          ...t,
                          exerciseIds: t.exerciseIds.filter(
                            (id) => id !== e.id,
                          ),
                        })),
                      }));
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </div>
      {editing && (
        <Modal
          title={
            data.exercises.some((e) => e.id === editing.id)
              ? "Изменить упражнение"
              : "Новое упражнение"
          }
          close={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <label>
              Название
              <input
                required
                autoFocus
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <div className="form-columns">
              <label>
                Группа мышц
                <select
                  value={editing.muscle}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      muscle: e.target.value as Exercise["muscle"],
                    })
                  }
                >
                  {muscles.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Оборудование
                <input
                  maxLength={100}
                  value={editing.equipment}
                  onChange={(e) =>
                    setEditing({ ...editing, equipment: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Как учитывать вес
              <select
                value={editing.loadMode}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    loadMode: e.target.value as LoadMode,
                  })
                }
              >
                {Object.entries(loadLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <p className="small muted">
              Для другого тренажёра, способа учёта веса или отдельной стороны
              создай отдельное упражнение. Так история останется сопоставимой.
            </p>
            <label>
              Заметка
              <textarea
                maxLength={1000}
                value={editing.note}
                onChange={(e) =>
                  setEditing({ ...editing, note: e.target.value })
                }
              />
            </label>
            <button className="primary full">Сохранить упражнение</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function TemplateEditor({
  template,
  data,
  save,
  close,
}: {
  template: Template;
  data: AppData;
  save: (t: Template) => void;
  close: () => void;
}) {
  const [value, setValue] = useState(template);
  return (
    <Modal title="Шаблон тренировки" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.name.trim() && value.exerciseIds.length) {
            save({ ...value, name: value.name.trim() });
            close();
          }
        }}
      >
        <label>
          Название
          <input
            autoFocus
            required
            maxLength={100}
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
        </label>
        <div className="form-columns">
          <label>
            Подходов по умолчанию
            <input
              required
              type="number"
              min="1"
              max="20"
              value={value.sets}
              onChange={(e) =>
                setValue({ ...value, sets: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Отдых, сек
            <input
              required
              type="number"
              min="0"
              max="900"
              step="15"
              value={value.rest}
              onChange={(e) =>
                setValue({ ...value, rest: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <p className="small muted">
          Выбери упражнения в нужном порядке. Порядок можно менять во время
          занятия.
        </p>
        <div className="template-checks">
          {data.exercises.map((ex) => (
            <label key={ex.id}>
              <input
                type="checkbox"
                checked={value.exerciseIds.includes(ex.id)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    exerciseIds: e.target.checked
                      ? [...value.exerciseIds, ex.id]
                      : value.exerciseIds.filter((id) => id !== ex.id),
                  })
                }
              />
              <span>
                {ex.name}
                <small>{ex.muscle}</small>
              </span>
              {value.exerciseIds.includes(ex.id) && (
                <b>{value.exerciseIds.indexOf(ex.id) + 1}</b>
              )}
            </label>
          ))}
        </div>
        <button disabled={!value.exerciseIds.length} className="primary full">
          Сохранить шаблон
        </button>
      </form>
    </Modal>
  );
}
