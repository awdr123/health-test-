"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Leaf, LockKeyhole, ShieldCheck, Sparkles, X } from "lucide-react";
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
  { key: "gender", title: "How do you describe yourself?", hint: "A few quick answers help us personalize your starting point with greater care.", type: "choice", options: [["female", "Female"], ["male", "Male"], ["nonbinary", "Non-binary"]] },
  { key: "goal", title: "What would you like to achieve?", hint: "Choose your focus and we will shape every next step around it.", type: "choice", options: [["lose", "Lose weight"], ["maintain", "Maintain weight"], ["gain", "Gain weight"]] },
  { key: "activity", title: "How active is a typical week?", hint: "Think about movement across work, errands, exercise, and the rest of daily life.", type: "choice", options: [["low", "Mostly seated"], ["light", "Lightly active"], ["moderate", "Active 3–4 days"], ["high", "Very active"]] },
  { key: "age", title: "How old are you?", hint: "This takes only a moment and makes your daily energy estimate more useful.", type: "number", unit: "years", min: 16, max: 100 },
  { key: "heightCm", title: "What is your height?", hint: "A close estimate works well, and you can always update it later.", type: "number", unit: "cm", min: 120, max: 230 },
  { key: "weightKg", title: "What is your current weight?", hint: "Your answer stays private and helps us calibrate your personal starting point.", type: "number", unit: "kg", min: 35, max: 300 },
  { key: "targetWeightKg", title: "What is your target weight?", hint: "Choose a realistic first milestone that feels both achievable and motivating.", type: "number", unit: "kg", min: 30, max: 250 }
] as const;

type PlanId = "month" | "quarter" | "year";

const plans: Array<{ id: PlanId; name: string; price: number; originalPrice: number; daily: string; popular?: boolean }> = [
  { id: "month", name: "1 Month", price: 29, originalPrice: 59, daily: "¥0.96/day" },
  { id: "quarter", name: "3 Months", price: 69, originalPrice: 149, daily: "¥0.76/day", popular: true },
  { id: "year", name: "12 Months", price: 199, originalPrice: 499, daily: "¥0.55/day" }
];

const previewProjection = [
  { week: 1, weight: 72.4 },
  { week: 2, weight: 71.8 },
  { week: 3, weight: 71.1 },
  { week: 4, weight: 70.5 }
];

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
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("quarter");
  const [paymentState, setPaymentState] = useState<"idle" | "paying" | "ready">("idle");

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

  async function unlock(plan: PlanId) {
    setPaymentState("paying");
    setError("");
    try {
      const response = await fetch("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, sessionId: `${plan}_${crypto.randomUUID()}` }) });
      if (!response.ok) throw new Error("pay");
      setShowPaywall(false);
      setPaymentState("ready");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await loadResult();
    } catch {
      setError("Payment simulation failed. Please try again.");
    } finally {
      setPaymentState("idle");
    }
  }

  function startOver() {
    localStorage.removeItem("wellpath-user-id");
    window.location.replace("/");
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
            <div className="progress-meta"><strong>Step {step + 1} / {steps.length}</strong><span>{Math.round(((step + 1) / steps.length) * 100)}% complete</span></div>
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
      ) : result ? <ResultView result={result} error={error} onUnlock={() => setShowPaywall(true)} onStartOver={startOver} /> : null}
      {showPaywall && (
        <PaymentModal
          selectedPlan={selectedPlan}
          paying={paymentState === "paying"}
          onSelect={setSelectedPlan}
          onClose={() => setShowPaywall(false)}
          onConfirm={() => unlock(selectedPlan)}
        />
      )}
      {paymentState === "ready" && (
        <div className="plan-ready" role="status" aria-live="polite">
          <CheckCircle2 size={48} aria-hidden="true" />
          <h2>Your plan is ready</h2>
          <p>Opening your complete personalized plan now.</p>
        </div>
      )}
    </main>
  );
}

