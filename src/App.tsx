import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  Download,
  FileAudio,
  FileCheck2,
  FileJson2,
  FlaskConical,
  Home,
  Info,
  Languages,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
  Zap,
} from "./icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import {
  evaluateTranscripts,
  getProviderInfo,
  getSample,
  transcribeAudio,
  type ProviderInfo,
} from "./api";
import type { AnalysisResult, EvaluationResult, Finding } from "./types";

const HISTORY_KEY = "voxsure-history-v1";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(wav|mp3|m4a|mp4|webm|flac|ogg|opus|aac|amr|aiff|wma)$/i;
const REPOSITORY_URL = import.meta.env.VITE_REPOSITORY_URL;

type HistoryItem = Pick<
  AnalysisResult,
  "id" | "created_at" | "filename" | "language_setting" | "provider" | "status" | "source"
>;
type ProductState = {
  provider: ProviderInfo | null;
  modeError: string | null;
  history: HistoryItem[];
  current: AnalysisResult | null;
  remember: (result: AnalysisResult) => void;
  openResult: (item: HistoryItem) => void;
  forget: (id: string) => void;
};
const ProductContext = createContext<ProductState | null>(null);

function useProduct(): ProductState {
  const outletContext = useOutletContext<ProductState | undefined>();
  const productContext = useContext(ProductContext);
  const context = outletContext ?? productContext;
  if (!context) throw new Error("VoxSure product state is unavailable.");
  return context;
}

function readHistory(): HistoryItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (item): item is HistoryItem =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "filename" in item &&
        typeof item.filename === "string",
    );
  } catch {
    return [];
  }
}

function App() {
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  const sessionResults = useRef(new Map<string, AnalysisResult>());

  useEffect(() => {
    getProviderInfo().then(setProvider).catch((error: unknown) => {
      setModeError(error instanceof Error ? error.message : "The API status could not be read.");
    });
  }, []);

  const remember = useCallback((result: AnalysisResult) => {
    setCurrent(result);
    sessionResults.current.set(result.id, result);
    setHistory((previous) => {
      const item: HistoryItem = {
        id: result.id,
        created_at: result.created_at,
        filename: result.filename,
        language_setting: result.language_setting,
        provider: result.provider,
        status: result.status,
        source: result.source,
      };
      const next = [item, ...previous.filter((saved) => saved.id !== item.id)].slice(0, 100);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        setModeError("Browser storage is full; this run will not appear in persistent history.");
      }
      return next;
    });
  }, []);

  const openResult = useCallback((item: HistoryItem) => {
    setCurrent(sessionResults.current.get(item.id) ?? null);
  }, []);

  const forget = useCallback((id: string) => {
    sessionResults.current.delete(id);
    setHistory((previous) => {
      const next = previous.filter((item) => item.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        setModeError("Could not update browser history.");
      }
      return next;
    });
    setCurrent((previous) => (previous?.id === id ? null : previous));
  }, []);

  const state = useMemo(
    () => ({ provider, modeError, history, current, remember, openResult, forget }),
    [provider, modeError, history, current, remember, openResult, forget],
  );

  return (
    <ProductContext.Provider value={state}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/workspace" element={<WorkspaceShell />}>
          <Route index element={<AnalysisPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="evaluation" element={<EvaluationPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ProductContext.Provider>
  );
}

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`wordmark${inverse ? " wordmark-inverse" : ""}`} to="/" aria-label="VoxSure home">
      <span className="brand-signal" aria-hidden="true">
        <svg viewBox="0 0 25 21" fill="none">
          <path d="M1 11h3l2.2-6 3.1 12L12.5 2l3.3 14 2.4-7H24" />
          <path className="brand-tick" d="m15.4 12.5 2.1 2.2 4.7-5" />
        </svg>
      </span>
      <span>VoxSure</span>
    </Link>
  );
}

