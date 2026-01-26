<script>
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
  import Header from '$lib/components/Header.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Gutter from '$lib/components/Gutter.svelte';
  import AnnotationPopover from '$lib/components/AnnotationPopover.svelte';
  import { createViolationMatchers, createWritingRuleMatcher } from '$lib/utils/writing-rules.js';
  import { createToneMatchers } from '$lib/utils/tone-lint.js';
  import { collectLintFindings } from '$lib/utils/lint.js';
  import {
    filename,
    filePath,
    originalContent,
    editedContent,
    generalNotes,
    hasChanges,
    changeSummary,
    diffResult,
    currentLine,
    annotations,
    slopMatchers,
    startTime,
    initializeWithContent,
    updateContent,
    updateGeneralNotes,
    setSlopMatchers,
    setAnnotation,
    removeAnnotation,
    setOriginalPlainText,
    originalPlainText,
    updatePlainText,
    editedPlainText,
  } from '$lib/stores/app.js';
  import { generateBundle } from '$lib/utils/bundle.js';
  import { computeDiff } from '$lib/utils/diff.js';

  // Local state
  let notesExpanded = $state(false);
  let lineCount = $state(20);
  let popoverVisible = $state(false);
  let popoverX = $state(0);
  let popoverY = $state(0);
  let popoverChangeId = $state('');
  let popoverText = $state('');
  let popoverRationale = $state('');
  let isDark = $state(false);
  /** @type {any} */
  let gutterRef = null;
  /** @type {any} */
  let editorRef = null;
  let isSyncingScroll = false;
  /** @type {Array<{ path: string, name: string, content: string }>} */
  let referenceFiles = $state([]);
  let activeReferenceIndex = $state(0);
  let cliBundleDir = $state('');
  let cliOutPath = $state('');
  let cliPrinciplesPath = $state('');
  /** @type {null | ((rationale: string) => string | null)} */
  let writingRuleMatcher = $state(null);
  /** @type {null | (() => void)} */
  let closeRequestedUnlisten = null;
  const REF_STORAGE_KEY = 'marginalia.references';

  /**
   * Build a JSON status object for the hook to parse
   * @param {'reviewed' | 'cancelled' | 'error'} status
   * @param {boolean} changesMade
   * @param {string | null} bundlePath
   * @param {string | null} errorMessage
   */
  function buildStatus(status, changesMade, bundlePath, errorMessage = null) {
    /** @type {{ status: 'reviewed' | 'cancelled' | 'error', changes_made: boolean, bundle_path: string | null, session_duration_seconds: number, error?: string }} */
    const statusObj = {
      status,
      changes_made: changesMade,
      bundle_path: bundlePath,
      session_duration_seconds: Math.round((Date.now() - $startTime.getTime()) / 1000)
    };
    if (errorMessage) {
      statusObj.error = errorMessage;
    }
    return JSON.stringify(statusObj, null, 2);
  }

  // Sample content for testing (when no CLI file is provided)
  const sampleContent = `# Draft: Product Brief

## What this is

This is a working draft. Mark it up. Leave short rationales. Press Esc.

## The problem

Right now, the feedback loop is slow and ambiguous. I want a tighter loop that preserves intent.

## Proposed solution

Open a lightweight review surface directly from the CLI session, capture edits + intent, and hand the agent a structured summary it can apply.

## Notes

Avoid hedging. No filler. Say what we mean and quantify the miss.`;

  onMount(() => {
    /** @type {() => void} */
    let cleanup = () => {};

    const init = async () => {
      // Check for CLI file path
      try {
        const cliOptions = await invoke('get_cli_options');
        const cliPath = cliOptions?.filePath;
        cliBundleDir = cliOptions?.bundleDir || '';
        cliOutPath = cliOptions?.outPath || '';
        cliPrinciplesPath = cliOptions?.principlesPath || '';
        // Always enable built-in tone lint. If a principles file is provided, extend matchers with it.
        setSlopMatchers(createToneMatchers());
        if (cliPrinciplesPath) {
          await loadWritingRules(cliPrinciplesPath);
        }
        if (cliPath) {
          const content = await invoke('read_file', { path: cliPath });
          initializeWithContent(cliPath, content);
        } else {
          // No CLI file - show file picker
          const picked = await pickAndLoadFile();
          if (!picked) {
            // User cancelled - use sample content for demo
            initializeWithContent('/test/draft.md', sampleContent);
          }
        }
      } catch (e) {
        console.error('Error loading file:', e);
        // Fallback to sample content
        setSlopMatchers(createToneMatchers());
        initializeWithContent('/test/draft.md', sampleContent);
      }

      // Listen for close-requested events (Cmd+Q, red button)
      // With closable: false in tauri.conf.json, all close actions route through this
      closeRequestedUnlisten = await listen('tauri://close-requested', async () => {
        console.log('Close requested - writing cancelled status');
        if (cliOutPath) {
          try {
            await invoke('write_file', {
              path: cliOutPath,
              content: buildStatus('cancelled', false, null)
            });
          } catch (e) {
            console.error('Failed to write cancelled status:', e);
          }
        }
        await invoke('close_window');
      });

      // Update line count when rendered text changes
      const unsubscribe = editedPlainText.subscribe((text) => {
        lineCount = (text.match(/\n/g) || []).length + 1;
      });

      // Check for dark mode preference
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      }

      // Listen for dark mode changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      /** @param {MediaQueryListEvent} e */
      const handleChange = (e) => {
        isDark = e.matches;
        document.documentElement.classList.toggle('dark', isDark);
      };
      mediaQuery.addEventListener('change', handleChange);

      await restoreReferenceFiles();

      return () => {
        unsubscribe();
        mediaQuery.removeEventListener('change', handleChange);
        if (closeRequestedUnlisten) {
          closeRequestedUnlisten();
        }
      };
    };

    init()
      .then((teardown) => {
        if (typeof teardown === 'function') {
          cleanup = teardown;
        }
      })
      .catch((e) => {
        console.error('Error initializing app:', e);
      });

    return () => {
      cleanup();
    };
  });

  /** @param {string} principlesPath */
  async function loadWritingRules(principlesPath) {
    if (!principlesPath) return;
    try {
      const rulesText = await invoke('read_file', { path: principlesPath });
      const matcher = createWritingRuleMatcher(rulesText);
      writingRuleMatcher = matcher.match;
      const matchers = createViolationMatchers(rulesText);
      const toneMatchers = createToneMatchers();
      setSlopMatchers([...matchers, ...toneMatchers]);
      editorRef?.refreshSlop();
      if (!cliPrinciplesPath) {
        cliPrinciplesPath = principlesPath;
      }
    } catch (e) {
      console.warn('WRITING.md not available for rule matching:', e);
      const toneMatchers = createToneMatchers();
      setSlopMatchers(toneMatchers);
      editorRef?.refreshSlop();
    }
  }

  /**
   * @param {string[]} paths
   */
  function saveReferencePaths(paths) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(paths));
  }

  /**
   * @returns {string[]}
   */
  function loadReferencePaths() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(REF_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
    } catch (e) {
      console.warn('Failed to read reference files from storage:', e);
      return [];
    }
  }

  /**
   * @param {string} filePath
   */
  async function addReferenceFile(filePath) {
    if (!filePath) return;
    try {
      const content = await invoke('read_file', { path: filePath });
      const name = filePath.split('/').pop() || filePath;
      const updated = [
        { path: filePath, name, content },
        ...referenceFiles.filter((ref) => ref.path !== filePath),
      ].slice(0, 3);
      referenceFiles = updated;
      activeReferenceIndex = 0;
      saveReferencePaths(updated.map((ref) => ref.path));
    } catch (e) {
      console.error('Failed to load reference file:', e);
    }
  }

  async function restoreReferenceFiles() {
    const paths = loadReferencePaths();
    if (paths.length === 0) return;
    const loaded = [];
    for (const path of paths) {
      try {
        const content = await invoke('read_file', { path });
        const name = path.split('/').pop() || path;
        loaded.push({ path, name, content });
      } catch (e) {
        console.warn(`Reference file missing or unreadable: ${path}`);
      }
    }
    if (loaded.length > 0) {
      referenceFiles = loaded.slice(0, 3);
      activeReferenceIndex = 0;
    }
  }

  /**
   * Show file picker and load the selected file
   * @returns {Promise<boolean>} true if a file was loaded, false if cancelled
   */
  async function pickAndLoadFile() {
    try {
      /** @type {any} */
      const selected = await openFileDialog({
        multiple: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (selected) {
        const filePath = typeof selected === 'string' ? selected : selected.path;
        const content = await invoke('read_file', { path: filePath });
        initializeWithContent(filePath, content);
        editorRef?.refreshSlop();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error picking file:', e);
      return false;
    }
  }

  /**
   * Show file picker and add as a reference file
   * @returns {Promise<boolean>} true if a file was loaded, false if cancelled
   */
  async function pickReferenceFile() {
    try {
      /** @type {any} */
      const selected = await openFileDialog({
        multiple: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (selected) {
        const filePath = typeof selected === 'string' ? selected : selected.path;
        if (filePath) {
          await addReferenceFile(filePath);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Error picking reference file:', e);
      return false;
    }
  }

  async function handleDone() {
    const changesMade = $hasChanges;
    const hasNotes = typeof $generalNotes === 'string' && $generalNotes.trim().length > 0;
    const hasAnnotations = $annotations instanceof Map && $annotations.size > 0;
    const feedbackProvided = changesMade || hasNotes || hasAnnotations;

    // No feedback case - write status and close
    if (!feedbackProvided) {
      console.log('No changes or notes to save');
      try {
        if (cliOutPath) {
          await invoke('write_file', {
            path: cliOutPath,
            content: buildStatus('reviewed', false, null)
          });
        }
        await invoke('close_window');
      } catch (e) {
        console.error('Error closing window:', e);
      }
      return;
    }

    // If diffResult isn't ready (plain text not initialized yet), compute it directly.
    // Prefer plain text (what the user sees) to keep change IDs aligned with annotations.
    const originalTextForDiff = $originalPlainText || $originalContent || '';
    const editedTextForDiff = $editedPlainText || $editedContent || '';
    const diffForBundle =
      !$diffResult || (changesMade && $diffResult.changes.length === 0)
        ? computeDiff(originalTextForDiff, editedTextForDiff)
        : $diffResult;

    const lintFindings = collectLintFindings(editedTextForDiff, $slopMatchers);

    // Generate the bundle
    /** @type {{ bundleName: string, files: Record<string, string> }} */
    const bundle = generateBundle({
      filePath: $filePath,
      originalContent: $originalContent,
      editedContent: $editedContent,
      diffResult: diffForBundle,
      annotations: $annotations,
      generalNotes: $generalNotes,
      startTime: $startTime,
      principlesPath: cliPrinciplesPath || null,
      lintFindings,
    });

    console.log('Generated bundle:', bundle.bundleName);

    try {
      // Get home directory and save bundle
      const homeDir = await invoke('get_home_dir');
      const bundleDir = cliBundleDir || `${homeDir}/.marginalia/bundles`;

      const savedPath = await invoke('save_bundle', {
        bundleDir,
        bundleName: bundle.bundleName,
        files: bundle.files,
      });

      console.log('Bundle saved to:', savedPath);

      // Write JSON status with bundle path
      if (cliOutPath) {
        await invoke('write_file', {
          path: cliOutPath,
          content: buildStatus('reviewed', feedbackProvided, savedPath)
        });
      }

      // Close window after saving
      await invoke('close_window');
    } catch (e) {
      console.error('Error saving bundle:', e);
      // Write error status
      if (cliOutPath) {
        try {
          const errorMessage = e instanceof Error ? e.message : String(e);
          await invoke('write_file', {
            path: cliOutPath,
            content: buildStatus('error', false, null, errorMessage)
          });
        } catch (writeErr) {
          console.error('Failed to write error status:', writeErr);
        }
      }
    }
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (popoverVisible) {
        popoverVisible = false;
      } else {
        handleDone();
      }
    }
    if (event.metaKey && event.key === 'Enter') {
      handleDone();
    }
    if (event.metaKey && event.key === 'g') {
      event.preventDefault();
      notesExpanded = !notesExpanded;
    }
    if (event.metaKey && event.key === '/') {
      event.preventDefault();
      // Open popover for current line if there's a change there
      handleGutterLineClick($currentLine ?? 1);
    }
    if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      pickReferenceFile();
      return;
    }
    if (event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      // Open file picker to load a different file
      pickAndLoadFile();
    }
  }

  /** @param {string} content */
  function handleContentChange(content) {
    updateContent(content);
  }

  /** @param {string} text */
  function handlePlainTextChange(text) {
    updatePlainText(text);
  }

  /** @param {string} text */
  function handleInitialRender(text) {
    setOriginalPlainText(text);
  }

  /** @param {number} line */
  function handleLineChange(line) {
    currentLine.set(line);
  }

  /** @param {number} x @param {number} y */
  function positionPopoverAt(x, y) {
    const margin = 16;
    const maxX = window.innerWidth - 320 - margin;
    const maxY = window.innerHeight - 350;
    popoverX = Math.min(Math.max(margin, x), maxX);
    popoverY = Math.min(Math.max(80, y), maxY);
  }

  /** @param {number} line @param {number} [x] @param {number} [y] */
  function handleGutterLineClick(line, x = NaN, y = NaN) {
    if (!$diffResult) return;

    // Find changes on this line
    const lineChanges = $diffResult.changes.filter(c => c.location.line === line);
    if (lineChanges.length === 0) return;

    const change = lineChanges[0];
    const existingAnnotation = $annotations.get(change.id);

    editorRef?.scrollToLine(line);

    let anchorX = x;
    let anchorY = y;
    if (typeof anchorX !== 'number' || typeof anchorY !== 'number') {
      const rect = gutterRef?.getLineRect(line);
      if (rect) {
        anchorX = rect.right + 8;
        anchorY = rect.top;
      }
    }
    if (typeof anchorX === 'number' && typeof anchorY === 'number') {
      positionPopoverAt(anchorX, anchorY);
    } else {
      positionPopoverAt(120, 120);
    }

    popoverChangeId = change.id;
    popoverText = change.text;
    popoverRationale = existingAnnotation?.rationale || '';
    popoverVisible = true;
  }

  /** @param {string} changeId @param {string} text @param {number} x @param {number} y */
  function handleEditorChangeClick(changeId, text, x, y) {
    const existingAnnotation = $annotations.get(changeId);

    // x and y come from the clicked element's bounding rect
    positionPopoverAt(x, y);

    popoverChangeId = changeId;
    popoverText = text;
    popoverRationale = existingAnnotation?.rationale || '';
    popoverVisible = true;
  }

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function handleNotesChange(event) {
    updateGeneralNotes(event.currentTarget.value);
  }

  /** @param {number} scrollTop */
  function handleEditorScroll(scrollTop) {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    gutterRef?.setScrollTop(scrollTop);
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  }

  /** @param {number} scrollTop */
  function handleGutterScroll(scrollTop) {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    editorRef?.setScrollTop(scrollTop);
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  }

  /** @param {{ changeId: string, rationale: string, category?: string }} data */
  function handlePopoverSave(data) {
    const { changeId, rationale, category } = data;
    const matchedRule = writingRuleMatcher ? writingRuleMatcher(rationale) : null;
    setAnnotation(changeId, {
      changeIds: [changeId],
      rationale,
      category,
      writingMdRule: matchedRule,
      principleCandidate: false,
    });
    popoverVisible = false;
  }

  /** @param {{ changeId: string }} data */
  function handlePopoverRemove(data) {
    const { changeId } = data;
    removeAnnotation(changeId);
    popoverVisible = false;
  }

  function handlePopoverClose() {
    popoverVisible = false;
  }

  function toggleDarkMode() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app">
  <Header
    filename={$filename}
    hasChanges={$hasChanges}
    onDone={handleDone}
  />

  <main class="main">
    <Gutter
      bind:this={gutterRef}
      {lineCount}
      onLineClick={handleGutterLineClick}
      onScroll={handleGutterScroll}
    />

    <div class="editor-container">
      <Editor
        bind:this={editorRef}
        content={$editedContent}
        onChange={handleContentChange}
        onPlainTextChange={handlePlainTextChange}
        onInitialRender={handleInitialRender}
        onLineChange={handleLineChange}
        getDiffResult={() => $diffResult}
        onClickChange={handleEditorChangeClick}
        onScroll={handleEditorScroll}
        getSlopMatchers={() => $slopMatchers}
      />
    </div>

    {#if referenceFiles.length > 0}
      <aside class="reference-panel glass-surface">
        <div class="reference-header">
          <span>Reference</span>
          <button class="reference-open" onclick={pickReferenceFile} title="Open reference (⌘⇧O)">
            ⌘⇧O
          </button>
        </div>

        <div class="reference-tabs">
          {#each referenceFiles as ref, index}
            <button
              class="reference-tab"
              class:active={index === activeReferenceIndex}
              onclick={() => activeReferenceIndex = index}
              title={ref.path}
            >
              {ref.name}
            </button>
          {/each}
        </div>

        <div class="reference-content">
          <pre>{referenceFiles[activeReferenceIndex]?.content}</pre>
        </div>
      </aside>
    {/if}
  </main>

  <footer class="notes-panel glass-surface" class:expanded={notesExpanded}>
    <button class="notes-toggle" onclick={() => notesExpanded = !notesExpanded}>
      <span class="notes-icon">{notesExpanded ? '▾' : '▸'}</span>
      <span>General notes</span>
      {#if $changeSummary !== 'No changes'}
        <span class="change-summary">({$changeSummary})</span>
      {/if}
    </button>
    {#if notesExpanded}
      <textarea
        class="notes-input"
        value={$generalNotes}
        oninput={handleNotesChange}
        placeholder="Add session-level feedback here..."
      ></textarea>
    {/if}
  </footer>

  <AnnotationPopover
    changeId={popoverChangeId}
    text={popoverText}
    currentRationale={popoverRationale}
    x={popoverX}
    y={popoverY}
    visible={popoverVisible}
    onSave={handlePopoverSave}
    onRemove={handlePopoverRemove}
    onClose={handlePopoverClose}
  />
</div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--paper);
  }

  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* Editor Container */
  .editor-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    justify-content: center;
  }

  .reference-panel {
    width: 320px;
    border-left: var(--border-subtle);
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .reference-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    color: var(--ink-faded);
    border-bottom: var(--border-subtle);
  }

  .reference-open {
    background: none;
    border: 1px solid var(--paper-edge);
    border-radius: 6px;
    padding: 2px 6px;
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    cursor: pointer;
  }

  .reference-open:hover {
    color: var(--ink);
    border-color: var(--ink-ghost);
  }

  .reference-tabs {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-subtle);
    overflow-x: auto;
  }

  .reference-tab {
    background: var(--paper);
    border: 1px solid var(--paper-edge);
    border-radius: 6px;
    padding: 2px 8px;
    font-size: var(--text-ui-small);
    color: var(--ink-faded);
    cursor: pointer;
    white-space: nowrap;
  }

  .reference-tab.active {
    color: var(--ink);
    border-color: var(--accent-subtle);
    background: var(--paper);
  }

  .reference-content {
    flex: 1;
    overflow: auto;
    padding: var(--space-3) var(--space-4);
  }

  .reference-content pre {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body);
    color: var(--ink);
    white-space: pre-wrap;
  }

  /* Notes Panel */
  .notes-panel {
    background: transparent;
    border-top: var(--border-subtle);
    transition: height var(--transition-normal);
  }

  .notes-toggle {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    color: var(--ink-faded);
    cursor: pointer;
    text-align: left;
  }

  .notes-toggle:hover {
    color: var(--ink);
  }

  .notes-icon {
    font-size: 10px;
  }

  .change-summary {
    color: var(--ink-ghost);
    font-size: var(--text-ui-small);
    margin-left: auto;
  }

  .notes-input {
    width: 100%;
    height: 100px;
    padding: 0 var(--space-4) var(--space-4);
    background: transparent;
    border: none;
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    color: var(--ink);
    resize: none;
    outline: none;
  }

  .notes-input::placeholder {
    color: var(--ink-ghost);
  }
</style>
