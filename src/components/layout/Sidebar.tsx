"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  badge?: number;
  icon: React.ReactNode;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]">
      <path d={d} />
    </svg>
  );
}

export function Sidebar({
  reviewCount,
  jobCount,
  modelSummary,
}: {
  reviewCount: number;
  jobCount: number;
  modelSummary: string;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard", label: "工作台", icon: <Icon d="M3 13h8V3H3zM13 21h8v-8h-8zM13 3h8v6h-8zM3 21h8v-4H3z" /> },
    {
      href: "/review",
      label: "审核台",
      badge: reviewCount,
      icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
    },
    {
      href: "/resumes",
      label: "简历库",
      icon: <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6" />,
    },
    {
      href: "/experiences",
      label: "经历库",
      icon: <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />,
    },
    {
      href: "/jobs",
      label: "岗位池",
      badge: jobCount,
      icon: <Icon d="M10 6h10M10 12h10M10 18h10M4 6h1M4 12h1M4 18h1" />,
    },
    {
      href: "/applications",
      label: "投递追踪",
      icon: <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
    },
    {
      href: "/interviews",
      label: "面试准备",
      icon: <Icon d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />,
    },
    {
      href: "/extension",
      label: "浏览器插件",
      icon: <Icon d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M12 3h4a2 2 0 0 1 2 2v4M9 15l6-6M9 9h6v6" />,
    },
  ];

  return (
    <aside className="bg-sidebar text-[#edf6f3] p-5 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="relative w-[38px] h-[38px] rounded-full bg-duck shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] flex-none" />
        <div className="grid gap-0.5">
          <strong className="text-xl leading-none">投递鸭</strong>
          <span className="text-[#a9bbb5] text-xs">AI 求职审核台</span>
        </div>
      </div>

      <nav className="grid gap-1.5">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full grid grid-cols-[24px_1fr_auto] items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[#d9e7e2] ${
                active ? "bg-white/10 text-white" : "hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge ? (
                <span className="min-w-[22px] h-[22px] rounded-full px-1.5 inline-flex items-center justify-center text-xs bg-[rgba(244,197,66,0.18)] text-[#ffe48a]">
                  {item.badge}
                </span>
              ) : (
                <span />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3 border border-white/10 rounded-lg text-[#c7d8d3] text-sm leading-relaxed">
        <strong>模型设置</strong>
        <br />
        当前：{modelSummary}
        <Link
          href="/dashboard"
          className="mt-2.5 block w-full text-center border border-white/15 rounded-lg bg-white/10 text-white min-h-[34px] leading-[34px]"
        >
          查看设置
        </Link>
      </div>
    </aside>
  );
}
