'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  mdiSofa, mdiBed, mdiBedKing, mdiSilverwareForkKnife, mdiFridge, mdiToilet,
  mdiShower, mdiWashingMachine, mdiGarage, mdiCarBack, mdiStairs, mdiHomeFloor0,
  mdiHomeFloor1, mdiHomeFloor2, mdiHomeFloor3, mdiHomeFloorB, mdiHome, mdiHomeOutline,
  mdiHomeCity, mdiOfficeBuilding, mdiDoor, mdiDoorOpen, mdiWindowClosedVariant,
  mdiStove, mdiCoffeeMaker, mdiTelevision, mdiSofaSingle, mdiDesk, mdiChairRolling,
  mdiBookshelf, mdiBabyCarriage, mdiDumbbell, mdiPool, mdiHotTub, mdiTree, mdiFlower,
  mdiGrass, mdiFence, mdiGreenhouse, mdiTools, mdiWrench, mdiServerNetwork, mdiRouterWireless,
  mdiWardrobe, mdiCountertop, mdiPaperRoll, mdiStairsUp, mdiStairsDown, mdiBalcony,
  mdiViewDashboard, mdiMapMarker, mdiLayers, mdiSeatReclineExtra, mdiTableChair, mdiSilverwareVariant,
  mdiBathtub, mdiToothbrush, mdiHanger, mdiVacuum, mdiBroom, mdiPaw, mdiBookOpenVariant,
  mdiGamepadVariant, mdiMusic, mdiPiano, mdiWeightLifter, mdiCarSports, mdiWarehouse,
  mdiHomeRoof, mdiCeilingLight, mdiLightbulb, mdiLamp, mdiSnowflake,
  mdiThermostat, mdiWaterPump, mdiFlash, mdiSolarPanel, mdiBatteryHigh, mdiLeaf,
  mdiFlowerTulip, mdiSprout, mdiBarn, mdiTractor, mdiBriefcase, mdiSchool, mdiBabyBottle,
  mdiTeddyBear, mdiDog, mdiCat, mdiFishbowl, mdiSilverwareSpoon, mdiCupWater,
  mdiMicrowave, mdiToaster, mdiDishwasher, mdiIron, mdiTumbleDryer, mdiHairDryer,
} from '@mdi/js';
import { Icon } from './Icon';
import { SearchField } from './SearchField';
import { mdiClose, mdiEmoticonOutline } from '@mdi/js';

/** One catalog entry. `id` is the HA-format identifier we store ("mdi:sofa"). */
interface IconEntry {
  id: string;
  path: string;
  keywords: string;
}

