# Onboarding as a house wall — design brief

**For:** Claude Design (mockups + animation)
**Subject:** An alternative visualization for the first-run onboarding flow of a smart-home
"phone platform" prototype. Same questions, same answers, completely different stage.

---

## 1. The idea

Today onboarding is nine centered questions floating on an ambient shader background. It is
calm, but it is nowhere. This version puts the questions **inside a home**.

The camera sits inside a house, looking straight at an interior **wall**, drawn in 2.5D. It
travels sideways along that wall, one station at a time. Every question lives on a real
surface it has business living on: the front door, the intercom, the nameplate beside it, a
framed map, the staircase, the corridor doors, a shuttered window. You are not filling in a
form; you are walking down a hallway, and the hallway asks you things.

At the end of the wall there is a dark rectangle — a wall-mounted panel by the living room.
The camera pushes into it, its bezel grows past the edges of the screen, and inside is the
real product: the cool, dense, futuristic dashboard. That single move is the whole point of
the concept. **Onboarding is warm, hand-drawn, physical, and 2D. The dashboard is cool,
precise, luminous, and screen-native. The panel is the seam, and we walk through it.**

Everything below is in service of making that seam land.

---

## 2. Non-negotiables

These are constraints from the product, not suggestions.

1. **The questions and their copy don't change.** This is a re-skin of the stage, not a
   redesign of the flow. Exact strings are in §5.
2. **Type and controls never take perspective.** The wall may have depth, vanishing points,
   and cast shadows. Text, input fields, chips, toggles and the primary button stay flat and
   screen-aligned — 0° skew, 0° rotation, no foreshortening. Legibility and accessibility
   beat trompe-l'œil, always. The *surface* frames the question; the question itself is a
   flat, crisp panel sitting a few millimetres in front of it.
3. **One question per screen.** Never two stations legible at once (see §4, the occluder
   wipe).
4. **Everything is skippable and reversible.** A back arrow lives top-left throughout. The
   house must never look like it broke because someone skipped a step.
5. **The primary button holds one fixed position** across all nine stations — bottom-centre,
   56px tall, pill, in the app's blue. It is the one element that ignores the house entirely.
   Consecutive stations show the same pill in the same place; it must not animate between
   steps or it reads as a flash. This continuity is what makes the finale work (§7).
6. **No people, no avatars, no mascot.** The home is empty and waiting. You are the only one
   in it.
7. **No exterior establishing shot.** We never see the house from outside. We are always
   already inside it.

---

## 3. Stage construction — the parallax stack

The whole flow is **one continuous wall**, roughly 12 viewport-widths long, built as six
layers. Camera moves right; layer speeds are multipliers on camera translation.

| # | Layer | Speed | Contents |
|---|-------|-------|----------|
| L0 | Beyond | 0.15× | What's visible through openings: garden, a fence, a neighbour's roof, sky. Very low contrast, heavily atmospheric — this layer's job is to prove the wall has an outside, not to be looked at. |
| L1 | Wall plane | 1.00× | The stage. Plaster/paint/wallpaper, baseboard, the openings cut into it. All question surfaces are cut from or mounted on this layer. |
| L2 | Wall dressing | 1.00× | Frames, sconces, switch plates, the nameplate, cable runs, picture hooks, hairline cracks. Same speed as L1 but carries its own soft cast shadows, which is what sells the two as separate depths. |
| L3 | Mid ground | 1.25× | Floor, rug edge, console table, a plant, the stair rail, an umbrella stand. Bottom third of the frame. |
| L4 | Occluders | 1.60× | Foreground: the near edge of a doorframe, hanging leaves, the back of a chair, a curtain. Dark, out of focus, cropped by the frame. Used as a wipe (§4). |
| L5 | Air | 1.05× | Dust motes in the light shaft, a very slight warm haze, a vignette. ≤6% opacity. Never animates on its own except a slow drift. |

Notes:
- **Vertical is real too.** Baseboard sits at ~78% frame height on desktop; the wall runs off
  the top of the frame. We are standing, not floating.
- **The floor is only ever the bottom ~20%.** This is a wall-forward composition, not a room.
- L4 occluders sit at roughly every 1.35 viewport-widths so that each station transition has
  one available.

---

## 4. Camera and motion system

**Primary move — the lateral pan.** Station to station, the camera translates right.

- Station spacing: **1.35 × viewport width** (so the previous station is fully off-frame).
- Duration: **900ms**, ease `cubic-bezier(0.22, 1, 0.36, 1)` (this is the app's existing
  `EASE_OUT` — reuse it so the new flow matches everything else).
