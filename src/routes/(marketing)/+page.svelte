<script>
  import CopyBlock from '$lib/site/CopyBlock.svelte';
  import { reveal } from '$lib/site/reveal.js';

  const quickstart = [
    {
      title: 'Draft hits disk',
      body: 'Your agent writes `memo-draft.md`.',
    },
    {
      title: 'Marginalia opens',
      body: 'A post-write hook launches a disposable review window.',
    },
    {
      title: 'Edit + explain',
      body: 'Edit inline. Add a one-line rationale when the reason matters.',
    },
    {
      title: 'Bundle returns',
      body: 'Press `Esc`. Marginalia writes the bundle and exits.',
    },
  ];

  const artifacts = [
    {
      name: 'original.md',
      desc: 'What the agent wrote (the input).',
      preview: `# Draft\n\nThis is the first pass. It is a bit wordy and hedged.\n`,
    },
    {
      name: 'final.md',
      desc: 'What you approved (the output).',
      preview: `# Draft\n\nThis is the first pass. It is direct and specific.\n`,
    },
    {
      name: 'summary_for_agent.md',
      desc: 'The only file the agent needs. Clear instructions, grounded in your actual edits.',
      preview: `## Review summary\n\n- 7 edits reviewed\n- Pattern to repeat: remove hedging, front-load the point\n\n### Feedback\n1. Remove filler so the thesis lands immediately.\n2. Keep claims concrete and quantified.\n\n### General notes\n- Keep sentences concrete. Prefer numbers.\n`,
    },
    {
      name: 'changes.patch',
      desc: 'An apply-ready patch for exactness (agents and automation).',
      preview: `diff --git a/draft.md b/draft.md\nindex 0000000..1111111 100644\n--- a/draft.md\n+++ b/draft.md\n@@ -1,3 +1,3 @@\n-This is kind of a rough draft...\n+This is the draft. Here is the point.\n`,
    },
    {
      name: 'changes.json',
      desc: 'Structured diff with stable IDs so rationales stay anchored.',
      preview: `{\n  \"bundle_format_version\": \"3.0\",\n  \"changes\": [\n    {\n      \"id\": \"c_ab12\",\n      \"type\": \"deletion\",\n      \"text\": \"kind of\",\n      \"location\": { \"line\": 3, \"col\": 9 }\n    }\n  ]\n}\n`,
    },
    {
      name: 'annotations.json',
      desc: 'Short rationales stored as durable annotation records with target metadata and stale-note status.',
      preview: `{\n  \"schema_version\": \"3.0\",\n  \"annotations\": [\n    {\n      \"id\": \"note_m8xy1a\",\n      \"rationale\": \"Remove hedging.\",\n      \"status\": \"active\",\n      \"matched_rule\": null,\n      \"target\": {\n        \"change_id\": \"c_ab12\",\n        \"resolved_change_id\": \"c_ab12\",\n        \"type\": \"deletion\",\n        \"excerpt\": \"kind of\"\n      }\n    }\n  ],\n  \"general_notes\": \"Keep sentences concrete.\"\n}\n`,
    },
    {
      name: 'provenance.json',
      desc: 'Hashes, sizes, version metadata. Useful when you want to trust the capture.',
      preview: `{\n  \"schema_version\": \"1.0\",\n  \"bundle\": { \"format_version\": \"3.0\" },\n  \"artifacts\": [\n    { \"file\": \"final.md\", \"sha256\": \"...\", \"bytes\": 4821 },\n    { \"file\": \"changes.patch\", \"sha256\": \"...\", \"bytes\": 913 }\n  ]\n}\n`,
    },
  ];

  const manualHookExample = `{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "MARGINALIA_REVIEW_MODE=async bash ~/.marginalia/hooks/post-write.sh",
            "async": true,
            "timeout": 1800000
          }
        ]
      }
    ]
  }
}`;

  let activeArtifact = $state(0);
</script>

<svelte:head>
  <title>Marginalia | Your edits are the instructions</title>
  <meta
    name="description"
    content="Marginalia is a disposable macOS review app for AI-generated drafts: edit inline, optionally add a one-line rationale, and return a patch + summary your agent can apply."
  />
  <meta property="og:title" content="Marginalia" />
  <meta property="og:description" content="Edit inline. Add a one-line rationale when it matters. Return a patch + summary your agent can apply." />
</svelte:head>

