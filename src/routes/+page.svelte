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
  let gutterRef;
  let editorRef;
  let isSyncingScroll = false;
  let cliBundleDir = $state('');
  let cliOutPath = $state('');
  let cliPrinciplesPath = $state('');
  let writingRuleMatcher = $state(null);
  let closeRequestedUnlisten = null;

  /**
   * Build a JSON status object for the hook to parse
   * @param {'reviewed' | 'cancelled' | 'error'} status
   * @param {boolean} changesMade
   * @param {string | null} bundlePath
   * @param {string | null} errorMessage
   */
  function buildStatus(status, changesMade, bundlePath, errorMessage = null) {
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
  const sampleContent = `# Investment Memo: ElevenLabs

## Executive Summary

I believe this represents a compelling opportunity for NVIDIA to invest in the leading voice AI platform. The company has demonstrated remarkable growth, achieving significant revenue milestones while maintaining strong unit economics.

## Key Highlights

- **Revenue Growth**: The company has experienced substantial year-over-year growth
- **Market Position**: ElevenLabs has arguably become the de facto standard for voice synthesis
- **Technology**: Their proprietary models potentially outperform all competitors

## Financial Overview

The company missed targets in Q3 but recovered strongly. Furthermore, their burn rate has improved significantly.

## Recommendation

Additionally, we recommend a $25M investment at the proposed valuation. This would position NVIDIA well for the emerging voice AI market.`;

  onMount(async () => {
    // Check for CLI file path
    try {
      const cliOptions = await invoke('get_cli_options');
      const cliPath = cliOptions?.filePath;
      cliBundleDir = cliOptions?.bundleDir || '';
      cliOutPath = cliOptions?.outPath || '';
      cliPrinciplesPath = cliOptions?.principlesPath || '';
      const homeDir = await invoke('get_home_dir');
      const defaultPrinciplesPath = `${homeDir}/phoenix/WRITING.md`;
      const resolvedPrinciplesPath = cliPrinciplesPath || defaultPrinciplesPath;
      await loadWritingRules(resolvedPrinciplesPath);
      if (cliPath) {
        const content = await invoke('read_file', { path: cliPath });
        initializeWithContent(cliPath, content);
      } else {
        // No CLI file - show file picker
        const picked = await pickAndLoadFile();
        if (!picked) {
          // User cancelled - use sample content for demo
          initializeWithContent('/test/ic-memo-elevenlabs.md', sampleContent);
        }
      }
    } catch (e) {
      console.error('Error loading file:', e);
      // Fallback to sample content
      initializeWithContent('/test/ic-memo-elevenlabs.md', sampleContent);
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

    // Update line count when content changes
    const unsubscribe = editedContent.subscribe((content) => {
      lineCount = (content.match(/\n/g) || []).length + 1;
    });

    // Check for dark mode preference
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      document.documentElement.classList.add('dark');
    }

    // Listen for dark mode changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      isDark = e.matches;
      document.documentElement.classList.toggle('dark', isDark);
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      unsubscribe();
      mediaQuery.removeEventListener('change', handleChange);
      if (closeRequestedUnlisten) {
        closeRequestedUnlisten();
      }
    };
  });

  async function loadWritingRules(principlesPath) {
    if (!principlesPath) return;
    try {
      const rulesText = await invoke('read_file', { path: principlesPath });
      const matcher = createWritingRuleMatcher(rulesText);
      writingRuleMatcher = matcher.match;
      const matchers = createViolationMatchers(rulesText);
      setSlopMatchers(matchers);
      editorRef?.refreshSlop();
      if (!cliPrinciplesPath) {
        cliPrinciplesPath = principlesPath;
      }
    } catch (e) {
      console.warn('WRITING.md not available for rule matching:', e);
    }
  }

  /**
   * Show file picker and load the selected file
   * @returns {Promise<boolean>} true if a file was loaded, false if cancelled
   */
  async function pickAndLoadFile() {
    try {
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

  async function handleDone() {
    const changesMade = $hasChanges;
    const hasNotes = typeof $generalNotes === 'string' && $generalNotes.trim().length > 0;
    const hasAnnotations = $annotations instanceof Map && $annotations.size > 0;
    const shouldCreateBundle = changesMade || hasNotes || hasAnnotations;

    // No feedback case - write status and close
    if (!shouldCreateBundle) {
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

    // Generate the bundle
    const bundle = generateBundle({
      filePath: $filePath,
      originalContent: $originalContent,
      editedContent: $editedContent,
      diffResult: diffForBundle,
      annotations: $annotations,
      generalNotes: $generalNotes,
      startTime: $startTime,
      principlesPath: cliPrinciplesPath || null,
    });

    console.log('Generated bundle:', bundle.bundleName);

    try {
      // Get home directory and save bundle
      const homeDir = await invoke('get_home_dir');
      const bundleDir = cliBundleDir || `${homeDir}/phoenix/.marginalia/bundles`;

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
          content: buildStatus('reviewed', changesMade, savedPath)
        });
      }

      // Close window after saving
      await invoke('close_window');
    } catch (e) {
      console.error('Error saving bundle:', e);
      // Write error status
      if (cliOutPath) {
        try {
          await invoke('write_file', {
            path: cliOutPath,
            content: buildStatus('error', false, null, e.toString())
          });
        } catch (writeErr) {
          console.error('Failed to write error status:', writeErr);
        }
      }
    }
  }

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
      handleGutterLineClick($currentLine);
    }
    if (event.metaKey && event.key === 'o') {
      event.preventDefault();
      // Open file picker to load a different file
      pickAndLoadFile();
    }
  }

  function handleContentChange(content) {
    updateContent(content);
  }

  function handlePlainTextChange(text) {
    updatePlainText(text);
  }

  function handleInitialRender(text) {
    setOriginalPlainText(text);
  }

  function handleLineChange(line) {
    currentLine.set(line);
  }

  function positionPopoverAt(x, y) {
    const margin = 16;
    const maxX = window.innerWidth - 320 - margin;
    const maxY = window.innerHeight - 350;
    popoverX = Math.min(Math.max(margin, x), maxX);
    popoverY = Math.min(Math.max(80, y), maxY);
  }

  function handleGutterLineClick(line, x, y) {
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

  function handleEditorChangeClick(changeId, text, x, y) {
    const existingAnnotation = $annotations.get(changeId);

    // x and y come from the clicked element's bounding rect
    positionPopoverAt(x, y);

    popoverChangeId = changeId;
    popoverText = text;
    popoverRationale = existingAnnotation?.rationale || '';
    popoverVisible = true;
  }

  function handleNotesChange(event) {
    updateGeneralNotes(event.target.value);
  }

  function handleEditorScroll(scrollTop) {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    gutterRef?.setScrollTop(scrollTop);
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  }

  function handleGutterScroll(scrollTop) {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    editorRef?.setScrollTop(scrollTop);
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  }

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
        getSlopMatchers={() => ($hasChanges ? [] : $slopMatchers)}
      />
    </div>
  </main>

  <footer class="notes-panel" class:expanded={notesExpanded}>
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

  /* Notes Panel */
  .notes-panel {
    background: var(--paper-matte);
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
