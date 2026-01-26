# Marginalia Walkthrough

This is the build doc for Marginalia: what problem it’s solving, what the app actually does, and the few decisions that matter.

If you want the marketing version, read `README.md`. This file is for implementers.

---

## The problem (in practice)

When an agent writes a long draft, the loop usually looks like this:

1. Agent produces text.
2. Human edits in a “real” editor.
3. Human describes those edits back to the agent.
4. Agent approximates the intent and misses details.
5. Repeat.

The failure mode isn’t that the agent can’t write. It’s that the feedback channel is low bandwidth and ambiguous.

Marginalia is a different bet: keep feedback *in-band* with the agentic CLI session by launching a lightweight review UI at the exact moment the draft is written, then returning structured, machine-consumable output.

Disposable software, on purpose:
the UI exists only to capture edits and intent. It should not grow into a full document system.

---

## The solution (what happens end-to-end)

1. A draft file lands on disk (usually `*-draft.md` or contains `<!-- REVIEW -->`).
2. A hook launches Marginalia as a blocking step.
3. You edit inline, and optionally attach short rationales to specific edits.
4. On `Esc`, Marginalia writes a “bundle” directory and exits.
5. The hook hands the agent `summary_for_agent.md`.

The bundle format is the contract. Everything else is implementation detail.

---

## Bundle format (the contract)

On close, Marginalia writes a directory like:

`~/.marginalia/bundles/[timestamp]_[filename]/`

Files:

- `original.md` – the input content
- `final.md` – your edited result
- `changes.json` – a structured diff (insertions/deletions with stable IDs)
- `annotations.json` – rationales keyed to change IDs
- `summary_for_agent.md` – the only thing the agent needs to read

Why a bundle directory instead of “just a patch”:
- It keeps human and agent views aligned.
- It makes downstream automation easy (attach to issues, store in a database, promote rules).

---

## Interaction model

Two kinds of feedback:

1. **Edits**: the literal text changes.
2. **Rationales**: short “why” notes anchored to edits.

Rationales are deliberately constrained. The point is to avoid a second essay about the first essay.

There’s also **General Notes** (`⌘ G`) for anything that doesn’t map cleanly to a specific edit (structure, missing section, voice).

---

## Principles / “anti-slop”

Marginalia has two sources of “don’t write like that” lint:

1. A principles file you pass in (`--principles ~/WRITING.md`), where you keep your own rules.
2. A small built-in tone lint (common AI-ish phrases, hedging, empty intensifiers).

This is not a grammar checker. It’s a cheap filter to catch the most common failure modes before they get baked into a second draft.

---

## Claude Code integration (hook)

The Claude Code hook is `hooks/post-write.sh`.

Responsibilities:

- Decide whether the file should trigger review (default: `-draft.md` or `<!-- REVIEW -->`).
- Launch Marginalia in blocking mode.
- Read the status JSON from `--out`.
- Return a single short message telling the agent what to read next.

Important: the hook should be boring. Don’t bake personal folder conventions into it. If you need custom rules, make them env-configurable.

---

## Architecture (what’s in the repo)

### Stack

- Tauri (Rust) shell
- Svelte (frontend)
- Milkdown / ProseMirror (markdown editor)
- diff-match-patch (diffing)

### Data flow

1. Rust reads the file.
2. Frontend renders markdown and maintains:
   - original content
   - edited content
   - plain-text projections (for stable diffing)
3. On close, frontend generates bundle files and asks Rust to write them.

### Key places to read

- `src/routes/+page.svelte` – app orchestration, close handling, bundle write
- `src/lib/utils/diff.js` – diff computation + grouping
- `src/lib/utils/bundle.js` – bundle file generation
- `src-tauri/src/lib.rs` – read/write file APIs + bundle persistence

---

## Non-goals

- Not a general markdown editor.
- Not a notes app.
- Not a “track changes” clone with endless UI.

It should stay sharp:
capture edits + intent fast, return structured feedback to the agent, exit.

