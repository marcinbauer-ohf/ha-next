'use client';

/**
 * /dev/design-system — the living specimen sheet for the onboarding-v2
 * design language. Every component renders here, interactive, with its name.
 * Lives under /dev/ so AppShell chrome is bypassed.
 */

import { useState } from 'react';
import {
  IconBed,
  IconBell,
  IconBulb,
  IconPlug,
  IconPlus,
  IconSearch,
  IconSofa,
  IconThermometer,
  IconToolsKitchen2,
  IconWifi,
  IconX,
} from '@tabler/icons-react';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Checkbox,
  Chip,
  CtaButton,
  IconButton,
  KEY_CAPS,
  ListRow,
  TextField,
  Press,
  ProgressBar,
  Radio,
  SegmentedControl,
  Skeleton,
  Slider,
  Spinner,
  StatusDot,
  Stepper,
  Toggle,
  ToggleRow,
  color,
  font,
} from '@/design-system';
import { Dialog, Grabber, PopMenu, Toast } from '@/design-system/overlays';
import { Door, KeySvg, Keychain, SCENES_KEYFRAMES } from '@/design-system/scenes';

// ── Sheet furniture ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-2 text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: color.textDim }}>
        {title}
      </h2>
      <div className="bg-white rounded-[24px] p-5 flex flex-wrap items-start gap-x-8 gap-y-6">{children}</div>
    </section>
  );
}

function Spec({ label, children, grow = false }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={grow ? 'flex flex-col gap-2 flex-1 min-w-[260px]' : 'flex flex-col gap-2'}>
      <div className="flex flex-col items-start gap-2">{children}</div>
      <span className="text-[12px] font-semibold" style={{ color: color.textDim }}>
        {label}
      </span>
    </div>
  );
}

const TYPE_RAMP: { label: string; size: number; track: number; tone?: string }[] = [
  { label: 'Display / 38', size: 38, track: -1.14 },
  { label: 'Title / 19', size: 19, track: -0.38 },
  { label: 'Body / 16', size: 16, track: -0.32 },
  { label: 'Row / 15', size: 15, track: -0.3 },
  { label: 'Caption / 13', size: 13, track: -0.26, tone: color.text2 },
  { label: 'Eyebrow / 13 dim', size: 13, track: 0, tone: color.textDim },
];

