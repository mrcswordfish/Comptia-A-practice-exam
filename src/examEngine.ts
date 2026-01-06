import { CoreId, getObjectiveMeta, listObjectivesByDomain } from "./objectives";

export type QuestionType = "single" | "multi" | "pbq-order" | "pbq-match";

export type Question = {
  id: string;
  core: CoreId;

  // Display domain label (e.g., "2.0 Networking")
  domain: string;

  // Objective ID (e.g., "2.1")
  objective: string;
  objectiveTitle: string;
  objectiveBullets: string[];
  focus?: string;

  type: QuestionType;
  prompt: string;

  options?: { id: string; text: string }[];
  correct: string[];

  explanation: string;

  pbq?:
    | { kind: "order"; items: { id: string; text: string }[] }
    | {
        kind: "match";
        leftLabel: string;
        rightLabel: string;
        left: { id: string; text: string }[];
        right: { id: string; text: string }[];
      };
};

export type SessionConfig = {
  pbqCount: number;
  showObjectiveHints: boolean;
};

export type ExamSession = {
  sessionId: string;
  core: CoreId;
  createdAtISO: string;
  durationSeconds: number;
  config: SessionConfig;
  questions: Question[];
};

export const EXAM_QUESTION_COUNT = 90;
export const EXAM_DURATION_SECONDS = 90 * 60;

export type AnswerMap = Record<string, string[] | undefined>;
export type ScoredQuestion = { questionId: string; isCorrect: boolean };

export type ExamResult = {
  percent: number;
  correctCount: number;
  total: number;
  byDomain: { domain: string; correct: number; total: number }[];
  scored: ScoredQuestion[];
};

