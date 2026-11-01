import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  Settings,
  Plus,
  Play,
  ArrowRight,
  Pencil,
  Trash2,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Download,
  X,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Auth } from "./Auth";
import { supabase } from "./supabase";
import { JournalSync } from "./sync";
import type { Snapshot, SyncView } from "./sync";
import {
  createWorkout,
  emptyData,
  demoData,
  uid,
  localDate,
  weekStart,
  isAppData,
  addDays,
} from "./model";
import type { AppData, Template, Workout } from "./model";
import { goalAt, setCount, volume, weeks } from "./metrics";
import {
  Logo,
  Modal,
  Empty,
  Stat,
  SectionTitle,
  number,
  dateLabel,
  download,
} from "./ui";
import { WorkoutEditor } from "./WorkoutEditor";
import { ExerciseLibrary, TemplateEditor } from "./Library";
import { Progress } from "./Progress";
const initial: SyncView = { data: emptyData(), status: "loading", message: "" };
const tabs = [
  { id: "today", label: "Сегодня", Icon: Activity },
  { id: "history", label: "Журнал", Icon: CalendarDays },
  { id: "progress", label: "Прогресс", Icon: ChartNoAxesCombined },
  { id: "exercises", label: "Упражнения", Icon: Dumbbell },
] as const;
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let live = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setUser(data.session?.user ?? null);
        setAuthLoading(false);
        if (error) console.error("Session could not be restored");
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (live) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      }
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  if (authLoading)
    return (
      <div className="loading-screen">
        <Logo />
        <p>Открываем дневник…</p>
      </div>
    );
  if (!user && !demo) return <Auth demo={() => setDemo(true)} />;
  return (
    <Journal
      key={demo ? "demo" : user!.id}
      user={user}
      demo={demo}
      exitDemo={() => setDemo(false)}
      recovery={recovery}
      clearRecovery={() => setRecovery(false)}
    />
  );
}
function Journal({
  user,
  demo,
  exitDemo,
  recovery,
  clearRecovery,
}: {
  user: User | null;
  demo: boolean;
  exitDemo: () => void;
  recovery: boolean;
  clearRecovery: () => void;
}) {
  const [view, setView] = useState<SyncView>(() =>
    demo ? { data: demoData(), status: "saved", message: "" } : initial,
  );
  const sync = useRef<JournalSync | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("today");
  const [editing, setEditing] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [settings, setSettings] = useState(false);
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [newGoal, setNewGoal] = useState(2);
  const [ioError, setIoError] = useState("");
  const [updateReady, setUpdateReady] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration)
        setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  useEffect(() => {
    setUpdateReady(needRefresh);
  }, [needRefresh]);
  useEffect(() => {
    if (demo || !user || !supabase) return;
    const client = supabase;
    const controller = new JournalSync(
      "gym-log:" + user.id,
      {
        read: async () => {
          const { data, error } = await client
            .from("journals")
            .select("data,revision,last_mutation_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          if (!isAppData(data.data))
            throw new Error(
              "Облачный журнал имеет неподдерживаемый формат. Данные не перезаписаны.",
            );
          return {
            data: data.data,
            revision: data.revision,
            mutationId: data.last_mutation_id,
          } as Snapshot;
        },
        write: async (data, revision, mutationId) => {
          const result = await client.rpc("save_journal", {
            p_data: data,
            p_expected_revision: revision,
            p_mutation_id: mutationId,
          });
          if (result.error) throw result.error;
          if (!result.data) return null;
          if (!isAppData(result.data.data))
            throw new Error("Неверный ответ сервера");
          return result.data as Snapshot;
        },
      },
      setView,
    );
    let released = false;
    let releaseLock: () => void = () => {};
    const lockAbort = new AbortController();
    const begin = async () => {
      if (released) return;
      sync.current = controller;
      await controller.start();
    };
    if (navigator.locks) {
      void navigator.locks
        .request(
          "gym-log:" + user.id,
          { signal: lockAbort.signal },
          async () => {
            if (released) return;
            await begin();
            await new Promise<void>((resolve) => {
              releaseLock = resolve;
              if (released) resolve();
            });
          },
        )
        .catch(() => {});
      setView((v) => ({
        ...v,
        status: "loading",
        message:
          "Открываем журнал. Если он уже открыт в другой вкладке, закрой её.",
      }));
    } else void begin();
    const retry = () => {
      if (sync.current === controller) void controller.flush();
    };
    const timer = setInterval(retry, 30000);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (controller.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      released = true;
      releaseLock();
      lockAbort.abort();
      controller.stop();
      clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      window.removeEventListener("beforeunload", beforeUnload);
      sync.current = null;
    };
  }, [demo, user]);
  const data = view.data;
  const active = data.workouts.find((w) => !w.finishedAt);
  const editWorkout = data.workouts.find((w) => w.id === editing);
  const finished = data.workouts
    .filter((w) => w.finishedAt)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt),
    );
  const week = weeks(data, localDate(), 1)[0];
  const completedWeek = data.workouts.filter(
    (w) => w.finishedAt && w.date >= week.start && w.date <= week.end,
  );
  const busy = view.status === "loading";
  function change(fn: (d: AppData) => AppData) {
    if (demo) setView((v) => ({ ...v, data: fn(structuredClone(v.data)) }));
    else sync.current?.change(fn);
  }
  function start(t?: Template) {
    if (active) {
      setEditing(active.id);
      return;
    }
    const w = createWorkout(data, t);
    change((d) => ({
      ...d,
      restSeconds: t?.rest ?? d.restSeconds,
      workouts: [...d.workouts, w],
    }));
    setEditing(w.id);
  }
  function updateWorkout(w: Workout) {
    change((d) => ({
      ...d,
      workouts: d.workouts.map((x) => (x.id === w.id ? w : x)),
    }));
  }
  async function logout() {
    if (sync.current?.dirty) {
      setIoError(
        "Дождись сохранения в облаке перед выходом. Если связь не восстанавливается, скачай копию данных.",
      );
      return;
    }
    if (demo) exitDemo();
    else {
      const r = await supabase!.auth.signOut();
      if (r.error) setIoError(r.error.message);
    }
  }
  const statusText: Record<SyncView["status"], string> = {
    loading: "Загружаем историю…",
    saved: "Сохранено в облаке",
    pending: "Сохраняем изменения…",
    offline: "Офлайн · есть локальная копия",
    error: "Нет подтверждения из облака",
    conflict: "Изменения на двух устройствах",
  };
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Файл слишком большой");
      const parsed: unknown = JSON.parse(await file.text());
      if (!isAppData(parsed))
        throw new Error("Файл не соответствует формату дневника");
      if (
        !window.confirm(
          "Заменить текущий журнал содержимым файла? Перед этим рекомендуется экспортировать текущую версию.",
        )
      )
        return;
      change(() => parsed);
      setIoError("");
    } catch (e) {
      setIoError(e instanceof Error ? e.message : "Не удалось прочитать файл");
    }
  }
  function exportCsv() {
    const cell = (s: unknown) => '"' + String(s).replaceAll('"', '""') + '"';
    const rows = [
      [
        "Дата",
        "Тренировка",
        "Упражнение",
        "Группа",
        "Учёт веса",
        "Подход",
        "Тип",
        "Вес",
        "Повторы",
        "Выполнен",
      ],
      ...finished.flatMap((w) =>
        w.exercises.flatMap((e) =>
          e.sets.map((s, i) => [
            w.date,
            w.name,
            e.exercise.name,
            e.exercise.muscle,
            e.exercise.loadMode,
            i + 1,
            s.kind,
            s.weight,
            s.reps,
            s.done ? "да" : "нет",
          ]),
        ),
      ),
    ];
    download(
      "gym-log.csv",
      "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <span className="sidebar-caption">ТВОЯ СИЛА В ЦИФРАХ</span>
        <nav aria-label="Основная навигация">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={tab === id && !editing ? "active" : ""}
              onClick={() => {
                setTab(id);
                setEditing(null);
              }}
            >
              <Icon size={20} />
              {label}
              {id === "today" && active && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={20} />
            <p>
              Маленькие шаги.
              <br />
              Заметный прогресс.
            </p>
          </div>
          <button
            onClick={() => {
              setNewGoal(goalAt(data, localDate()));
              setSettings(true);
            }}
          >
            <Settings size={19} /> Настройки
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-title">Личный дневник тренировок</span>
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="topbar-right">
            <button
              className={
                "sync-status " +
                (["error", "conflict", "offline"].includes(view.status)
                  ? "warning"
                  : "")
              }
              onClick={() => void sync.current?.flush()}
              title={view.message || statusText[view.status]}
              aria-label="Повторить синхронизацию"
            >
              {demo ? (
                <Dumbbell size={16} />
              ) : view.status === "saved" ? (
                <Cloud size={17} />
              ) : view.status === "offline" ? (
                <CloudOff size={17} />
              ) : (
                <RefreshCw size={16} />
              )}
              <span>{demo ? "Демоверсия" : statusText[view.status]}</span>
            </button>
            <button
              className="avatar"
              aria-label="Открыть настройки"
              onClick={() => {
                setNewGoal(goalAt(data, localDate()));
                setSettings(true);
              }}
            >
              {demo ? "Д" : user?.email?.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>Демонстрация · примеры данных, изменения не сохраняются</span>
            <button onClick={exitDemo}>
              Выйти <X size={14} />
            </button>
          </div>
        )}
        {!demo && (view.status === "error" || view.status === "offline") && (
          <div className="sync-banner" role="status">
            <span>
              {view.message ||
                "Записи остаются на устройстве до восстановления связи. Не очищай данные браузера."}
            </span>
            <button onClick={() => void sync.current?.flush()}>
              Повторить
            </button>
          </div>
        )}
        {updateReady && (
          <div className="sync-banner">
            <span>Доступна новая версия приложения.</span>
            <button
              disabled={!demo && view.status !== "saved"}
              onClick={() => void updateServiceWorker(true)}
            >
              Обновить
            </button>
          </div>
        )}
        <main className="main-content">
          {busy ? (
            <div className="empty">
              <RefreshCw />
              <p>{view.message || "Загружаем твой журнал…"}</p>
            </div>
          ) : editWorkout ? (
            <WorkoutEditor
              key={editWorkout.id}
              workout={editWorkout}
              data={data}
              update={updateWorkout}
              close={() => setEditing(null)}
              remove={() =>
                change((d) => ({
                  ...d,
                  workouts: d.workouts.filter((w) => w.id !== editWorkout.id),
                }))
              }
            />
          ) : tab === "today" ? (
            <>
              <SectionTitle
                eyebrow={new Intl.DateTimeFormat("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
                  .format(new Date())
                  .toUpperCase()}
                title="Время для себя"
              >
                <span className="quiet-tag">
                  <span /> Твой темп. Твои результаты.
                </span>
              </SectionTitle>
              <div className="hero">
                <div>
                  <span className="hero-eyebrow">
                    {active ? "ПРОДОЛЖИМ?" : "СЛЕДУЮЩИЙ ШАГ — ТВОЙ"}
                  </span>
                  <h2>
                    {active ? active.name : "Сильнее с каждым\nподходом."}
                  </h2>
                  <p>
                    {active
                      ? "Тренировка уже начата. Все внесённые подходы на месте."
                      : "Не обязательно ставить рекорд сегодня.\nДостаточно прийти и сделать свой подход."}
                  </p>
                  <button
                    className="lime"
                    onClick={() =>
                      active ? setEditing(active.id) : start(data.templates[0])
                    }
                  >
                    <Play size={17} fill="currentColor" />
                    {active ? "Продолжить тренировку" : "Начать тренировку"}
                    <ArrowRight size={18} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <Dumbbell />
                  <span className="hero-stamp">
                    ЕЩЁ ОДИН
                    <br />
                    ПОДХОД
                  </span>
                </div>
              </div>
              <div className="stats-grid">
                <Stat
                  label="На этой неделе"
                  value={
                    <>
                      {week.count}
                      <em> / {week.goal}</em>
                    </>
                  }
                  detail={
                    week.count >= week.goal
                      ? "План выполнен. Отличный ритм."
                      : "Тренировок из недельной цели"
                  }
                />
                <Stat
                  label="Рабочих подходов"
                  value={completedWeek.reduce((n, w) => n + setCount(w), 0)}
                  detail="За текущую неделю"
                />
                <Stat
                  label="Всего тренировок"
                  value={finished.length}
                  detail={
                    finished.length
                      ? "История, которую ты создаёшь"
                      : "Первая запись — впереди"
                  }
                />
              </div>
              <div className="panel-heading section-space">
                <h2>Твои тренировки</h2>
                <button
                  className="text-button"
                  onClick={() =>
                    setTemplate({
                      id: uid(),
                      name: "",
                      exerciseIds: [],
                      sets: 3,
                      rest: 90,
                    })
                  }
                >
                  <Plus size={16} /> Новый шаблон
                </button>
              </div>
              <div className="templates-grid">
                {data.templates.map((t, i) => (
                  <section className="template-card" key={t.id}>
                    <div className="template-top">
                      <span className="template-letter">
                        {String.fromCharCode(65 + (i % 26))}
                      </span>
                      <div className="inline-actions">
                        <button
                          className="icon-button"
                          aria-label={"Изменить " + t.name}
                          onClick={() => setTemplate(t)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Удалить шаблон " + t.name}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Удалить шаблон? Выполненные тренировки сохранятся.",
                              )
                            )
                              change((d) => ({
                                ...d,
                                templates: d.templates.filter(
                                  (x) => x.id !== t.id,
                                ),
                              }));
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <h3>{t.name}</h3>
                    <p>
                      {t.exerciseIds.length} упражнений · по {t.sets} подхода
                    </p>
                    <div className="template-exercises">
                      {t.exerciseIds.slice(0, 3).map((id) => (
                        <span key={id}>
                          {data.exercises.find((e) => e.id === id)?.name}
                        </span>
                      ))}
                      {t.exerciseIds.length > 3 && (
                        <small>и ещё {t.exerciseIds.length - 3}</small>
                      )}
                    </div>
                    <button className="secondary full" onClick={() => start(t)}>
                      Начать <ArrowRight size={17} />
                    </button>
                  </section>
                ))}
                <button className="free-template" onClick={() => start()}>
                  <Plus size={24} />
                  <strong>Свободная тренировка</strong>
                  <span>Собери занятие по ходу дела</span>
                </button>
              </div>
              <div className="panel-heading section-space">
                <h2>Последние занятия</h2>
                <button
                  className="text-button"
                  onClick={() => setTab("history")}
                >
                  Весь журнал <ArrowRight size={16} />
                </button>
              </div>
              {finished.length ? (
                <div className="session-list">
                  {finished.slice(0, 3).map((w) => (
                    <SessionRow
                      key={w.id}
                      workout={w}
                      open={() => setEditing(w.id)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="Начнём твою историю"
                  text="Выбери готовый шаблон или собери свою первую тренировку."
                />
              )}
            </>
          ) : tab === "history" ? (
            <>
              <SectionTitle
                eyebrow="ВСЁ, ЧТО ТЫ СДЕЛАЛ"
                title="Журнал тренировок"
              />
              <div className="search-row">
                <input
                  aria-label="Поиск тренировок"
                  placeholder="Поиск по названию"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <label>
                  Месяц
                  <input
                    aria-label="Месяц тренировок"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
                {month && (
                  <button className="text-button" onClick={() => setMonth("")}>
                    Все даты
                  </button>
                )}
              </div>
              <div className="calendar-strip">
                {Array.from({ length: 14 }, (_, i) =>
                  addDays(localDate(), i - 13),
                ).map((date) => (
                  <div
                    key={date}
                    className={
                      finished.some((w) => w.date === date) ? "trained" : ""
                    }
                  >
                    <small>
                      {new Intl.DateTimeFormat("ru-RU", {
                        weekday: "short",
                      }).format(new Date(date + "T12:00:00"))}
                    </small>
                    <b>{new Date(date + "T12:00:00").getDate()}</b>
                    <span />
                  </div>
                ))}
              </div>
              {active && (
                <button
                  className="active-session"
                  onClick={() => setEditing(active.id)}
                >
                  <Play size={18} /> Незавершённая: {active.name}
                  <ArrowRight size={18} />
                </button>
              )}
              <div className="session-list">
                {finished
                  .filter(
                    (w) =>
                      (!month || w.date.startsWith(month)) &&
                      w.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((w) => (
                    <SessionRow
                      key={w.id}
                      workout={w}
                      open={() => setEditing(w.id)}
                    />
                  ))}
              </div>
              {!finished.length && (
                <Empty
                  title="Пока нет завершённых тренировок"
                  text="Здесь будут даты, упражнения и результаты каждого занятия."
                />
              )}
            </>
          ) : tab === "progress" ? (
            <Progress data={data} />
          ) : (
            <ExerciseLibrary data={data} change={change} />
          )}
          <footer className="app-footer">
            Подход за подходом.
            <span>
              {demo ? "Пример личного дневника" : "Твой личный дневник"}
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Мобильная навигация">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={tab === id && !editing ? "active" : ""}
            onClick={() => {
              setTab(id);
              setEditing(null);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {template && (
        <TemplateEditor
          template={template}
          data={data}
          close={() => setTemplate(null)}
          save={(t) =>
            change((d) => ({
              ...d,
              templates: d.templates.some((x) => x.id === t.id)
                ? d.templates.map((x) => (x.id === t.id ? t : x))
                : [...d.templates, t],
            }))
          }
        />
      )}
      {settings && (
        <Modal
          title="Настройки"
          close={() => {
            setSettings(false);
            setIoError("");
          }}
        >
          <p className="muted">
            {demo ? "Демонстрационный аккаунт" : user?.email}
          </p>
          <label>
            Цель: тренировок в неделю
            <input
              type="number"
              min="1"
              max="7"
              value={newGoal}
              onChange={(e) => setNewGoal(Number(e.target.value))}
            />
          </label>
          <button
            className="secondary full"
            disabled={newGoal < 1 || newGoal > 7 || !Number.isInteger(newGoal)}
            onClick={() => {
              const week = weekStart(localDate());
              change((d) => ({
                ...d,
                goals: [
                  ...d.goals.filter((g) => g.week !== week),
                  { id: uid(), week, count: newGoal },
                ],
              }));
              setSettings(false);
            }}
          >
            Применить с текущей недели
          </button>
          <label>
            Отдых по умолчанию, секунд
            <input
              type="number"
              min="0"
              max="900"
              step="15"
              value={data.restSeconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0 && n <= 900)
                  change((d) => ({ ...d, restSeconds: n }));
              }}
            />
          </label>
          <hr />
          <h3>Твои данные</h3>
          <p className="small muted">
            {demo
              ? "Демоданные изолированы от личного аккаунта."
              : "Записи автоматически сохраняются в Supabase. Очистка браузера не удаляет отправленные в облако данные. Неотправленные офлайн-записи зависят от памяти устройства."}
          </p>
          <div className="settings-actions">
            <button
              className="secondary"
              onClick={() =>
                download(
                  "gym-log-" + localDate() + ".json",
                  JSON.stringify(data, null, 2),
                )
              }
            >
              <Download size={16} /> JSON
            </button>
            <button className="secondary" onClick={exportCsv}>
              <Download size={16} /> CSV
            </button>
          </div>
          <label className="import-label">
            Восстановить журнал из JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => void restore(e.target.files?.[0])}
            />
          </label>
          <p className="small muted">
            На iPhone: Safari → Поделиться → На экран «Домой». Для
            офлайн-доступа сначала открой приложение с интернетом. Таймер
            пересчитывается после возврата; фоновый сигнал не гарантируется.
          </p>
          {ioError && (
            <p role="alert" className="error">
              {ioError}
            </p>
          )}
          <button className="secondary full" onClick={() => void logout()}>
            <LogOut size={17} />
            {demo ? "Выйти из демоверсии" : "Выйти из аккаунта"}
          </button>
        </Modal>
      )}
      {view.status === "conflict" && view.remote && (
        <Modal title="Есть две версии журнала" close={() => {}}>
          <p>
            На другом устройстве появились изменения. Чтобы не потерять записи,
            сначала скачай обе версии, затем выбери, какую продолжить
            использовать. Автоматического объединения в этой версии нет.
          </p>
          <button
            className="secondary full"
            onClick={() =>
              download("gym-log-local.json", JSON.stringify(data, null, 2))
            }
          >
            Скачать версию этого устройства
          </button>
          <button
            className="secondary full"
            onClick={() =>
              download(
                "gym-log-cloud.json",
                JSON.stringify(view.remote!.data, null, 2),
              )
            }
          >
            Скачать облачную версию
          </button>
          <hr />
          <button
            className="primary full"
            onClick={() => {
              if (
                window.confirm(
                  "Заменить локальный журнал облачной версией? Неотправленные локальные изменения будут отброшены.",
                )
              )
                void sync.current?.resolve("remote");
            }}
          >
            Использовать облачную версию
          </button>
          <button
            className="secondary full"
            onClick={() => {
              if (
                window.confirm(
                  "Заменить облачный журнал версией этого устройства? Изменения другого устройства будут перезаписаны.",
                )
              )
                void sync.current?.resolve("local");
            }}
          >
            Использовать версию этого устройства
          </button>
        </Modal>
      )}
      {recovery && (
        <Modal title="Новый пароль" close={clearRecovery}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await supabase!.auth.updateUser({ password });
              if (r.error) setAuthMessage(r.error.message);
              else {
                setPassword("");
                setAuthMessage("");
                clearRecovery();
              }
            }}
          >
            <label>
              Новый пароль
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {authMessage && (
              <p role="alert" className="error">
                {authMessage}
              </p>
            )}
            <button className="primary full">Сохранить пароль</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function SessionRow({
  workout: w,
  open,
}: {
  workout: Workout;
  open: () => void;
}) {
  const minutes = w.finishedAt
    ? Math.max(
        0,
        Math.round(
          (Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000,
        ),
      )
    : 0;
  return (
    <button className="session-row" onClick={open}>
      <span className="session-icon">
        <Dumbbell size={22} />
      </span>
      <span className="session-info">
        <strong>{w.name}</strong>
        <small>
          {dateLabel(w.date)} · {w.exercises.length} упр. · {setCount(w)}{" "}
          подходов{minutes > 0 ? " · " + minutes + " мин" : ""}
        </small>
      </span>
      <span className="session-volume">
        {number(volume(w))}
        <small>кг внешнего веса</small>
      </span>
      <ChevronRight size={19} />
    </button>
  );
}
