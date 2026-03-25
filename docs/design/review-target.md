> Historical design reference. Use [docs/architecture.md](../architecture.md) and [docs/reliability.md](../reliability.md) for the current product contract.

# Marginalia Design Review

Eight directions explored in Paper. This document captures our analysis of what works, what doesn't, and what the ideal synthesis looks like — grounded in the Marginalia ethos.

**Date**: 2026-03-06
**File**: Marginalia.paper (Page 1, 8 artboards)

---

## The Artboards

| Board | Name | Format | Key Traits |
|---|---|---|---|
| Hero | Marginalia - Active Review | 1280x1050 | Full three-column, email draft, CHANGES sidebar, three annotation types |
| A | The Galley | 1040x780 | Cormorant Garamond, literary personality, floating italic margin note |
| B | The Review | 1040x780 | IBM Plex, three-column minimalism, numbered gutter mark, unboxed annotation |
| C | The Writer's Proof | 1040x780 | Charter-esque serif, left border on manuscript, bare floating annotation |
| D | The Study | 1040x780 | Dark mode, paragraphs in card blocks, rounded annotation card |
| E | The Proof Sheet | 1040x780 | Swiss/modernist, bold sans, red strikethrough, all-caps status bar |
| F | The Redline | 1040x780 | EB Garamond, CHANGES sidebar, gutter marks, green highlight pills, margin annotations |
| G | The Margin | 1040x780 | Dark companion to F, Crimson Pro, same architecture |

---

## Rankings

### 1. F — The Redline (best small-format)

Every element has a distinct job and none are redundant. The CHANGES sidebar indexes what happened. Gutter marks anchor changes to specific paragraphs. Inline diff (salmon strikethrough + green highlight pills) shows exactly what left and what arrived. Right-margin annotation gives the human's rationale. EB Garamond as body typeface says this is a document worth reading carefully, not a terminal dump. Status bar ("esc close / cmd-N note / cmd-enter approve") is the clearest expression of the three available actions.

### 2. Active Review (best showcase)

The wider canvas lets all three columns breathe. Email draft content makes the use case immediately tangible. Three distinct annotation types (two edits + slop detection) demonstrate range. The warm cream / terra cotta / gold palette is the strongest color story across all eight boards — evokes old books and library stamps without feeling dusty. But it's a presentation piece, not necessarily the most elegant core implementation.

### 3. B — The Review (best minimal)

The one that best captures the margin note essence. Strips everything to: the text, the diff, one numbered annotation. No cards, no boxes, no backgrounds. Just typography doing all the work. Left metadata ("Investment Memo / DRAFT 1 / CLAUDE") grounds you, then gets out of the way. If Marginalia's ethos is about the intimate editorial moment — human makes a mark, writes a thought, done — B captures that with the least visual overhead.

### 4. A — The Galley (most literary)

Large Cormorant Garamond, italic annotation floating in the right margin like a professor's note. Feels like a physical artifact. Lacks structured navigation (sidebar, gutter marks) needed when a document exceeds one page.

### 5. G — The Margin (F's dark companion)

Warm text on dark surface is inviting for evening sessions. Derivative of F rather than a distinct direction.

### 6. C — The Writer's Proof (clean but thin)

The floating annotation has no visual tether to the text it refers to. In a longer document, you'd lose the mapping. The left border running down the manuscript is a nice galley proof reference.

### 7. D — The Study (interesting but heavy)

Card-based paragraph grouping suggests a "review one block at a time" interaction. But card borders add visual weight that fights reading. You look at containers instead of prose. Drifts from editorial metaphor into app pattern.

### 8. E — The Proof Sheet (too engineering)

Bright red-on-white strikethrough and bold black additions feel aggressive. Reads more like a code diff tool than a manuscript review surface. All-caps status bar reinforces engineering tone. Marginalia should feel like literature, not GitHub.

---

## Best Individual Elements

