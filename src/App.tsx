import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AnswerMap,
  CoreId,
  ExamResult,
  ExamSession,
  Question,
  createExamSession,
  scoreExam,
  EXAM_DURATION_SECONDS,
  EXAM_QUESTION_COUNT,
} from "./examEngine";
import { readJson, writeJson } from "./storage";
import { recordAttempt } from "./analytics";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";

type Screen = "setup" | "exam" | "review" | "results" | "analytics";
const SESSION_KEY = "comptia_a_session_v2";

type Persisted = {
  screen: Screen;
  core?: CoreId;
  session?: ExamSession;
  remainingSeconds?: number;
  answers?: AnswerMap;
  flagged?: Record<string, boolean>;
  pbqState?: Record<string, any>;
  result?: ExamResult | null;
  pbqCount?: number;
  showObjectiveHints?: boolean;
};

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [core, setCore] = useState<CoreId>("220-1201");
  const [pbqCount, setPbqCount] = useState(5);
  const [showObjectiveHints, setShowObjectiveHints] = useState(false);

  const [session, setSession] = useState<ExamSession | null>(null);
  const [idx, setIdx] = useState(0);

  const [remainingSeconds, setRemainingSeconds] = useState(EXAM_DURATION_SECONDS);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [pbqState, setPbqState] = useState<Record<string, any>>({});
  const [result, setResult] = useState<ExamResult | null>(null);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const p = readJson<Persisted | null>(SESSION_KEY, null);
    if (!p) return;

    if (p.core) setCore(p.core);
    if (typeof p.pbqCount === "number") setPbqCount(p.pbqCount);
    if (typeof p.showObjectiveHints === "boolean") setShowObjectiveHints(p.showObjectiveHints);

    if (p.session) setSession(p.session);

    setScreen(p.screen ?? "setup");
    setRemainingSeconds(p.remainingSeconds ?? EXAM_DURATION_SECONDS);
    setAnswers(p.answers ?? {});
    setFlagged(p.flagged ?? {});
    setPbqState(p.pbqState ?? {});
    setResult(p.result ?? null);
  }, []);

  useEffect(() => {
    const payload: Persisted = {
      screen,
      core,
      session: session ?? undefined,
      remainingSeconds,
      answers,
      flagged,
      pbqState,
      result,
      pbqCount,
      showObjectiveHints,
    };
    writeJson(SESSION_KEY, payload);
  }, [screen, core, session, remainingSeconds, answers, flagged, pbqState, result, pbqCount, showObjectiveHints]);

  useEffect(() => {
    if (screen !== "exam" || !session) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (timerRef.current) return;

    timerRef.current = window.setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(timerRef.current!);
          timerRef.current = null;
          finalizeSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, session]);

  const questions = session?.questions ?? [];
  const current = questions[idx];

  const unansweredCount = useMemo(() => {
    if (!session) return 0;
    let n = 0;
    for (const q of session.questions) {
      const isPBQ = q.type.startsWith("pbq");
      if (isPBQ) {
        const st = pbqState[q.id];
        if (!st) n++;
        else {
          if (q.type === "pbq-order" && (!st.order || st.order.length !== q.correct.length)) n++;
          if (q.type === "pbq-match" && (!st.pairs || st.pairs.length !== q.correct.length)) n++;
        }
      } else {
        const a = answers[q.id] ?? [];
        if (a.length === 0) n++;
      }
    }
    return n;
  }, [session, answers, pbqState]);

  function startNewSession(selectedCore: CoreId) {
    const s = createExamSession(selectedCore, { pbqCount, showObjectiveHints });
    setSession(s);
    setIdx(0);
    setAnswers({});
    setFlagged({});
    setPbqState({});
    setResult(null);
    setRemainingSeconds(EXAM_DURATION_SECONDS);
    setScreen("exam");
  }

  function resetAll() {
    localStorage.removeItem(SESSION_KEY);
    setScreen("setup");
    setSession(null);
    setIdx(0);
    setAnswers({});
    setFlagged({});
    setPbqState({});
    setResult(null);
    setRemainingSeconds(EXAM_DURATION_SECONDS);
  }

  function toggleFlag(qid: string) {
    setFlagged((f) => ({ ...f, [qid]: !f[qid] }));
  }

  function goTo(i: number) {
    setIdx(Math.max(0, Math.min(i, (session?.questions.length ?? 1) - 1)));
  }

  function setSingleAnswer(q: Question, optionId: string) {
    setAnswers((a) => ({ ...a, [q.id]: [optionId] }));
  }

  function toggleMultiAnswer(q: Question, optionId: string) {
    setAnswers((a) => {
      const cur = new Set(a[q.id] ?? []);
      if (cur.has(optionId)) cur.delete(optionId);
      else cur.add(optionId);
      return { ...a, [q.id]: Array.from(cur) };
    });
  }

  function openReview() {
    setScreen("review");
  }

  function finalizeSubmit(isTimeout: boolean) {
    if (!session) return;
    const r = scoreExam(session, answers, pbqState);
    setResult(r);
    setScreen("results");
    recordAttempt(session, r);

    if (!isTimeout) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="title">CompTIA A+ Practice Exam Simulator</div>
          <div className="subtitle">
            Core 1 (220-1201) / Core 2 (220-1202) • {EXAM_QUESTION_COUNT} questions • {EXAM_DURATION_SECONDS / 60} minutes
          </div>
        </div>

        {screen === "exam" && session && (
          <div className="status">
            <div className="pill"><span className="muted">Core</span> {session.core}</div>
            <div className={"pill " + (remainingSeconds <= 10 * 60 ? "danger" : "")}>
              <span className="muted">Time</span> {formatTime(remainingSeconds)}
            </div>
            <div className="pill"><span className="muted">Unanswered</span> {unansweredCount}</div>
            <button className="btn ghost" onClick={openReview}>Submit</button>
          </div>
        )}

        {screen !== "exam" && (
          <div className="status">
            <button className="btn ghost" onClick={() => setScreen("analytics")}>Analytics</button>
            <button className="btn ghost" onClick={resetAll}>Reset</button>
          </div>
        )}
      </header>

      {screen === "setup" && (
        <div className="card">
          <h2>Start a practice session</h2>
          <p className="muted">
            Exam mode: no explanations during the session; you will get a review screen before final submission.
          </p>

          <div className="row">
            <label className="radio">
              <input type="radio" checked={core === "220-1201"} onChange={() => setCore("220-1201")} />
              <span>
                <b>Core 1 (220-1201)</b>
                <div className="muted small">Mobile, Networking, Hardware, Cloud, Troubleshooting</div>
              </span>
            </label>

            <label className="radio">
              <input type="radio" checked={core === "220-1202"} onChange={() => setCore("220-1202")} />
              <span>
                <b>Core 2 (220-1202)</b>
                <div className="muted small">OS, Security, Troubleshooting, Operational Procedures</div>
              </span>
            </label>
          </div>

          <div className="row">
            <div className="pill">
              <span className="muted">PBQs</span>
              <input
                type="number"
                min={0}
                max={12}
                value={pbqCount}
                onChange={(e) => setPbqCount(Math.max(0, Math.min(12, Number(e.target.value))))}
                style={{ width: 70, marginLeft: 8 }}
              />
              <span className="muted" style={{ marginLeft: 8 }}>(realistic ~3–5)</span>
            </div>

            <label className="radio" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={showObjectiveHints}
                onChange={() => setShowObjectiveHints((v) => !v)}
              />
              <span>
                <b>Show objective hints during exam</b>
                <div className="muted small">Off = more realistic</div>
              </span>
            </label>
          </div>

          <div className="row">
            <button className="btn" onClick={() => startNewSession(core)}>Start Session</button>
            <button className="btn ghost" onClick={() => setScreen("analytics")}>View Analytics</button>
          </div>

          <div className="note">
            <b>Objective titles + bullet lists (recommended):</b>
            <ul>
              <li>Place your PDFs in <code>objectives/</code> and run <code>npm run extract-objectives</code>.</li>
              <li>If you don’t, the app uses a minimal objective metadata file and still runs.</li>
            </ul>
          </div>
        </div>
      )}

      {screen === "exam" && session && current && (
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebarHead">
              <div className="muted small">Question</div>
              <div className="big">{idx + 1} / {session.questions.length}</div>
              <div className="muted small">Core: {session.core}</div>
            </div>

            <div className="grid">
              {session.questions.map((q, i) => {
                const isCurrent = i === idx;
                const isFlag = !!flagged[q.id];

                const isPBQ = q.type.startsWith("pbq");
                const isAnswered = isPBQ
                  ? !!pbqState[q.id] && ((q.type === "pbq-order" && pbqState[q.id]?.order?.length) || (q.type === "pbq-match" && pbqState[q.id]?.pairs?.length))
                  : (answers[q.id]?.length ?? 0) > 0;

                const cls = ["qbtn", isCurrent ? "current" : "", isAnswered ? "answered" : "", isFlag ? "flagged" : ""].join(" ");
                return (
                  <button key={q.id} className={cls} onClick={() => goTo(i)} title={`${q.objective} • ${q.domain}`}>
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="sidebarActions">
              <button className="btn ghost" onClick={() => toggleFlag(current.id)}>
                {flagged[current.id] ? "Unmark" : "Mark"} for review
              </button>
              <button className="btn danger" onClick={openReview}>Submit (Review first)</button>
            </div>
          </aside>

          <main className="main">
            <div className="card">
              <div className="metaRow">
                <span className="badge">{current.domain}</span>
                {session.config.showObjectiveHints ? <span className="badge subtle">Obj {current.objective}</span> : null}
                {current.type.startsWith("pbq") ? <span className="badge pbq">PBQ</span> : null}
                {flagged[current.id] ? <span className="badge warn">Flagged</span> : null}
              </div>

              <h2 className="questionTitle">
                Q{idx + 1}. <span className="muted">{current.type === "multi" ? "(Select all that apply)" : ""}</span>
              </h2>
              <p className="prompt">{current.prompt}</p>

              {(current.type === "single" || current.type === "multi") && current.options && (
                <div className="options">
                  {current.options.map((o) => {
                    const checked = (answers[current.id] ?? []).includes(o.id);
                    return (
                      <label className="option" key={o.id}>
                        <input
                          type={current.type === "single" ? "radio" : "checkbox"}
                          name={current.id}
                          checked={checked}
                          onChange={() => current.type === "single" ? setSingleAnswer(current, o.id) : toggleMultiAnswer(current, o.id)}
                        />
                        <span>{o.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {current.type === "pbq-order" && current.pbq?.kind === "order" && (
                <PBQOrder question={current} pbqState={pbqState} setPbqState={setPbqState} />
              )}

              {current.type === "pbq-match" && current.pbq?.kind === "match" && (
                <PBQMatch question={current} pbqState={pbqState} setPbqState={setPbqState} />
              )}

              <div className="navRow">
                <button className="btn ghost" onClick={() => goTo(idx - 1)} disabled={idx === 0}>Previous</button>
                <button className="btn ghost" onClick={() => goTo(idx + 1)} disabled={idx === session.questions.length - 1}>Next</button>
              </div>

              <div className="muted small">Exam mode: no explanations shown until after submission.</div>
            </div>
          </main>
        </div>
      )}

      {screen === "review" && session && (
        <div className="card">
          <h2>Review Before Final Submit</h2>
          <div className="row">
            <div className="pill"><span className="muted">Time remaining</span> {formatTime(remainingSeconds)}</div>
            <div className="pill"><span className="muted">Unanswered</span> {unansweredCount}</div>
            <div className="pill"><span className="muted">Flagged</span> {Object.values(flagged).filter(Boolean).length}</div>
          </div>

          <p className="muted">Click a question number to jump back and fix it before final submission.</p>

          <div className="grid" style={{ maxWidth: 520 }}>
            {session.questions.map((q, i) => {
              const isFlag = !!flagged[q.id];
              const isPBQ = q.type.startsWith("pbq");
              const isAnswered = isPBQ
                ? !!pbqState[q.id] && ((q.type === "pbq-order" && pbqState[q.id]?.order?.length) || (q.type === "pbq-match" && pbqState[q.id]?.pairs?.length))
                : (answers[q.id]?.length ?? 0) > 0;

              const cls = ["qbtn", isAnswered ? "answered" : "", isFlag ? "flagged" : ""].join(" ");
              return (
                <button key={q.id} className={cls} onClick={() => { setIdx(i); setScreen("exam"); }}>
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="row">
            <button className="btn ghost" onClick={() => setScreen("exam")}>Return to Exam</button>
            <button className="btn danger" onClick={() => finalizeSubmit(false)}>Final Submit</button>
          </div>
        </div>
      )}

      {screen === "results" && session && result && (
        <div className="card">
          <h2>Results</h2>

          <div className="scoreRow">
            <div className="scoreBox">
              <div className="muted small">Score</div>
              <div className="scoreBig">{result.percent}%</div>
              <div className="muted">{result.correctCount} / {result.total} correct</div>
            </div>
            <div className="scoreBox">
              <div className="muted small">Core</div>
              <div className="scoreBig">{session.core}</div>
              <div className="muted">{new Date(session.createdAtISO).toLocaleString()}</div>
            </div>
          </div>

          <h3>Objective Coverage Dashboard (what to study next)</h3>
          <ObjectiveCoverage session={session} result={result} />

          <h3>Domain breakdown</h3>
          <div className="table">
            <div className="trow thead">
              <div>Domain</div><div>Correct</div><div>Total</div><div>%</div>
            </div>
            {result.byDomain.map((d) => {
              const pct = d.total ? Math.round((d.correct / d.total) * 1000) / 10 : 0;
              return (
                <div className="trow" key={d.domain}>
                  <div>{d.domain}</div><div>{d.correct}</div><div>{d.total}</div><div>{pct}%</div>
                </div>
              );
            })}
          </div>

          <h3>Review (answers + explanations)</h3>
          <div className="review">
            {session.questions.map((q, i) => {
              const sq = result.scored.find((x) => x.questionId === q.id)!;
              return (
                <details key={q.id} className={"reviewItem " + (sq.isCorrect ? "ok" : "bad")}>
                  <summary>
                    <span className="badge">{sq.isCorrect ? "Correct" : "Incorrect"}</span>
                    <span className="muted">Q{i + 1} • {q.domain} • Obj {q.objective}</span>
                  </summary>
                  <div className="reviewBody">
                    <div className="prompt">{q.prompt}</div>

                    {(q.type === "single" || q.type === "multi") && (
                      <>
                        <div className="muted small">Correct answer:</div>
                        <ul>
                          {q.correct.map((cid) => {
                            const opt = q.options?.find((o) => o.id === cid);
                            return <li key={cid}>{opt?.text ?? cid}</li>;
                          })}
                        </ul>
                      </>
                    )}

                    {q.type === "pbq-order" && (
                      <>
                        <div className="muted small">Correct order:</div>
                        <ol>{q.correct.map((t) => <li key={t}>{t}</li>)}</ol>
                      </>
                    )}

                    {q.type === "pbq-match" && (
                      <>
                        <div className="muted small">Correct pairs:</div>
                        <ul>{q.correct.map((p) => <li key={p}>{p}</li>)}</ul>
                      </>
                    )}

                    <div className="explain"><b>Explanation:</b> {q.explanation}</div>

                    <details style={{ marginTop: 10 }}>
                      <summary className="muted small">Objective detail: {q.objectiveTitle}</summary>
                      <ul>
                        {q.objectiveBullets.slice(0, 20).map((b, idx2) => <li key={idx2} className="muted small">{b}</li>)}
                      </ul>
                      {q.objectiveBullets.length > 20 ? <div className="muted small">…{q.objectiveBullets.length - 20} more bullets</div> : null}
                    </details>
                  </div>
                </details>
              );
            })}
          </div>

          <div className="row">
            <button className="btn" onClick={() => startNewSession(session.core)}>Start Another Session (same core)</button>
            <button className="btn ghost" onClick={() => setScreen("setup")}>Change Core</button>
            <button className="btn ghost" onClick={() => setScreen("analytics")}>View Analytics</button>
            <button className="btn ghost" onClick={resetAll}>Reset All</button>
          </div>
        </div>
      )}

      {screen === "analytics" && (
        <AnalyticsDashboard core={core} onClose={() => setScreen("setup")} />
      )}
    </div>
  );
}

function ObjectiveCoverage({ session, result }: { session: ExamSession; result: ExamResult }) {
  const agg: Record<string, { title: string; total: number; missed: number; focuses: Record<string, number> }> = {};

  for (const q of session.questions) {
    const ok = !!result.scored.find((s) => s.questionId === q.id)?.isCorrect;
    const key = q.objective;
    if (!agg[key]) agg[key] = { title: q.objectiveTitle, total: 0, missed: 0, focuses: {} };
    agg[key].total += 1;
    if (!ok) {
      agg[key].missed += 1;
      if (q.focus) agg[key].focuses[q.focus] = (agg[key].focuses[q.focus] ?? 0) + 1;
    }
  }

  const missed = Object.entries(agg)
    .filter(([, v]) => v.missed > 0)
    .sort((a, b) => b[1].missed - a[1].missed)
    .slice(0, 10);

  if (missed.length === 0) {
    return <div className="note"><b>Excellent:</b> No missed objectives detected in this attempt.</div>;
  }

  return (
    <div className="note">
      <b>Top missed objectives (prioritize these):</b>
      <ol>
        {missed.map(([objId, v]) => {
          const focusList = Object.entries(v.focuses).sort((a, b) => b[1] - a[1]).slice(0, 3);
          return (
            <li key={objId}>
              <b>{objId}</b> — {v.title} <span className="muted">({v.missed}/{v.total} missed)</span>
              {focusList.length > 0 ? (
                <div className="muted small">Common misses: {focusList.map(([f, n]) => `${f} (${n})`).join(", ")}</div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="muted small">
        Recommendation: drill these objectives until accuracy stabilizes above ~80–85%.
      </div>
    </div>
  );
}

function PBQOrder({
  question,
  pbqState,
  setPbqState,
}: {
  question: Question;
  pbqState: Record<string, any>;
  setPbqState: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  const items = question.pbq?.kind === "order" ? question.pbq.items : [];
  const state = pbqState[question.id]?.orderItems as { id: string; text: string }[] | undefined;
  const [local, setLocal] = useState<{ id: string; text: string }[]>(state ?? items);

  useEffect(() => {
    setLocal(state ?? items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= local.length) return;
    const copy = [...local];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setLocal(copy);

    setPbqState((s) => ({
      ...s,
      [question.id]: { orderItems: copy, order: copy.map((x) => x.text) },
    }));
  }

  return (
    <div className="pbq">
      <div className="muted small">Reorder using Up/Down. (All-or-nothing scoring)</div>
      {local.map((it, i) => (
        <div key={it.id} className="pbqRow">
          <div className="pbqNum">{i + 1}</div>
          <div className="pbqText">{it.text}</div>
          <div className="pbqBtns">
            <button className="btn tiny ghost" onClick={() => move(i, -1)} disabled={i === 0}>Up</button>
            <button className="btn tiny ghost" onClick={() => move(i, 1)} disabled={i === local.length - 1}>Down</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PBQMatch({
  question,
  pbqState,
  setPbqState,
}: {
  question: Question;
  pbqState: Record<string, any>;
  setPbqState: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  if (question.pbq?.kind !== "match") return null;

  const left = question.pbq.left;
  const right = question.pbq.right;

  const pairs: Record<string, string> = pbqState[question.id]?.map ?? {};
  const pairList: string[] = pbqState[question.id]?.pairs ?? [];

  function setPair(leftText: string, rightText: string) {
    const next = { ...pairs, [leftText]: rightText };
    const encoded = Object.entries(next).map(([l, r]) => `${l}=>${r}`);
    setPbqState((s) => ({ ...s, [question.id]: { map: next, pairs: encoded } }));
  }

  return (
    <div className="pbq">
      <div className="muted small">Select a match for each item. (All-or-nothing scoring)</div>
      <div className="matchGrid">
        <div className="matchHead">{question.pbq.leftLabel}</div>
        <div className="matchHead">{question.pbq.rightLabel}</div>

        {left.map((l) => (
          <React.Fragment key={l.id}>
            <div className="matchLeft">{l.text}</div>
            <div className="matchRight">
              <select value={pairs[l.text] ?? ""} onChange={(e) => setPair(l.text, e.target.value)}>
                <option value="">— Select —</option>
                {right.map((r) => (
                  <option key={r.id} value={r.text}>{r.text}</option>
                ))}
              </select>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="muted small">Matches set: {pairList.length}</div>
    </div>
  );
}
