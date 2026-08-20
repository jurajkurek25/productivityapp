import type { LifeDomain } from "@productivityapp/core";

const LABELS: Record<LifeDomain, string> = {
  study: "Study",
  business: "Business",
  social: "Social",
  relax: "Relax",
};

const DOT_CLASS: Record<LifeDomain, string> = {
  study: "bg-domain-study",
  business: "bg-domain-business",
  social: "bg-domain-social",
  relax: "bg-domain-relax",
};

const TEXT_CLASS: Record<LifeDomain, string> = {
  study: "text-domain-study",
  business: "text-domain-business",
  social: "text-domain-social",
  relax: "text-domain-relax",
};

export function DomainBadge({ domain }: { domain: LifeDomain }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TEXT_CLASS[domain]}`}>
      <span className={`h-2 w-2 rounded-full ${DOT_CLASS[domain]}`} />
      {LABELS[domain]}
    </span>
  );
}

export function domainDotClass(domain: LifeDomain): string {
  return DOT_CLASS[domain];
}
