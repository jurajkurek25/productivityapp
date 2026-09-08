import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-6 shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
