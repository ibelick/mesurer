import { CheckIcon } from "@phosphor-icons/react";
import Button from "./components/button";

type Tier = "free" | "pro" | "team";

type Feature = {
  id: string;
  label: string;
  tier: Tier;
};

type Plan = {
  id: Tier;
  name: string;
  price: string;
  cadence?: string;
  description: string;
  includes?: string;
  features: string[];
  cta: string;
  href: string;
};

export const featureCatalog: Feature[] = [
  { id: "inspect", label: "Inspect", tier: "free" },
  { id: "annotate", label: "Annotate", tier: "free" },
  { id: "comments", label: "Comments", tier: "free" },
  { id: "agent-context", label: "Agent context", tier: "free" },
  { id: "copy-for-agent", label: "Copy for agent", tier: "free" },
  { id: "unlimited-reviews", label: "Unlimited Reviews", tier: "pro" },
  { id: "mesurer-links", label: "Mesurer Links", tier: "pro" },
  { id: "private-projects", label: "Private projects", tier: "pro" },
  { id: "versions-history", label: "Versions & history", tier: "pro" },
  { id: "cloud-sync", label: "Cloud sync", tier: "pro" },
  { id: "members", label: "10 members", tier: "team" },
  { id: "shared-projects", label: "Shared projects", tier: "team" },
  { id: "team-reviews", label: "Team reviews", tier: "team" },
  { id: "permissions", label: "Permissions", tier: "team" },
  { id: "shared-history", label: "Shared history", tier: "team" },
];

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "For building with Mesurer.",
    features: ["inspect", "annotate", "comments", "agent-context", "copy-for-agent"],
    cta: "Get started",
    href: "#installation",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$39",
    cadence: "/month",
    description: "For building across projects, deployments, and agents.",
    includes: "Everything in Free, plus",
    features: ["unlimited-reviews", "mesurer-links", "private-projects", "versions-history", "cloud-sync"],
    cta: "Get Pro",
    href: "#pricing",
  },
  {
    id: "team",
    name: "Team",
    price: "$149",
    cadence: "/month",
    description: "For teams building software together.",
    includes: "Everything in Pro, plus",
    features: ["members", "shared-projects", "team-reviews", "permissions", "shared-history"],
    cta: "Get Team",
    href: "#pricing",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative left-1/2 mt-24 w-screen -translate-x-1/2 px-5" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <h2 id="pricing-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
            Choose how you build with Mesurer.
          </h2>
          <p className="mt-2 text-pretty text-base leading-relaxed text-muted">
            Start free, then scale your reviews, projects, and team when you are ready.
          </p>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          {plans.map((plan) => {
            const features = featureCatalog.filter((feature) => plan.features.includes(feature.id));

            return (
              <article
                key={plan.id}
                className="flex flex-col rounded-[var(--radius)] border border-border p-6"
                aria-labelledby={`${plan.id}-plan-title`}
              >
                <div className="flex-1">
                  <h3 id={`${plan.id}-plan-title`} className="text-base font-medium text-strong">
                    {plan.name}
                  </h3>
                  <p className="mt-3 flex items-baseline text-strong">
                    <span className="text-3xl font-medium tracking-tight">{plan.price}</span>
                    {plan.cadence && <span className="ml-1 text-sm text-muted">{plan.cadence}</span>}
                  </p>
                  <p className="mt-4 min-h-10 text-sm leading-relaxed text-muted">{plan.description}</p>
                  {plan.includes && <p className="mt-6 text-sm font-medium text-strong">{plan.includes}</p>}

                  <ul className="mt-5 flex flex-col gap-3" aria-label={`${plan.name} features`}>
                    {features.map((feature) => (
                      <li key={feature.id} className="flex items-start gap-2 text-sm text-muted">
                        <CheckIcon aria-hidden="true" weight="bold" className="mt-0.5 size-4 shrink-0 text-strong" />
                        <span>{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button href={plan.href} variant="secondary" className="mt-8 w-full">
                  {plan.cta}
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