function Waveform({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const samples = useMemo(
    () =>
      Array.from({ length: compact ? 48 : 90 }, (_, index) => {
        const signal =
          Math.abs(Math.sin(index * 2.14)) * 0.46 +
          Math.abs(Math.cos(index * 0.43 + 0.8)) * 0.36 +
          Math.abs(Math.sin(index * 0.11)) * 0.18;
        return Math.max(compact ? 4 : 5, Math.round(signal * (compact ? 34 : 92)));
      }),
    [compact],
  );
  return (
    <div className={`waveform${dark ? " waveform-dark" : ""}${compact ? " waveform-compact" : ""}`} aria-hidden="true">
      {samples.map((height, index) => (
        <span key={index} style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

const sampleTranscript = (
  <>
    Namaskara, my appointment is on <mark>14/08/2026</mark> at <mark>10:30</mark>. Please
    bring reference ID <mark>KA-4821</mark>.
  </>
);

function Landing() {
  const [activePreview, setActivePreview] = useState<"transcript" | "review">("transcript");
  return (
    <div className="landing-page">
      <header className="public-nav">
        <div className="public-nav-inner">
          <Wordmark />
          <nav aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#workflow">How it works</a>
            <a href="#evaluation">Evaluation</a>
            <Link to="/workspace/docs">Docs</Link>
          </nav>
          <Link className="button button-dark button-nav" to="/workspace">
            Open workspace <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="signal-dot" /> A SPEECH QUALITY INSTRUMENT</div>
            <h1>Every word<br />should <span>hold up.</span></h1>
            <p className="hero-description">
              Explore Indian-language speech recognition with the detail it deserves.
              Catch the numbers, names and code-switches that a single score can hide.
            </p>
            <div className="hero-actions">
              <Link className="button button-lime" to="/workspace">
                <AudioLines size={17} /> Analyze audio <ArrowRight size={16} />
              </Link>
              <a className="text-link" href="#evaluation">Explore the evaluation <ArrowDownRight size={15} /></a>
            </div>
            <div className="hero-footnote"><span className="micro-dot" /> DEMO IS FREE. LIVE SPEECH-TO-TEXT NEEDS YOUR OWN API KEY.</div>
          </div>

          <div className="hero-visual" aria-label="Illustrative voice signal visualization">
            <div className="visual-topline"><span>VOICE / 01</span><span className="visual-live"><span /> SIGNAL VIEW</span></div>
            <div className="visual-grid" />
            <div className="visual-mark mark-a">IN / 08.4<span>SEC</span></div>
            <div className="signal-svg">
              <svg viewBox="0 0 780 250" fill="none" preserveAspectRatio="none" role="img" aria-label="Abstract audio signal">
                <path className="signal-halo" d="M0 126 C24 126 25 119 42 122 S61 175 78 152 94 79 113 115 131 181 149 143 164 112 183 122 199 73 219 110 236 191 251 154 271 99 288 130 302 173 321 141 337 84 355 122 372 176 390 146 404 110 421 126 438 166 457 140 473 95 493 121 510 183 526 147 542 99 559 130 576 157 594 135 612 91 629 118 644 178 664 139 681 102 700 126 717 168 734 139 752 115 780 126" />
                <path className="signal-main" d="M0 126 C24 126 25 119 42 122 S61 175 78 152 94 79 113 115 131 181 149 143 164 112 183 122 199 73 219 110 236 191 251 154 271 99 288 130 302 173 321 141 337 84 355 122 372 176 390 146 404 110 421 126 438 166 457 140 473 95 493 121 510 183 526 147 542 99 559 130 576 157 594 135 612 91 629 118 644 178 664 139 681 102 700 126 717 168 734 139 752 115 780 126" />
                <circle cx="390" cy="146" r="4" className="signal-point" />
              </svg>
            </div>
            <div className="visual-caption"><span>01</span> A signal is not yet a transcript. A transcript is not yet evidence.</div>
            <div className="visual-axis"><span>0:00</span><span>00:04</span><span>00:08</span></div>
            <div className="visual-bottom"><span>FIELD NOTES&nbsp; / &nbsp;INDIC LANGUAGES</span><AudioLines size={16} /></div>
          </div>
        </section>

        <section id="product" className="preview-section">
          <div className="section-intro">
            <div className="eyebrow">01 — INSPECT, DON’T JUST TRANSCRIBE</div>
            <h2>Hear what the score<br />doesn’t tell you.</h2>
            <p>One missed digit can matter more than ten correctly heard filler words. VoxSure gives the important details their own review.</p>
          </div>
          <div className="preview-window">
            <div className="preview-bar">
              <div className="preview-brand"><span className="window-lights"><i /><i /><i /></span><span>VOXSURE / ANALYSIS</span></div>
              <span className="sample-pill">SAMPLE · NOT MODEL OUTPUT</span>
            </div>
            <div className="preview-body">
              <div className="preview-meta"><span><FileAudio size={14} /> sample-call.wav</span><span>DEMO SAMPLE</span><span>Auto / code-mixed</span></div>
              <div className="preview-tabs" role="tablist" aria-label="Preview panels">
                <button role="tab" aria-selected={activePreview === "transcript"} className={activePreview === "transcript" ? "selected" : ""} onClick={() => setActivePreview("transcript")}>Model output</button>
                <button role="tab" aria-selected={activePreview === "review"} className={activePreview === "review" ? "selected" : ""} onClick={() => setActivePreview("review")}>VoxSure analysis <span>03</span></button>
              </div>
              {activePreview === "transcript" ? (
                <div className="preview-transcript">
                  <p>{sampleTranscript}</p>
                  <div className="preview-inline-wave"><Waveform compact /><span>08.4 SEC · SAMPLE CONTENT</span></div>
                </div>
              ) : (
                <div className="preview-findings">
                  <div><span className="finding-icon">#</span><span><b>14/08/2026</b><small>Date pattern · verify against source audio</small></span><i>NEEDS REVIEW</i></div>
                  <div><span className="finding-icon">◷</span><span><b>10:30</b><small>Time pattern · verify against source audio</small></span><i>NEEDS REVIEW</i></div>
                  <div><span className="finding-icon">ID</span><span><b>KA-4821</b><small>Identifier pattern · verify against source audio</small></span><i>NEEDS REVIEW</i></div>
                </div>
              )}
              <div className="preview-disclaimer"><Info size={14} /> Illustrative content; this sample was not transcribed from an audio recording.</div>
            </div>
          </div>
        </section>

        <section className="truth-strip">
          <div className="truth-index">WHY WORD ERROR RATE<br />ISN’T THE WHOLE STORY</div>
          <div className="truth-copy"><p>A transcript can score well on average and still get the <em>one thing that matters</em> wrong.</p></div>
          <div className="truth-side"><span>THE SIGNAL TO LOOK FOR</span><p>Names. Amounts.<br />Dates. IDs. Switches.</p></div>
        </section>

        <section id="workflow" className="workflow-section">
          <div className="eyebrow">02 — THE WORKFLOW</div>
          <div className="workflow-heading"><h2>From raw audio<br />to a reasoned result.</h2><p>No magic correction. No mystery score.<br />Just a clearer way to ask what was heard.</p></div>
          <div className="workflow-steps">
            {[
              { number: "01", icon: <Upload />, title: "Bring audio", body: "Drop in a clip or choose a public demo sample. Audio is handled in memory and never saved by default." },
              { number: "02", icon: <Languages />, title: "Choose a provider", body: "Try the clearly labelled offline-credential demo, or bring a server-side Sarvam API key." },
              { number: "03", icon: <Search />, title: "Inspect what matters", body: "Review transparent number and identifier checks. A flag is a prompt, never a claim of error." },
              { number: "04", icon: <BarChart3 />, title: "Evaluate & export", body: "Compare with a human reference using reproducible WER and CER. Take results with you." },
            ].map((step) => (
              <article className="workflow-step" key={step.number}>
                <div className="step-n">{step.number}</div><div className="step-icon">{step.icon}</div>
                <h3>{step.title}</h3><p>{step.body}</p><ArrowUpRight className="step-arrow" size={16} />
              </article>
            ))}
          </div>
        </section>

        <section className="capabilities-section">
          <div className="capability-stamp"><span>Built for</span><strong>the details<br />between<br />the words.</strong><i>▱</i></div>
          <div className="capability-list">
            <div className="eyebrow">03 — WHAT YOU CAN DO</div>
            {[
              ["A", "Explore code-mixed speech", "Switch across Indian languages and English with clear provider provenance."],
              ["B", "Surface critical details", "Find heuristic number, date, time, amount and identifier patterns. You decide what to trust."],
              ["C", "Compare two transcripts", "See word and character errors, counts, alignment, and annotation scores when you supply annotations."],
              ["D", "Keep evaluation honest", "No invented confidence, no hidden rewrite, no unsourced benchmark claims."],
            ].map(([letter, title, description]) => (
              <article className="capability-row" key={letter}><span>{letter}</span><div><h3>{title}</h3><p>{description}</p></div><ChevronRight size={17} /></article>
            ))}
          </div>
        </section>

        <section id="evaluation" className="evaluation-preview">
          <div className="evaluation-heading"><div><div className="eyebrow eyebrow-on-dark">04 — EVALUATION, NOT ESTIMATION</div><h2>A score with its<br />working shown.</h2></div><p>Bring your own reference. VoxSure calculates edit distance from the text you provide—not a chart from an unpublished benchmark.</p></div>
          <div className="metric-readouts">
            {[
              ["WER", "Word error rate", "—"], ["CER", "Character error rate", "—"],
              ["EM", "Entity exact match", "—"], ["NE", "Number exact match", "—"],
            ].map(([short, title, value]) => <div key={short} className="metric-cell"><span>{short}</span><small>{title}</small><strong>{value}</strong><i>NO COMPARISON YET</i></div>)}
          </div>
          <p className="benchmark-state"><span /> Benchmark not run yet · These are metric labels, not measured VoxSure results.</p>
          <Link className="button button-lime" to="/workspace/evaluation">Open evaluation lab <ArrowRight size={15} /></Link>
        </section>

        <section className="usecases-section">
          <div className="eyebrow">05 — MADE FOR CAREFUL LISTENERS</div>
          <div className="usecases-grid"><h2>Less guessing.<br /><span>More knowing.</span></h2><div className="usecases-cards">
            {[["ML / Speech teams", "Evaluate providers beyond the aggregate score."], ["Voice product QA", "Reproduce a specific issue before it reaches a caller."], ["Researchers", "Keep reference, normalization and provenance explicit."], ["Dataset builders", "Spot details that deserve another annotation pass."]].map(([title, copy]) => <div className="usecase-card" key={title}><span>↗</span><h3>{title}</h3><p>{copy}</p></div>)}
          </div></div>
        </section>

        <section className="transparency-section">
          <div className="transparency-icon"><Shield size={23} /></div>
          <div><div className="eyebrow">06 — A NOTE ON WHAT THIS IS</div><h2>An instrument.<br />Not a truth machine.</h2></div>
          <div className="transparency-copy"><p>VoxSure uses Sarvam’s speech-to-text API only when you configure a server-side API key. A demo fixture is explicitly sample text, not audio inference. Numeric flags are pattern matches, not proof. WER and CER need a human reference.</p><p>Provider confidence is language-level only when supplied; it is not confidence in individual words. VoxSure is not affiliated with or endorsed by Sarvam AI.</p><Link className="text-link" to="/workspace/docs">Read the product documentation <ArrowRight size={14} /></Link></div>
        </section>

        <section className="final-cta"><div className="eyebrow">THE INSTRUMENT IS READY</div><h2>Let’s look a little<br /><span>closer.</span></h2><Link className="button button-lime" to="/workspace">Open the workspace <ArrowRight size={16} /></Link><Waveform dark /></section>
      </main>

      <footer className="public-footer"><div><Wordmark /><p>Voice intelligence. Built for accuracy.</p></div><div className="footer-links"><Link to="/workspace">Workspace</Link><Link to="/workspace/docs">Documentation</Link><Link to="/privacy">Privacy</Link>{REPOSITORY_URL && <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">Source repository ↗</a>}<span>Not affiliated with Sarvam AI</span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} VOXSURE · AN INDEPENDENT PROJECT</span><span>NO BENCHMARK RESULTS PUBLISHED</span></div></footer>
    </div>
  );
}

const sidebarItems = [
  { label: "Overview", to: "/workspace", icon: Home, end: true },
  { label: "History", to: "/workspace/history", icon: Clock3 },
  { label: "Evaluation lab", to: "/workspace/evaluation", icon: FlaskConical },
];
const resourceItems = [
  { label: "Documentation", to: "/workspace/docs", icon: BookOpen },
  { label: "Settings", to: "/workspace/settings", icon: Settings },
];

function WorkspaceShell() {
  const state = useProduct();
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();
  const providerState = state.provider?.provider;
  const modeText = state.provider
    ? state.provider.provider.mode === "demo"
      ? "Demo mode"
      : state.provider.provider.available
        ? "Live provider"
        : "Provider unavailable"
    : "Checking API";
  const modeClass = state.provider?.provider.mode === "demo" ? "mode-demo" : state.provider?.provider.available ? "mode-live" : "mode-offline";

  return (
    <div className="app-shell">
      <aside className={`sidebar${navOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-logo"><Wordmark inverse /><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={18} /></button></div>
        <div className="sidebar-workspace"><span className="workspace-avatar">V</span><span><b>My workspace</b><small>Personal · Local only</small></span><ChevronDown size={14} /></div>
        <button className="button button-lime sidebar-new" onClick={() => { navigate("/workspace"); setNavOpen(false); }}><Plus size={16} /> New analysis <span>↵</span></button>
        <div className="sidebar-group-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">{sidebarItems.map(({ label, to, icon: Icon, end }) => <NavLink end={end} key={to} to={to} onClick={() => setNavOpen(false)}><Icon size={16} /><span>{label}</span>{label === "History" && state.history.length > 0 && <small>{state.history.length}</small>}</NavLink>)}</nav>
        <div className="sidebar-group-label sidebar-resources-label">RESOURCES</div>
        <nav className="sidebar-nav" aria-label="Resources navigation">{resourceItems.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setNavOpen(false)}><Icon size={16} /><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-spacer" />
        <div className={`provider-status ${modeClass}`}><span className="provider-dot" /><div><b>{modeText}</b><small>{providerState?.available ? providerState.provider ?? "Sample provider" : "API · /api/health"}</small></div><CircleHelp size={15} aria-label="Provider status is read from the API health endpoint" /></div>
        <div className="sidebar-privacy"><LockKeyhole size={12} /> Audio is not stored by default</div>
      </aside>
      {navOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
      <main className="workspace-main">
        <header className="workspace-topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={19} /></button><div className="breadcrumb"><span>VOXSURE</span><ChevronRight size={12} /><strong>{getPageName(window.location.pathname)}</strong></div><div className={`topbar-mode ${modeClass}`}><span className="provider-dot" />{modeText}</div><a className="topbar-help" href="/workspace/docs"><CircleHelp size={16} /><span>Help</span></a></header>
        <div className="workspace-content"><Outlet context={state} /></div>
        <footer className="workspace-footer"><span>VOXSURE · VOICE INTELLIGENCE, BUILT FOR ACCURACY.</span><span><Link to="/privacy">PRIVACY</Link>&nbsp; · &nbsp;NOT AFFILIATED WITH SARVAM AI</span></footer>
      </main>
    </div>
  );
}

function getPageName(path: string) {
  if (path.endsWith("evaluation")) return "EVALUATION LAB";
  if (path.endsWith("history")) return "HISTORY";
  if (path.endsWith("docs")) return "DOCUMENTATION";
  if (path.endsWith("settings")) return "SETTINGS";
  return "NEW ANALYSIS";
}

function PageTitle({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}

function AnalysisPage() {
  const { provider, modeError, current, remember, forget } = useProduct();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("unknown");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [correction, setCorrection] = useState("");
  const [editing, setEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputId = useId();

  useEffect(() => {
    if (!file) { setAudioUrl(""); return; }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const setValidatedFile = (candidate?: File) => {
    setNotice("");
    if (!candidate) return;
    if (!ACCEPTED_EXTENSIONS.test(candidate.name)) {
      setNotice("That file type is not supported. Choose WAV, MP3, M4A, WebM, FLAC, OGG, AAC, AMR, AIFF, or WMA.");
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setNotice("This file exceeds the 25 MB upload limit.");
      return;
    }
    if (!candidate.size) {
      setNotice("This audio file is empty. Choose a file containing audio.");
      return;
    }
    setFile(candidate);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => setValidatedFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    setValidatedFile(event.dataTransfer.files[0]);
  };

  const loadSample = async () => {
    setBusy(true);
    setNotice("");
    try {
      const sample = await getSample();
      remember(sample);
      setCorrection("");
      setEditing(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the demo sample.");
    } finally { setBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) { setNotice("Choose an audio file before starting an analysis."); return; }
    setBusy(true);
    setNotice("");
    try {
      const result = await transcribeAudio(file, language, context);
      remember(result);
      setCorrection("");
      setEditing(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The audio could not be analyzed.");
    } finally { setBusy(false); }
  };

  const statusText = provider?.provider.mode === "demo"
    ? "Demo mode · audio is not transcribed"
    : provider?.provider.available
      ? "Live provider · real inference"
      : modeError ?? provider?.provider.reason ?? "Provider configuration needed";

  const copyTranscript = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.transcript);
      setNotice("Original model output copied to the clipboard.");
    } catch { setNotice("Clipboard access is unavailable in this browser."); }
  };
  const download = (extension: "txt" | "json") => {
    if (!current) return;
    const payload = extension === "txt"
      ? current.transcript
      : JSON.stringify({ ...current, user_approved_correction: correction || null }, null, 2);
    const blob = new Blob([payload], { type: extension === "txt" ? "text/plain;charset=utf-8" : "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(current.filename)}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Transcript ${extension.toUpperCase()} export downloaded.`);
  };

  const removeResult = () => {
    if (!current) return;
    forget(current.id);
    setCorrection("");
    setNotice("The analysis was removed from this browser’s local history.");
  };

  const updateFinding = (target: Finding, status: Finding["status"]) => {
    if (!current) return;
    remember({ ...current, analysis: current.analysis.map((item) => item === target ? { ...item, status } : item) });
  };

  return (
    <div className="analysis-layout">
      <div className="analysis-main-column">
        <PageTitle eyebrow="SPEECH / 01 · NEW ANALYSIS" title="Start with the signal." description="Submit an audio clip or inspect the clearly labelled sample transcript. No raw audio is retained.">
          <span className={`status-chip ${provider?.provider.available ? "chip-ready" : provider?.provider.mode === "demo" ? "chip-demo" : "chip-neutral"}`}><span />{statusText}</span>
        </PageTitle>

        <form className="analysis-form" onSubmit={(event) => void submit(event)}>
          <section className="instrument-panel upload-panel">
            <div className="panel-heading"><span className="panel-index">01</span><div><h2>Audio source</h2><p>WAV, MP3, M4A, WebM, FLAC, OGG, AAC, AMR, AIFF, WMA · max 25 MB</p></div><span className="required-label">OPTIONAL FOR DEMO SAMPLE</span></div>
            {file ? (
              <div className="file-selected"><span className="file-icon"><FileAudio size={19} /></span><div className="file-details"><b>{file.name}</b><small>{formatBytes(file.size)} · {file.type || "audio format"}{provider?.provider.mode === "demo" ? " · Demo mode will not process this audio" : ""}</small></div><audio controls src={audioUrl} aria-label="Audio file preview" /><button className="icon-button" type="button" aria-label="Remove selected audio" onClick={() => setFile(null)}><X size={17} /></button></div>
            ) : (
              <div className={`drop-zone${dragging ? " drop-zone-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                <input id={fileInputId} type="file" accept=".wav,.mp3,.m4a,.mp4,.webm,.flac,.ogg,.opus,.aac,.amr,.aiff,.wma,audio/*" onChange={onFileChange} />
                <label htmlFor={fileInputId}><span className="upload-icon"><Upload size={19} /></span><b>Drop audio here, or <span>choose a file</span></b><small>Your clip stays in memory during processing, then is discarded.</small></label>
              </div>
            )}
            {busy && file && <div className="upload-progress" role="progressbar" aria-label="Uploading audio and waiting for the speech provider" aria-valuetext="Upload and transcription request in progress"><span /></div>}
            <div className="form-pair"><label>Language / recognition<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="unknown">Auto / code-mixed</option><option value="hi-IN">Hindi</option><option value="bn-IN">Bengali</option><option value="kn-IN">Kannada</option><option value="ml-IN">Malayalam</option><option value="mr-IN">Marathi</option><option value="od-IN">Odia</option><option value="pa-IN">Punjabi</option><option value="ta-IN">Tamil</option><option value="te-IN">Telugu</option><option value="en-IN">English</option><option value="gu-IN">Gujarati</option><option value="as-IN">Assamese</option><option value="ur-IN">Urdu</option><option value="ne-IN">Nepali</option></select><small>Language selection is sent to the configured provider. Auto-detect is used by default.</small></label>
              <label>Glossary / key terms <textarea placeholder={"One term per line · e.g.\nNew Delhi\nSupportDesk"} value={context} onChange={(event) => setContext(event.target.value)} rows={2} /><small>{provider?.provider.mode === "demo" ? "Ignored by the demo. Sarvam saaras:v4 can use up to 50 glossary terms (64 characters each)." : "Optional; sent only when the configured Sarvam saaras:v4 provider accepts keyterms."}</small></label></div>
            {notice && <p className="inline-notice error-notice" role="alert"><Info size={15} />{notice}</p>}
            <div className="form-actions"><button className="button button-dark" type="submit" disabled={busy || !file}>{busy && file ? <LoaderCircle className="spin" size={16} /> : <AudioLines size={16} />}{busy && file ? "Sending request…" : "Analyze audio"}<ArrowRight size={15} /></button><span>Provider calls are made only when you press the button.</span></div>
          </section>
        </form>

        <div className="demo-divider"><span /> OR EXPLORE A PRESET <span /></div>
        <section className="sample-card"><div className="sample-icon"><Sparkles size={18} /></div><div><b>Try the demo sample</b><p>A small, curated text fixture with obvious date, time and ID patterns. No audio is uploaded or inferred.</p></div><button className="button button-outline" disabled={busy} onClick={() => void loadSample()}>{busy && !file ? <LoaderCircle className="spin" size={15} /> : "Load sample"}<ArrowRight size={14} /></button></section>

        <div className="analysis-section-heading"><div><span className="section-number">02</span><div><h2>Transcript &amp; evidence</h2><p>Original output and heuristic review are kept distinct.</p></div></div>{current && <button className="button button-quiet" onClick={removeResult}><Trash2 size={14} /> Delete</button>}</div>

        {current ? (
          <section className="result-panel">
            <div className="result-topline"><div className="result-file"><FileCheck2 size={16} /><b>{current.filename}</b>{current.label && <span className="sample-pill">{current.label.split(" — ")[0]}</span>}</div><div className="result-state"><span className="provider-dot" />{current.source === "live_provider" ? "LIVE RESULT" : "SAMPLE TEXT"}</div></div>
            <div className="result-metadata"><span><Languages size={13} />{current.language_setting}</span><span><Clock3 size={13} />{formatDate(current.created_at)}</span><span><Zap size={13} />{current.provider} · {current.model}</span>{current.duration_seconds !== null && <span>{formatDuration(current.duration_seconds)}</span>}</div>
            {current.label && <div className="sample-banner"><Info size={15} />{current.label}.</div>}
            <div className="result-section-label">MODEL OUTPUT <span>IMMUTABLE ORIGINAL</span></div>
            <div className="transcript-output">{current.transcript ? renderHighlightedTranscript(current.transcript, current.analysis) : <em>The provider returned an empty transcript. This is a valid result; no fallback text was inserted.</em>}</div>
            {current.segments?.length ? <div className="segments"><b>PROVIDER CHUNK TIMESTAMPS</b>{current.segments.map((segment, index) => <span key={`${index}-${segment.start}`}>{formatDuration(segment.start)}–{formatDuration(segment.end)} &nbsp;{segment.text}</span>)}<small>These are phrase-level segments, not word alignment.</small></div> : null}
            {current.confidence !== null && <p className="confidence-note">Provider language-detection confidence: {(current.confidence * 100).toFixed(1)}% · not per-word confidence.</p>}
            {current.confidence === null && <p className="confidence-note">Word-level confidence and alignment were not provided.</p>}
            <div className="result-actions"><button onClick={() => void copyTranscript()}><Copy size={14} /> Copy original</button><button onClick={() => download("txt")}><Download size={14} /> Download .txt</button><button onClick={() => download("json")}><FileJson2 size={14} /> Export JSON</button><button onClick={() => setShowDetails((value) => !value)}><Info size={14} /> Run details</button></div>
            {showDetails && <div className="run-details"><div><span>Run ID</span><code>{current.id}</code></div><div><span>Provider request</span><code>{current.provider_request_id ?? "Not supplied"}</code></div><div><span>Raw audio</span><code>Not retained by VoxSure</code></div></div>}

            <div className="critical-heading"><div><h3>Critical information</h3><p>Pattern-matched spans only — never an automatic correction.</p></div><span>{current.analysis.filter((item) => item.status === "needs_review").length} TO REVIEW</span></div>
            {current.analysis.length ? <div className="critical-list">{current.analysis.map((finding, index) => <FindingRow key={`${finding.kind}-${finding.value}-${index}`} finding={finding} onUpdate={(status) => updateFinding(finding, status)} />)}</div> : <div className="empty-findings"><CheckCircle2 size={16} />No numeric patterns were matched. This does not confirm the rest of the transcript.</div>}

            <div className="correction-area"><div className="correction-heading"><div><h3>User-approved correction</h3><p>VoxSure never rewrites model output. Add your own version here.</p></div><button className="text-button" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : correction ? "Edit correction" : "Add correction"}</button></div>
              {editing && <label className="correction-input">Correction<textarea value={correction} onChange={(event) => setCorrection(event.target.value)} rows={3} placeholder="Enter your corrected transcript. This is your edit, not an AI suggestion." /><button className="button button-outline" onClick={() => setEditing(false)}>Keep correction</button></label>}
              {correction && !editing && <div className="diff-view"><div><span>MODEL OUTPUT</span><p>{current.transcript}</p></div><ArrowRight size={15} /><div><span>USER-APPROVED CORRECTION</span><p>{correction}</p></div></div>}
            </div>
          </section>
        ) : (
          <div className="empty-result"><span className="empty-symbol"><Volume2 size={22} /></span><div><b>No transcript to inspect yet</b><p>Use a live configured provider with a clip, or load the clearly labelled sample above.</p></div><span className="empty-stamp">AWAITING<br />INPUT</span></div>
        )}
      </div>
      <aside className="analysis-aside"><div className="aside-heading"><span>READOUT / 01</span><MoreHorizontal size={17} /></div><div className="aside-card"><div className="aside-icon"><BadgeCheck size={17} /></div><h3>Evidence first.</h3><p>A pattern flag is not an error diagnosis. Always check the audio and keep the original model output intact.</p><Link to="/workspace/docs">How checks work <ArrowRight size={13} /></Link></div><div className="aside-card aside-privacy"><LockKeyhole size={16} /><b>Audio handling</b><p>Uploaded audio is held in server memory for one request only. No raw audio or transcript is written to a database.</p></div><div className="aside-tip"><span>BEFORE YOU BEGIN</span><p>Public deployments should use HTTPS. Configure only origins you control.</p><Link to="/privacy">Read privacy notes <ArrowRight size={13} /></Link></div><div className="aside-footer">NO WORD-LEVEL CONFIDENCE<br />UNLESS YOUR PROVIDER SAYS SO.</div></aside>
    </div>
  );
}

function FindingRow({ finding, onUpdate }: { finding: Finding; onUpdate: (status: Finding["status"]) => void }) {
  const [open, setOpen] = useState(false);
  const label = finding.kind.replaceAll("_", " ");
  return (
    <div className={`finding-row${finding.status !== "needs_review" ? " finding-resolved" : ""}`}>
      <span className="finding-kind">{finding.kind === "time" ? "◷" : finding.kind === "identifier" ? "ID" : finding.kind === "amount" ? "₹" : "#"}</span>
      <div className="finding-content"><b>{finding.value}</b><span>{label} pattern</span>{open && <small>{finding.basis}</small>}</div>
      <button className="finding-details" aria-label={`${open ? "Hide" : "Show"} basis for ${finding.value}`} onClick={() => setOpen((value) => !value)}><Info size={14} /></button>
      {finding.status === "needs_review" ? <><button className="finding-review" onClick={() => onUpdate("reviewed")}><Check size={13} /> Reviewed</button><button className="finding-dismiss" aria-label={`Dismiss ${finding.value}`} onClick={() => onUpdate("dismissed")}><X size={15} /></button></> : <button className="finding-undo" onClick={() => onUpdate("needs_review")}>{finding.status === "dismissed" ? "Dismissed · Undo" : "Reviewed · Undo"}</button>}
    </div>
  );
}

function renderHighlightedTranscript(transcript: string, findings: Finding[]) {
  const spans = findings
    .map((finding) => ({ value: finding.value, index: transcript.indexOf(finding.value) }))
    .filter((span) => span.index >= 0)
    .sort((left, right) => left.index - right.index);
  if (!spans.length) return transcript;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const [index, span] of spans.entries()) {
    if (span.index < cursor) continue;
    nodes.push(transcript.slice(cursor, span.index));
    nodes.push(<mark key={`${span.index}-${index}`}>{span.value}</mark>);
    cursor = span.index + span.value.length;
  }
  nodes.push(transcript.slice(cursor));
  return nodes;
}

function EvaluationPage() {
  const { current } = useProduct();
  const [reference, setReference] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [lowercase, setLowercase] = useState(false);
  const [stripPunctuation, setStripPunctuation] = useState(false);
  const [normalizeWhitespace, setNormalizeWhitespace] = useState(true);
  const [normalizeNumbers, setNormalizeNumbers] = useState(false);
  const [referenceEntities, setReferenceEntities] = useState("");
  const [hypothesisEntities, setHypothesisEntities] = useState("");
  const [referenceNumbers, setReferenceNumbers] = useState("");
  const [hypothesisNumbers, setHypothesisNumbers] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const splitList = (value: string) => value.split(/\n|,/).map((part) => part.trim()).filter(Boolean);
  const compare = async (event: FormEvent) => {
    event.preventDefault();
    if (!reference.trim() && !hypothesis.trim()) { setNotice("Enter a reference and hypothesis, or choose the sample pair."); return; }
    setBusy(true); setNotice("");
    try {
      setResult(await evaluateTranscripts(
        reference, hypothesis,
        { lowercase, strip_punctuation: stripPunctuation, normalize_whitespace: normalizeWhitespace, normalize_numbers: normalizeNumbers },
        splitList(referenceEntities), splitList(hypothesisEntities),
        splitList(referenceNumbers), splitList(hypothesisNumbers),
      ));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Evaluation could not be calculated."); }
    finally { setBusy(false); }
  };

  const useSamplePair = () => {
    const ref = "Namaskara, my appointment is on 14/08/2026 at 10:30. Please bring reference ID KA-4821.";
    const hyp = "Namaskara, my appointment is on 14/08/2026 at 10:00. Please bring reference ID KA-4821.";
    setReference(ref); setHypothesis(hyp); setResult(null);
    setNotice("Sample pair loaded. Its comparison is illustrative input, not a measured benchmark result.");
  };
  const useCurrentTranscript = () => {
    if (!current) return;
    setHypothesis(current.transcript);
    setNotice("Current transcript loaded as hypothesis. Add a human-verified reference before running a comparison.");
  };
  const downloadResult = (format: "json" | "csv") => {
    if (!result) return;
    const content = format === "json"
      ? JSON.stringify({ result, reference, hypothesis }, null, 2)
      : ["metric,value", `WER,${result.word.wer ?? "undefined (empty reference)"}`, `CER,${result.character.cer ?? "undefined (empty reference)"}`, `substitutions,${result.word.substitutions}`, `deletions,${result.word.deletions}`, `insertions,${result.word.insertions}`, `entity_exact_match,${result.entities?.exact_match ?? "not annotated"}`, `number_exact_match,${result.numbers?.exact_match ?? "not annotated"}`].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json" : "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = `voxsure-evaluation.${format}`; link.click(); URL.revokeObjectURL(url);
    setNotice(`Evaluation ${format.toUpperCase()} export downloaded.`);
  };

  return (
    <div className="page-column evaluation-page">
      <PageTitle eyebrow="EVALUATION / 02 · REPRODUCIBLE METRICS" title="Compare with a reference." description="Edit distance is calculated from your exact text. No external model, benchmark, or invented metric is involved." />
      <form className="instrument-panel eval-form" onSubmit={(event) => void compare(event)}>
        <div className="panel-heading"><span className="panel-index">01</span><div><h2>Text pair</h2><p>A trusted, human-reviewed reference is required for meaningful error rates.</p></div><button type="button" className="button button-quiet" onClick={useSamplePair}><RefreshCcw size={14} /> Use sample pair</button></div>
        <div className="eval-textareas"><label>REFERENCE <span>GROUND TRUTH</span><textarea required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Paste the human-verified reference transcript…" rows={6} /></label><label>HYPOTHESIS <span>MODEL OUTPUT</span><textarea required value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} placeholder="Paste the speech-to-text hypothesis…" rows={6} /></label></div>
        {current && <button className="text-button current-hypothesis" type="button" onClick={useCurrentTranscript}><FileAudio size={14} /> Use current analysis as hypothesis: {current.filename}</button>}
        <div className="normalization-options"><div><b>Normalization</b><small>Meaningful differences are preserved by default.</small></div>{[
          { label: "Collapse whitespace", checked: normalizeWhitespace, setChecked: setNormalizeWhitespace },
          { label: "Lowercase", checked: lowercase, setChecked: setLowercase },
          { label: "Strip punctuation", checked: stripPunctuation, setChecked: setStripPunctuation },
          { label: "Normalize leading zeros", checked: normalizeNumbers, setChecked: setNormalizeNumbers },
        ].map(({ label, checked, setChecked }) => <label key={label} className="check-option"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />{label}</label>)}</div>
        <details className="annotation-details"><summary>Optional critical-detail annotations <span>Only scored when both lists are supplied</span></summary><div className="annotation-grid"><label>REFERENCE ENTITIES <textarea rows={2} placeholder="One entity per line or comma-separated" value={referenceEntities} onChange={(event) => setReferenceEntities(event.target.value)} /></label><label>HYPOTHESIS ENTITIES <textarea rows={2} placeholder="Matching entity annotations" value={hypothesisEntities} onChange={(event) => setHypothesisEntities(event.target.value)} /></label><label>REFERENCE NUMBERS <textarea rows={2} placeholder="e.g. 14/08/2026, KA-4821" value={referenceNumbers} onChange={(event) => setReferenceNumbers(event.target.value)} /></label><label>HYPOTHESIS NUMBERS <textarea rows={2} placeholder="Matching number annotations" value={hypothesisNumbers} onChange={(event) => setHypothesisNumbers(event.target.value)} /></label></div></details>
        {notice && <p className="inline-notice"><Info size={15} />{notice}</p>}
        <div className="form-actions"><button type="submit" className="button button-dark" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <BarChart3 size={16} />}{busy ? "Calculating…" : "Calculate evaluation"}<ArrowRight size={15} /></button><small>Calculation runs via the VoxSure API · your text is not retained.</small></div>
      </form>
      {result ? <EvaluationResults result={result} onExport={downloadResult} /> : <div className="empty-result eval-empty"><span className="empty-symbol"><FlaskConical size={22} /></span><div><b>Awaiting a text pair</b><p>Load the sample pair or add a reference and a hypothesis to calculate WER and CER.</p></div><span className="empty-stamp">WER<br />CER</span></div>}
      <section className="metric-caveats"><h3>How to read these numbers</h3><div><p><b>WER</b> = (substitutions + deletions + insertions) ÷ reference word count. It can exceed 100% when insertions are numerous.</p><p><b>CER</b> uses Unicode code points in the normalized strings, including spaces when retained. It is not grapheme-cluster aware.</p><p>An empty reference has an <b>undefined rate</b>, shown as “—”; counts and alignment remain available. Exact-match annotation scores are multiset recall with precision shown separately.</p></div></section>
    </div>
  );
}

function EvaluationResults({ result, onExport }: { result: EvaluationResult; onExport: (format: "json" | "csv") => void }) {
  return (
    <section className="results-panel" aria-live="polite">
      <div className="results-title"><div><div className="eyebrow">02 — CALCULATED FROM YOUR TEXT</div><h2>Comparison results</h2></div><div className="export-actions"><button onClick={() => onExport("csv")}><Download size={14} /> CSV</button><button onClick={() => onExport("json")}><FileJson2 size={14} /> JSON</button></div></div>
      <div className="result-metric-grid"><Metric label="WER" detail="Word error rate" value={formatRate(result.word.wer)} /><Metric label="CER" detail="Character error rate" value={formatRate(result.character.cer)} /><Metric label="S / D / I" detail="Sub · del · insert" value={`${result.word.substitutions} / ${result.word.deletions} / ${result.word.insertions}`} compact /><Metric label="REFERENCE" detail="Tokenized words" value={String(result.word.reference_count)} compact /></div>
      {(result.entities || result.numbers) && <div className="annotation-scores">{result.entities && <div><span>ENTITY EXACT-MATCH RECALL</span><b>{formatRate(result.entities.exact_match)}</b><small>Precision {formatRate(result.entities.precision)} · {result.entities.matches}/{result.entities.reference_count} reference entities matched</small></div>}{result.numbers && <div><span>NUMBER EXACT-MATCH RECALL</span><b>{formatRate(result.numbers.exact_match)}</b><small>Precision {formatRate(result.numbers.precision)} · {result.numbers.matches}/{result.numbers.reference_count} reference numbers matched</small></div>}</div>}
      <div className="alignment-title"><h3>Word alignment</h3><span>{result.alignment.filter((item) => item.operation !== "equal").length} EDITS · SEQUENCE ALIGNMENT</span></div>
      <div className="alignment-grid"><div className="alignment-head"><span>REFERENCE</span><span>OPERATION</span><span>HYPOTHESIS</span></div>{result.alignment.length ? result.alignment.map((item, index) => <div className={`alignment-row alignment-${item.operation}`} key={`${index}-${item.reference}-${item.hypothesis}`}><span>{item.reference ?? "∅"}</span><span>{item.operation === "equal" ? "match" : item.operation}</span><span>{item.hypothesis ?? "∅"}</span></div>) : <div className="alignment-row"><span>Empty</span><span>match</span><span>Empty</span></div>}</div>
      <p className="results-provenance"><Info size={14} />WER and CER are computed from the exact texts and normalization options above. This result is not a benchmark, accuracy claim, or model assessment beyond this pair.</p>
    </section>
  );
}

function Metric({ label, detail, value, compact = false }: { label: string; detail: string; value: string; compact?: boolean }) {
  return <div className={`metric-readout${compact ? " metric-compact" : ""}`}><span>{label}</span><small>{detail}</small><strong>{value}</strong></div>;
}

function HistoryPage() {
  const { history, openResult, forget } = useProduct();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();
  const visible = history.filter((item) => `${item.filename} ${item.provider} ${item.language_setting}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || item.source === filter));
  return <div className="page-column"><PageTitle eyebrow="WORKSPACE / 03 · LOCAL HISTORY" title="A record of your runs." description="Only session metadata is saved in this browser. Transcripts stay in memory and are cleared when the tab closes." /><div className="history-tools"><label className="search-input"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search runs…" /></label><label className="filter-select"><span className="sr-only">Filter history by source</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All runs</option><option value="live_provider">Live provider</option><option value="sample_fixture">Demo samples</option><option value="demo_sample">Demo uploads</option></select></label><span>{visible.length} RUN{visible.length === 1 ? "" : "S"}</span></div>
    {visible.length ? <div className="history-table"><div className="history-row history-head"><span>ANALYSIS</span><span>PROVIDER</span><span>LANGUAGE</span><span>DATE</span><span>STATUS</span><span className="sr-only">Actions</span></div>{visible.map((item) => <div className="history-row" key={item.id}><button className="history-file" onClick={() => { openResult(item); navigate("/workspace"); }}><FileAudio size={16} /><span><b>{item.filename}</b><small>{item.id.slice(0, 16)}</small></span><ArrowUpRight size={14} /></button><span>{item.provider}</span><span>{item.language_setting}</span><span>{formatDate(item.created_at)}</span><span className={`history-status ${item.source === "live_provider" ? "history-live" : ""}`}><span />{item.source === "live_provider" ? "LIVE" : "SAMPLE"}</span><button className="icon-button" aria-label={`Delete ${item.filename} from local history`} onClick={() => forget(item.id)}><Trash2 size={14} /></button></div>)}</div> : <div className="empty-result"><span className="empty-symbol"><Clock3 size={22} /></span><div><b>{search || filter !== "all" ? "No matching runs" : "No runs in this browser yet"}</b><p>{search || filter !== "all" ? "Try a different search or filter." : "Your analysis metadata appears here after your first run. Transcripts are not persisted."}</p></div><Link className="button button-outline" to="/workspace">New analysis <ArrowRight size={14} /></Link></div>}
    <div className="history-note"><LockKeyhole size={15} /><p><b>Local browser history</b><br />No sign-in, sync, encryption claim, or backup. This list contains filenames, timestamps, provider, and language only. Full transcripts remain in memory for the current browser session and cannot be reopened after it closes.</p></div></div>;
}

function DocsPage() {
  const topics = [
    ["Getting started", "Run `pip install -r backend/requirements.txt` and `npm install`. Start the API with `uvicorn backend.main:app --reload`; in another terminal run `npm run dev`. Open http://localhost:5173. Demo mode is the default and needs no provider credential."],
    ["Audio formats & limits", "The API accepts WAV, MP3, M4A/MP4, WebM, FLAC, OGG/Opus, AAC, AMR, AIFF and WMA files up to 25 MB. The server checks an extension, audio media type and file signature, then keeps bytes in memory for the request only. Provider support may be narrower."],
    ["Demo & live providers", "Demo mode returns an explicitly curated sample string even when you upload a file; it never processes that audio. Live mode sends a real request to Sarvam when `VOXSURE_PROVIDER=sarvam` and `SARVAM_API_KEY` is set on the server. Keys are never exposed to the browser. The glossary uses documented `saaras:v4` keyterms and is ignored in the demo."],
    ["WER, CER & annotations", "WER = (S + D + I) / reference words. CER uses Unicode code points of normalized text, spaces included when retained. Default normalization collapses whitespace only; case, punctuation and leading-zero normalization are opt-in. Empty reference rates are undefined. Entity and number exact-match use supplied annotated lists only, reporting multiset recall and precision."],
    ["Pattern review", "Built-in patterns identify common amounts, numeric date/time formats, numeric identifiers and standalone numbers. Each flag shows its rule basis and remains a needs-review prompt. This is not an entity recognizer, a speech-audio comparison, or a correction. You may dismiss or mark the individual result reviewed."],
    ["Privacy & retention", "The API stores no uploaded audio and performs no database writes. Browser history saves metadata only in `localStorage` (filename, provider, language, time and status). Full transcript results exist in browser memory until the tab is closed. Provider live requests send the supplied audio and keyterms to Sarvam; review that provider’s terms before use. Use HTTPS for public deployments."],
    ["Limitations", "No model confidence is synthesized. Sarvam language-probability is a language-level signal, not confidence in words. The REST API supplies phrase-level timestamps rather than word alignment. Heuristic numeric checks can miss or misclassify spoken numbers. No public VoxSure benchmark has been run or reported."],
    ["Reproduce & contribute", "Evaluation uses deterministic dynamic-programming edit alignment. Backend tests cover normalization, insertions/deletions/substitutions, annotation scoring, upload validation and demo-provider labeling. Run `python -m pytest` from the repository root, and `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. No restricted benchmark or model is downloaded by tests."],
    ["Troubleshooting", "A browser API connection error means the FastAPI server is unavailable or the Vite proxy target needs `VITE_API_PROXY_TARGET`. A 503 in demo mode may indicate the API itself is offline; in Sarvam mode check the server-side credential and quota. CORS should list the exact public frontend origin in `VOXSURE_ALLOWED_ORIGINS`."],
  ];
  return <div className="page-column"><PageTitle eyebrow="REFERENCE / 04 · PRODUCT DOCUMENTATION" title="A small user guide." description="How providers, metrics, and local data work—without hiding the caveats." /><div className="docs-notice"><Info size={16} /><p><b>Honest by design.</b> VoxSure separates model output, deterministic analysis and user-approved edits. A demo sample is not a transcription.</p></div><div className="docs-layout"><nav className="docs-toc" aria-label="Documentation sections">{topics.map(([title], index) => <a key={title} href={`#guide-${index}`}>{title}</a>)}</nav><div className="docs-articles">{topics.map(([title, body], index) => <article id={`guide-${index}`} key={title}><span>{String(index + 1).padStart(2, "0")} / NOTES</span><h2>{title}</h2><p>{body}</p></article>)}</div></div></div>;
}

function SettingsPage() {
  const { provider, modeError } = useProduct();
  const status = provider?.provider;
  return <div className="page-column"><PageTitle eyebrow="PREFERENCES / 05 · CONFIGURATION" title="Know what’s connected." description="Provider configuration lives on your server—not in browser settings or a public bundle." />
    <section className="setting-card"><div className="setting-head"><span className="setting-icon"><AudioLines size={18} /></span><div><h2>Speech provider</h2><p>Server-side connection status read from the API.</p></div><span className={`status-chip ${status?.available ? "chip-ready" : status?.mode === "demo" ? "chip-demo" : "chip-neutral"}`}><span />{status?.mode === "demo" ? "Demo mode" : status?.available ? "Connected" : "Not configured"}</span></div><div className="setting-table"><div><span>Provider</span><b>{status?.mode === "demo" ? "VoxSure demo" : status?.provider ?? "Not available"}</b></div><div><span>Model</span><b>{status?.model ?? "—"}</b></div><div><span>Credential</span><b>Server environment only</b></div><div><span>Status detail</span><b>{status?.reason ?? (modeError || (status?.available ? "Ready for a genuine provider request." : "The API status is loading."))}</b></div></div></section>
    <section className="setting-card"><div className="setting-head"><span className="setting-icon setting-icon-cyan"><Database size={18} /></span><div><h2>Data retention</h2><p>No persisted database or server-side audio storage is configured.</p></div></div><div className="setting-table"><div><span>Audio</span><b>In-memory request handling; not saved by default</b></div><div><span>Transcript</span><b>In browser memory; cleared when the tab closes</b></div><div><span>History</span><b>Metadata only in this browser’s local storage</b></div><div><span>Delete</span><b>Remove a run from the History page</b></div></div><Link className="text-link setting-link" to="/privacy">Read the complete privacy statement <ArrowRight size={14} /></Link></section>
    <section className="setting-card"><div className="setting-head"><span className="setting-icon"><Settings size={18} /></span><div><h2>Build information</h2><p>Configuration notes for the person operating this instance.</p></div></div><div className="setting-table"><div><span>VoxSure version</span><b>0.1.0 · research pilot</b></div><div><span>Upload limit</span><b>25 MB maximum</b></div><div><span>Source repository</span><b>{REPOSITORY_URL ? <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">Open configured repository ↗</a> : "Not configured"}</b></div><div><span>Live key</span><b>Configure `SARVAM_API_KEY` server-side only</b></div></div></section>
    <div className="settings-caution"><Shield size={16} /><p>Never commit `.env` files or set provider keys in `VITE_`/`NEXT_PUBLIC_` browser variables. Public instances should use HTTPS and a narrowly scoped CORS allowlist.</p></div></div>;
}

function PrivacyPage() {
  return <div className="standalone-page"><header className="standalone-header"><Wordmark /><Link className="button button-outline" to="/workspace">Back to workspace <ArrowLeft size={14} /></Link></header><main><div className="eyebrow">VOXSURE / DATA HANDLING</div><h1>Privacy, in plain language.</h1><p className="standalone-lead">Audio and transcripts can be sensitive. This pilot is designed not to keep your audio, but you should understand each hop.</p><div className="privacy-sections">{[
    ["Audio never defaults to disk.", "FastAPI reads a bounded request into memory and passes it to the configured provider. VoxSure writes no uploaded audio file and has no database. The hosting platform and speech provider may have their own operational logs and data terms."],
    ["Demo means a fixture, not inference.", "With the default demo provider, any uploaded audio is explicitly ignored and a fixed curated text sample is returned. For privacy, do not upload sensitive audio in demo mode; no transcription is happening."],
    ["Live mode sends audio to Sarvam.", "When configured, the server sends your chosen audio, filename, language choice, and optional glossary to api.sarvam.ai. Use the provider only after reviewing its current privacy, retention and terms."],
    ["History is local metadata only.", "This browser stores filenames, provider, language, timestamps and status in localStorage. Transcript text is held only in JavaScript memory and does not persist after the browser tab/session closes. Local storage is neither encrypted nor backed up."],
    ["Deployment operators are responsible.", "Use HTTPS, configure the exact allowed browser origins, set upload limits, protect the API from abuse and provide a public privacy notice. The starter deployment does not include authentication or rate limiting, so do not expose sensitive, unrestricted usage."],
  ].map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}</div></main><footer>VOXSURE · INDEPENDENT PROJECT · NOT AFFILIATED WITH SARVAM AI</footer></div>;
}

function NotFound() {
  return <div className="not-found"><Wordmark /><div className="eyebrow">404 / OFF THE SIGNAL</div><h1>Nothing to hear here.</h1><p>This page isn’t part of VoxSure yet.</p><Link className="button button-dark" to="/">Return to the beginning <ArrowRight size={15} /></Link></div>;
}

function safeFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || "transcript";
}
function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function formatRate(rate: number | null) {
  return rate === null ? "—" : `${(rate * 100).toFixed(2)}%`;
}

export default App;