// ---------- Deterministic RNG ----------
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: string) {
  const seedFn = xmur3(seed);
  return mulberry32(seedFn());
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function setEq(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

// ---------- Domain blueprints (weights) ----------
type DomainBlueprint = { domainNumber: string; domainLabel: string; weight: number };

const CORE1_BLUEPRINT: DomainBlueprint[] = [
  { domainNumber: "1.0", domainLabel: "Mobile Devices", weight: 13 },
  { domainNumber: "2.0", domainLabel: "Networking", weight: 23 },
  { domainNumber: "3.0", domainLabel: "Hardware", weight: 25 },
  { domainNumber: "4.0", domainLabel: "Virtualization and Cloud Computing", weight: 11 },
  { domainNumber: "5.0", domainLabel: "Hardware and Network Troubleshooting", weight: 28 },
];

const CORE2_BLUEPRINT: DomainBlueprint[] = [
  { domainNumber: "1.0", domainLabel: "Operating Systems", weight: 28 },
  { domainNumber: "2.0", domainLabel: "Security", weight: 28 },
  { domainNumber: "3.0", domainLabel: "Software Troubleshooting", weight: 23 },
  { domainNumber: "4.0", domainLabel: "Operational Procedures", weight: 21 },
];

function allocateByWeight(total: number, blueprint: DomainBlueprint[]) {
  const sum = blueprint.reduce((s, d) => s + d.weight, 0);
  const raw = blueprint.map((d) => ({
    key: d.domainNumber,
    exact: (d.weight / sum) * total,
    floor: Math.floor((d.weight / sum) * total),
  }));

  const used = raw.reduce((s, r) => s + r.floor, 0);
  let remaining = total - used;

  const byRemainder = raw
    .map((r) => ({ ...r, rem: r.exact - r.floor }))
    .sort((a, b) => b.rem - a.rem);

  const counts: Record<string, number> = {};
  for (const r of raw) counts[r.key] = r.floor;

  for (let i = 0; i < remaining; i++) {
    counts[byRemainder[i % byRemainder.length].key] += 1;
  }
  return counts;
}

function enrich(core: CoreId, objectiveId: string) {
  const meta = getObjectiveMeta(core, objectiveId);
  const derivedDomainNum = `${objectiveId.split(".")[0]}.0`;
  return {
    objectiveTitle: meta?.title ?? `Objective ${objectiveId}`,
    objectiveBullets: meta?.bullets ?? [],
    domain: meta?.domain ?? derivedDomainNum,
  };
}

type IdGen = (prefix: string) => string;

function qSingle(
  rng: () => number,
  id: string,
  core: CoreId,
  objective: string,
  prompt: string,
  options: string[],
  correctText: string,
  explanation: string,
  focus?: string
): Question {
  const meta = enrich(core, objective);
  const shuffled = shuffle(
    rng,
    options.map((t, i) => ({ id: `o${i + 1}`, text: t }))
  );
  const correctId = shuffled.find((o) => o.text === correctText)?.id ?? shuffled[0].id;

  return {
    id,
    core,
    domain: meta.domain,
    objective,
    objectiveTitle: meta.objectiveTitle,
    objectiveBullets: meta.objectiveBullets,
    focus,
    type: "single",
    prompt,
    options: shuffled,
    correct: [correctId],
    explanation,
  };
}

function pbqOrder(
  rng: () => number,
  id: string,
  core: CoreId,
  objective: string,
  prompt: string,
  steps: string[],
  explanation: string
): Question {
  const meta = enrich(core, objective);
  const items = shuffle(rng, steps).map((t, i) => ({ id: `s${i + 1}`, text: t }));

  return {
    id,
    core,
    domain: meta.domain,
    objective,
    objectiveTitle: meta.objectiveTitle,
    objectiveBullets: meta.objectiveBullets,
    type: "pbq-order",
    prompt,
    correct: [...steps],
    explanation,
    pbq: { kind: "order", items },
  };
}

function pbqMatch(
  rng: () => number,
  id: string,
  core: CoreId,
  objective: string,
  prompt: string,
  leftLabel: string,
  rightLabel: string,
  pairs: { left: string; right: string }[],
  distractors: string[],
  explanation?: string
): Question {
  const meta = enrich(core, objective);

  const left = pairs.map((p, i) => ({ id: `l${i + 1}`, text: p.left }));
  const rightPool = shuffle(rng, [...new Set([...pairs.map((p) => p.right), ...distractors])]).slice(
    0,
    Math.max(4, pairs.length + 1)
  );
  const right = rightPool.map((t, i) => ({ id: `r${i + 1}`, text: t }));

  const correct = pairs.map((p) => `${p.left}=>${p.right}`);

  return {
    id,
    core,
    domain: meta.domain,
    objective,
    objectiveTitle: meta.objectiveTitle,
    objectiveBullets: meta.objectiveBullets,
    type: "pbq-match",
    prompt,
    correct,
    explanation: explanation ?? "Match each item to the best answer based on the objective.",
    pbq: { kind: "match", leftLabel, rightLabel, left, right },
  };
}

// ---------- PBQ template library (14 templates total) ----------
function buildPbqTemplates(core: CoreId, idGen: IdGen) {
  const t: ((rng: () => number) => Question)[] = [];

  if (core === "220-1201") {
    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "3.2",
        "PBQ: Match each connector to the MOST common cable/usage.",
        "Connector",
        "Usage",
        [
          { left: "RJ-45", right: "Ethernet (twisted pair)" },
          { left: "RJ-11", right: "Telephone/DSL line" },
          { left: "LC", right: "Fiber optic connector" },
        ],
        ["Coaxial TV input", "USB peripheral", "Analog video (legacy)", "High-speed video (digital)"],
        "RJ-45 is used for Ethernet, RJ-11 for telephone/DSL, and LC is a common fiber connector."
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "2.2",
        "PBQ: Match the Wi-Fi term to the MOST accurate description.",
        "Term",
        "Description",
        [
          { left: "2.4GHz", right: "Longer range; more interference" },
          { left: "5GHz", right: "Higher throughput; less range" },
          { left: "WPA3", right: "Modern Wi-Fi security standard" },
        ],
        ["Legacy weak encryption", "Only for wired switching", "Requires a SIM card"]
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "2.7",
        "PBQ: Router hardening—match the configuration action to the MOST accurate purpose.",
        "Action",
        "Purpose",
        [
          { left: "Change default admin password", right: "Prevents easy unauthorized access" },
          { left: "Disable WPS", right: "Reduces risk of brute-force PIN attacks" },
          { left: "Update firmware", right: "Patches known vulnerabilities" },
        ],
        ["Improves monitor resolution", "Speeds up SATA storage", "Fixes printer spooler crashes"]
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "4.2",
        "PBQ: Match each cloud service model to what the provider typically supplies.",
        "Model",
        "Provider supplies",
        [
          { left: "IaaS", right: "Virtualized compute/network/storage; customer manages OS/apps" },
          { left: "PaaS", right: "Managed platform/runtime; customer deploys apps" },
          { left: "SaaS", right: "Complete application delivered over the internet" },
        ],
        ["Only physical cabling", "Only end-user training", "Only onsite UPS power"]
      )
    );

    t.push((rng) =>
      pbqOrder(
        rng,
        idGen("pbq"),
        core,
        "5.5",
        "PBQ: Put the troubleshooting methodology steps in the BEST order.",
        [
          "Identify the problem",
          "Establish a theory of probable cause",
          "Test the theory to determine the cause",
          "Establish a plan of action and implement the solution",
          "Verify full system functionality and implement preventive measures",
          "Document findings, actions, and outcomes",
        ],
        "This is the standard CompTIA troubleshooting workflow."
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "5.2",
        "PBQ: Match the RAID level to the BEST description.",
        "RAID",
        "Description",
        [
          { left: "RAID 0", right: "Striping; performance; no redundancy" },
          { left: "RAID 1", right: "Mirroring; redundancy" },
          { left: "RAID 5", right: "Striping + parity; needs 3+ disks" },
          { left: "RAID 10", right: "Stripe of mirrors; performance + redundancy" },
        ],
        ["Cloud-only backup", "GPU acceleration mode", "Print queue service"]
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "5.6",
        "PBQ: Match the printer symptom to the MOST likely cause.",
        "Symptom",
        "Cause",
        [
          { left: "Faded prints", right: "Low toner/ink or printhead issue" },
          { left: "Lines down the page", right: "Dirty/damaged drum or imaging component" },
          { left: "Garbled output", right: "Wrong driver/language or corrupt spool" },
        ],
        ["Incorrect system time", "DNS misconfiguration", "Bad Wi-Fi passphrase"]
      )
    );
  } else {
    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "1.3",
        "PBQ: Match the Windows utility to the MOST appropriate task.",
        "Utility",
        "Task",
        [
          { left: "Event Viewer", right: "Review system/application logs and errors" },
          { left: "Disk Management", right: "Create/extend partitions and manage volumes" },
          { left: "Device Manager", right: "View device status and manage drivers" },
          { left: "Services", right: "Start/stop and configure background services" },
        ],
        ["Edit BIOS firmware directly", "Clean browser cookies", "Defragment cloud storage"]
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "1.4",
        "PBQ: Match the command to the MOST accurate purpose.",
        "Command",
        "Purpose",
        [
          { left: "ipconfig", right: "View IP configuration" },
          { left: "tracert", right: "Trace route to a host" },
          { left: "sfc", right: "Check/repair system files" },
          { left: "chkdsk", right: "Check disk and filesystem integrity" },
        ],
        ["Update router firmware", "Change UEFI boot order", "Encrypt a disk automatically"]
      )
    );

    t.push((rng) =>
      pbqOrder(
        rng,
        idGen("pbq"),
        core,
        "2.4",
        "PBQ: Put the malware response actions in the BEST order.",
        [
          "Investigate and verify malware symptoms",
          "Quarantine the infected system",
          "Update anti-malware tools/definitions",
          "Scan and remove (safe mode/recovery as needed)",
          "Schedule updates and confirm protections are enabled",
          "Educate the end user and document actions",
        ],
        "Confirm symptoms, isolate, update tools, remediate, restore protections, then educate/document."
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "4.1",
        "PBQ: Ticket triage—match the ticket to the MOST appropriate priority.",
        "Ticket",
        "Priority",
        [
          { left: "CEO laptop won’t boot before a live presentation in 30 minutes", right: "High" },
          { left: "Single user cannot print to a shared printer", right: "Medium" },
          { left: "Request: install a new font pack next week", right: "Low" },
        ],
        ["Critical (entire site down)", "Informational only", "Deferred indefinitely"],
        "Triage prioritizes impact + urgency."
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "4.9",
        "PBQ: Match the remote access technology to the BEST use case.",
        "Technology",
        "Use case",
        [
          { left: "RDP", right: "Windows graphical remote desktop" },
          { left: "SSH", right: "Secure command-line remote access" },
          { left: "VPN", right: "Encrypted tunnel into a private network" },
          { left: "VNC", right: "Cross-platform remote screen sharing" },
        ],
        ["BIOS password reset", "RAM timing configuration", "Printer toner replacement"]
      )
    );

    t.push((rng) =>
      pbqMatch(
        rng,
        idGen("pbq"),
        core,
        "4.3",
        "PBQ: Match the backup type to the MOST accurate description.",
        "Backup",
        "Description",
        [
          { left: "Full", right: "Copies all selected data each time" },
          { left: "Incremental", right: "Copies changes since last backup (any type)" },
          { left: "Differential", right: "Copies changes since last full backup" },
        ],
        ["Only cloud sync", "Only system logs", "Only browser cache"]
      )
    );

    t.push((rng) =>
      pbqOrder(
        rng,
        idGen("pbq"),
        core,
        "4.2",
        "PBQ: Put the change management actions in the BEST order.",
        [
          "Document the requested change and scope",
          "Assess risk and create a backout plan",
          "Obtain approval per policy",
          "Schedule change window and communicate",
          "Implement the change",
          "Validate results and complete post-change documentation",
        ],
        "Document, assess risk/backout, approve, schedule/communicate, implement, validate and document."
      )
    );
  }

  return t;
}

