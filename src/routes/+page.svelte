<script>
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import Header from '$lib/components/Header.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Gutter from '$lib/components/Gutter.svelte';
  import AnnotationPopover from '$lib/components/AnnotationPopover.svelte';
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
    startTime,
    initializeWithContent,
    updateContent,
    updateGeneralNotes,
    setAnnotation,
    removeAnnotation,
  } from '$lib/stores/app.js';
  import { generateBundle } from '$lib/utils/bundle.js';

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
      const cliPath = await invoke('get_cli_file_path');
      if (cliPath) {
        const content = await invoke('read_file', { path: cliPath });
        initializeWithContent(cliPath, content);
      } else {
        // Use sample content for testing
        initializeWithContent('/test/ic-memo-elevenlabs.md', sampleContent);
      }
    } catch (e) {
      console.error('Error loading file:', e);
      // Fallback to sample content
      initializeWithContent('/test/ic-memo-elevenlabs.md', sampleContent);
    }

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
    };
  });

  async function handleDone() {
    if (!$diffResult || $diffResult.changes.length === 0) {
      console.log('No changes to save');
      // TODO: Close window
      return;
    }

    // Generate the bundle
    const bundle = generateBundle({
      filePath: $filePath,
      originalContent: $originalContent,
      editedContent: $editedContent,
      diffResult: $diffResult,
      annotations: $annotations,
      generalNotes: $generalNotes,
      startTime: $startTime,
    });

    console.log('Generated bundle:', bundle.bundleName);

    try {
      // Get home directory and save bundle
      const homeDir = await invoke('get_home_dir');
      const bundleDir = `${homeDir}/phoenix/.marginalia/bundles`;

      const savedPath = await invoke('save_bundle', {
        bundleDir,
        bundleName: bundle.bundleName,
        files: bundle.files,
      });

      console.log('Bundle saved to:', savedPath);

      // TODO: Close window after saving
      // await invoke('close_window');
    } catch (e) {
      console.error('Error saving bundle:', e);
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
  }

  function handleContentChange(content) {
    updateContent(content);
  }

  function handleLineChange(line) {
    currentLine.set(line);
  }

  function handleGutterLineClick(line) {
    if (!$diffResult) return;

    // Find changes on this line
    const lineChanges = $diffResult.changes.filter(c => c.location.line === line);
    if (lineChanges.length === 0) return;

    const change = lineChanges[0];
    const existingAnnotation = $annotations.get(change.id);

    // Position popover near the gutter
    popoverX = 80;
    popoverY = (line - 1) * 27 + 100; // Approximate based on line height

    popoverChangeId = change.id;
    popoverText = change.text;
    popoverRationale = existingAnnotation?.rationale || '';
    popoverVisible = true;
  }

  function handleNotesChange(event) {
    updateGeneralNotes(event.target.value);
  }

  function handlePopoverSave(event) {
    const { changeId, rationale, category } = event.detail;
    setAnnotation(changeId, {
      changeIds: [changeId],
      rationale,
      category,
      writingMdRule: null, // TODO: Match against WRITING.md
      principleCandidate: false,
    });
    popoverVisible = false;
  }

  function handlePopoverRemove(event) {
    const { changeId } = event.detail;
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
      {lineCount}
      onLineClick={handleGutterLineClick}
    />

    <div class="editor-container">
      <Editor
        content={$editedContent}
        onChange={handleContentChange}
        onLineChange={handleLineChange}
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
    on:save={handlePopoverSave}
    on:remove={handlePopoverRemove}
    on:close={handlePopoverClose}
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
