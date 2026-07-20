export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="h-auto min-h-[72px] sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 px-7 py-3 border-b border-line bg-white/85 backdrop-blur-md">
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-semibold leading-tight">{title}</h1>
          {subtitle ? <p className="mt-1 mb-0 text-muted text-sm">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2.5 flex-wrap justify-end">{actions}</div> : null}
      </header>
      <div className="p-6 sm:p-7 grid gap-4.5 gap-y-4">{children}</div>
    </>
  );
}
