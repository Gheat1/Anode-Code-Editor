import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// One app-wide right-click menu. Components describe what they want shown via
// `openContextMenu(x, y, items)`; this provider owns the single popup, the
// click-away scrim, and viewport clamping so the menu never spills off-screen
// (the old per-component menus didn't clamp and double-fired against each other).
export interface ContextMenuItem {
  label: string;
  run?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean; // draws a divider *above* this item
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

type OpenFn = (x: number, y: number, items: ContextMenuItem[]) => void;

const Ctx = createContext<OpenFn>(() => {});

export function useContextMenu(): OpenFn {
  return useContext(Ctx);
}

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const open = useCallback<OpenFn>((x, y, items) => {
    if (items.length === 0) return;
    // Render at the raw point first; the layout effect corrects it once the
    // menu has measured itself.
    setMenu({ x, y, items });
    setPos({ left: x, top: y });
  }, []);

  // Clamp into the viewport after the menu mounts and we know its real size.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;
    const left =
      menu.x + rect.width > window.innerWidth - pad
        ? Math.max(pad, window.innerWidth - rect.width - pad)
        : menu.x;
    const top =
      menu.y + rect.height > window.innerHeight - pad
        ? Math.max(pad, window.innerHeight - rect.height - pad)
        : menu.y;
    setPos({ left, top });
  }, [menu]);

  const close = () => {
    setMenu(null);
    setPos(null);
  };

  return (
    <Ctx.Provider value={open}>
      {children}
      {menu && pos && (
        <>
          <div className="picker-scrim" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
          <div
            ref={ref}
            className="context-menu"
            style={{ left: pos.left, top: pos.top }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {menu.items.map((it, i) => (
              <div key={i}>
                {it.separator && i > 0 && <div className="context-menu-divider" />}
                <button
                  className={`context-menu-item ${it.danger ? "danger" : ""}`}
                  disabled={it.disabled}
                  onClick={() => {
                    close();
                    it.run?.();
                  }}
                >
                  {it.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Ctx.Provider>
  );
}
