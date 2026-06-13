# PokeMMO Breeding Mechanics (research reference)

> Implementation-ready reference for the breeding engine. **PokeMMO does NOT use mainline Pokémon breeding rules** — every section below is PokeMMO-specific. Where a mechanic is commonly confused with mainline, it is flagged. Confidence and source conflicts are called out explicitly; items flagged **[verify in-game]** should be confirmed before being treated as hard numbers.
>
> Primary source is the actively-maintained PokeMMO ShoutWiki, corroborated by the Fandom mirror, forums.pokemmo.com, and community guides (MMOKB, PokeMMO Hub). Sources are linked inline.

## 0. The one fact that shapes the whole app

**Both parents are permanently consumed by a single breed**, producing **exactly one egg/offspring**. The daycare does not return the parents; there is no "leave a pair in the daycare and collect eggs" loop. Breeding is a **one-shot fusion** of two parents into one child.

Consequences for the model:
- A breeding plan is a **consumption tree**: every node is spent to produce its parent node.
- Each owned Pokémon can be used in **exactly one** breed, then it is gone.
- Reaching N perfect IVs requires a pyramid of **2^(N−1)** base single-IV Pokémon and **2^(N−1) − 1** breeds (see §6).

Source: [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding). Confidence: **high**. No per-Pokémon "fertility counter" exists beyond consumption; treat the model as "1 breed, then gone."

## 1. Pairing requirements

