import { HTMLAttributes } from "react";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cx(
        "bg-surface border border-line rounded-lg shadow-[var(--shadow-panel)] min-w-0",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-line">
      <div>
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {subtitle ? <span className="text-muted text-sm">{subtitle}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="p-4 text-muted leading-relaxed text-sm">{children}</div>;
}
