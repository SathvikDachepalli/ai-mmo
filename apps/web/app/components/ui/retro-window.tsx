"use client";

import { WindowHeader } from "./window-header";

/** A "desktop application window" — the one chrome primitive every screen
 * (lobby, chat, admin, panels) is built from, so header/border styling
 * never gets duplicated per screen. Pass `header={null}` to omit the title
 * bar entirely (rare — e.g. a window nested inside another). */
export function RetroWindow({
  title,
  icon,
  headerRight,
  header,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  /** Pass a custom header element instead of the default title bar. */
  header?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`retro-window flex flex-col overflow-hidden ${className}`}>
      {header !== undefined ? header : title ? <WindowHeader title={title} icon={icon} right={headerRight} /> : null}
      <div className={bodyClassName || "p-4"}>{children}</div>
    </div>
  );
}
