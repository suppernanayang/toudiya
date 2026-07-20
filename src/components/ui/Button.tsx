import { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "primary" | "warning" | "ghost";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "border border-line bg-surface text-text hover:bg-surface-2",
  primary: "border border-teal bg-teal text-white hover:bg-teal-dark",
  warning: "border border-[#f3d38a] bg-amber-soft text-[#7c3b07] hover:brightness-95",
  ghost: "border-0 bg-transparent text-teal-dark hover:underline px-0",
};

export function Button({
  variant = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    variant === "ghost"
      ? "inline-flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      : "min-h-9 rounded-lg inline-flex items-center justify-center gap-2 px-3 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
  return <button className={`${base} ${VARIANT_CLASS[variant]} ${className || ""}`} {...props} />;
}