- Two Pokémon of the **same egg group** and **opposite gender**.
- **Ditto** breeds with any gendered, non-genderless Pokémon regardless of gender.
- **Genderless** species (Magnemite, Beldum, fossils, etc.) can breed **only with Ditto**, every generation.
- The **offspring's species is the female parent's species** (or, in a Ditto pairing, the non-Ditto parent's species).

Source: [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding), [Fandom — Breeding](https://pokemmo.fandom.com/wiki/Breeding). Confidence: **high**.

## 2. IV inheritance — the core minigame

**No Destiny Knot exists in PokeMMO.** Any guide that says "Destiny Knot passes 5 IVs" is mainline contamination. (Confirmed by its absence on the wiki and by a forum thread *requesting it be added*: [forum](https://forums.pokemmo.com/index.php?/topic/77118-idea-for-destiny-knot-or-how-to-easily-breed-hidden-abilities/).)

**Default rule (no items):** of the baby's 6 IVs, **exactly 3 are inherited unchanged** from the parents (any split between them), and the **other 3 are the average of the two parents' IVs in those stats, rounded down**.

**Power items** — each forces the holder's IV in one specific stat to pass to the child (counts as one of the 3 inherited slots):

| Item | Stat forced |
|---|---|
| Power Weight | HP |
| Power Bracer | Attack |
| Power Belt | Defense |
| Power Lens | Sp. Atk |
| Power Band | Sp. Def |
| Power Anklet | Speed |

**Max 2 breeding items per breed (one per parent).** The standard competitive loadout is **one Power item on each parent**, each forcing the stat that parent contributes.

**Per-stat outcome probabilities** for a stat that is *not* force-pinned (each stat resolves to the higher parent's IV, the lower parent's IV, or their average):

| Power items in play | High IV | Average | Low IV |
|---|---|---|---|
| 0 (default) | — 3 stats inherited / 3 averaged overall — | | |
| 1 | 20% | 60% | 20% |
| 2 | 12.5% | 75% | 12.5% |

**This is fundamentally an averaging/convergence model.** Stacking two high-IV parents trends toward the average; the deterministic way to *lock* a 31 is to Power-item-pin that stat. The pyramid works by pinning one specific 31 per parent per layer.

Source: [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding), [ShoutWiki — Breeding Items](https://pokemmo.shoutwiki.com/wiki/Breeding_Items). Confidence: **high** on the model and item→stat map; **medium-high** on the exact 20/60/20 and 12.5/75/12.5 splits (single authoritative source, internally consistent) **[verify in-game]**.

## 3. Nature inheritance

- **Everstone** held by a parent passes that parent's nature to the child. Put it on **only one** parent (the one with the target nature). Model nature as "carried if a parent holds Everstone with the desired nature."
- The official Everstone item text says it **always** passes the holder's nature; some older community guides say **50%** (the pre-Gen-V mainline value). **This is the one genuine source conflict on nature.** Default the engine to **guaranteed with a single Everstone**, but expose the pass-rate as a configurable constant. **[verify in-game]**
- **No Nature Mints in PokeMMO** — there is no item to rewrite an existing Pokémon's nature; nature is controlled only via Everstone breeding. (Confirmed by an active suggestion thread requesting mints: [forum](https://forums.pokemmo.com/index.php?/topic/176510-neutralizing-mint/).)

Sources: [ShoutWiki — Everstone](https://pokemmo.shoutwiki.com/wiki/Everstone), [ShoutWiki — Breeding Items](https://pokemmo.shoutwiki.com/wiki/Breeding_Items), [MMOKB](https://mmokb.com/pokemmo-breeding-complete-guide/).

## 4. Ability & Hidden Ability inheritance

- **Regular ability:** when a species has two normal abilities, the child has a high chance (~**80%**) to inherit the **female parent's** ability (Ditto pairing: the non-Ditto parent's). The **80%** figure is widely-repeated community consensus, **not** first-party-documented — treat the *direction* as solid, the exact number as **medium confidence**. **[verify in-game]**
- **Hidden Ability (HA):** passes **only if the female-role parent has the HA**. It does not appear spontaneously and Ditto cannot carry an HA to pass.
- **HA is sourced from Alpha Pokémon** (see §7) — Alphas introduce the HA for their species. There is **no Ability Patch/Capsule** in PokeMMO to convert a normal Pokémon to its HA.
- **Ability Pill** ($35,000, from the daycare) switches a Pokémon between its **two regular** abilities after the fact; it does **not** affect Hidden Ability.

**Engine implication:** to breed an HA child, an HA-carrying female-role parent of the line must exist at every generation where HA is to be preserved. Warn when the user wants an HA child but the only HA carrier is male-only/genderless and only Ditto is available — that line cannot propagate HA until an HA female of the species exists.

Sources: [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding), [Fandom — Breeding](https://pokemmo.fandom.com/wiki/Breeding), [ShoutWiki — Alpha Pokémon](https://pokemmo.shoutwiki.com/wiki/Alpha_Pok%C3%A9mon), [ShoutWiki — Gift Shop](https://pokemmo.shoutwiki.com/wiki/Gift_Shop), HA guide: [forum](https://forums.pokemmo.com/index.php?/topic/147619-hidden-ability-breeding-guide/).

## 5. Gender determination & fees

- Baby gender follows the species' **wild gender ratio** by default.
- Gender can be **forced** by paying the daycare man a fee scaled to that ratio: **$5,000** for a 1:1 species, up to **$25,000** for the minority gender of a **7:1** species. Intermediate tiers (e.g. 3:1) aren't fully enumerated on the wiki — model the documented endpoints and treat intermediate tiers as "scaled". **[verify in-game]**
- Low-female-ratio species (many pseudo-legendaries at 7:1) are expensive: you need female carriers at each step and may pay up to $25k/step to force female offspring.

Source: [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding), [Fandom — Breeding](https://pokemmo.fandom.com/wiki/Breeding). Confidence: **high** on endpoints.

## 6. The breeding pyramid

Standard chart, building from **single-31-IV ("1×31") base Pokémon**, each internal breed adding one guaranteed 31 via a Power item:

| Target | Base 1×31 mons | Total breeds | Power-item cost | + gender selection (example) |
|---|---|---|---|---|
| 2×31 | 2 | 1 | $20,000 | +$25,000 |
| 3×31 | 4 | 3 | $60,000 | +$75,000 |
| 4×31 | 8 | 7 | $140,000 | +$175,000 |
| 5×31 | 16 | 15 | $300,000 | +$375,000 |
| 6×31 | 32 | 31 | $620,000 | scales similarly |
| 5×31 + Nature | 32 | 31 | $620,000 | +$775,000 |

- **Base count = 2^(N−1)**; **total breeds = 2^(N−1) − 1**, for N perfect attributes.
- **A nature counts as an added "attribute"**: it doubles the tree the same way an extra IV does (one base mon dedicated to the correct nature, carried up via Everstone). So model cost generically as: *each desired perfect attribute (an IV, or the nature) doubles the base count.* The 31-breed row is shared by "6×31" and "5×31 + nature"; for 6×31 **with** a nature, go one tier further again.

**Per-layer structure:** bottom layer = 1×31 mons (each perfect in exactly one target stat, acquired by catching/hordes). Each internal breed pairs two parents and puts a Power item on each, forcing the two stats being merged so they pass at 100% rather than averaging. A dedicated nature mon is carried up every layer with Everstone.

Confidence: **high** on rows 2×31–5×31 and the 2^(N−1) formula (directly tabulated); **medium** on the 6×31-vs-5×31+nature labeling of the 31-breed row (same count). Source: [ShoutWiki — Money Making / Breeding for Profit](https://pokemmo.shoutwiki.com/wiki/Guide:Money_Making/Breeding_for_Profit).

## 7. Alpha Pokémon

- Alphas are special spawns that **carry their species' Hidden Ability**, come with **2 guaranteed perfect IVs**, and have cosmetic tells (larger follower, red battle outline, special icon/cry).
- **Alphas can be bred, but "Alpha" status carries to the child only if BOTH parents are Alpha.** Alpha × non-Alpha → ordinary offspring (but the child still inherits the usual things: HA if the Alpha was the female-role parent, IVs, nature via Everstone, moves).
- Typical use: a single Alpha is the **HA seed** — consumed in one breed; the child is non-Alpha but keeps the HA if the Alpha was female-role.
- Obtained from **Alpha Swarms** (roughly once per in-game day, time/location random).

**Engine implication:** Alpha is a second "both-parents-required" flag (parallel to shiny×shiny) and the primary HA source. Source: [ShoutWiki — Alpha Pokémon](https://pokemmo.shoutwiki.com/wiki/Alpha_Pok%C3%A9mon), [forum](https://forums.pokemmo.com/index.php?/topic/147290-can-you-breed-alpha-mons/).

## 8. Shiny

- **No Masuda method / no breeding-based shiny boost.** Breeding does not improve shiny odds.
- **shiny × shiny → guaranteed shiny offspring.** This is the only way breeding interacts with shininess.
- **shiny × non-shiny is an invalid pairing** (hard restriction — disallow it).
- Base shiny rate **1/30,000** (wild-encounter modifiers like Donator/Shiny Charm/hordes apply to *encounters*, not breeding).

**Engine implication:** model shiny as a **non-breedable owned flag** with two rules — disallow shiny↔non-shiny pairings, and treat shiny×shiny as a guaranteed-shiny child. Do not offer "breed for shiny odds." Source: [ShoutWiki — Shiny Pokémon](https://pokemmo.shoutwiki.com/wiki/Shiny_Pok%C3%A9mon), [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding).

## 9. Egg moves

- The child inherits a move if **either parent knows it** and the child's species can legally learn that move by any method (level-up, TM, egg move, tutor). **Not father-only** — this is a PokeMMO divergence from mainline.
- A parent can carry a normal level-up/TM move that becomes an "egg move" on the child.
- **Egg-move chaining** across egg groups works (pass a move into an intermediate species, then breed toward the target).
- Any move the child is born knowing can later be re-taught via the Move Relearner (Heart Scales) if forgotten.

**Engine implication:** model each desired egg move as a constraint requiring **at least one parent** in the final pairing to know it; because parents are consumed, required moves must be propagated **up** the tree. Support multi-step chaining when the target species can't directly source a move. Tool reference: [PokeMMO Hub — Egg Moves Helper](https://pokemmohub.com/tools/egg-moves-calculator/). Sources: [Fandom — Breeding](https://pokemmo.fandom.com/wiki/Breeding), [forum: moves inherited](https://forums.pokemmo.com/index.php?/topic/139644-how-are-moves-inherited-when-breeding/), [forum: normal moves as egg moves](https://forums.pokemmo.com/index.php?/topic/144947-normal-moves-as-egg-moves/).

## 10. Hatching, daycare, misc

- Breeding is done at the **daycare** (daycare man in each region); you submit two parents and receive an egg immediately.
- Eggs hatch after a **set amount of time** (real/playtime), **not step-based**. Hatch time is reduced by a first-slot **Flame Body / Magma Armor** Pokémon and by **−10% Donator status**. (Not part of IV math; informational.)
- **No friendship/level/EV requirement** to breed.
- **OT / tradeability:** offspring tradeability depends on whether the **mother** is in your OT-dex; otherwise the child is flagged restricted (OT\*). Relevant only if the app ever models trading. **[niche]**

Source: [ShoutWiki — Breeding](https://pokemmo.shoutwiki.com/wiki/Breeding), [forum: breeding with OT](https://forums.pokemmo.com/index.php?/topic/173618-breeding-with-ot/).

## 11. Cost model summary (for the estimator)

Per-breed and per-tree costs the estimator should sum:

| Cost | Amount | Frequency | Consumed? |
|---|---|---|---|
| Power item | $10,000 each | up to 2 per breed | **consumed** |
| Everstone | (market) | 1 per nature-carrying line | see open question below |
| Gender-selection fee | $5,000–$25,000 (by ratio) | per breed where needed | n/a (fee) |
| Ability Pill | $35,000 | once, post-breed ability fix | consumed |
| Ditto | (market) | every step for genderless lines | consumed (as a parent) |

- **No flat breeding fee** beyond items + gender selection.
- **Open question [verify in-game]:** whether **Everstone is consumed vs reusable**. The item is nominally "reusable," but its holder is destroyed during the breed, so in practice it is likely lost each breed. Sources conflict; the wiki cost tables only balance arithmetically if breeding items are per-breed costs. **Default the engine to treating Everstone as consumed-per-breed, behind a configurable constant.**

## 12. PokeMMO-unique gotchas (vs mainline) — checklist for the engine

1. Both parents **consumed** every breed → consumption tree, no reuse. *(mainline: parents survive)*
2. **No Destiny Knot.** IVs are **3-inherited + 3-averaged**, not "inherit 5 verbatim."
3. **Averaging model** → pin stats with Power items (20/60/20 one item, 12.5/75/12.5 two items).
4. **Everstone = (default) 100% nature**, carried as a separate doubling dimension.
5. **Breeding items consumed per breed** → cost is per-breed, not one-time.
6. **Gender selection is a paid per-breed option** ($5k–$25k).
7. **Egg moves from either parent** (not father-only).
8. **HA only via female-role parent, sourced from Alphas**; no Ability Patch/Capsule.
9. **Shiny not breedable for odds**; shiny×shiny guaranteed, shiny×non-shiny invalid.
10. **Alpha status only if both parents Alpha**; Alpha is the HA seed.
11. **Genderless ⇒ Ditto every step.**
12. **No** Nature Mints, Ability Capsule/Patch, or "Breeding Briar" item exist.

## Open questions to confirm in-game before shipping hard numbers

1. Everstone **consumed vs reusable** when the holder is destroyed (§11) — default: consumed.
2. Everstone nature pass rate **"always" vs 50%** (§3) — default: guaranteed with one Everstone.
3. The **20/60/20** and **12.5/75/12.5** IV probability splits (§2) — single-sourced.
4. The **~80%** regular-ability mother-pass rate (§4) — community consensus, not first-party.
5. **Intermediate gender-fee tiers** (e.g. 3:1) (§5) — only 1:1 and 7:1 endpoints documented.
6. **Regional-form inheritance** specifics — under-documented; PokeMMO implements fewer regional forms than mainline.

All six are isolated as **configurable constants** in the cost/inheritance model so they can be corrected without touching engine logic.
