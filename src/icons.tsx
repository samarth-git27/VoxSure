import type { ReactNode, SVGProps } from "react";

type IconName =
  | "ArrowDownRight" | "ArrowLeft" | "ArrowRight" | "ArrowUpRight" | "AudioLines"
  | "BadgeCheck" | "BarChart3" | "BookOpen" | "Check" | "CheckCircle2"
  | "ChevronDown" | "ChevronRight" | "CircleHelp" | "Clock3" | "Copy"
  | "Database" | "Download" | "FileAudio" | "FileCheck2" | "FileJson2"
  | "FlaskConical" | "Home" | "Info" | "Languages" | "LoaderCircle"
  | "LockKeyhole" | "Menu" | "MoreHorizontal" | "Plus" | "RefreshCcw"
  | "Search" | "Settings" | "Shield" | "Sparkles" | "Trash2" | "Upload"
  | "Volume2" | "X" | "Zap";

const paths: Record<IconName, ReactNode> = {
  ArrowDownRight: <path d="M7 7 17 17M7 17h10V7" />,
  ArrowLeft: <path d="m12 19-7-7 7-7M5 12h14" />,
  ArrowRight: <path d="m12 5 7 7-7 7m7-7H5" />,
  ArrowUpRight: <path d="M7 17 17 7M7 7h10v10" />,
  AudioLines: <path d="M2 10v4m4-8v12m4-16v20m4-14v8m4-12v16m4-10v4" />,
  BadgeCheck: <><path d="M12 3 14.5 4l2.7-.1 1.1 2.5 2 1.8-.6 2.7.6 2.7-2 1.8-1.1 2.5-2.7-.1L12 21l-2.5-1.1-2.7.1-1.1-2.5-2-1.8.6-2.7-.6-2.7 2-1.8 1.1-2.5 2.7.1L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  BarChart3: <path d="M3 3v18h18M8 17v-4m5 4V7m5 10V4" />,
  BookOpen: <path d="M12 7v14m0-14C9 4.5 6 4 3 5v14c3-1 6-.5 9 2m0-14c3-2.5 6-3 9-2v14c-3-1-6-.5-9 2" />,
  Check: <path d="m5 12 4 4L19 6" />,
  CheckCircle2: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  ChevronDown: <path d="m6 9 6 6 6-6" />,
  ChevronRight: <path d="m9 18 6-6-6-6" />,
  CircleHelp: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 0 1 4.8.8c0 1.8-2.4 2.2-2.4 4m0 3h.01" /></>,
  Clock3: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  Copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>,
  Database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  Download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" />,
  FileAudio: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13v4m3-6v8m3-5v2m3-4v6" /></>,
  FileCheck2: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 15l2 2 4-4" /></>,
  FileJson2: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M10 12c-2 0-2 1-2 2s0 2-2 2m8-4c2 0 2 1 2 2s0 2 2 2" /></>,
  FlaskConical: <><path d="M9 3h6m-5 0v7L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-10V3M7 16h10" /><path d="M10 13h4" /></>,
  Home: <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7" />,
  Info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  Languages: <><path d="m5 8 6 6m-7 1 6-6 2-3M2 5h12M7 2h1m11 10 4 10m-8 0 4-10 4 10m-7-3h6" /><path d="M14 5h8m-4-3v2c0 5-2 8-5 10" /></>,
  LoaderCircle: <><path d="M21 12a9 9 0 1 1-6.2-8.6" /><path d="M21 4v5h-5" /></>,
  LockKeyhole: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  Menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  MoreHorizontal: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  Plus: <path d="M12 5v14m-7-7h14" />,
  RefreshCcw: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12m-16 0 2.8 5a7 7 0 0 0 11.6-2" /></>,
  Search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  Settings: <><path d="m12 3 1.2 2.4 2.7.5 2.3-1.1 1.5 2.6-1.8 2.1.4 2.7 1.8 2-1.5 2.7-2.7-.6-2.1 1.7-.6 2.7h-3l-.7-2.7-2.2-1.5-2.6.6-1.5-2.7 1.8-2-.4-2.7-1.8-2 1.5-2.7 2.7.5L11 3h1Z" /><circle cx="12" cy="12" r="3" /></>,
  Shield: <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />,
  Sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14ZM5 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" /></>,
  Trash2: <><path d="M3 6h18m-2 0-1 15H6L5 6m4 0V4h6v2m-5 4v7m4-7v7" /></>,
  Upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5-5 5 5m-5-5v12" />,
  Volume2: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" /></>,
  X: <path d="m18 6-12 12M6 6l12 12" />,
  Zap: <path d="m13 2-3 9h8L8 22l3-9H3l10-11Z" />,
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function createIcon(name: IconName) {
  return function Icon({ size = 24, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      >
        {paths[name]}
      </svg>
    );
  };
}

export const ArrowDownRight = createIcon("ArrowDownRight");
export const ArrowLeft = createIcon("ArrowLeft");
export const ArrowRight = createIcon("ArrowRight");
export const ArrowUpRight = createIcon("ArrowUpRight");
export const AudioLines = createIcon("AudioLines");
export const BadgeCheck = createIcon("BadgeCheck");
export const BarChart3 = createIcon("BarChart3");
export const BookOpen = createIcon("BookOpen");
export const Check = createIcon("Check");
export const CheckCircle2 = createIcon("CheckCircle2");
export const ChevronDown = createIcon("ChevronDown");
export const ChevronRight = createIcon("ChevronRight");
export const CircleHelp = createIcon("CircleHelp");
export const Clock3 = createIcon("Clock3");
export const Copy = createIcon("Copy");
export const Database = createIcon("Database");
export const Download = createIcon("Download");
export const FileAudio = createIcon("FileAudio");
export const FileCheck2 = createIcon("FileCheck2");
export const FileJson2 = createIcon("FileJson2");
export const FlaskConical = createIcon("FlaskConical");
export const Home = createIcon("Home");
export const Info = createIcon("Info");
export const Languages = createIcon("Languages");
export const LoaderCircle = createIcon("LoaderCircle");
export const LockKeyhole = createIcon("LockKeyhole");
export const Menu = createIcon("Menu");
export const MoreHorizontal = createIcon("MoreHorizontal");
export const Plus = createIcon("Plus");
export const RefreshCcw = createIcon("RefreshCcw");
export const Search = createIcon("Search");
export const Settings = createIcon("Settings");
export const Shield = createIcon("Shield");
export const Sparkles = createIcon("Sparkles");
export const Trash2 = createIcon("Trash2");
export const Upload = createIcon("Upload");
export const Volume2 = createIcon("Volume2");
export const X = createIcon("X");
export const Zap = createIcon("Zap");
