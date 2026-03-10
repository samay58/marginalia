> Historical redesign prompt. Useful for visual direction, but not the source of truth for the current architecture or bundle/schema behavior.

# Marginalia Redesign Handoff Prompt

Use this when you want ChatGPT Pro or another web app to produce an implementation-grade redesign spec for Marginalia.

## Recommended Inputs To Attach Or Connect

If the web app cannot access the local repo directly, provide these files:

- `README.md`
- `WALKTHROUGH.md`
- `DEEP-DIVE.md`
- `POLISH-SPEC.md`
- `DESIGN-REVIEW.md`
- `package.json`
- `src/routes/review/+page.svelte`
- `src/app.css`
- `src/lib/components/Header.svelte`
- `src/lib/components/ChangeRail.svelte`
- `src/lib/components/Editor.svelte`
- `src/lib/components/AnnotationPopover.svelte`
- `src/lib/stores/app.js`
- `src/lib/utils/diff.js`
- `src/lib/utils/semantic-diff.js`
- `src/lib/utils/bundle.js`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `hooks/post-write.sh`

If you also have implementation exports from the Paper design or companion mock implementation, provide those too:

- React component files
- Tailwind CSS / utility-based styling files
- any design-token files, mock data files, or exported asset references that came with the design

If possible, also provide:

- screenshots or a short recording of the current review UI
- exported images of the target Paper boards
- the Paper design link: `https://app.paper.design/file/01KK15BXTG9HA0PDMKA68TA7GG`

Important:
- treat the React/Tailwind design files as reference material for the target visual system and interaction intent
- do not treat them as the target implementation stack
- the actual product must be specified for Marginalia’s real architecture and codebase

## Copy/Paste Prompt

```text
You are acting as a senior product designer, staff desktop frontend engineer, and reliability-minded product spec writer.

Your job is to produce a detailed, implementation-grade redesign specification for Marginalia. This is not a moodboard exercise and not a generic “refresh the UI” writeup. The output must be concrete enough that I can hand it to an implementation agent later and have it build the redesign reliably in the existing codebase.

Important: do not invent context. If you cannot inspect the Paper design file or the current app/screenshots, explicitly say what is blocked and request the missing asset. Do not fake visual details.

Also: if I provide React/Tailwind design files exported from the Paper design or a related mock implementation, you should inspect them closely for layout, token, component, and interaction intent. But you must translate that intent into Marginalia’s real implementation constraints rather than proposing a React/Tailwind port.

## What Marginalia Is

Marginalia exists because the normal AI draft feedback loop is lossy:
1. an AI agent writes a long draft,
2. the human edits it in a real editor,
3. then the human translates those edits back into instructions,
4. and nuance dies in that translation.

Marginalia is meant to keep feedback in-band with the agentic CLI loop. When a draft hits disk, a lightweight native review UI opens immediately. The user edits inline, optionally attaches short rationales to specific edits, leaves session-level notes if needed, and then exits. On close, Marginalia writes a review bundle that the agent can consume directly.

This app is intentionally disposable software:
- open fast
- do one job
- capture edits + intent
- get out of the way
- close cleanly

It is explicitly not meant to become a full document editor, notes app, or multi-document workspace.

## What The App Does Today

Current workflow:
- a draft file lands on disk, usually through an agentic CLI hook
- Marginalia opens a native desktop review window
- the user edits inline
- the user can attach a short rationale to a change
- the user can add general session notes
- the user closes with `Esc` or `Cmd+Enter` or the current `Done` action
- the app writes a bundle directory containing:
  - `original.md`
  - `final.md`
  - `changes.json`
  - `annotations.json`
  - `summary_for_agent.md`
  - `changes.patch`
  - `provenance.json`

The summary is the primary agent-facing output, but the other artifacts matter for trust, automation, debugging, and provenance.

## Current Stack And Constraints

This is an existing desktop app. Do not spec a rewrite into a different stack unless there is a very strong, evidence-based reason.

Current stack:
- Tauri 2 for the native shell
- Rust for thin filesystem / CLI / window commands
- Svelte 5 + SvelteKit for the frontend
- Milkdown / ProseMirror for the editor
- diff-match-patch for diffing
- vanilla CSS with custom properties for the design system

Important implementation reality:
- the desktop review UI lives at `/review`
- the marketing page at `/` is not the redesign target
- Tauri loads the `/review` route
- the Rust layer is intentionally thin
- frontend code owns most product logic
- styling is currently vanilla CSS with custom properties, not Tailwind
- any React/Tailwind design files I provide are reference implementations only
- the spec must explain how to translate those references into Svelte components, existing stores/utilities, Milkdown editor constraints, and the current token system

## Current Product / UX Principles To Preserve

Do not lose these:
- prose is the protagonist
- editorial / manuscript / margin-note metaphor, not IDE chrome
- human rationale has equal status to the literal text change
- the app should feel lightweight, transient, and sharp
- feedback must remain machine-consumable and reliable
- the redesign must preserve the app’s core contract, not just its appearance

## Current Review UI Structure To Understand Before Specifying Changes

Inspect the current implementation and describe it accurately before proposing changes. You should specifically inspect:
- `src/routes/review/+page.svelte`
- `src/app.css`
- `src/lib/components/Header.svelte`
- `src/lib/components/ChangeRail.svelte`
- `src/lib/components/Editor.svelte`
- `src/lib/components/AnnotationPopover.svelte`
- `src/lib/stores/app.js`
- `src/lib/utils/diff.js`
- `src/lib/utils/semantic-diff.js`
- `src/lib/utils/bundle.js`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `hooks/post-write.sh`

You should understand the current UI as including, at minimum:
- a header with filename, density switch, `Esc` hint, and `Done` button
- a left-side change rail
- a central editor/manuscript surface
- an optional right-side reference panel
- a bottom notes + lint panel
- annotation popovers
- density modes (`Review` and `Manuscript`)
- dark mode support
- autosave / recovery / degraded mode handling

Important current-state nuance:
- the live review route is not yet the exact Paper three-column annotation composition
- today it is effectively `change rail + editor + optional reference panel`, with notes/lint docked at the bottom
- inline diff presentation currently emphasizes insertions inside the editor; deletions are represented more strongly in the rail and bundle artifacts
- there is also a `Gutter` component in the codebase, but it is not the active mounted review navigator right now

## Current Visual / Interaction Details That Matter

Do not wash these out into generic SaaS design:
- warm “paper and ink” visual language
- serif manuscript text, distinct UI typography, restrained radii
- warm accent action color rather than generic blue
- manuscript/editorial atmosphere rather than coding-tool atmosphere

Current accent tokens in code:
- light mode: `--accent: #C17F24`, `--accent-hover: #D4922E`
- dark mode: `--accent: #DBA044`, `--accent-hover: #E8B054`

