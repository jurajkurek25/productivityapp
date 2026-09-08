import { Briefcase, Feather, GraduationCap, Users2, type LucideIcon } from "lucide-react";
import type { LifeDomain } from "@productivityapp/core";
import { domainLabels } from "../lib/i18n";

const ICONS: Record<LifeDomain, LucideIcon> = {
  study: GraduationCap,
  business: Briefcase,
  social: Users2,
  relax: Feather,
};

const DOT_CLASS: Record<LifeDomain, string> = {
  study: "bg-domain-study",
  business: "bg-domain-business",
  social: "bg-domain-social",
  relax: "bg-domain-relax",
};

const PILL_CLASS: Record<LifeDomain, string> = {
  study: "bg-domain-study/10 text-domain-study",
  business: "bg-domain-business/10 text-domain-business",
  social: "bg-domain-social/10 text-domain-social",
  relax: "bg-domain-relax/10 text-domain-relax",
};

export function DomainBadge({ domain }: { domain: LifeDomain }) {
  const Icon = ICONS[domain];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${PILL_CLASS[domain]}`}>
      <Icon size={12} strokeWidth={2.5} />
      {domainLabels[domain]}
    </span>
  );
}

export function domainDotClass(domain: LifeDomain): string {
  return DOT_CLASS[domain];
}
