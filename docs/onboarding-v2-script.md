# A Home, Not a Setup Wizard

*Scripts for the UX discussion post / demo video about the onboarding concept.*
*Alternative title: "Not a wizard — a home onboarding."*

---

## Short form (~90 seconds)

Hi, I'm Marcin from the Open Home Foundation. 👋

This is a concept for the first real interaction someone has with Home Assistant. The idea in one sentence: **you shouldn't fill out a wizard — you should set up your home.**

Onboarding today is a form: fields, steps, jargon. But everything it asks for already has a physical counterpart people know intimately. So this concept draws a visual parallel for every step:

- **Naming your home** is writing the name on your front door.
- **Creating your account** is cutting your own key — your username shapes it, your password cuts it.
- **Inviting your household** is handing out keys on the keyring.
- **Setting the location** is a picture frame on the wall that becomes a living map.
- **Floors and areas** are shelves, and the areas are books you place on them.

Parallels like these explain abstract things without technical jargon — and jargon is exactly the wrong language for the first five minutes with a product that's supposed to feel like home.

Two more principles behind it:

1. **Show value before asking for effort.** Home Assistant already starts discovering devices the moment it boots — we just hide that until the end. Here, a quiet toast on the very first screen counts the devices already found nearby. There's something waiting for you; the setup is just the architecture to hang it on.
2. **A draft is enough.** The flow asks only for what a home needs before you walk in: what it's called, who has a key, where it stands, how many floors, which rooms. If it covers 80–90% of your real home, perfect — you refine it later, from inside.

The demo and the full walkthrough are below. I'd love to hear what resonates and what doesn't.

---

## Long form (full walkthrough script)

### 0 · Intro

Hi, my name is Marcin, I'm from the Open Home Foundation. This is the second roundup on onboarding, and I'd like to show a high-level concept of approaching it — the first real interaction a user has with Home Assistant — differently than usual.

You could summarize it as: **setting up your home, rather than going through a form, a wizard, or a stepper.**

The way I want to achieve that is by drawing parallels between what you're clicking and what it actually represents in your home. Parallels are a powerful tool for explaining abstract things. When we translate reality into a digital form, it's tempting to reach for technical jargon — and I think jargon is exactly the wrong form of communication here. So every step in this flow has a physical counterpart you already understand.

I'll go through each step, explain the high-level goal, and point out opportunities we already have and could simply use to our advantage.

### 1 · The welcome scene

*[show: the welcome screen — door, keyring, framed map, shelf with books]*

The first screen tries to encapsulate everything you're about to go through: there's a front door, a key on a ring, a framed picture, a shelf with books. That will read as obvious once you've been through the flow — it's the whole onboarding as one still life.

One thing worth noting: **today, while the user sits on the first onboarding screen, Home Assistant is already scanning the network for devices.** We just don't tell them until the very end. Here, a small toast rises over the button: *"3 devices found nearby"* — counting up as discovery trickles in.

That's the value proposition before any effort is asked: something is already waiting for you. You just need to put the architectural layer in place — the home — for it to live in.

> **UX note:** this leans on the *endowed progress effect* — people are far more likely to finish something they perceive as already started. The devices found "for free" are a head start on the goal, before the first tap.

### 2 · Name your home — the door

*[show: the door with the nameplate, name chips, typing a name]*

When the user begins, we start with the home name — represented as a name written on the front door. I can name it "Home," "The Lab," whatever; there are a few predefined suggestions to pick from. As I type, the name appears on the door.

That's simply *how you name a home.* No "instance name" field. A door with your name on it.

### 3 · Create your account — your own key

