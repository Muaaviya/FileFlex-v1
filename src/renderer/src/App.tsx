import { useEffect } from "react";
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { formatDate } from "../../shared/format";
import {
  ChartIcon,
  CheckSquareIcon,
  ClockIcon,
  FolderIcon,
  ListIcon,
  ShieldIcon,
  SlidersIcon,
  TagIcon,
} from "./components/icons";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ErrorBoundary, Toasts } from "./components/ui";
import HistoryPage from "./pages/HistoryPage";
import ReviewApprove from "./pages/ReviewApprove";
import RulesPage from "./pages/RulesPage";
import ScanResults from "./pages/ScanResults";
import ScanSetup from "./pages/ScanSetup";
import SettingsPage from "./pages/SettingsPage";
import SuggestionsQueue from "./pages/SuggestionsQueue";
import { nextRunPreview, useStore } from "./store";
import { FolderPen } from "lucide-react";

function Sidebar() {
  const scan = useStore((s) => s.scan);
  const decisions = useStore((s) => s.decisions);
  const settings = useStore((s) => s.settings);
  const info = useStore((s) => s.info);

  const pending = scan
    ? scan.suggestions.filter((x) => !decisions[x.id]).length
    : 0;
  const approved = scan
    ? scan.suggestions.filter((x) => decisions[x.id] === "approved").length
    : 0;
  const nextRun = nextRunPreview(settings);

  const workflow = [
    { to: "/", icon: <FolderIcon />, label: "Scan Setup" },
    { to: "/results", icon: <ChartIcon />, label: "Scan Results" },
    { to: "/queue", icon: <ListIcon />, label: "Suggestions", badge: pending },
    {
      to: "/review",
      icon: <CheckSquareIcon />,
      label: "Review & Approve",
      badge: approved,
    },
    { to: "/history", icon: <ClockIcon />, label: "History & Undo" },
  ];
  const configure = [
    { to: "/rules", icon: <TagIcon />, label: "Naming Rules" },
    { to: "/settings", icon: <SlidersIcon />, label: "Settings" },
  ];

  const Item = ({
    to,
    icon,
    label,
    badge,
  }: {
    to: string;
    icon: React.ReactNode;
    label: string;
    badge?: number;
  }) => (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] font-medium transition-colors ${
          isActive
            ? "bg-linear-to-br from-brand-500/60 to-brand-800 text-brand-100"
            : "text-ink-2 hover:bg-surface hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-brand-400" />
          )}
          <span className={isActive ? "text-brand-100" : "text-ink-3"}>
            {icon}
          </span>
          <span className="flex-1">{label}</span>
          {!!badge && (
            <span className="tnum rounded-full bg-brand-600 px-2.5 py-0.75 text-[13px] font-semibold leading-4 text-white">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-linear-to-br from-brand-500 to-brand-800 text-[18px] font-bold text-white">
          <FolderPen size={24} />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-12 tracking-[-0.01em] text-ink">
            FileFlex
          </div>
          {/* <div className="text-[10.5px] leading-3 text-ink-3">
            folder cleanup, approved by you
          </div> */}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5">
        <div className="mb-1 mt-2 px-2.5 text-[15px] font-semibold uppercase tracking-wider text-ink-3">
          Workflow
        </div>
        <div className="space-y-1">
          {workflow.map((item) => (
            <Item key={item.to} {...item} />
          ))}
        </div>
        <div className="mb-1 mt-5 px-2.5 text-[15px] font-semibold uppercase tracking-wider text-ink-3">
          Configure
        </div>
        <div className="space-y-1">
          {configure.map((item) => (
            <Item key={item.to} {...item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-line px-4 py-3 text-[13px] text-ink-3">
        <div className="flex items-center gap-1.5 text-ink-2">
          <ShieldIcon className="h-3.5 w-3.5" />
          <span>Private by design — all local</span>
        </div>
        <div className="tnum mt-1.5">
          {nextRun
            ? `Next monthly scan: ${formatDate(nextRun)}`
            : "Monthly scan: off"}
        </div>
        {info && <div className="mt-0.5">v{info.version}</div>}
      </div>
    </aside>
  );
}

function RouteFallback() {
  const ready = useStore((s) => s.ready);
  const navigate = useNavigate();
  useEffect(() => {
    if (ready) navigate("/results", { replace: true });
  }, [ready, navigate]);
  return null;
}

/** Keyed by pathname so a caught page error clears on navigation. */
function BoundRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<ScanSetup />} />
        <Route path="/results" element={<ScanResults />} />
        <Route path="/queue" element={<SuggestionsQueue />} />
        <Route path="/review" element={<ReviewApprove />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<RouteFallback />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  const toasts = useStore((s) => s.toasts);
  const dropToast = useStore((s) => s.dropToast);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <HashRouter>
      <ThemeProvider>
        <div className="flex h-full">
          <Sidebar />
          <main className="h-full flex-1 overflow-y-auto">
            <div className="w-full px-4 py-6">
              <BoundRoutes />
            </div>
          </main>
        </div>
      </ThemeProvider>
      <Toasts toasts={toasts} onClose={dropToast} />
    </HashRouter>
  );
}