// Curated set of icons that fit areas & floors. Not the full 7k MDI set — that
// would bloat the bundle and overwhelm the picker. Search matches the id + the
// extra keywords. Extend this list as needed.
const CATALOG: IconEntry[] = [
  { id: 'mdi:sofa', path: mdiSofa, keywords: 'living room lounge couch' },
  { id: 'mdi:sofa-single', path: mdiSofaSingle, keywords: 'armchair seat' },
  { id: 'mdi:seat-recline-extra', path: mdiSeatReclineExtra, keywords: 'recliner lounge' },
  { id: 'mdi:bed', path: mdiBed, keywords: 'bedroom sleep' },
  { id: 'mdi:bed-king', path: mdiBedKing, keywords: 'master bedroom sleep double' },
  { id: 'mdi:silverware-fork-knife', path: mdiSilverwareForkKnife, keywords: 'dining kitchen eat' },
  { id: 'mdi:silverware-variant', path: mdiSilverwareVariant, keywords: 'dining eat' },
  { id: 'mdi:silverware-spoon', path: mdiSilverwareSpoon, keywords: 'kitchen eat' },
  { id: 'mdi:table-chair', path: mdiTableChair, keywords: 'dining room table' },
  { id: 'mdi:fridge', path: mdiFridge, keywords: 'kitchen refrigerator' },
  { id: 'mdi:stove', path: mdiStove, keywords: 'kitchen oven cook' },
  { id: 'mdi:microwave', path: mdiMicrowave, keywords: 'kitchen' },
  { id: 'mdi:toaster', path: mdiToaster, keywords: 'kitchen' },
  { id: 'mdi:dishwasher', path: mdiDishwasher, keywords: 'kitchen' },
  { id: 'mdi:coffee-maker', path: mdiCoffeeMaker, keywords: 'kitchen coffee' },
  { id: 'mdi:countertop', path: mdiCountertop, keywords: 'kitchen' },
  { id: 'mdi:cup-water', path: mdiCupWater, keywords: 'kitchen drink' },
  { id: 'mdi:toilet', path: mdiToilet, keywords: 'bathroom wc restroom' },
  { id: 'mdi:shower', path: mdiShower, keywords: 'bathroom' },
  { id: 'mdi:bathtub', path: mdiBathtub, keywords: 'bathroom bath' },
  { id: 'mdi:toothbrush', path: mdiToothbrush, keywords: 'bathroom' },
  { id: 'mdi:hair-dryer', path: mdiHairDryer, keywords: 'bathroom' },
  { id: 'mdi:washing-machine', path: mdiWashingMachine, keywords: 'laundry utility' },
  { id: 'mdi:tumble-dryer', path: mdiTumbleDryer, keywords: 'laundry utility' },
  { id: 'mdi:iron', path: mdiIron, keywords: 'laundry utility' },
  { id: 'mdi:hanger', path: mdiHanger, keywords: 'closet wardrobe laundry' },
  { id: 'mdi:wardrobe', path: mdiWardrobe, keywords: 'closet bedroom' },
  { id: 'mdi:paper-roll', path: mdiPaperRoll, keywords: 'bathroom utility' },
  { id: 'mdi:garage', path: mdiGarage, keywords: 'car parking' },
  { id: 'mdi:car-back', path: mdiCarBack, keywords: 'garage car' },
  { id: 'mdi:car-sports', path: mdiCarSports, keywords: 'garage car' },
  { id: 'mdi:warehouse', path: mdiWarehouse, keywords: 'storage garage' },
  { id: 'mdi:television', path: mdiTelevision, keywords: 'living room media tv' },
  { id: 'mdi:gamepad-variant', path: mdiGamepadVariant, keywords: 'game playroom media' },
  { id: 'mdi:music', path: mdiMusic, keywords: 'media audio' },
  { id: 'mdi:piano', path: mdiPiano, keywords: 'music room' },
  { id: 'mdi:desk', path: mdiDesk, keywords: 'office study work' },
  { id: 'mdi:chair-rolling', path: mdiChairRolling, keywords: 'office study' },
  { id: 'mdi:briefcase', path: mdiBriefcase, keywords: 'office work' },
  { id: 'mdi:bookshelf', path: mdiBookshelf, keywords: 'library study books' },
  { id: 'mdi:book-open-variant', path: mdiBookOpenVariant, keywords: 'library study' },
  { id: 'mdi:school', path: mdiSchool, keywords: 'study kids' },
  { id: 'mdi:baby-carriage', path: mdiBabyCarriage, keywords: 'nursery kids baby' },
  { id: 'mdi:baby-bottle', path: mdiBabyBottle, keywords: 'nursery baby' },
  { id: 'mdi:teddy-bear', path: mdiTeddyBear, keywords: 'kids playroom nursery' },
  { id: 'mdi:dumbbell', path: mdiDumbbell, keywords: 'gym fitness exercise' },
  { id: 'mdi:weight-lifter', path: mdiWeightLifter, keywords: 'gym fitness' },
  { id: 'mdi:pool', path: mdiPool, keywords: 'swimming outdoor' },
  { id: 'mdi:hot-tub', path: mdiHotTub, keywords: 'spa jacuzzi' },
  { id: 'mdi:dog', path: mdiDog, keywords: 'pet animal' },
  { id: 'mdi:cat', path: mdiCat, keywords: 'pet animal' },
  { id: 'mdi:paw', path: mdiPaw, keywords: 'pet animal' },
  { id: 'mdi:fishbowl', path: mdiFishbowl, keywords: 'pet aquarium' },
  { id: 'mdi:vacuum', path: mdiVacuum, keywords: 'cleaning utility' },
  { id: 'mdi:broom', path: mdiBroom, keywords: 'cleaning utility' },
  { id: 'mdi:tree', path: mdiTree, keywords: 'garden outdoor yard' },
  { id: 'mdi:flower', path: mdiFlower, keywords: 'garden outdoor' },
  { id: 'mdi:flower-tulip', path: mdiFlowerTulip, keywords: 'garden outdoor' },
  { id: 'mdi:sprout', path: mdiSprout, keywords: 'garden plant' },
  { id: 'mdi:leaf', path: mdiLeaf, keywords: 'garden plant eco' },
  { id: 'mdi:grass', path: mdiGrass, keywords: 'garden lawn yard' },
  { id: 'mdi:fence', path: mdiFence, keywords: 'garden outdoor yard' },
  { id: 'mdi:greenhouse', path: mdiGreenhouse, keywords: 'garden plants' },
  { id: 'mdi:barn', path: mdiBarn, keywords: 'outbuilding farm' },
  { id: 'mdi:tractor', path: mdiTractor, keywords: 'farm outdoor' },
  { id: 'mdi:balcony', path: mdiBalcony, keywords: 'outdoor patio terrace' },
  { id: 'mdi:tools', path: mdiTools, keywords: 'workshop utility' },
  { id: 'mdi:wrench', path: mdiWrench, keywords: 'workshop utility' },
  { id: 'mdi:server-network', path: mdiServerNetwork, keywords: 'network rack utility' },
  { id: 'mdi:router-wireless', path: mdiRouterWireless, keywords: 'network wifi' },
  { id: 'mdi:door', path: mdiDoor, keywords: 'entry hallway' },
  { id: 'mdi:door-open', path: mdiDoorOpen, keywords: 'entry hallway' },
  { id: 'mdi:window-closed-variant', path: mdiWindowClosedVariant, keywords: 'window' },
  { id: 'mdi:ceiling-light', path: mdiCeilingLight, keywords: 'light lamp' },
  { id: 'mdi:lightbulb', path: mdiLightbulb, keywords: 'light lamp' },
  { id: 'mdi:lamp', path: mdiLamp, keywords: 'light' },
  { id: 'mdi:thermostat', path: mdiThermostat, keywords: 'climate hvac temperature' },
  { id: 'mdi:snowflake', path: mdiSnowflake, keywords: 'climate cooling ac' },
  { id: 'mdi:water-pump', path: mdiWaterPump, keywords: 'utility water' },
  { id: 'mdi:flash', path: mdiFlash, keywords: 'energy electrical' },
  { id: 'mdi:solar-panel', path: mdiSolarPanel, keywords: 'energy solar' },
  { id: 'mdi:battery-high', path: mdiBatteryHigh, keywords: 'energy battery' },
  // Floor / building icons
  { id: 'mdi:home', path: mdiHome, keywords: 'house floor' },
  { id: 'mdi:home-outline', path: mdiHomeOutline, keywords: 'house floor' },
  { id: 'mdi:home-roof', path: mdiHomeRoof, keywords: 'attic top floor' },
  { id: 'mdi:home-floor-0', path: mdiHomeFloor0, keywords: 'floor ground level 0' },
  { id: 'mdi:home-floor-1', path: mdiHomeFloor1, keywords: 'floor first level 1' },
  { id: 'mdi:home-floor-2', path: mdiHomeFloor2, keywords: 'floor second level 2' },
  { id: 'mdi:home-floor-3', path: mdiHomeFloor3, keywords: 'floor third level 3' },
  { id: 'mdi:home-floor-b', path: mdiHomeFloorB, keywords: 'floor basement cellar' },
  { id: 'mdi:home-city', path: mdiHomeCity, keywords: 'building' },
  { id: 'mdi:office-building', path: mdiOfficeBuilding, keywords: 'building floor' },
  { id: 'mdi:stairs', path: mdiStairs, keywords: 'floor staircase' },
  { id: 'mdi:stairs-up', path: mdiStairsUp, keywords: 'floor upstairs' },
  { id: 'mdi:stairs-down', path: mdiStairsDown, keywords: 'floor downstairs basement' },
  { id: 'mdi:layers', path: mdiLayers, keywords: 'floor level' },
  { id: 'mdi:map-marker', path: mdiMapMarker, keywords: 'location area zone' },
  { id: 'mdi:view-dashboard', path: mdiViewDashboard, keywords: 'area room generic' },
];