// ---------- MCQ generator by objective ----------
function buildMCQ(rng: () => number, idGen: IdGen, core: CoreId, objectiveId: string): Question {
  const meta = getObjectiveMeta(core, objectiveId);
  const title = meta?.title ?? `Objective ${objectiveId}`;
  const bullets = meta?.bullets ?? [];
  const qid = idGen("q");

  if (core === "220-1201" && objectiveId === "2.1") {
    const portBullets = bullets.filter((b) => /^\d/.test(b) && b.includes("–"));
    const pick = pickOne(rng, portBullets.length ? portBullets : ["443 – HTTPS"]);
    const [portPart, protoPart] = pick.split("–").map((x) => x.trim());
    const correct = portPart;
    const wrong = shuffle(rng, portBullets.filter((b) => b !== pick).map((b) => b.split("–")[0].trim())).slice(0, 3);
    return qSingle(
      rng,
      qid,
      core,
      objectiveId,
      `Which port is associated with ${protoPart}?`,
      shuffle(rng, [correct, ...wrong]),
      correct,
      `${protoPart} commonly uses port ${correct}.`,
      pick
    );
  }

  if (core === "220-1202" && objectiveId === "1.3") {
    const items = [
      { tool: "Event Viewer", task: "review system/application logs and errors" },
      { tool: "Disk Management", task: "create/extend partitions and manage volumes" },
      { tool: "Device Manager", task: "view device status and manage drivers" },
      { tool: "Services", task: "start/stop and configure background services" },
      { tool: "Task Manager", task: "view processes and performance / end tasks" },
    ];
    const pick = pickOne(rng, items);
    const wrong = shuffle(rng, items.filter((x) => x.tool !== pick.tool)).slice(0, 3).map((x) => x.tool);
    return qSingle(
      rng,
      qid,
      core,
      objectiveId,
      `Which Windows utility is MOST appropriate to ${pick.task}?`,
      shuffle(rng, [pick.tool, ...wrong]),
      pick.tool,
      `${pick.tool} is used to ${pick.task}.`,
      pick.tool
    );
  }

  if (core === "220-1202" && objectiveId === "1.4") {
    const items = [
      { cmd: "ipconfig", purpose: "view IP configuration" },
      { cmd: "tracert", purpose: "trace route to a host" },
      { cmd: "sfc", purpose: "check/repair system files" },
      { cmd: "chkdsk", purpose: "check disk integrity and filesystem errors" },
      { cmd: "netstat", purpose: "view active connections and listening ports" },
    ];
    const pick = pickOne(rng, items);
    const wrong = shuffle(rng, items.filter((x) => x.cmd !== pick.cmd)).slice(0, 3).map((x) => x.cmd);
    return qSingle(
      rng,
      qid,
      core,
      objectiveId,
      `Which command is MOST appropriate to ${pick.purpose}?`,
      shuffle(rng, [pick.cmd, ...wrong]),
      pick.cmd,
      `${pick.cmd} is used to ${pick.purpose}.`,
      pick.cmd
    );
  }

  if (core === "220-1202" && objectiveId === "2.4") {
    const types = bullets.length ? bullets : ["Ransomware", "Trojan", "Rootkit", "Spyware"];
    const correct = pickOne(rng, types);
    const wrong = shuffle(rng, types.filter((x) => x !== correct)).slice(0, 3);
    return qSingle(
      rng,
      qid,
      core,
      objectiveId,
      `Which malware type BEST matches the term "${correct}"?`,
      shuffle(rng, [correct, ...wrong]),
      correct,
      "Know malware categories and typical indicators/removal approaches.",
      correct
    );
  }

  if (core === "220-1202" && objectiveId === "4.3") {
    const correct = "3-2-1 rule";
    const options = shuffle(rng, [correct, "1-1-1 rule", "RAID 0", "WEP"]);
    return qSingle(
      rng,
      qid,
      core,
      objectiveId,
      "Which concept is BEST associated with maintaining three copies of data on two media types with one offsite copy?",
      options,
      correct,
      "The 3-2-1 rule: 3 copies, 2 different media types, 1 offsite.",
      "3-2-1"
    );
  }

  const focus = bullets.length ? pickOne(rng, bullets) : undefined;
  const distractors = bullets.length ? shuffle(rng, bullets.filter((b) => b !== focus)).slice(0, 3) : [];
  const correct = focus ?? "Implement least privilege";
  const baseOptions = bullets.length ? [correct, ...distractors] : [correct, "Reinstall the OS", "Disable IPv6", "Replace the monitor"];
  const options = shuffle(rng, baseOptions.slice(0, 4));

  return qSingle(
    rng,
    qid,
    core,
    objectiveId,
    `Which option is MOST directly associated with: ${title}`,
    options,
    correct,
    focus ? `This item appears under objective ${objectiveId}: ${title}.` : `This question drills objective ${objectiveId}.`,
    focus
  );
}