Preserve that warm brown-orange action language for interactive controls, especially action states and hover states around controls like:
- `Esc`
- annotate / rationale actions
- undo / redo actions
- `Done`

If you recommend changing the exact values, justify it and keep the family recognizably warm.

## Design Target

The design direction we are proceeding with is:
- the `Marginalia Active Review` board from the linked Paper file, specifically the first board
- plus the equivalent design translated thoughtfully into dark mode

The local design review notes already identify Active Review as the ship target, with these key ideas:
- three-column layout with changes sidebar, manuscript, and annotations
- warm cream / terra cotta / gold palette
- prose-first editorial tone
- manuscript-forward layout
- design should feel like an editorial desk, not an engineering diff tool

The notes also suggest useful influences from other boards:
- clearer gutter marks / numbered anchors
- more restrained annotation treatment
- literary confidence in typography
- strong status/action vocabulary

Do not just rely on those notes. Inspect the actual Paper design if you can. If the Paper file is not accessible, ask for exports/screenshots before finalizing visual recommendations.

If I provide React/Tailwind files derived from that design, treat them as an additional artifact that clarifies:
- spacing rhythm
- intended component composition
- responsive assumptions
- interaction states
- token naming or palette choices

But do not mistake that artifact for the app’s real codebase. Your job is to translate that design artifact into how Marginalia should actually be implemented.

Paper file:
`https://app.paper.design/file/01KK15BXTG9HA0PDMKA68TA7GG`

The design we are moving forward with is the first `Marginalia Active Review` board and its dark-mode counterpart.

## Reliability / Quality Context

This redesign spec must respect that the app also has a reliability agenda. Some of this is already shipped and should not be accidentally regressed:
- stable change interaction model
- semantic diff channel
- safe close behavior
- autosave snapshots and recovery
- degraded mode fallback
- bundle contract v2 with patch + provenance
- sync/async hook orchestration with single-instance queue
- dark-mode first paint handling
- motion/performance tuning

You are not being asked to implement the reliability pass now, but your spec must include a dedicated section for later reliability / packaging / performance hardening so that the redesign does not create regressions.

## What You Must Produce

Produce a detailed spec with the sections below.

### 1. Product Understanding

Summarize:
- what Marginalia is for
- why it exists
- the user’s job-to-be-done
- what absolutely must not change about the product contract
- what the redesign is trying to improve

### 2. Current-State Audit

Create a grounded audit of the current implementation:
- existing architecture and file ownership
- layout structure
- component inventory
- current visual language
- interaction model
- already-shipped reliability features
- current UX pain points or mismatch against the Paper target

Be explicit about what is working well and should be preserved.

### 3. Paper-to-Product Translation

