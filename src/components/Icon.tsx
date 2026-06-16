// Monochrome icon pack. Every glyph is a 24x24 stroke SVG using currentColor,
// so icons inherit the theme's text/accent color and stay consistent when you
// switch themes or palettes. Add new icons by dropping a path into PATHS.

export type IconName =
  | "folder"
  | "folderOpen"
  | "file"
  | "markdown"
  | "code"
  | "git"
  | "pull"
  | "push"
  | "settings"
  | "sparkles"
  | "preview"
  | "search"
  | "plus"
  | "close"
  | "chevron"
  | "minimize"
  | "maximize"
  | "send"
  | "warning"
  | "error"
  | "check"
  | "files"
  | "github"
  | "sync"
  | "commit"
  | "logout"
  | "save"
  | "terminal"
  | "split"
  | "palette"
  | "type"
  | "sliders"
  | "user"
  | "heart"
  | "stop"
  | "slash"
  | "copy"
  | "sidebar"
  | "reset";

const PATHS: Record<IconName, React.ReactNode> = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  folderOpen: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" />
      <path d="M3 9h17l-2 8a2 2 0 0 1-2 1.6H5a2 2 0 0 1-2-2z" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  markdown: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l3 3 3-3v6" />
      <path d="M17 9v6m0 0-2-2m2 2 2-2" />
    </>
  ),
  code: <path d="m9 8-5 4 5 4m6-8 5 4-5 4" />,
  git: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <path d="M6 8.5v7M18 11.5V13a3 3 0 0 1-3 3H9" />
    </>
  ),
  pull: <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />,
  push: <path d="M12 21V9m0 0-4 4m4-4 4 4M5 3h14" />,
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  preview: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  minimize: <path d="M5 12h14" />,
  maximize: <rect x="5" y="5" width="14" height="14" rx="2" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  warning: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  files: (
    <>
      <path d="M9 3h7l4 4v10a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M16 3v4h4" />
    </>
  ),
  github: (
    <path d="M9 19c-4 1.5-4-2-6-2.5m12 4v-3.5a3 3 0 0 0-.8-2.3c2.6-.3 5.4-1.3 5.4-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.5 1.6 5.5 1.9 5.5 1.9a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 8.3c0 4.6 2.8 5.7 5.4 6a3 3 0 0 0-.8 2.3V21" />
  ),
  sync: <path d="M21 12a9 9 0 0 1-15 6.7L3 16m0 0h4m-4 0v4M3 12a9 9 0 0 1 15-6.7L21 8m0 0h-4m4 0V4" />,
  commit: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12h5.5M15.5 12H21" />
    </>
  ),
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  save: (
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h7V3M8 21v-7h8v7" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </>
  ),
  split: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="12" cy="8" r="1" />
      <circle cx="16.5" cy="11" r="1" />
    </>
  ),
  type: (
    <>
      <path d="M5 6V5h14v1" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="7" cy="18" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.4-9.2-8.4A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5.6C19 15.6 12 20 12 20z" />
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
  slash: <path d="M9.5 19 14.5 5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.6,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
