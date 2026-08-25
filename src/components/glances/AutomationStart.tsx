'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mdiPencilRuler, mdiRobot, mdiSitemap } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { StoreOverlay, type StoreItem } from '../ui';
import { DialogFrame, IntroStep } from '../cards/dialogKit';
import { useAddContext } from '@/contexts';
import { useBlueprints, type BlueprintSummary } from '@/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Starting an automation, for a home that has none. Two screens:
//
//   1. what an automation even is, and one way in
//   2. from scratch, or from a blueprint
//
// The second is the pattern every tool that makes things converges on — blank
// document or template — and here the templates are blueprints, browsed in the
// same store the "+ → Blueprint" menu opens (see StoreOverlay).
// ─────────────────────────────────────────────────────────────────────────────

function toStoreItem(blueprint: BlueprintSummary): StoreItem {
  return {
    id: blueprint.id,
    name: blueprint.name,
    tagline: blueprint.tagline,
    category: blueprint.category,
    icon: blueprint.icon,
    accent: blueprint.accent,
    source: blueprint.author,
    badges: blueprint.author === 'Home Assistant' ? ['Official'] : [],
    installed: blueprint.installed,
    featured: blueprint.author === 'Home Assistant',
    description: blueprint.description ?? blueprint.tagline,
    facts: [
      { label: 'Makes', value: blueprint.domain === 'script' ? 'A script' : 'An automation' },
      { label: 'By', value: blueprint.author },
    ],
    url: blueprint.sourceUrl,
  };
}

/** One of the two ways to start — a big, plainly-labelled choice. */
function StartOption({
  icon,
  title,
  blurb,
  meta,
  onClick,
}: {
  icon: string;
  title: string;
  blurb: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-ha-2 rounded-ha-2xl bg-surface-default p-ha-4 text-left transition-colors hover:bg-surface-mid active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-ha-xl bg-surface-low text-ha-blue">
        <Icon path={icon} size={26} />
      </span>
      <span className="text-base font-semibold text-text-primary">{title}</span>
      <span className="text-sm text-text-secondary">{blurb}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{meta}</span>
    </button>
  );
}

/**
 * The "how do you want to start" step. Rendered inside the automations dialog,
 * so it wears the same frame as everything else in there.
 */
export function AutomationStart({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { requestAdd } = useAddContext();
  const { catalog, importBlueprint } = useBlueprints();
  const [storeOpen, setStoreOpen] = useState(false);

  const items = useMemo(() => catalog.map(toStoreItem), [catalog]);

  // Same hand-off the top-bar "+ → Automation" makes: the editor lives in
  // settings, and this is the way to it rather than a second one built here.
  const fromScratch = () => {
    onClose();
    requestAdd('automations');
    router.push('/settings/automations');
  };

  return (
    <>
      <DialogFrame onClose={onClose}>
        <div className="flex flex-col gap-ha-3">
          <div className="flex flex-col gap-ha-1 px-ha-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">New automation</span>
            {/* No full stop — display heading (see the house rule). */}
            <h2 className="text-2xl font-bold leading-tight text-text-primary">How do you want to start</h2>
          </div>
          <div className="flex flex-col gap-ha-2 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-ha-3">
            <StartOption
              icon={mdiPencilRuler}
              title="Start from scratch"
              blurb="Pick what sets it off and what it should do, step by step. Nothing is assumed."
              meta="Blank"
              onClick={fromScratch}
            />
            <StartOption
              icon={mdiSitemap}
              title="Start from a blueprint"
              blurb="A ready-made automation somebody already worked out. You fill in your own devices."
              meta={`${items.length} templates`}
              onClick={() => setStoreOpen(true)}
            />
          </div>
        </div>
      </DialogFrame>

      {/* The same store the "+ → Blueprint" menu opens — one browser, not two. */}
      <StoreOverlay
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        eyebrow="Blueprint store"
        title="Blueprints"
        items={items}
        onAdd={(item) => importBlueprint(item.id)}
        addLabel="Use this"
        addedLabel="Added"
        emptyLabel="No blueprints match that search."
      />
    </>
  );
}

/**
 * What a home with no automations sees when it opens the chip: what the thing
 * is, in the plainest words available, and the way in.
 */
export function AutomationsIntro({ onStart }: { onStart: () => void }) {
  return (
    <IntroStep
      icon={mdiRobot}
      iconClass="text-violet-500"
      eyebrow="Automations"
      headline="Let your home do it for you"
      blurb="An automation is a rule your home follows on its own: when this happens, do that. Lights that come on at sunset, a heater that goes off when everyone leaves."
      cta="Add automation"
      onStart={onStart}
    />
  );
}
