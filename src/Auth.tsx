import { useState } from "react";
import { ArrowRight, Check, Cloud, WifiOff, TrendingUp } from "lucide-react";
import { supabase, configured } from "./supabase";
import { Logo } from "./ui";
export function Auth({ demo }: { demo: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        const r = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (r.error) throw r.error;
        setMessage(
          "Если аккаунт существует, письмо для сброса пароля отправлено.",
        );
      } else if (mode === "signup") {
        const r = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (r.error) throw r.error;
        if (!r.data.session)
          setMessage("Подтверди email по ссылке в письме, затем войди.");
      } else {
        const r = await supabase.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header>
        <Logo />
        <span className="label">ЛИЧНЫЙ ДНЕВНИК ТРЕНИРОВОК</span>
      </header>
      <main className="auth-grid">
        <section className="auth-intro">
          <span className="eyebrow">КАЖДЫЙ ПОДХОД ИМЕЕТ ЗНАЧЕНИЕ</span>
          <h1>
            Твой прогресс.
            <br />В твоём темпе<span>.</span>
          </h1>
          <p>
            Записывай тренировки. Замечай, как растут веса и повторения.
            Возвращайся за следующим маленьким рекордом.
          </p>
          <div className="auth-features">
            <span>
              <Cloud size={18} /> История в облаке
            </span>
            <span>
              <WifiOff size={18} /> Запись без интернета
            </span>
            <span>
              <TrendingUp size={18} /> Понятная динамика
            </span>
          </div>
          <div className="sample-lift">
            <div>
              <span>Жим штанги лёжа</span>
              <small>Пример прогресса за месяц</small>
            </div>
            <strong>
              55 <ArrowRight size={18} /> 60 <small>кг × 10</small>
            </strong>
            <span className="sample-check">
              <Check size={16} /> +5 кг к прошлому результату
            </span>
          </div>
        </section>
        <section className="auth-card">
          <span className="eyebrow">ПОЕХАЛИ?</span>
          <h2>
            {mode === "signup"
              ? "Создать аккаунт"
              : mode === "reset"
                ? "Восстановить доступ"
                : "С возвращением"}
          </h2>
          <p>
            {configured
              ? "Войди, чтобы сохранить историю и открыть её на любом устройстве."
              : "Облачное хранение ещё не подключено. Пока можно посмотреть приложение на примерах."}
          </p>
          {configured ? (
            <>
              <div className="segmented">
                <button
                  className={mode === "login" ? "selected" : ""}
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                >
                  Вход
                </button>
                <button
                  className={mode === "signup" ? "selected" : ""}
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setMessage("");
                  }}
                >
                  Регистрация
                </button>
              </div>
              <form onSubmit={submit}>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {mode !== "reset" && (
                  <label>
                    Пароль
                    <input
                      required
                      type="password"
                      minLength={8}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <small>Не менее 8 символов</small>
                  </label>
                )}
                <button disabled={busy} className="primary full">
                  {busy
                    ? "Подождите…"
                    : mode === "signup"
                      ? "Создать аккаунт"
                      : mode === "reset"
                        ? "Отправить письмо"
                        : "Войти"}
                  <ArrowRight size={17} />
                </button>
              </form>
              <button
                className="text-button"
                onClick={() => {
                  setMode("reset");
                  setMessage("");
                  setError("");
                }}
              >
                Не помню пароль
              </button>
            </>
          ) : (
            <div className="notice">
              Для владельца: подключи Supabase по инструкции в README. Личные
              записи станут доступны после настройки.
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <div className="divider">
            <span>или познакомься с приложением</span>
          </div>
          <button className="secondary full" onClick={demo}>
            Открыть демоверсию <ArrowRight size={17} />
          </button>
          <small className="auth-footnote">
            В демоверсии только примеры. Изменения не попадут в личный аккаунт.
          </small>
        </section>
      </main>
      <footer>Подход за подходом — к своему результату.</footer>
    </div>
  );
}