export function createExamSession(core: CoreId, config: SessionConfig): ExamSession {
  const sessionId = `${core}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rng = makeRng(sessionId);

  const idGen: IdGen = (() => {
    let i = 0;
    return (prefix: string) => `${sessionId}-${prefix}-${++i}`;
  })();

  const blueprint = core === "220-1201" ? CORE1_BLUEPRINT : CORE2_BLUEPRINT;
  const allocation = allocateByWeight(EXAM_QUESTION_COUNT, blueprint);

  const questions: Question[] = [];

  for (const d of blueprint) {
    const count = allocation[d.domainNumber] ?? 0;
    const objectiveIds = listObjectivesByDomain(core, d.domainNumber);

    for (let i = 0; i < count; i++) {
      const objId = objectiveIds.length ? pickOne(rng, objectiveIds) : `${d.domainNumber.split(".")[0]}.1`;
      questions.push(buildMCQ(rng, idGen, core, objId));
    }
  }

  const pbqTemplates = buildPbqTemplates(core, idGen);
  const pbqCount = Math.max(0, Math.min(config.pbqCount, 12));

  const indices = new Set<number>();
  while (indices.size < pbqCount && indices.size < questions.length) {
    indices.add(Math.floor(rng() * questions.length));
  }

  for (const idx of indices) {
    const pbq = pickOne(rng, pbqTemplates)(rng);
    questions[idx] = pbq;
  }

  return {
    sessionId,
    core,
    createdAtISO: new Date().toISOString(),
    durationSeconds: EXAM_DURATION_SECONDS,
    config,
    questions: shuffle(rng, questions).slice(0, EXAM_QUESTION_COUNT),
  };
}

export function scoreExam(session: ExamSession, answers: AnswerMap, pbqState?: Record<string, any>): ExamResult {
  let correctCount = 0;
  const scored: ScoredQuestion[] = [];
  const domainAgg: Record<string, { correct: number; total: number }> = {};

  for (const q of session.questions) {
    if (!domainAgg[q.domain]) domainAgg[q.domain] = { correct: 0, total: 0 };
    domainAgg[q.domain].total += 1;

    let ok = false;
    if (q.type === "pbq-order") {
      const order = pbqState?.[q.id]?.order as string[] | undefined;
      ok = !!order && order.length === q.correct.length && order.every((t, i) => t === q.correct[i]);
    } else if (q.type === "pbq-match") {
      const pairs = pbqState?.[q.id]?.pairs as string[] | undefined;
      ok = !!pairs && setEq(pairs, q.correct);
    } else {
      const a = answers[q.id] ?? [];
      ok = setEq(a, q.correct);
    }

    if (ok) {
      correctCount += 1;
      domainAgg[q.domain].correct += 1;
    }
    scored.push({ questionId: q.id, isCorrect: ok });
  }

  const total = session.questions.length;
  const percent = Math.round((correctCount / total) * 1000) / 10;

  const byDomain = Object.entries(domainAgg).map(([domain, v]) => ({
    domain,
    correct: v.correct,
    total: v.total,
  }));

  return { percent, correctCount, total, byDomain, scored };
}
