"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Leaf, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Answers = {
  gender?: "female" | "male" | "nonbinary";
  goal?: "lose" | "maintain" | "gain";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activity?: "low" | "light" | "moderate" | "high";
};

type Result = {
  isMember: boolean;
  bmi: number;
  bmiLabel: string;
  goal: string;
  dailyCalories: number | null;
  targetDate: string | null;
  weeklyProjection: Array<{ week: number; weight: number }> | null;
  bodyType: string | null;
  lifestyle: string | null;
  activityLevel: string | null;
  metabolism: string | null;
  plan: string[] | null;
};

const steps = [
  { key: "gender", title: "How do you describe yourself?", hint: "This helps us estimate your baseline energy needs.", type: "choice", options: [["female", "Female"], ["male", "Male"], ["nonbinary", "Non-binary"]] },
  { key: "goal", title: "What would you like to achieve?", hint: "Choose the goal that feels most useful right now.", type: "choice", options: [["lose", "Lose weight"], ["maintain", "Maintain weight"], ["gain", "Gain weight"]] },
  { key: "age", title: "How old are you?", hint: "We support adults from 16 to 100 years old.", type: "number", unit: "years", min: 16, max: 100 },
  { key: "heightCm", title: "What is your height?", hint: "A close estimate is fine. You can update it later.", type: "number", unit: "cm", min: 120, max: 230 },
  { key: "weightKg", title: "What is your current weight?", hint: "Your answers stay private and are used only for this plan.", type: "number", unit: "kg", min: 35, max: 300 },
  { key: "targetWeightKg", title: "What is your target weight?", hint: "Choose a realistic first milestone within 50 kg of your current weight.", type: "number", unit: "kg", min: 30, max: 250 },
  { key: "activity", title: "How active is a typical week?", hint: "Think about deliberate movement as well as day-to-day activity.", type: "choice", options: [["low", "Mostly seated"], ["light", "Lightly active"], ["moderate", "Active 3–4 days"], ["high", "Very active"]] }
] as const;