Translate the Paper design into the actual app, not a generic web mock.

For each major area, specify:
- what the Paper design appears to intend
- how that maps onto the current Marginalia product model
- how it should be implemented in the existing Tauri/Svelte/Milkdown architecture
- what should remain unchanged because of product or technical constraints

You must also explicitly translate any provided React/Tailwind design artifact into Marginalia’s implementation model:
- what in that artifact is purely presentational
- what implies a reusable interaction pattern
- what can map cleanly to existing Svelte components
- what conflicts with Milkdown/editor constraints
- what should become CSS custom properties, shared utility classes, or component-local styles in this codebase

Cover at least:
- window-level composition
- header / action bar
- change rail / change index
- whether a gutter-like anchor system should return, and if so how it coexists with or replaces the current rail
- manuscript/editor surface
- inline diff presentation
- rationale / annotation presentation
- notes + lint area, including whether it should remain a footer dock or be integrated differently
- reference panel behavior if retained
- keyboard-first action vocabulary
- density modes
- dark mode

### 4. Detailed Visual Spec

Give an implementation-grade visual spec, not vague adjectives.

Include:
- layout grid and column behavior
- spacing system
- typography roles and pairings
- color/token system for light and dark modes
- surface treatment
- borders / radii / shadows
- diff colors and rationale styling
- motion guidance
- focus / hover / pressed / selected states
- responsive behavior if any matters for the current desktop constraints

Be precise about which current tokens can stay, which should change, and which new tokens should be introduced.

### 5. Component Mapping

Create a component-by-component mapping that an implementation agent can follow.

For each relevant file/component:
- current responsibility
- redesign responsibility
- keep / modify / simplify / replace
- key implementation notes
- risks / dependency notes
- if relevant, how ideas from the React/Tailwind design artifact should map into this component without importing that stack literally

At minimum include:
- `src/routes/review/+page.svelte`
- `src/lib/components/Header.svelte`
- `src/lib/components/ChangeRail.svelte`
- `src/lib/components/Editor.svelte`
- `src/lib/components/AnnotationPopover.svelte`
- any relevant supporting stores / utils / Tauri files

### 6. Behavioral And Interaction Spec

Specify:
- primary user flows
- action hierarchy
- keyboard shortcuts and discoverability
- annotation creation/editing/removal behavior
- how change selection should behave
- empty states
- loading / error / degraded states
- recovery/autosave surfaces
- visual feedback for “done”, “saved”, and “degraded mode”

### 7. Accessibility And Quality Bar

Spell out:
- accessibility requirements
- contrast expectations
- keyboard interaction expectations
- reduced-motion expectations
- text legibility requirements
- dark mode legibility requirements

### 8. Reliability / Performance / Packaging Follow-On

Create a dedicated section for the later engineering pass. It should identify:
- likely reliability-sensitive surfaces in the redesign
- performance-sensitive surfaces
- packaging/distribution concerns
- regression risks
- recommended verification plan

This section should align with the current architecture instead of proposing abstract best practices.

### 9. Phased Implementation Plan

Produce a realistic phased rollout plan that an implementation agent could execute.

For each phase, include:
- goal
- files likely touched
- order of operations
- testing / QA expectations
- risk level

Prefer phases like:
- foundation / tokens / layout scaffolding
- component redesign
- interaction refinement
- dark mode parity
- reliability / performance hardening
- QA / packaging verification

### 10. Acceptance Criteria

Write a concrete acceptance checklist that can be used later during implementation review.

Include:
- visual parity criteria
- interaction criteria
- non-regression criteria
- reliability criteria
- dark mode criteria
- packaging / build / run criteria

### 11. Open Questions

End with the smallest possible list of genuinely unresolved questions. Do not use this section to avoid doing the work.

## Working Style Requirements

You must:
- think from the actual codebase and actual design artifacts
- avoid generic React/Tailwind redesign advice
- avoid cargo-culting class names or component structure from reference design code
- avoid speculative architecture rewrites
- avoid turning the app into a broader product than it is
- preserve the disposable-software philosophy
- preserve bundle/review workflow integrity
- preserve the warm editorial personality

You must explicitly state:
- which facts came from code/docs
- which facts came from inspecting the Paper design
- which recommendations are your own synthesis

## Output Format

Your output should be a rigorous spec, with clear sections and tables where helpful.

It should read like a handoff document to an implementation agent, not a marketing writeup.

When you make a recommendation that differs from the current implementation, explain:
- why the current implementation falls short
- why the Paper design is better
- how to implement the improvement without breaking Marginalia’s product contract
- how to translate any React/Tailwind design reference into Marginalia’s actual Tauri/Svelte/CSS implementation

If you cannot inspect the Paper design or current app visuals directly, stop short of final visual claims and tell me exactly what screenshots or exports you need.
```