- **2% overshoot** past the target, then a **220ms settle** back. Gives the camera mass.
- Going back reverses it, same numbers, no shortcut.
- During the middle 40% of the pan, an L4 occluder crosses the frame. **The outgoing question
  panel is gone before the occluder clears, and the incoming one appears after.** The
  occluder is the wipe — it means we never see two questions, and it hides the fact that the
  wall is a repeating flat plane.
- Question panels themselves: out = 160ms fade + 8px drift left; in = 240ms fade + 12px rise,
  starting at 55% of the pan. Never scale them.

**Secondary move — the storey lift.** Used only between the floors station and each rooms
station (§5, steps 6–7). Camera rises one storey: **0.80 × viewport height, 1100ms**, same
ease, with the stair rail (L3) sliding past as the readable cue. Slight downward tilt of the
whole stack (≤2°) at the midpoint, returning to 0° on arrival — just enough to feel the
climb. This is the only vertical camera move in the flow.

**Tertiary move — the acknowledgment.** Every answer changes one physical thing on the wall
(§6). 300–450ms, always a property the object could actually do (a light turning on, a shutter
rotating, an engraving deepening). Never a bounce, never a sparkle, never confetti.

**Idle life.** When nobody is doing anything: the light shaft drifts ~2px over 8s, a leaf on
L4 moves, dust falls. Sub-perceptual. It should be impossible to point at, and obvious if you
turned it off.

**Total flow length** at default pacing: roughly 45–60 seconds of camera time if you never
pause to think. Nothing waits on an animation — every pan is interruptible and every station
is usable at frame one.

---

## 5. Station map

Nine stations. Copy is verbatim from the build; keep it.

### 1 — The front door (closed) · `hello`
> **"Let's make this home"**
> A few easy questions, nothing here is permanent.
> `[ Let's begin → ]`

Entry hall, seen from inside. The door is shut; a hard blade of afternoon light lies under it
and across the floor. Keys not yet on the hook. The Home Assistant logo sits where a peephole
or door knocker would — small, brass-ish, breathing very slowly (5s, ±6% scale). The question
panel floats over the door's middle panel.

**On continue:** the door doesn't open. The camera pans right *past* it. We were never
outside; we were always in.

### 2 — Two doorways · `path`
> **"How would you like to start?"**
> You can switch between these anytime.
> `Connect my home` — Link this screen to your Home Assistant and see your real rooms and devices.
> `Look around the demo home` — Explore a fully furnished sample home first. No setup needed.
> *(plus the dashed prototype note — keep it, verbatim)*

Two openings side by side in the wall. The left is a **real doorway** into a dim, lived-in
space — you can just make out a sofa arm and a warm lamp. The right is a **framed showroom
model** hung on the wall like a picture: a tiny, perfectly tidy, brightly lit cutaway house,
obviously a model. That's the demo, and the frame around it does the explaining that the copy
otherwise has to do.

The two option cards are flat panels in front of each opening, not inside them.

### 3 — The intercom · `connect`
> **"Let's find your home"**
> *(the URL + sign-in field; label copy as built)*

A wall-mounted entry panel beside the left doorway: brushed metal, one speaker grille, one
small amber status LED. The address field reads as the label strip on the panel. The LED is
the connection state — amber searching, a slow pulse while connecting, steady green on
success, and on failure it stays amber (never red; a failed connection is not an error, it's
a retry).

### 4 — The nameplate · `name`
> **"What should we call your home?"**
> This name greets you on the dashboard. Pick anything you like.
> *(big text field, placeholder "Home", suggestion chips: Our place · The nest · Casa · Hygge house)*

A blank plaque beside the door, at eye height — the one thing on this wall that has always
been unlabelled. As the user types, the letters appear **engraved into the plaque**, one
character at a time, with the tiny shadow an engraving has. The suggestion chips sit below as
flat pills; picking one engraves it in one 280ms pass.

This is the emotional centre of the flow. It is the moment the house becomes *theirs*, and it
deserves the most craft on the wall. If only one station gets a hero-quality mock, make it
this one.

### 5 — The framed map · `location`
> **"Where is your home?"**
> *(map with a draggable pin; `Continue` and `Skip for now`)*

A large framed map on the wall — the kind of stylized city print people actually hang. The
interactive map lives inside the frame's mount; the pin is a real brass push-pin stuck into
it, casting a small shadow. Dropping the pin makes the softest possible *tick*. Skipping
leaves the map pinless and the frame slightly askew — a deliberate, forgivable loose end,
never an error state.

### 6 — The staircase · `floors`
> **"How many floors does your home have?"**
> Floors group your rooms. One is perfectly normal.
> *(big −/+ stepper around a hero numeral)*