function getUserId() {
  const key = "wellpath-user-id";
  const current = localStorage.getItem(key);
  if (current) return current;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export default function Home() {
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [view, setView] = useState<"quiz" | "result">("quiz");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
    fetch(`/api/progress?userId=${id}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ record }) => {
        if (!record) return;
        setAnswers({ gender: record.gender, goal: record.goal, age: record.age, heightCm: record.heightCm, weightKg: record.weightKg, targetWeightKg: record.targetWeightKg, activity: record.activity });
        if (record.completed) return loadResult(id);
        setStep(Math.min(record.step, steps.length - 1));
      })
      .catch(() => setError("We couldn't restore your progress. You can still start again."))
      .finally(() => setLoading(false));
  }, []);

  async function loadResult(id = userId) {
    const response = await fetch(`/api/result?userId=${id}`);
    if (!response.ok) throw new Error("Result unavailable");
    setResult(await response.json());
    setView("result");
  }

  const current = steps[step];
  const value = answers[current?.key as keyof Answers];
  const valid = useMemo(() => {
    if (!current) return false;
    if (current.type === "choice") return Boolean(value);
    return typeof value === "number" && value >= current.min && value <= current.max;
  }, [current, value]);

  async function next() {
    if (!valid || !userId) return;
    setError("");
    setLoading(true);
    try {
      if (step < steps.length - 1) {
        const nextStep = step + 1;
        await persist(nextStep);
        setStep(nextStep);
      } else {
        const response = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, step: steps.length - 1, ...answers }) });
        if (!response.ok) throw new Error("submit");
        await loadResult();
      }
    } catch {
      setError("We couldn't save that answer. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function persist(nextStep: number) {
    const response = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, step: nextStep, ...answers }) });
    if (!response.ok) throw new Error("save");
  }

  function update(value: string | number) {
    setAnswers((old) => ({ ...old, [current.key]: value }));
    setError("");
  }

  async function unlock() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, sessionId: `demo_${crypto.randomUUID()}` }) });
      if (!response.ok) throw new Error("pay");
      await loadResult();
    } catch {
      setError("Payment simulation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !userId) return <main className="loading-page"><Leaf aria-hidden="true" /><span>Preparing your assessment…</span></main>;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#" aria-label="WellPath home"><span><Leaf size={20} /></span>WellPath</a>
        <div className="privacy"><ShieldCheck size={16} /> Private & secure</div>
      </header>
      {view === "quiz" ? (
        <section className="quiz-shell">
          <div className="quiz-visual" aria-hidden="true">
            <Image src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1400&q=85" alt="" fill priority sizes="(max-width: 800px) 100vw, 44vw" />
            <div className="visual-caption"><Sparkles size={18} /><span>Small, sustainable choices<br /><strong>made for your life.</strong></span></div>
          </div>
          <div className="quiz-panel">
            <div className="progress-meta"><span>Personal assessment</span><strong>{step + 1} of {steps.length}</strong></div>
            <div className="progress-track"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
            <div className="question" key={current.key}>
              <p className="eyebrow">A little about you</p>
              <h1>{current.title}</h1>
              <p className="hint">{current.hint}</p>
              {current.type === "choice" ? (
                <div className="options">{current.options.map(([option, label]) => (
                  <button key={option} className={value === option ? "option selected" : "option"} onClick={() => update(option)} aria-pressed={value === option}>
                    <span>{label}</span>{value === option && <Check size={18} />}
                  </button>
                ))}</div>
              ) : (
                <label className="number-field">
                  <span className="sr-only">{current.title}</span>
                  <input type="number" min={current.min} max={current.max} value={typeof value === "number" ? value : ""} onChange={(event) => update(event.target.value === "" ? NaN : Number(event.target.value))} autoFocus />
                  <span>{current.unit}</span>
                </label>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              <div className="actions">
                <button className="back" onClick={() => setStep((old) => Math.max(0, old - 1))} disabled={step === 0 || loading} aria-label="Previous question"><ArrowLeft size={20} /></button>
                <button className="primary" onClick={next} disabled={!valid || loading}>{step === steps.length - 1 ? "See my results" : "Continue"}<ArrowRight size={19} /></button>
              </div>
            </div>
          </div>
        </section>
      ) : result ? <ResultView result={result} loading={loading} error={error} onUnlock={unlock} /> : null}
    </main>
  );
}

function ResultView({ result, loading, error, onUnlock }: { result: Result; loading: boolean; error: string; onUnlock: () => void }) {
  return (
    <section className="result-shell">
      <div className="result-heading"><p className="eyebrow">Your starting point</p><h1>Your personal health snapshot</h1><p>Built from your answers and designed to give you a calm, practical next step.</p></div>
      <div className="result-grid">
        <article className="bmi-card"><span>BMI estimate</span><strong>{result.bmi}</strong><p>{result.bmiLabel}</p><small>BMI is a screening measure, not a diagnosis.</small></article>
        <article className="plan-card">
          <div className="plan-title"><div><span>{result.isMember ? "Your plan" : "Complete your plan"}</span><h2>{result.isMember ? "A clear path forward" : "Unlock your tailored targets"}</h2></div>{!result.isMember && <LockKeyhole />}</div>
          {result.isMember ? (
            <>
              <div className="metrics"><div><span>Daily energy guide</span><strong>{result.dailyCalories?.toLocaleString()} kcal</strong></div><div><span>12-week milestone</span><strong>{result.targetDate ? new Date(result.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</strong></div></div>
              {result.weeklyProjection && <ProjectionChart points={result.weeklyProjection} />}
              <ul>{result.plan?.map((item) => <li key={item}><Check size={17} />{item}</li>)}</ul>
            </>
          ) : (
            <>
              <div className="locked-preview"><div><span>Daily energy guide</span><strong>•••• kcal</strong></div><div><span>Target milestone</span><strong>•• ••• 2026</strong></div></div>
              <p className="unlock-copy">See your calorie guide, target date and a focused three-part action plan.</p>
              <button className="primary wide" onClick={onUnlock} disabled={loading}><LockKeyhole size={17} />Unlock plan — $9.00</button>
              <small className="demo-note">Secure demo checkout · one-time payment simulation</small>
            </>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </article>
      </div>
      <p className="medical-note">For general wellbeing only. Talk with a qualified clinician before making major changes to your diet or activity.</p>
    </section>
  );
}

function ProjectionChart({ points }: { points: Array<{ week: number; weight: number }> }) {
  const weights = points.map((point) => point.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(max - min, 0.1);

  return (
    <section className="projection" aria-label="Four week weight projection">
      <div className="projection-heading"><span>4-week projection</span><strong>At a steady 0.75 kg per week</strong></div>
      <div className="projection-bars">
        {points.map((point) => (
          <div className="projection-column" key={point.week}>
            <span className="projection-value">{point.weight} kg</span>
            <div className="projection-track"><span style={{ height: `${45 + ((point.weight - min) / range) * 55}%` }} /></div>
            <small>Week {point.week}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