export default function DesignSystemPage() {
  const [text, setText] = useState('');
  const [secret, setSecret] = useState('hunter2');
  const [badName, setBadName] = useState('My Home');
  const [on, setOn] = useState(true);
  const [rowOn, setRowOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('Auto');
  const [segment, setSegment] = useState('Heat');
  const [count, setCount] = useState(2);
  const [level, setLevel] = useState(62);
  const [chips, setChips] = useState<Set<string>>(new Set(['Bedroom']));
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);
  const [progress, setProgress] = useState(38);

  const toggleChip = (name: string) =>
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="ds-gallery min-h-screen" style={{ background: color.surface, fontFamily: font }}>
      <style>{`
        [data-squircle="on"] .ds-gallery, [data-squircle="on"] .ds-gallery * { corner-shape: round; }
        ${SCENES_KEYFRAMES}
      `}</style>
      <div className="w-full max-w-[960px] mx-auto px-5 py-10 flex flex-col gap-8">
        <header className="px-2">
          <h1 className="text-[38px] font-semibold tracking-[-1.14px] leading-tight" style={{ color: color.text }}>
            Design system
          </h1>
          <p className="mt-1 text-[16px] tracking-[-0.32px]" style={{ color: color.text2 }}>
            The onboarding-v2 language: Geist semibold, spring-pressed. Clickable = pill, inputs = 16px. Everything below is live.
          </p>
        </header>

        <Section title="Palette">
          {(
            [
              ['surface', color.surface],
              ['accent', color.accent],
              ['ink', color.ink],
              ['text', color.text],
              ['text-2', color.text2],
              ['text-dim', color.textDim],
              ['field', color.field],
              ['tint', color.tint],
              ['warn', color.warn],
              ['danger', color.danger],
            ] as const
          ).map(([name, value]) => (
            <Spec key={name} label={`${name} · ${value}`}>
              <span className="size-[56px] rounded-[18px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]" style={{ background: value }} />
            </Spec>
          ))}
          <Spec label="key caps (identity)">
            <span className="flex gap-1.5">
              {KEY_CAPS.map((c) => (
                <span key={c} className="size-[24px] rounded-full" style={{ background: c }} />
              ))}
            </span>
          </Spec>
        </Section>

        <Section title="Type">
          <div className="flex flex-col gap-2 w-full">
            {TYPE_RAMP.map((t) => (
              <div key={t.label} className="flex items-baseline gap-4">
                <span className="w-[130px] shrink-0 text-[12px] font-semibold" style={{ color: color.textDim }}>
                  {t.label}
                </span>
                <span
                  className="font-semibold truncate"
                  style={{ color: t.tone ?? color.text, fontSize: t.size, letterSpacing: t.track }}
                >
                  A home that works for you
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons">
          <Spec label="CtaButton" grow>
            <CtaButton label="Continue" onClick={() => {}} arrow />
          </Spec>
          <Spec label="CtaButton · disabled" grow>
            <CtaButton label="Continue" onClick={() => {}} arrow disabled />
          </Spec>
          <Spec label="Button · md / sm × ink / field / accent / danger">
            <span className="flex flex-wrap items-center gap-2">
              <Button label="Save changes" onClick={() => {}} />
              <Button label="Cancel" tone="field" onClick={() => {}} />
              <Button label="Add device" size="sm" tone="accent" onClick={() => {}} />
              <Button label="Remove" size="sm" tone="danger" onClick={() => {}} />
              <Button label="Disabled" size="sm" disabled onClick={() => {}} />
            </span>
          </Spec>
          <Spec label="IconButton · md (44) / sm (36) × field / accent / white / ink">
            <span className="flex items-center gap-2">
              <IconButton aria-label="Search" onClick={() => {}}>
                <IconSearch size={20} color={color.text2} />
              </IconButton>
              <IconButton aria-label="Add" tone="accent" onClick={() => {}}>
                <IconPlus size={22} color="white" />
              </IconButton>
              <IconButton aria-label="Search small" size="sm" onClick={() => {}}>
                <IconSearch size={17} color={color.text2} />
              </IconButton>
              <IconButton aria-label="Add small" size="sm" tone="accent" onClick={() => {}}>
                <IconPlus size={18} color="white" />
              </IconButton>
              <IconButton aria-label="Clear" tone="white" size={38} onClick={() => {}}>
                <IconX size={17} color={color.text2} />
              </IconButton>
              <IconButton aria-label="Notifications" tone="ink" size="sm" onClick={() => {}}>
                <IconBell size={18} color="white" />
              </IconButton>
            </span>
          </Spec>
          <Spec label="Press · ghost">
            <Press onClick={() => {}} className="px-4 py-1 text-[15px] font-semibold tracking-[-0.3px]">
              <span style={{ color: color.text2 }}>Skip for now</span>
            </Press>
          </Spec>
        </Section>

        <Section title="Inputs">
          <Spec label="TextField · accent ring on focus" grow>
            <TextField value={text} onChange={setText} placeholder="Name your home" />
          </Spec>
          <Spec label="TextField · secret" grow>
            <TextField value={secret} onChange={setSecret} placeholder="Password" secret />
          </Spec>
          <Spec label="TextField · error + label" grow>
            <TextField
              value={badName}
              onChange={setBadName}
              label="Home name"
              placeholder="e.g. The Nest"
              error="That name is already taken"
            />
          </Spec>
        </Section>

        <Section title="Selection">
          <Spec label="Chip · icon, selected grows a +">
            <span className="flex flex-wrap gap-2">
              {(
                [
                  ['Living room', IconSofa],
                  ['Bedroom', IconBed],
                  ['Kitchen', IconToolsKitchen2],
                ] as const
              ).map(([name, Icon]) => (
                <Chip
                  key={name}
                  label={name}
                  icon={Icon}
                  selected={chips.has(name)}
                  onClick={() => toggleChip(name)}
                  onAdd={() => {}}
                />
              ))}
              <Chip label="Text only" selected={chips.has('Text only')} onClick={() => toggleChip('Text only')} />
            </span>
          </Spec>
          <Spec label="Toggle">
            <Toggle on={on} onToggle={() => setOn((v) => !v)} />
          </Spec>
          <Spec label="Checkbox / Radio">
            <span className="flex flex-col gap-2.5">
              <Checkbox checked={checked} onChange={setChecked} label="Share crash reports" />
              <span className="flex gap-4">
                {['Auto', 'On', 'Off'].map((opt) => (
                  <Radio key={opt} selected={radio === opt} onSelect={() => setRadio(opt)} label={opt} />
                ))}
              </span>
            </span>
          </Spec>
          <Spec label="ToggleRow · highlight" grow>
            <div className="w-full flex flex-col gap-1">
              <ToggleRow label="Basic analytics" description="Counts only, never content" on={rowOn} onToggle={() => setRowOn((v) => !v)} />
              <ToggleRow label="Thank-you letter" description="A note from the team" on={rowOn} onToggle={() => setRowOn((v) => !v)} highlight />
            </div>
          </Spec>
          <Spec label="SegmentedControl" grow>
            <SegmentedControl options={['Heat', 'Cool', 'Auto', 'Off']} value={segment} onChange={setSegment} />
          </Spec>
          <Spec label="Stepper" grow>
            <Stepper value={count} onChange={setCount} min={1} max={5} />
          </Spec>
          <Spec label={`Slider · ${level}%`} grow>
            <Slider value={level} onChange={setLevel} />
          </Spec>
        </Section>

        <Section title="Status & feedback">
          <Spec label="StatusDot / Badge">
            <span className="flex items-center gap-3">
              <StatusDot status="on" />
              <StatusDot status="off" />
              <StatusDot status="warning" />
              <StatusDot status="error" />
            </span>
            <span className="flex flex-wrap gap-2">
              <Badge label="Connected" status="on" />
              <Badge label="Idle" status="off" />
              <Badge label="Low battery" status="warning" />
              <Badge label="Unavailable" status="error" />
            </span>
          </Spec>
          <Spec label="Spinner / Skeleton">
            <span className="flex items-center gap-4">
              <Spinner />
              <span className="flex flex-col gap-2">
                <Skeleton className="w-[140px] h-[12px]" />
                <Skeleton className="w-[90px] h-[12px]" />
              </span>
            </span>
          </Spec>
          <Spec label={`ProgressBar · ${progress}%`} grow>
            <div className="w-full flex items-center gap-3">
              <ProgressBar percent={progress} />
              <IconButton aria-label="Advance" size={32} onClick={() => setProgress((p) => (p >= 100 ? 0 : p + 17))}>
                <IconPlus size={16} color={color.text2} />
              </IconButton>
            </div>
          </Spec>
          <Spec label="Banner · info / warning / error" grow>
            <div className="w-full flex flex-col gap-2">
              <Banner title="Backup complete">Your home is safe as of 2:00 AM.</Banner>
              <Banner kind="warning" title="Update available">
                Restart to finish installing.
              </Banner>
              <Banner kind="error" title="Hub unreachable">
                Check the power cable and try again.
              </Banner>
            </div>
          </Spec>
        </Section>

        <Section title="Lists & identity">
          <Spec label="ListRow · tappable / static / trailing" grow>
            <div className="w-full bg-white rounded-[24px] flex flex-col">
              <ListRow icon={IconBulb} label="Ceiling light" sub="Living room" onClick={() => {}} />
              <ListRow icon={IconThermometer} label="Thermostat" trailing={<Badge label="21.5°" status="on" />} />
              <ListRow icon={IconPlug} label="Smart plug" trailing={<Toggle on={on} onToggle={() => setOn((v) => !v)} />} />
              <ListRow icon={IconWifi} label="Network" sub="Loading…" trailing={<Spinner size={18} />} />
            </div>
          </Spec>
          <Spec label="Avatar · cap-colored by seed">
            <span className="flex gap-2">
              {['marcin', 'sam', 'ola', 'kim'].map((seed) => (
                <Avatar key={seed} seed={seed} size={40} />
              ))}
            </span>
          </Spec>
        </Section>

        <Section title="Overlays">
          <Spec label="PopMenu">
            <span className="relative">
              <Press
                onClick={() => setMenuOpen((v) => !v)}
                className="min-h-[44px] px-4 rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.3px]"
                style={{ color: color.text2 }}
              >
                Open menu
              </Press>
              <PopMenu
                open={menuOpen}
                onPick={() => setMenuOpen(false)}
                items={['English', 'Polski', 'Español']}
                leading={['🇬🇧', '🇵🇱', '🇪🇸']}
              />
            </span>
          </Spec>
          <Spec label="Dialog · confirm">
            <Press
              onClick={() => setDialogOpen(true)}
              className="min-h-[44px] px-4 rounded-full text-white text-[15px] font-semibold tracking-[-0.3px]"
              style={{ background: color.danger }}
            >
              Remove device…
            </Press>
            <Dialog
              open={dialogOpen}
              title="Remove Ceiling light?"
              confirmLabel="Remove"
              cancelLabel="Keep it"
              danger
              onConfirm={() => setDialogOpen(false)}
              onClose={() => setDialogOpen(false)}
            >
              Its history stays until the next cleanup.
            </Dialog>
          </Spec>
          <Spec label="Toast (+ key art) / Grabber" grow>
            <div className="flex flex-col items-start gap-3">
              {toastVisible ? (
                <button type="button" onClick={() => setToastVisible(false)} className="max-w-full">
                  <Toast
                    leading={
                      <span aria-hidden className="shrink-0 -my-1 -rotate-90">
                        <KeySvg cutSeed="sam@home.io" styleSeed="sam@home.io" color="#ffffff" height={26} />
                      </span>
                    }
                  >
                    Key cut for sam@home.io — tap to dismiss
                  </Toast>
                </button>
              ) : (
                <Press onClick={() => setToastVisible(true)} className="px-4 py-2 rounded-full bg-[#f3f3f3] text-[14px] font-semibold" style={{ color: color.text2 }}>
                  Show toast
                </Press>
              )}
              <div className="w-[200px] bg-[#f3f3f3] rounded-t-[24px]">
                <Grabber />
              </div>
            </div>
          </Spec>
        </Section>

        <Section title="Scenes (illustration kit)">
          <Spec label="Door · tap-able in the flow">
            <Door name="Villa Rosa" height={230} />
          </Spec>
          <Spec label="Keychain · keys cut by seed">
            <Keychain
              keys={[
                { id: 'admin', cutSeed: 'hunter2', styleSeed: 'marcin', color: color.ink },
                { id: 'g1', cutSeed: 'sam@home.io', styleSeed: 'sam@home.io', color: color.text2 },
                { id: 'g2', cutSeed: 'ola@home.io', styleSeed: 'ola@home.io', color: color.text2 },
              ]}
              keyHeight={96}
              ringSize={64}
            />
          </Spec>
          <Spec label="KeySvg · cut / dimple / card">
            <span className="flex items-start gap-4">
              {['classic-1', 'dimple-04', 'card-206'].map((seed) => (
                <KeySvg key={seed} cutSeed={seed} styleSeed={seed} height={88} />
              ))}
            </span>
          </Spec>
        </Section>

        <footer className="px-2 pb-6 text-[13px] tracking-[-0.26px]" style={{ color: color.textDim }}>
          Source: src/design-system · consumed by /dev/onboarding-v2 · roadmap in notes/design-system-inventory.md
        </footer>
      </div>
    </div>
  );
}