The wall opens into a stairwell. The **flights of stairs draw themselves upward** as the
count increases — one flight per storey, 380ms per flight, treads appearing bottom-to-top —
and retract on decrement. The hero numeral sits flat in front, at the same display scale as
the name field. The floor-name strip (`Ground floor · First floor · …`) reads as small labels
on the landings.

Where Home Assistant already knows the answer, the stairs are **already built** when we
arrive, and the subtitle changes to *"This is what Home Assistant already knows — adjust it
if it looks off."* That should feel like walking into a house that's already partly furnished.

### 7 — The corridor, once per storey · `rooms:N`
> **"Which rooms are on the ground floor?"** *(or "Which rooms do you have?" for a single-storey home)*
> Tap the ones in your home — we'll set them up in Home Assistant for you.
> `[ Continue with 4 rooms → ]`

A corridor wall with a row of **closed doors**, each with a dark transom window above it. The
room chips are flat pills in front. Selecting a room:

- the transom above that door **lights up warm** (300ms),
- a small hand-lettered sign drops onto the door with the room's name and icon.

Deselecting reverses both. The result is a physical read of progress: a dark corridor
gradually filling with lit doorways. At the end of each storey, the storey lift (§4) carries
us up to the next corridor, which starts dark again.

This station repeats — up to eight times for an eight-storey home. **Vary the corridors**
(door spacing, one with a window at the end, one narrower) so repetition doesn't read as a
bug, but keep them unmistakably the same house.

### 8 — The shuttered window · `analytics`
> **"Want to help make this better?"**
> *(four independent toggles: Share the basics · Send error reports · Share what you use · Share rough numbers)*

A tall window with **four horizontal louvered shutters**, one per toggle. Off = louver closed
flat. On = louver rotated open, letting a band of light in across the floor. Four toggles all
on = the window is open and the room is bright; all off = four dark bands and the room is
dim, and *that is a perfectly fine outcome the art must not punish.* Default is all-off; the
dim version is the one we ship as the default keyframe.

This is the clearest object-to-meaning mapping in the flow — how much you open up is how much
you share — and it does it without a single word of extra copy.

### 9 — The panel · `finale`
See §7. This one is the whole reason we built the hallway.

---

## 6. How the house acknowledges answers

One rule, applied everywhere: **the answer changes the house, not the UI.** No checkmarks, no
toast, no progress bar, no percentage. The progress indicator *is* how much of the wall is
behind you and how much of it is lit.

| Answer | The house does |
|---|---|
| Names the home | The plaque is engraved |
| Connects | The intercom LED goes steady green |
| Drops the map pin | A brass pin, with a shadow, in the frame |
| Adds a floor | A flight of stairs builds upward |
| Picks a room | That door's transom lights; a name sign drops |
| Opens an analytics toggle | A shutter louver rotates open; a band of light lands on the floor |
| Skips anything | Nothing lights, nothing breaks, nothing nags |