function ResultView({ result, error, onUnlock, onStartOver }: { result: Result; error: string; onUnlock: () => void; onStartOver: () => void }) {
  return (
    <section className="result-shell">
      <div className="result-heading"><p className="eyebrow">Your starting point</p><h1>Your personal health snapshot</h1><p>Built from your answers and designed to give you a calm, practical next step.</p></div>
      <div className="trust-strip"><ShieldCheck size={17} aria-hidden="true" /><span>Reviewed by fitness coaches · Based on Mifflin-St Jeor equation · For educational purposes, not medical advice</span></div>
      <div className="result-grid">
        <div className="result-summary">
          <article className="bmi-card"><span>BMI estimate</span><strong>{result.bmi}</strong><p>{result.bmiLabel}</p><small>BMI is a screening measure, not a diagnosis.</small></article>
          <section className="profile-card" aria-label="Your health profile">
            <h2>Your profile</h2>
            <dl>
              <div><dt>Body type</dt><dd>{result.bodyType ?? "Not available"}</dd></div>
              <div><dt>Lifestyle</dt><dd>{result.lifestyle ?? "Not available"}</dd></div>
              <div><dt>Activity level</dt><dd>{result.activityLevel ?? "Not available"}</dd></div>
              <div><dt>Metabolism</dt><dd>{result.metabolism ?? "Not available"}</dd></div>
            </dl>
          </section>
        </div>
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
              <div className="locked-preview"><div><span>Daily energy guide</span><strong>Unlock to see your daily target</strong></div><div><span>12-week milestone</span><strong>Your personalized date</strong></div></div>
              <div className="blurred-preview">
                <div className="blurred-preview-content" aria-hidden="true">
                  <ProjectionChart points={previewProjection} />
                  <ul><li><Check size={17} />A personalized nutrition action</li><li><Check size={17} />A weekly movement target</li><li><Check size={17} />A practical recovery habit</li></ul>
                </div>
                <div className="preview-overlay"><LockKeyhole size={22} /><strong>Your projection and weekly plan are ready</strong></div>
              </div>
              <p className="unlock-copy">See your calorie target, projected progress, and the actions designed around your answers.</p>
              <button className="primary wide unlock-button" onClick={onUnlock}><LockKeyhole size={17} />Unlock your 12-week personalized plan</button>
              <small className="demo-note">Secure simulated checkout · choose the plan that suits you</small>
            </>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </article>
      </div>
      <p className="medical-note">For general wellbeing only. Talk with a qualified clinician before making major changes to your diet or activity.</p>
      <div className="start-over"><button type="button" onClick={onStartOver}>Start over</button></div>
    </section>
  );
}

function PaymentModal({ selectedPlan, paying, onSelect, onClose, onConfirm }: { selectedPlan: PlanId; paying: boolean; onSelect: (plan: PlanId) => void; onClose: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !paying) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose, paying]);

  const chosen = plans.find((plan) => plan.id === selectedPlan) ?? plans[1];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !paying && onClose()}>
      <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <button className="modal-close" onClick={onClose} disabled={paying} aria-label="Close payment options"><X size={21} /></button>
        <div className="modal-heading"><p className="eyebrow">Choose your access</p><h2 id="payment-title">Start your personalized plan</h2><p>Pick the pace that fits your goals. Your full plan unlocks immediately.</p></div>
        <div className="pricing-grid" role="radiogroup" aria-label="Membership duration">
          {plans.map((plan) => (
            <button key={plan.id} type="button" role="radio" aria-checked={selectedPlan === plan.id} className={selectedPlan === plan.id ? "price-option selected" : "price-option"} onClick={() => onSelect(plan.id)}>
              {plan.popular && <span className="popular-label">MOST POPULAR</span>}
              <span className="plan-duration">{plan.name}</span>
              <span className="price-line"><s>¥{plan.originalPrice}</s><strong>¥{plan.price}</strong></span>
              <span className="daily-price">{plan.daily}</span>
              <span className="radio-mark" aria-hidden="true">{selectedPlan === plan.id && <Check size={15} />}</span>
            </button>
          ))}
        </div>
        <ul className="benefits">
          <li><Check size={17} />Personalized daily calorie target</li>
          <li><Check size={17} />4-week weight projection</li>
          <li><Check size={17} />Weekly plan updates</li>
          <li><Check size={17} />Cancel anytime</li>
        </ul>
        <button className="primary wide modal-cta" onClick={onConfirm} disabled={paying}>{paying ? "Preparing your plan…" : `Unlock ${chosen.name} for ¥${chosen.price}`}</button>
        <p className="payment-terms">Prices in CNY. Auto-renews, cancel anytime. Not a medical service.</p>
      </section>
    </div>
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