| Element | Winner | Why |
|---|---|---|
| Typography | A (The Galley) | Cormorant Garamond at large size says "this text deserves careful reading" |
| Annotation treatment | B (The Review) | Just a number and italic text. The annotation IS the margin note. No container. |
| Information architecture | F (The Redline) | Sidebar + gutter + inline diff + margin notes. Four layers, zero redundancy. |
| Diff rendering | F/G | Green highlight pills + salmon strikethrough. Deletions fade, additions glow. |
| Color palette | Active Review | Warm cream (#F7F3EE) + terra cotta (#A0523D) + gold (#D4A843). Warm and authoritative. |
| Dark mode | G over D | G keeps editorial structure. D's cards feel like UI, not editorial. |
| Status bar | F/G | Most scannable action vocabulary. |

---

## What the Best Designs Get Right About Marginalia

Marginalia is named after the notes people write in book margins. It's fundamentally about the human-to-text conversation — the moment someone reads machine output and talks back to it.

### 1. The prose is the protagonist

UI lives at the periphery, in the margins where it belongs. F does this best: EB Garamond body text is the center of gravity, everything else orbits.

### 2. Physical book as reference, not software IDE

A, B, and F evoke galleys, proofs, and margin notes. D's cards and E's Swiss minimalism drift toward app patterns. The right metaphor is the editorial desk, not the developer console.

### 3. Showing, not decorating

The diff should be visible but not aggressive. F/G's highlight pills nail this — clearly present, never shouting. E's bright red screams. Deletions should fade (they're leaving). Additions should glow (they're arriving).

### 4. Disposability through restraint

Marginalia exists for one session then exits. The design should feel transient — like reading proofs at a cafe, not configuring a persistent workspace. B and C honor this. Active Review and D risk feeling like applications.

### 5. Human rationale has equal status to the change

The annotations aren't error messages or code comments. They're the reason a human made a choice. A's italic prose, B's minimal numbered note, and F's circled-number-plus-margin all feel personal, not systemic.

---

## The Ship Target: Active Review

**Active Review is the primary design.** It's the one we're building toward. Everything else is a reference board — ideas to borrow from, not alternatives to choose between.

Active Review already has the right bones:
- Three-column layout with CHANGES sidebar, manuscript, and annotations
- The warm cream / terra cotta / gold palette (#F7F3EE / #A0523D / #D4A843) — strongest color story across all boards
- Real email draft content that makes the use case instantly tangible
- Three annotation types (edits + slop detection) demonstrating range
- 1280x1050 canvas gives every column room to breathe

### What to pull in from other boards

**From F (The Redline):** Gutter marks. The circled numbers anchoring changes to specific paragraphs. Active Review currently has the thin change indicator bars in the left margin, but F's numbered circles create a clearer visual link between the sidebar index and the in-text location. Also F's green highlight pills on addition text — the Frame-wrapped approach that actually renders in Paper.

**From B (The Review):** Annotation restraint. Active Review's right-column annotations currently sit in background cards (#EDE7DD). B proves you can drop the cards entirely — just a number and italic text, no container. The annotation IS the margin note. Consider stripping the card backgrounds to let the notes feel more like handwriting in a margin and less like UI cards.

**From A (The Galley):** Literary conviction. Cormorant Garamond's personality reminds us that the typeface choice signals "this text deserves careful reading." Active Review already uses Source Serif 4 for body and DM Sans for UI labels, which is solid. But A's lesson is to lean harder into the serif's expressiveness — let the manuscript text feel like literature, not like a form field.

**From F/G:** The "esc close / cmd-N note / cmd-enter approve" status bar vocabulary. Active Review's status bar already has similar actions but F/G's phrasing is the most scannable.

### What Active Review already does best (keep these)

- The CHANGES sidebar with colored dots and italic preview text
- DM Sans for UI labels (clean separation from manuscript serif)
- Terra cotta / gold color coding for edits vs. slop
- The wider 1280 canvas — the small-format boards (1040) feel cramped with all three columns
- Real email content with multiple paragraph types and edit scenarios

---

## Technical Notes (Paper Rendering)

Lessons learned during implementation:

- **Paper Text nodes** only accept: color, font properties, padding, borderRadius. No backgroundColor, boxShadow, outline, or textDecoration.
- **Highlight pills** require wrapping text in a Frame (via write_html replace). Frames support backgroundColor; Text nodes don't.
- **Inset box-shadow vignettes** render on artboards but require high opacity (0.08-0.25) to be perceptible. The repeating-conic-gradient CSS is not supported.
- **Gutter mark positioning** requires calculating the exact pixel gap between sidebar content edge and manuscript column start. The 24px right-padding zone of the left margin is the sweet spot.