Going back must visibly *undo* the corresponding change. That reversibility is what makes the
whole thing feel safe to poke at, which is exactly what the copy promises ("nothing here is
permanent").

---

## 7. The finale — walking into the panel

The last stretch of wall opens up: the corridor gives way to the corner of a living room. On
that wall, at switch height, is a **dark rectangle** — a wall-mounted control panel, glass
face, thin bezel, currently off. It has been the one cool-toned object in a warm house since
the camera first saw it, four seconds ago, at the far right of frame.

**Shot by shot:**

1. **0ms — the pill.** The primary button is exactly where it has been for nine stations,
   bottom-centre, in blue.
2. **0–500ms — the pill becomes the panel.** The button *is* the transition: it keeps its
   fill and its rect at frame one, then grows, tips away from the camera (`rotateX`), and
   sweeps under the lens toward the wall. It must never visibly swap for another element —
   measure the button's rect and start the animation from exactly that rect. (This mechanic
   already exists in the current finale; keep it, it's the good part.)
3. **500–900ms — the panel wakes.** Glass goes from off-black to a deep charcoal with a faint
   cool gradient. A hairline of light traces the bezel.
4. **900–1900ms — the push-in.** The camera dollies straight into the panel. The bezel scales
   past all four edges of the frame. The warm house — wall, plant, light shaft — slides
   outward and blurs away. Parallax layers separate hard here: L4 blows past the camera, L0
   barely moves. This is the only true perspective move in the entire flow, and it should
   feel like it.
5. **1400–2400ms — the dashboard resolves.** Inside the panel, the real dashboard is *already
   running* — it was never a picture. It starts dark, blurred (~26px) and at 85% black, and
   the veil clears off it: blur to zero, dim to nothing, over ~1.9s. Cards, the hero, the
   device shelf and the dock arrive already in their live positions. **Nothing on the
   dashboard animates in.** The reveal is the veil leaving, not the UI assembling. That
   distinction is the difference between "we walked into the product" and "we played a
   loading animation".
6. **~2550ms — done.** Onboarding is gone. No confirmation screen, no "you're all set" panel
   to dismiss. The screen-reader-only heading says *"All set, welcome home"* and that's the
   only place those words appear.

Tapping anywhere skips straight to the end. Reduced motion: cross-dissolve from the wall to
the dashboard over 700ms, no dolly, no rotation.

**The one thing to get right:** at the exact midpoint of the push-in, the frame is half warm
plaster and half cool glass, and both are in focus. If that single frame doesn't look like
two worlds meeting, the concept hasn't landed — and no amount of easing will save it.

---

## 8. Light

**Constant late afternoon, the whole way through.** One low, warm sun source from the left,
around 25° above horizontal, throwing long soft shadows to the right. It does not change from
station one to station nine. The house is at its most inviting hour and it stays there.

What this buys us: every station is coherent, mockups are cheap to keep consistent, and the
only lighting *events* in the flow are the ones the user causes — a transom lighting, a
shutter opening, the panel waking. Those read as events precisely because the ambient light
never moves.

What it costs: the dashboard reveal doesn't get a free contrast boost from a darkening room.
Compensate in the art:
- The panel is the **only** cool-toned, only pure-dark object in a warm, mid-value house.
- Its immediate surroundings are the lightest part of the wall (bounce from the window), so
  the rectangle reads as a hole punched in a bright wall.
- Keep the house's value range **middle-heavy** — no true blacks anywhere except inside the
  panel. Then the dashboard's near-black is the darkest thing we've seen all flow, and it
  arrives glowing.

Shadow spec: two-tier. A tight contact shadow (2–4px, 25% opacity) under every mounted object
on L2, plus a long soft cast shadow (20–40px blur, 12% opacity, offset right). The contact
shadow is what makes the plaque feel screwed to the wall.

---

## 9. Art direction — four skins, one storyboard

Everything above (layers, camera, stations, acknowledgments, finale beats) is style-agnostic.
Mock the storyboard once, then treat these as **four interchangeable skins over it**, so the
choice can be made from real frames instead of adjectives. Use station 4 (the nameplate) as
the comparison shot for all four — it has type, an engraved surface, a light shaft, a cast
shadow, and a piece of L3 furniture, which is enough to judge any of them.

### A. Soft-lit flat vector, warm palette — *the safe strong choice*
Flat shapes, one soft light source, no outlines. Warm plaster, oak, wool, unglazed ceramic.
Value contrast does the modelling; almost no gradients except in the light shaft. Cozy
editorial illustration, close to what a good publication uses for a feature about houses.
**Why it wins:** maximum contrast against the dashboard's cool precision, which is the concept's
entire thesis. Cheapest to produce and to keep coherent across eight repeating corridors.
**Risk:** if it drifts even slightly generic it reads as stock illustration. The engraved
plaque and the brass pin are where it earns its keep — the craft has to be in those details,
because the big shapes are simple by design.

### B. Line-art blueprint that fills in — *the conceptual choice*
Opens as thin architectural linework on a paper-toned ground: hairline walls, dimension
marks, hatched floor. Each answer **materialises** the part it concerns — the plaque gains
brass and shadow, the staircase gains treads and wood, the corridor doors gain paint. By the
finale, the near half of the wall is fully rendered and the far end is still drawing.
**Why it wins:** it literalises the flow. You are drafting your home, and it is being built as
you answer. The acknowledgment moments (§6) become the most satisfying they can possibly be.
**Risk:** blueprint is a *cool*, technical language, so it fights the concept's warm-to-cool
seam — the finale has much less contrast to land against. Mitigate by making the
already-materialised parts genuinely warm and rich, so the finale still crosses a border. Also
the most animation work by a distance: every object needs two states and a transition.

### C. Painterly / soft-shaded — *the beautiful choice*
Gradient-shaded surfaces, visible brush or grain texture, real bounce light, soft-edged
shadows. Nearly a render, but hand-made. The light shaft becomes a volumetric event; the
plaster has tooth.
**Why it wins:** the highest ceiling of the four. If the goal is a flow people screenshot, this
is it, and the finale's half-warm/half-cool midpoint frame (§7) is spectacular here.
**Risk:** the most expensive to mock and the hardest to keep consistent — especially across
repeated corridors, where painterly variation is exactly what makes them look like different
houses. Also the most likely to make the flat, screen-aligned type panels (§2, rule 2) look
pasted on. If we pick this, the panels need their own material treatment: frosted glass with
a real edge, not a rectangle with opacity.

### D. Paper-cut layers — *the charming choice*
Every layer is literal cut paper: visible fibrous edges, hard drop shadows between planes,
slightly imperfect cuts. Parallax becomes the whole point, because you can *see* the gaps
between layers.
**Why it wins:** the storey lift and the occluder wipes look best here by far — the depth is
declared rather than implied, so the camera work reads instantly. Very memorable, very
ownable.
**Risk:** the loudest distinct voice; it reads as a children's book, and the dashboard on the
other side of the panel does not. That could be the best joke in the flow or a total tonal
break, and only a real frame will tell us which. Small text on cut paper is also the weakest
of the four for legibility — the flat panels have to sit clearly *above* the paper stack, with
their own shadow, or the whole thing turns to mush.

**Recommendation:** mock **A** as the baseline and **B** as the contender — they're the two
that argue with each other productively (contrast-first vs. concept-first). Mock **C** and
**D** as single-frame style probes of station 4 only, to price them before committing.

---

## 10. Responsive

**Desktop / landscape (1440×900 reference).** As described. Wall runs off the top of frame,
baseboard at ~78%, question panel centred with the primary pill anchored below page centre.
Two stations' worth of wall visible at rest — you can see a little of what's coming.

**Mobile / portrait (390×844 reference).** Same wall, same stations, camera much closer:
**one surface fills the frame.** The pan is still horizontal (never convert it to vertical
scrolling — the sideways travel *is* the metaphor), but station spacing drops to 1.1×
viewport width because the frame is narrower. The primary pill sits exactly where the app's
bottom nav lives, so finishing the flow fades it onto the nav. Occluder wipes matter more
here, not less: with less wall visible, they're the only cue that we moved rather than cut.
Keyboard-up state for the name and connect stations: the wall stays put, the panel rises,
nothing reflows.

**Tablet.** Landscape treatment, slightly closer camera.

---

## 11. Accessibility

- `prefers-reduced-motion`: no parallax, no pans, no dolly. Stations cross-dissolve in 250ms.
  All the wall art stays — it's the camera that stops, not the illustration. The finale is a
  700ms dissolve to the dashboard.
- Every acknowledgment in §6 has a non-motion, non-colour reading: the lit transom also gets
  its name sign, the open louver also changes value, the connected intercom LED also changes
  shape.
- Contrast is measured on the **flat panels**, not on the wall art. Panels get whatever
  backing they need — including a solid fill — to clear AA against their own text. The wall
  behind a panel is never allowed to be the reason text is hard to read.
- The house is decorative: `aria-hidden` on all of it. The step heading, the controls and the
  primary action are the only things in the accessibility tree, and focus moves to the new
  heading on every station change.
- Focus is trapped in the flow while it's up. Tab order: back arrow → heading → controls →
  primary. Never into the wall.

---

## 12. What not to do

- Don't skew, rotate, or perspective-map any text. Ever. (§2)
- Don't show the house from outside, and don't show a floor plan from above — we're at eye
  level, inside, for the entire flow. (The doll-house view is a different, valid concept; it
  isn't this one.)
- Don't animate the dashboard's cards in during the reveal. The veil leaves; the product was
  already there. (§7)
- Don't put a progress bar on it. The wall is the progress bar.
- Don't reward answers with sparkles, confetti, checkmarks or a "Nice!" — the house
  acknowledging is the reward. (§6)
- Don't punish skipping. An unpinned map and a dark corridor are valid, finished-looking
  states.
- Don't let the eight corridor repeats be identical, and don't let them be different houses.
- Don't clutter. This is a home someone is about to move into, not one they already live in.
  Empty, warm, waiting.

---

## 13. Deliverables

1. **Nine station keyframes**, desktop (1440×900) and mobile (390×844), in skin A.
2. **The wall as one continuous strip** — the whole 12-viewport run, so the pacing and the
   occluder placement can be judged as a single composition.
3. **Style probes** of station 4 (nameplate) in skins B, C and D. One frame each, desktop only.
4. **Three motion prototypes:**
   - a station-to-station pan, with the occluder wipe and the panel cross-fade;
   - one acknowledgment (recommend the analytics shutters — it's four toggles in one object);
   - the finale, pill → panel → push-in → veil clearing, at full length.
5. **The midpoint frame** of the finale push-in, called out on its own: half warm plaster,
   half cool glass, both in focus. That frame is the concept's thesis statement, and it's the
   one to review first.