/** Resolve a stored "mdi:foo" id to its svg path, if it's in the catalog. */
export function iconPathFor(id: string | null | undefined): string | null {
  if (!id) return null;
  return CATALOG.find((e) => e.id === id)?.path ?? null;
}

interface IconPickerProps {
  /** Currently-selected icon id ("mdi:sofa") or null. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Fallback path rendered on the trigger when no icon is chosen. */
  placeholderPath?: string;
  label?: string;
}

/**
 * Compact icon-field: a trigger tile that opens a searchable grid popover.
 * Deals in HA-format ids ("mdi:sofa"); see CATALOG for the curated set.
 */
export function IconPicker({ value, onChange, placeholderPath = mdiEmoticonOutline, label }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG;
    return CATALOG.filter((e) => e.id.includes(q) || e.keywords.includes(q));
  }, [query]);

  const selectedPath = iconPathFor(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen(true); setQuery(''); }}
        aria-label={label ?? 'Pick an icon'}
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-ha-2xl border border-surface-lower bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary"
      >
        <Icon path={selectedPath ?? placeholderPath} size={22} className={selectedPath ? 'text-ha-blue' : undefined} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  className="fixed inset-0 z-[120] bg-black/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  className="fixed left-1/2 top-1/2 z-[121] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-4 shadow-[0_28px_64px_-24px_rgba(15,23,42,0.5)]"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <div className="mb-ha-3 flex items-center gap-ha-2">
                    <SearchField value={query} onChange={setQuery} onClear={() => setQuery('')} placeholder="Search icons…" autoFocus className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-ha-2xl text-text-secondary transition-colors hover:bg-surface-mid"
                    >
                      <Icon path={mdiClose} size={20} />
                    </button>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    <div className="grid grid-cols-6 gap-ha-2">
                      {value && (
                        <button
                          type="button"
                          onClick={() => { onChange(null); setOpen(false); }}
                          aria-label="No icon"
                          className="flex aspect-square items-center justify-center rounded-ha-xl border border-dashed border-surface-lower text-text-tertiary transition-colors hover:bg-surface-mid"
                        >
                          <Icon path={mdiClose} size={18} />
                        </button>
                      )}
                      {results.map((e) => {
                        const active = e.id === value;
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => { onChange(e.id); setOpen(false); }}
                            title={e.id.replace('mdi:', '')}
                            className={`flex aspect-square items-center justify-center rounded-ha-xl transition-colors ${
                              active ? 'bg-ha-blue/15 text-ha-blue ring-1 ring-ha-blue/40' : 'text-text-secondary hover:bg-surface-mid hover:text-text-primary'
                            }`}
                          >
                            <Icon path={e.path} size={22} />
                          </button>
                        );
                      })}
                    </div>
                    {results.length === 0 && (
                      <p className="py-ha-6 text-center text-sm text-text-tertiary">No icons match “{query}”.</p>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
