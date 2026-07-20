import { HTMLAttributes } from "react";

export type TagVariant = "default" | "teal" | "amber" | "blue" | "green" | "rose";

const VARIANT_CLASS: Record<TagVariant, string> = {
  default: "bg-[#eef2f7] text-[#485568]",
  teal: "bg-mint text-teal-dark",
  amber: "bg-amber-soft text-amber",
  blue: "bg-blue-soft text-blue",
  green: "bg-[#e7f6ec] text-green",
  rose: "bg-rose-soft text-rose",
};

export function Tag({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: TagVariant }) {
  return (
    <span
      className={`inline-flex items-center min-h-6 rounded-full px-2.5 text-xs ${VARIANT_CLASS[variant]} ${className || ""}`}
      {...props}
    />
  );
}