<div class="marg-site">
  <header class="site-nav glass-surface glass-surface-ambient">
    <div class="site-shell">
      <div class="site-nav-inner">
        <a class="brand" href="/" aria-label="Marginalia home">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">Marginalia</span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#bundle">Bundle</a>
          <a href="#install">Install</a>
          <a href="https://github.com/samay58/marginalia" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="site-main">
    <section class="hero">
      <div class="site-shell">
        <div class="hero-grid">
          <div>
            <div class="eyebrow">
              <span class="eyebrow-dot" aria-hidden="true"></span>
              Disposable review window for agent drafts (macOS)
            </div>
            <h1>Your edits are the instructions.</h1>
            <p class="lead">
              Editing is high-bandwidth. Retelling your edits is not. Marginalia opens the moment a draft hits disk, captures what
              changed plus short intent, and returns an apply-ready bundle: <code>changes.patch</code> and <code>summary_for_agent.md</code>.
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#install">Get set up</a>
              <a class="btn btn-secondary" href="#how">See the loop</a>
              <a class="btn btn-ghost" href="https://github.com/samay58/marginalia" target="_blank" rel="noreferrer">
                Read the source
              </a>
            </div>

            <div class="hero-snippets">
              <CopyBlock
                label="Install (macOS)"
                hint="Requires `jq` (brew install jq)"
                value={"curl -fsSL https://raw.githubusercontent.com/samay58/marginalia/main/scripts/install.sh | bash"}
              />
              <CopyBlock label="Enable the Claude Code hook" hint="Global install" value="marginalia init --global" />
            </div>
          </div>

          <div class="hero-visual" aria-label="Marginalia workflow">
            <div class="flow">
              <div class="flow-row">
                <div class="flow-node">
                  <strong>Agent writes</strong>
                  <span>`memo-draft.md` lands on disk</span>
                </div>
                <div class="flow-arrow" aria-hidden="true">→</div>
                <div class="flow-node">
                  <strong>Hook triggers</strong>
                  <span>Marginalia opens instantly</span>
                </div>
              </div>
              <div class="flow-row">
                <div class="flow-node">
                  <strong>You edit</strong>
                  <span>Inline changes + short rationales</span>
                </div>
                <div class="flow-arrow" aria-hidden="true">→</div>
                <div class="flow-node">
                  <strong>Bundle returns</strong>
                  <span>Patch + `summary_for_agent.md`</span>
                </div>
              </div>
              <div class="flow-row">
                <div class="flow-node">
                  <strong>Agent applies</strong>
                  <span>High-fidelity revision, no guessing</span>
                </div>
                <div class="flow-arrow" aria-hidden="true">→</div>
                <div class="flow-node">
                  <strong>Done</strong>
                  <span>Disposable software exits</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="how" class="section" use:reveal>
      <div class="site-shell">
            <h2 class="section-title">Stop translating edits into instructions.</h2>
            <p class="section-subtitle">
          The usual loop is lossy: you edit in a real editor, then summarize what you did, and the agent guesses what to repeat.
          Marginalia removes the translation step. Your edits become the feedback channel.
            </p>

        <div class="split">
          <div class="panel">
            <h3>Without Marginalia</h3>
            <p>You edit somewhere else, then describe the changes. Nuance gets lost: what changed, why it changed, and what pattern to repeat.</p>
            <div class="steps">
              <div class="step">
                <div class="step-index">1</div>
                <div><strong>Agent drafts</strong><span>Text appears in chat</span></div>
              </div>
              <div class="step">
                <div class="step-index">2</div>
                <div><strong>You edit</strong><span>In a separate editor</span></div>
              </div>
              <div class="step">
                <div class="step-index">3</div>
                <div><strong>You explain</strong><span>Natural language summary (lossy)</span></div>
              </div>
              <div class="step">
                <div class="step-index">4</div>
                <div><strong>Agent approximates</strong><span>And misses subtle intent</span></div>
              </div>
            </div>
          </div>

          <div class="panel">
            <h3>With Marginalia</h3>
            <p>A hook launches Marginalia only when a file should be reviewed. You edit, optionally add why, then close. A bundle returns.</p>
            <div class="steps">
              {#each quickstart as step, i (step.title)}
                <div class="step">
                  <div class="step-index">{i + 1}</div>
                  <div><strong>{step.title}</strong><span>{step.body}</span></div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" use:reveal>
      <div class="site-shell">
        <h2 class="section-title">Edits + intent.</h2>
        <p class="section-subtitle">
          Edits say what happened. Rationales say why. Most changes need no comment; add a one-liner when the reason matters.
        </p>

        <div class="split">
          <div class="panel">
            <h3>Anchored rationales</h3>
            <p>
              Rationales stay attached to the edit they refer to, so the agent doesn't have to infer which sentence you meant.
            </p>
            <pre class="bundle-preview"><code>Change: "kind of" -> (removed)
Why: Remove hedging. Keep claims crisp.</code></pre>
            <p>
              Keyboard-first: comment an edit with <code>⌘ /</code>, leave general notes with <code>⌘ G</code>, finish with <code>Esc</code>.
            </p>
          </div>
          <div class="panel">
            <h3>Principles and anti-slop</h3>
            <p>
              Bring your writing rules. If you pass a principles file, Marginalia highlights violations and includes them in the agent summary.
            </p>
            <CopyBlock label="Optional principles file" hint="Works great with WRITING.md" value="marginalia open ./draft.md --principles ~/WRITING.md" />
          </div>
        </div>
      </div>
    </section>

    <section id="bundle" class="section" use:reveal>
      <div class="site-shell">
        <h2 class="section-title">A bundle is the contract.</h2>
        <p class="section-subtitle">
          On close, Marginalia writes a directory with original/final text, structured diffs, rationales, and an apply-ready patch.
          If you only feed one thing to the agent, feed <code>summary_for_agent.md</code>.
        </p>

        <div class="bundle-grid">
          <div class="bundle-list" aria-label="Bundle files">
            {#each artifacts as item, i (item.name)}
              <button class="bundle-item" class:active={i === activeArtifact} type="button" onclick={() => (activeArtifact = i)}>
                {item.name}
              </button>
            {/each}
          </div>
          <div class="bundle-detail" aria-live="polite">
            <h3>{artifacts[activeArtifact].name}</h3>
            <p>{artifacts[activeArtifact].desc}</p>
            <pre class="bundle-preview"><code>{artifacts[activeArtifact].preview}</code></pre>
          </div>
        </div>
      </div>
    </section>

    <section id="install" class="section" use:reveal>
      <div class="site-shell">
        <h2 class="section-title">Setup that stays boring.</h2>
        <p class="section-subtitle">
          Install once. Enable the hook once. From then on, Marginalia opens only for drafts (by default: <code>*-draft.md</code> or
          files containing <code>&lt;!-- REVIEW --&gt;</code>).
        </p>

        <div class="split">
          <div class="panel">
            <h3>Enable the loop</h3>
            <p>Most people: install, then enable the Claude Code hook.</p>
            <div class="hero-snippets">
              <CopyBlock
                label="Install"
                hint="macOS only"
                value={"curl -fsSL https://raw.githubusercontent.com/samay58/marginalia/main/scripts/install.sh | bash"}
              />
              <CopyBlock label="Hook" hint="Claude Code" value="marginalia init --global" />
            </div>
          </div>
          <div class="panel">
            <h3>Modes</h3>
            <p>Choose sync (blocking) or async (non-blocking) behavior depending on your workflow.</p>
            <div class="steps">
              <div class="step">
                <div class="step-index">S</div>
                <div><strong>Sync</strong><span>Agent waits until you close the review window.</span></div>
              </div>
              <div class="step">
                <div class="step-index">A</div>
                <div><strong>Async</strong><span>Agent continues; the bundle summary arrives later.</span></div>
              </div>
            </div>
            <details>
              <summary>Manual hook example (Claude Code)</summary>
              <pre class="bundle-preview"><code>{manualHookExample}</code></pre>
            </details>
          </div>
        </div>

        <div class="panel stack">
          <h3>How you actually use it</h3>
          <p>
            Tell your agent to write a draft file. Review in Marginalia. Close with <code>Esc</code>. Your hook hands the agent the path
            to <code>summary_for_agent.md</code>.
          </p>
          <div class="hero-snippets">
            <CopyBlock
              label="Ask your agent"
              hint="Example prompt"
              value={"Write the memo to memo-draft.md."}
            />
            <CopyBlock
              label="After you review"
              hint="What the agent should read"
              value={"Read the summary and revise:\n~/.marginalia/bundles/<timestamp>_memo-draft/summary_for_agent.md"}
            />
          </div>
        </div>
      </div>
    </section>

    <section class="section" use:reveal>
      <div class="site-shell">
        <h2 class="section-title">Opinionated by design.</h2>
        <p class="section-subtitle">
          Marginalia is disposable software: open fast, capture edits + intent, write a bundle, exit. It's not a document editor. It's a
          feedback tool for agent drafts.
        </p>

        <div class="split">
          <div class="panel">
            <h3>Deliberate constraints</h3>
            <p>Constraints keep the workflow predictable.</p>
            <div class="steps">
              <div class="step">
                <div class="step-index">1</div>
                <div><strong>One file per session</strong><span>No tabs. No document management.</span></div>
              </div>
              <div class="step">
                <div class="step-index">2</div>
                <div><strong>Close to finalize</strong><span><code>Esc</code> writes the bundle and exits.</span></div>
              </div>
              <div class="step">
                <div class="step-index">3</div>
                <div><strong>Rationales stay short</strong><span>One line per change when needed.</span></div>
              </div>
              <div class="step">
                <div class="step-index">4</div>
                <div><strong>Local in, local out</strong><span>No accounts. No syncing. Just files.</span></div>
              </div>
            </div>
          </div>

          <div class="panel">
            <h3>Unique payoff</h3>
            <p>What you get that "just tell the agent" can't deliver reliably.</p>
            <div class="steps">
              <div class="step">
                <div class="step-index">✓</div>
                <div><strong>Exact diffs</strong><span>The changes are the instructions.</span></div>
              </div>
              <div class="step">
                <div class="step-index">✓</div>
                <div><strong>Anchored intent</strong><span>Rationales attach to specific edits.</span></div>
              </div>
              <div class="step">
                <div class="step-index">✓</div>
                <div><strong>Apply-ready patch</strong><span>Agents can patch, not guess.</span></div>
              </div>
              <div class="step">
                <div class="step-index">✓</div>
                <div><strong>Bundle contract</strong><span>Structured artifacts for tooling and trust.</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="site-shell">
      <div class="footer-row">
        <span>Marginalia is MIT-licensed and desktop-first by design.</span>
        <div class="footer-links">
          <a href="https://github.com/samay58/marginalia" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/review">Review UI</a>
        </div>
      </div>
    </div>
  </footer>
</div>