*[show: the keychain; typing a username changes the key's shape, typing the password changes its cuts]*

Once the home has a name, you create the first admin account — which is really just *access to your home.* Rather than a plain login-and-password form, we take the parallel of a key and make it yours:

- Your **username shapes the key** — one name gets a classic house key, another a dimple key, another a key card.
- Your **password cuts it** — the teeth, the drill pattern, the embossing change as you type.

Write a different name, get a different key. Change the password, the cuts change live. The abstract pair of credentials becomes the most familiar access object there is.

### 4 · Invite others — keys on the ring

*[show: grayed-out placeholder keys on the ring; focusing the field; a ghost key forming from the typed email]*

Since I've just set up my own key, I might as well cut one for my wife, my partner, my kids — or skip it entirely and do it later. Before I touch the field, a few grayed-out keys hang on the ring: the household that could be. When I type an email, one key takes shape from it and joins the ring on send.

Everyone joins as a guest; promoting someone to admin is a later, settings-level decision — not a question worth asking in the first five minutes.

> **UX note:** offering the invite right after the user created their own account rides the *foot-in-the-door effect* and simple task momentum — they're already in "handing out access" mode, so the second, similar ask is nearly free. And skipping is one tap.

### 5 · Where is your home — the picture on the wall

*[show: the framed pin; tapping it develops into a draggable map; the address appears in the frame's caption]*

Name, people — now, *where is it?* The location step is represented by a picture frame on the wall. Pictures are tied to places — they're from somewhere, often from home. Tap the frame and the photo "develops" into a real map; drag until your home sits under the marker, or search for the address. The caption under the photo fills in with the place it shows.

### 6 · Floors and areas — shelves and books

*[show: adding floors as stacked shelves; tapping room chips drops books onto the focused shelf]*

Then we get to something that is **not part of onboarding today, but is crucial to a basic setup of a home**: its structure.

Think of entering anyone's home for the first time. What do you register immediately? How many floors it has, and what the rooms are. That's the first mental map you build of any environment — so it should be the first map you build of your digital home too.

Floors are **shelves**, stacked bottom-up. Areas are **books** you place on each shelf — pick from predefined rooms or add your own. A crowded ground floor simply becomes a crowded shelf.

This is explicitly *not* meant to be a perfect setup. If it covers 80–90% of how your home is structured, that's enough. The point is that when you land in your dashboard, the discovered devices from step one have floors and rooms *waiting for them* — you place devices where they belong, instead of still wondering how many floors you have while a device list piles up.

### 7 · What leaves your home — postcards

*[show: the mailbox; toggling analytics adds postcards; all-on reveals the thank-you letter]*

The last step is the privacy question we already ask today: what are you willing to share with us? Each option is framed as an **anonymous postcard to Home Assistant** dropped in your mailbox — because that's what it is: occasional, small, one-directional.

One human touch: if someone turns everything on, one more letter appears — a **thank-you note to the Open Home Foundation.** A way to say "I appreciate the work, that's why I'm sending this." It's opt-in, it's warm, and it ends the flow on gratitude rather than on a consent checkbox.

> **Open question:** should this step be in onboarding at all? Today roughly 20% of installations share everything, and the analytics we collect are almost never used by us. If the data doesn't earn its place, the step is pure friction at the worst possible moment — worth a separate discussion.

### 8 · Into the home

*[show: the dashboard with the discovered devices]*

And after that — the regular dashboard experience, whatever it may be. The main focus of this exploration was the onboarding approach itself: by the time you arrive, your home has a name on the door, keys in people's pockets, a place on the map, floors, and rooms. The devices that were found while you were still at the door just need to be put away where they belong.

### 9 · What I'm asking the community

- Does the "home, not wizard" framing hold up for you — or does the metaphor get in the way anywhere?
- Is home structure (floors/areas) the right thing to *add* to onboarding, given the goal of minimal steps?
- Should the analytics step *leave* onboarding, given the 20% share rate and how little we use the data?
- Which parallels land, and which feel forced?

Thanks for reading — happy to share the prototype.

---

## Appendix — principles referenced

| Where | Principle | Why it applies |
|---|---|---|
| Discovery toast on the welcome screen | Endowed progress effect | A visible head start ("3 devices found") makes completing the setup feel like continuing, not starting |
| Whole flow | Mental models / recognition over recall | Doors, keys, shelves need no explanation; form fields do |
| Custom key from credentials | Self-relevance / personalization | An object that visibly becomes *yours* is worth more than a generic one |
| Invite right after account creation | Foot-in-the-door, task momentum | A second, similar ask while in flow is nearly free; skipping stays one tap |
| Floors & areas as a rough draft | Satisficing (80/20) | A "good enough" structure now beats a perfect one never |
| Thank-you letter at the end | Peak–end rule | The flow ends on a warm, human note instead of a consent form |
