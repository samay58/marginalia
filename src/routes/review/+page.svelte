<script>
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
  import Editor from '$lib/components/Editor.svelte';
  import ChangeRail from '$lib/components/ChangeRail.svelte';
  import AnnotationColumn from '$lib/components/AnnotationColumn.svelte';
  import AnnotationPopover from '$lib/components/AnnotationPopover.svelte';
  import ReferencePane from '$lib/components/ReferencePane.svelte';
  import SessionDrawer from '$lib/components/SessionDrawer.svelte';
  import TopBar from '$lib/components/shell/TopBar.svelte';
  import StatusBar from '$lib/components/shell/StatusBar.svelte';
  import HelpSheet from '$lib/components/shell/HelpSheet.svelte';
  import { createWritingRuleMatcher } from '$lib/utils/writing-rules.js';
  import {
    filename,
    filePath,
    originalContent,
    editedContent,
    generalNotes,
    hasChanges,
    diffResult,
    currentLine,
    annotations,
    annotationEntries,
    annotatedChangeIds,
    annotatedTargetIds,
    startTime,
    initializeWithContent,
    restoreFromSnapshot,
    updateContent,
    updateGeneralNotes,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    setOriginalPlainText,
    originalPlainText,
    updatePlainText,
    editedPlainText,
    selectedChangeId,
    selectedTargetId,
    selectedChange,
    selectedTarget,
    selectedAnnotation,
    substantiveChanges,
    substantiveChangeGroups,
    trivialChanges,
    trivialChangeCount,
    visibleChanges,
    reviewTargets,
    resolvedReviewTargets,
    rationaleDrafts,
    documentEpoch,
    diffEpoch,
    renderEpoch,
    diffStatus,
    ensureTargetForChange,
    setSelectedTarget,
    startRationaleForTarget,
    updateRationaleDraftText,
    discardRationaleDraft,
    setReviewStatus,
    setSelectedChange,
    clearSelectedChange,
  } from '$lib/stores/review-session.js';
  import { generateBundle } from '$lib/utils/bundle.js';
  import { createAnnotationRecord, reanchorAnnotation } from '$lib/utils/annotations.js';
  import { computeDiff } from '$lib/utils/diff.js';
  import { computeSemanticChanges } from '$lib/utils/semantic-diff.js';

  // Local state
  let notesExpanded = $state(false);
  let compactLayout = $state(false);
  let referenceDrawerOpen = $state(false);
  let popoverVisible = $state(false);
  let popoverX = $state(0);
  let popoverY = $state(0);
  let popoverChangeId = $state('');
  let popoverText = $state('');
  let popoverDraft = $state('');
  let popoverAnnotationId = $state('');
  let popoverTargetId = $state('');
  /** @type {any} */
  let editorRef = $state(null);
  /** @type {any} */
  let annotationColumnRef = $state(null);
  let selectedAnnotationId = $state(/** @type {string | null} */ (null));
  let composerOpen = $state(false);
  let composerDraft = $state('');
  let composerDraftId = $state('');
  let composerTargetId = $state('');
  /** @type {Array<{ path: string, name: string, content: string }>} */
  let referenceFiles = $state([]);
  let activeReferenceIndex = $state(0);
  let cliBundleDir = $state('');
  let cliOutPath = $state('');
  let cliPrinciplesPath = $state('');
  let cliInitialPath = $state('');
  /** Review shows the change list and rationale panel; focus shows only the manuscript. */
  let viewMode = $state(/** @type {'review' | 'focus'} */ ('review'));
  let rationaleOpen = $state(true);
  let helpOpen = $state(false);

  const showRail = $derived(viewMode === 'review');
  const showRationale = $derived(viewMode === 'review' && rationaleOpen && !compactLayout);
  const titleParts = $derived.by(() => {
    const path = $filePath || '';
    const segments = path.split('/').filter(Boolean);
    return {
      name: $filename || segments.at(-1) || 'Untitled draft',
      folder: segments.length > 1 ? segments.at(-2) : '',
    };
  });
  /** @type {null | ((rationale: string) => string | null)} */
  let writingRuleMatcher = $state(null);
  /** @type {null | (() => void)} */
  let closeRequestedUnlisten = null;
  let isProgrammaticClose = $state(false);
  let isFinalizingClose = $state(false);

  let homeDir = $state('');
  let sessionId = $state('');
  // Set once a session is finished or discarded. A late autosave must never
  // mark it active again, or the next launch offers to resume a done review.
  let sessionClosed = false;
  let snapshotPath = $state('');
  let activeSessionStatePath = $state('');
  let autosaveState = $state('idle');
  const saveState = $derived(
    !sessionId ? 'none' : autosaveState === 'saving' ? 'saving' : autosaveState === 'error' ? 'error' : 'saved'
  );
  let isHydratingSnapshot = $state(false);
  let hasInitialDocument = $state(false);
  let degradedMode = $state(false);
  const initialTauriAvailable = (() => {
    try {
      // @ts-expect-error present only in Tauri runtime
      return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
    } catch {
      return false;
    }
  })();
  let tauriAvailable = $state(initialTauriAvailable);
  /** @type {string[]} */
  let degradedReasons = $state([]);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let autosaveTimeout = null;

  /** @type {null | { sessionId: string, snapshotPath: string, activeStatePath: string, snapshot: any, filePath: string, updatedAt: string | null }} */
  let recoveryCandidate = $state(null);

  const SNAPSHOT_VERSION = 2;
  const AUTOSAVE_DEBOUNCE_MS = 900;
  const REF_STORAGE_KEY = 'marginalia.references';

  const editCount = $derived.by(() => $visibleChanges?.length ?? 0);
  const selectedAnnotationEntry = $derived.by(() => {
    if (selectedAnnotationId) {
      return $annotationEntries.find((entry) => entry.annotation.id === selectedAnnotationId) || null;
    }
    return $selectedAnnotation || null;
  });


  /**
   * Build a JSON status object for the hook to parse
   * @param {'reviewed' | 'cancelled' | 'error'} status
   * @param {boolean} changesMade
   * @param {string | null} bundlePath
   * @param {string | null} errorMessage
   */
  function buildStatus(status, changesMade, bundlePath, errorMessage = null) {
    /** @type {{ status: 'reviewed' | 'cancelled' | 'error', changes_made: boolean, bundle_path: string | null, session_duration_seconds: number, error?: string, degraded_mode?: boolean, degraded_reasons?: string[] }} */
    const statusObj = {
      status,
      changes_made: changesMade,
      bundle_path: bundlePath,
      session_duration_seconds: Math.round((Date.now() - $startTime.getTime()) / 1000)
    };
    if (errorMessage) {
      statusObj.error = errorMessage;
    }
    if (degradedMode) {
      statusObj.degraded_mode = true;
      statusObj.degraded_reasons = [...degradedReasons];
    }
    return JSON.stringify(statusObj, null, 2);
  }

  async function closeWindowSafely() {
    if (isProgrammaticClose) return;
    isProgrammaticClose = true;
    try {
      await invoke('close_window');
    } finally {
      isProgrammaticClose = false;
    }
  }

  /**
   * @param {string} reason
   * @param {string} [detail]
   */
  function enterDegradedMode(reason, detail = '') {
    degradedMode = true;
    setReviewStatus('degraded');
    const normalized = detail ? `${reason}: ${detail}` : reason;
    if (!degradedReasons.includes(normalized)) {
      degradedReasons = [...degradedReasons, normalized];
    }
  }

  function getDegradedSummaryNote() {
    if (!degradedMode || degradedReasons.length === 0) {
      return '';
    }
    const reasons = degradedReasons.map((reason) => `- ${reason}`).join('\n');
    return `Marginalia degraded mode: some review highlights were unavailable. Final text and notes were still captured.\n${reasons}`;
  }

  function createSessionId() {
    const now = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${now}-${random}`;
  }

  /** @param {string} baseHomeDir @param {string} nextSessionId */
  function computeSessionPaths(baseHomeDir, nextSessionId) {
    const root = `${baseHomeDir}/.marginalia/sessions`;
    return {
      rootDir: root,
      snapshotPath: `${root}/${nextSessionId}/snapshot.json`,
      activeStatePath: `${root}/active-session.json`,
    };
  }

  /** @param {string} path */
  async function readJsonFile(path) {
    try {
      const raw = await invoke('read_file', { path });
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * @param {string} path
   * @param {any} value
   */
  async function writeJsonFile(path, value) {
    await invoke('write_file', {
      path,
      content: JSON.stringify(value, null, 2),
    });
  }

  /**
   * @param {boolean} active
   * @param {string} reason
   */
  async function writeActiveSessionState(active, reason) {
    if (!activeSessionStatePath || !snapshotPath) return;
    try {
      await writeJsonFile(activeSessionStatePath, {
        version: SNAPSHOT_VERSION,
        active,
        reason,
        session_id: sessionId || null,
        file_path: $filePath,
        snapshot_path: snapshotPath,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to write active session state:', e);
    }
  }

  function clearAutosaveTimer() {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
      autosaveTimeout = null;
    }
  }

  function clearPopoverState() {
    popoverVisible = false;
    popoverChangeId = '';
    popoverTargetId = '';
    popoverText = '';
    popoverDraft = '';
    popoverAnnotationId = '';
  }

  function getPendingAnnotationSnapshot() {
    if (composerOpen) {
      return {
        surface: 'column',
        target_id: composerTargetId || $selectedTargetId || selectedAnnotationEntry?.annotation.targetId || null,
        draft_id: composerDraftId || null,
        change_id: $selectedChangeId || selectedAnnotationEntry?.change?.id || null,
        annotation_id: selectedAnnotationId || selectedAnnotationEntry?.annotation.id || null,
        text: $selectedChange?.text || selectedAnnotationEntry?.annotation.target.excerpt || '',
        draft: composerDraft,
      };
    }

    if (popoverVisible && popoverChangeId) {
      return {
        surface: 'popover',
        target_id: popoverTargetId || null,
        change_id: popoverChangeId,
        annotation_id: popoverAnnotationId || null,
        text: popoverText,
        draft: popoverDraft,
      };
    }

    return null;
  }

  /**
   * @param {string} reason
   */
  async function persistSnapshot(reason) {
    if (sessionClosed || !snapshotPath || !sessionId || !hasInitialDocument || isHydratingSnapshot) return;
    autosaveState = 'saving';
    try {
      const pendingAnnotation = getPendingAnnotationSnapshot();
      await writeJsonFile(snapshotPath, {
        version: SNAPSHOT_VERSION,
        session_id: sessionId,
        file_path: $filePath,
        filename: $filename,
        started_at: $startTime.toISOString(),
        snapshot_saved_at: new Date().toISOString(),
        reason,
        original_content: $originalContent,
        edited_content: $editedContent,
        original_plain_text: $originalPlainText,
        edited_plain_text: $editedPlainText,
        general_notes: $generalNotes,
        annotations: $annotations,
        review_targets: $reviewTargets,
        rationale_drafts: $rationaleDrafts,
        selected_change_id: $selectedChangeId,
        selected_target_id: $selectedTargetId,
        selected_annotation_id: selectedAnnotationId,
        document_epoch: $documentEpoch,
        diff_epoch: $diffEpoch,
        render_epoch: $renderEpoch,
        diff_status: $diffStatus,
        pending_annotation: pendingAnnotation,
        session_drawer_open: notesExpanded,
        degraded_mode: degradedMode,
        degraded_reasons: [...degradedReasons],
        cli_options: {
          bundle_dir: cliBundleDir || null,
          out_path: cliOutPath || null,
          principles_path: cliPrinciplesPath || null,
        },
      });
      if (sessionClosed) return;
      await writeActiveSessionState(true, 'autosave');
      autosaveState = 'saved';
    } catch (e) {
      autosaveState = 'error';
      console.error('Autosave failed:', e);
    }
  }

  /**
   * @param {string} reason
   */
  function scheduleAutosave(reason) {
    if (sessionClosed || !snapshotPath || !sessionId || !hasInitialDocument || isHydratingSnapshot) return;
    clearAutosaveTimer();
    autosaveTimeout = setTimeout(() => {
      persistSnapshot(reason).catch((e) => {
        console.error('Autosave scheduling failure:', e);
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function ensureHomeDir() {
    if (homeDir) return homeDir;
    try {
      homeDir = await invoke('get_home_dir');
    } catch (e) {
      console.error('Failed to resolve home directory for session snapshots:', e);
      homeDir = '';
    }
    return homeDir;
  }

  /**
   * @param {string} newSessionId
   */
  async function activateSession(newSessionId) {
    const resolvedHome = await ensureHomeDir();
    if (!resolvedHome) return;

    const paths = computeSessionPaths(resolvedHome, newSessionId);
    sessionClosed = false;
    sessionId = newSessionId;
    snapshotPath = paths.snapshotPath;
    activeSessionStatePath = paths.activeStatePath;
    await writeActiveSessionState(true, 'session-start');
    await persistSnapshot('session-start');
  }

  /**
   * @param {string} reason
   */
  async function deactivateSession(reason) {
    sessionClosed = true;
    clearAutosaveTimer();
    await writeActiveSessionState(false, reason);
  }

  async function maybeLoadRecoveryCandidate() {
    const resolvedHome = await ensureHomeDir();
    if (!resolvedHome) return null;

    const { activeStatePath } = computeSessionPaths(resolvedHome, 'placeholder');
    const activeState = await readJsonFile(activeStatePath);
    if (!activeState || activeState.active !== true || !activeState.snapshot_path) {
      return null;
    }

    const snapshot = await readJsonFile(activeState.snapshot_path);
    if (!snapshot) {
      // Snapshot missing; clear active marker so it does not block future launches.
      try {
        await writeJsonFile(activeStatePath, {
          version: SNAPSHOT_VERSION,
          active: false,
          reason: 'stale-active-pointer',
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Failed to clear stale active session pointer:', e);
      }
      return null;
    }

    return {
      sessionId: activeState.session_id || snapshot.session_id || '',
      snapshotPath: activeState.snapshot_path,
      activeStatePath,
      snapshot,
      filePath: snapshot.file_path || activeState.file_path || '',
      updatedAt: snapshot.snapshot_saved_at || activeState.updated_at || null,
    };
  }

  /** @param {string} path */
  async function loadDocumentFromPath(path) {
    degradedMode = false;
    degradedReasons = [];
    notesExpanded = false;
    referenceDrawerOpen = false;
    composerOpen = false;
    composerDraft = '';
    composerDraftId = '';
    composerTargetId = '';
    selectedAnnotationId = null;
    clearPopoverState();
    clearSelectedChange();
    const content = await invoke('read_file', { path });
    initializeWithContent(path, content);
    hasInitialDocument = true;
    // If editor is already mounted, push new content explicitly
    editorRef?.setContent?.(content);
    await activateSession(createSessionId());
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
    if (!tauriAvailable) return;

    /** @type {() => void} */
    let cleanup = () => {};

    const init = async () => {
      updateLayoutMode();

      // Check for CLI options and load initial document (or recovery prompt)
      try {
        const cliOptions = await invoke('get_cli_options');
        cliInitialPath = cliOptions?.filePath || '';
        cliBundleDir = cliOptions?.bundleDir || '';
        cliOutPath = cliOptions?.outPath || '';
        cliPrinciplesPath = cliOptions?.principlesPath || '';
        await ensureHomeDir();
        if (cliPrinciplesPath) {
          await loadWritingRules(cliPrinciplesPath);
        }

        recoveryCandidate = await maybeLoadRecoveryCandidate();
        if (!recoveryCandidate) {
          if (cliInitialPath) {
            await loadDocumentFromPath(cliInitialPath);
          } else {
            // No CLI file - show file picker
            const picked = await pickAndLoadFile();
            if (!picked) {
              // User cancelled - use sample content for demo
              degradedMode = false;
              degradedReasons = [];
              initializeWithContent('/test/draft.md', sampleContent);
              hasInitialDocument = true;
              await activateSession(createSessionId());
            }
          }
        }
      } catch (e) {
        console.error('Error loading file:', e);
        // Fallback to sample content
        degradedMode = false;
        degradedReasons = [];
        initializeWithContent('/test/draft.md', sampleContent);
        hasInitialDocument = true;
        await activateSession(createSessionId());
      }

      // Intercept standard macOS close actions and finalize safely before exit.
      closeRequestedUnlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        if (isProgrammaticClose) {
          return;
        }
        event.preventDefault();
        if (isFinalizingClose) {
          return;
        }
        isFinalizingClose = true;
        try {
          await handleDone();
        } finally {
          isFinalizingClose = false;
        }
      });

      window.addEventListener('resize', updateLayoutMode);

      await restoreReferenceFiles();

      return () => {
        clearAutosaveTimer();
        window.removeEventListener('resize', updateLayoutMode);
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

    return () => cleanup();
  });

  function updateLayoutMode() {
    if (typeof window === 'undefined') return;
    const nextCompactLayout = window.innerWidth < 1180;
    const leavingCompactLayout = compactLayout && !nextCompactLayout;
    compactLayout = nextCompactLayout;
    if (!compactLayout) {
      referenceDrawerOpen = false;
      if (leavingCompactLayout && popoverVisible) {
        if (popoverDraft.trim() || popoverAnnotationId) {
          composerOpen = true;
          composerDraft = popoverDraft;
          selectedAnnotationId = popoverAnnotationId || selectedAnnotationId;
          setSelectedChange(popoverChangeId || $selectedChangeId);
        }
        clearPopoverState();
      }
    }
  }

  $effect(() => {
    // Trigger autosave on non-keystroke session state changes.
    // Keystroke-driven autosave is handled directly in handleContentChange.
    $generalNotes;
    $annotations;
    $reviewTargets;
    $rationaleDrafts;
    $selectedChangeId;
    $selectedTargetId;
    selectedAnnotationId;
    notesExpanded;
    composerOpen;
    composerDraft;
    composerDraftId;
    composerTargetId;
    popoverVisible;
    popoverChangeId;
    popoverTargetId;
    popoverDraft;
    popoverAnnotationId;
    if (!sessionId || !snapshotPath || !hasInitialDocument || isHydratingSnapshot) return;
    scheduleAutosave('state-change');
  });

  $effect(() => {
    if ($selectedChangeId && !$selectedChange) {
      if (!selectedAnnotationEntry || selectedAnnotationEntry.status !== 'stale') {
        clearSelectedChange();
      }
    }
  });

  $effect(() => {
    $annotationEntries;
    $selectedChange;
    composerOpen;
    if (composerOpen) return;

    if ($selectedChange) {
      const activeMatch = $annotationEntries.find(
        (entry) => entry.status === 'active' && entry.change?.id === $selectedChange.id
      );
      selectedAnnotationId = activeMatch?.annotation.id || null;
      return;
    }

    if (selectedAnnotationId) {
      const existing = $annotationEntries.find((entry) => entry.annotation.id === selectedAnnotationId);
      if (!existing || existing.status === 'active') {
        selectedAnnotationId = null;
      }
    }
  });

  /** @param {string} principlesPath */
  async function loadWritingRules(principlesPath) {
    if (!principlesPath) return;
    try {
      const rulesText = await invoke('read_file', { path: principlesPath });
      const matcher = createWritingRuleMatcher(rulesText);
      writingRuleMatcher = matcher.match;
      if (!cliPrinciplesPath) {
        cliPrinciplesPath = principlesPath;
      }
    } catch (e) {
      console.warn('WRITING.md not available for rule matching:', e);
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
        const selectedPath = typeof selected === 'string' ? selected : selected.path;
        if (!selectedPath) return false;
        if (sessionId && hasInitialDocument) {
          await deactivateSession('switched-file');
        }
        await loadDocumentFromPath(selectedPath);
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

  async function resumeRecoveredSession() {
    if (!recoveryCandidate) return;

    degradedMode = false;
    degradedReasons = [];
    isHydratingSnapshot = true;
    clearAutosaveTimer();
    const snapshot = recoveryCandidate.snapshot;

    degradedMode = snapshot?.degraded_mode === true;
    degradedReasons = Array.isArray(snapshot?.degraded_reasons)
      ? [...snapshot.degraded_reasons]
      : [];

    if (snapshot?.cli_options) {
      cliBundleDir = snapshot.cli_options.bundle_dir || cliBundleDir;
      cliOutPath = snapshot.cli_options.out_path || cliOutPath;
      cliPrinciplesPath = snapshot.cli_options.principles_path || cliPrinciplesPath;
    }
    if (cliPrinciplesPath) {
      await loadWritingRules(cliPrinciplesPath);
    }

    restoreFromSnapshot({
      filePath: snapshot.file_path || recoveryCandidate.filePath || '',
      filename: snapshot.filename || null,
      originalContent: snapshot.original_content || '',
      editedContent: snapshot.edited_content || '',
      originalPlainText: snapshot.original_plain_text || '',
      editedPlainText: snapshot.edited_plain_text || '',
      generalNotes: snapshot.general_notes || '',
      annotations: snapshot.annotations || [],
      reviewTargets: snapshot.review_targets || [],
      rationaleDrafts: snapshot.rationale_drafts || {},
      startedAt: snapshot.started_at || null,
      selectedChangeId: snapshot.selected_change_id || null,
      selectedTargetId: snapshot.selected_target_id || null,
      documentEpoch: snapshot.document_epoch || 0,
      diffEpoch: snapshot.diff_epoch || 0,
      renderEpoch: snapshot.render_epoch || 0,
      diffStatus: snapshot.diff_status || 'clean',
    });

    selectedAnnotationId =
      typeof snapshot.selected_annotation_id === 'string' && snapshot.selected_annotation_id.length > 0
        ? snapshot.selected_annotation_id
        : null;
    composerOpen = false;
    composerDraft = '';
    notesExpanded = snapshot.session_drawer_open === true;
    referenceDrawerOpen = false;
    clearPopoverState();

    const pendingAnnotation = snapshot.pending_annotation;
    if (pendingAnnotation && typeof pendingAnnotation.draft === 'string' && pendingAnnotation.draft.length > 0) {
      if (typeof pendingAnnotation.annotation_id === 'string' && pendingAnnotation.annotation_id.length > 0) {
        selectedAnnotationId = pendingAnnotation.annotation_id;
      }
      if (typeof pendingAnnotation.change_id === 'string' && pendingAnnotation.change_id.length > 0) {
        setSelectedChange(pendingAnnotation.change_id);
      }
      if (typeof pendingAnnotation.target_id === 'string' && pendingAnnotation.target_id.length > 0) {
        composerTargetId = pendingAnnotation.target_id;
        setSelectedTarget(pendingAnnotation.target_id);
      }
      if (typeof pendingAnnotation.draft_id === 'string' && pendingAnnotation.draft_id.length > 0) {
        composerDraftId = pendingAnnotation.draft_id;
      }
      if (compactLayout && pendingAnnotation.surface === 'popover' && pendingAnnotation.change_id) {
        popoverChangeId = pendingAnnotation.change_id;
        popoverTargetId = pendingAnnotation.target_id || '';
        popoverText = pendingAnnotation.text || '';
        popoverDraft = pendingAnnotation.draft;
        popoverAnnotationId = pendingAnnotation.annotation_id || '';
        popoverVisible = true;
      } else {
        composerOpen = true;
        composerDraft = pendingAnnotation.draft;
      }
    }

    hasInitialDocument = true;
    sessionClosed = false;
    sessionId = recoveryCandidate.sessionId || createSessionId();
    snapshotPath = recoveryCandidate.snapshotPath;
    activeSessionStatePath = recoveryCandidate.activeStatePath;
    recoveryCandidate = null;
    isHydratingSnapshot = false;

    await writeActiveSessionState(true, 'recovered');
    await persistSnapshot('recovered-resume');

    // Push restored content to editor and refresh visual plugins.
    // setContent already calls triggerDiffUpdate internally.
    const restoredContent = snapshot.edited_content || snapshot.original_content || '';
    editorRef?.setContent?.(restoredContent);
  }

  async function discardRecoveredSession() {
    if (recoveryCandidate) {
      activeSessionStatePath = recoveryCandidate.activeStatePath;
      sessionId = recoveryCandidate.sessionId || '';
      snapshotPath = recoveryCandidate.snapshotPath;
      await deactivateSession('discarded-recovery');
      recoveryCandidate = null;
    }

    if (hasInitialDocument) return;

    if (cliInitialPath) {
      try {
        await loadDocumentFromPath(cliInitialPath);
        return;
      } catch (e) {
        console.error('Failed to load CLI file after discard:', e);
      }
    }

    const picked = await pickAndLoadFile();
    if (!picked) {
      degradedMode = false;
      degradedReasons = [];
      initializeWithContent('/test/draft.md', sampleContent);
      hasInitialDocument = true;
      await activateSession(createSessionId());
    }
  }

  let finishing = false;

  async function handleDone() {
    if (finishing) return;
    finishing = true;
    try {
      await finishReview();
    } finally {
      finishing = false;
    }
  }

  async function finishReview() {
    setReviewStatus('finalizing');
    await persistSnapshot('done-invoked');
    const changesMade = $hasChanges;
    const hasNotes = typeof $generalNotes === 'string' && $generalNotes.trim().length > 0;
    const hasAnnotations = Array.isArray($annotations) && $annotations.length > 0;
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
        await deactivateSession('reviewed-no-feedback');
        await closeWindowSafely();
      } catch (e) {
        console.error('Error closing window:', e);
      }
      return;
    }

    // If diffResult isn't ready (plain text not initialized yet), compute it directly.
    // Prefer plain text (what the user sees) to keep change IDs aligned with annotations.
    const originalTextForDiff = $originalPlainText || $originalContent || '';
    const editedTextForDiff = $editedPlainText || $editedContent || '';
    /** @type {any} */
    let diffForBundle = $diffResult;
    if (!$diffResult || (changesMade && $diffResult.changes.length === 0)) {
      try {
        diffForBundle = computeDiff(originalTextForDiff, editedTextForDiff);
      } catch (e) {
        enterDegradedMode('bundle_diff_generation_failed', e instanceof Error ? e.message : String(e));
        diffForBundle = { changes: [], deletions: 0, insertions: 0 };
      }
    }
    if (!diffForBundle) {
      enterDegradedMode('bundle_diff_unavailable');
      diffForBundle = { changes: [], deletions: 0, insertions: 0 };
    }

    /** @type {import('$lib/utils/semantic-diff.js').SemanticChange[]} */
    let semanticChanges = [];
    try {
      semanticChanges = computeSemanticChanges($originalContent || '', $editedContent || '');
    } catch (e) {
      enterDegradedMode('semantic_diff_generation_failed', e instanceof Error ? e.message : String(e));
      semanticChanges = [];
    }

    const degradedSummary = getDegradedSummaryNote();
    const mergedGeneralNotes = [$generalNotes, degradedSummary]
      .map((entry) => (entry || '').trim())
      .filter(Boolean)
      .join('\n\n');

    // Generate the bundle
    /** @type {{ bundleName: string, files: Record<string, string> }} */
    const bundle = await generateBundle({
      filePath: $filePath,
      originalContent: $originalContent,
      editedContent: $editedContent,
      diffResult: diffForBundle,
      semanticChanges,
      annotations: $annotationEntries,
      reviewTargets: $resolvedReviewTargets,
      generalNotes: mergedGeneralNotes,
      startTime: $startTime,
      principlesPath: cliPrinciplesPath || null,
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
      await deactivateSession('reviewed-with-feedback');
      await closeWindowSafely();
    } catch (e) {
      setReviewStatus(degradedMode ? 'degraded' : 'reviewing');
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
  function handleWindowKeydown(event) {
    if (!tauriAvailable) return;
    handleKeydown(event);
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (recoveryCandidate) {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
      return;
    }
    // Fields that handle their own keys (the rationale composer) mark the event.
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeTopLayerOrFinish();
      return;
    }
    if (!event.metaKey) return;

    const key = event.key.toLowerCase();
    if (key === 'enter') {
      event.preventDefault();
      handleDone();
    } else if (key === 'g') {
      event.preventDefault();
      toggleSessionDrawer();
    } else if (key === '/') {
      event.preventDefault();
      handleAnnotationShortcut();
    } else if (event.shiftKey && key === 'r') {
      event.preventDefault();
      rationaleOpen = !rationaleOpen;
    } else if (event.shiftKey && key === 'o') {
      event.preventDefault();
      toggleReferenceSurface();
    } else if (key === 'o') {
      event.preventDefault();
      pickAndLoadFile();
    }
  }

  /** Escape peels one layer at a time; with nothing open it finishes the review. */
  function closeTopLayerOrFinish() {
    if (helpOpen) {
      helpOpen = false;
    } else if (popoverVisible) {
      clearPopoverState();
    } else if (referenceDrawerOpen) {
      referenceDrawerOpen = false;
    } else if (composerOpen) {
      closeComposer();
    } else if (notesExpanded) {
      notesExpanded = false;
    } else {
      handleDone();
    }
  }

  /** @param {string} id */
  function handleShortcut(id) {
    if (id === 'rationale') handleAnnotationShortcut();
    else if (id === 'notes') toggleSessionDrawer();
    else if (id === 'references') toggleReferenceSurface();
    else if (id === 'undo') editorRef?.undo?.();
  }

  /** @param {string} content */
  function handleContentChange(content) {
    updateContent(content);
    scheduleAutosave('content-change');
  }

  /** @param {string} text */
  function handlePlainTextChange(text) {
    updatePlainText(text);
  }

  /** @param {string} text */
  function handleInitialRender(text) {
    if (!text) return;
    const isPristineDocument =
      $editedContent === $originalContent && $annotations.length === 0 && !$generalNotes;
    if (!$originalPlainText || isPristineDocument) {
      setOriginalPlainText(text);
    } else if (!$editedPlainText) {
      updatePlainText(text);
    }
  }

  /** @param {number} line */
  function handleLineChange(line) {
    currentLine.set(line);
  }

  /** @param {number} x @param {number} y */
  function positionPopoverAt(x, y) {
    const margin = 16;
    const popoverWidth = 384;
    const estimatedHeight = 320;
    const maxX = window.innerWidth - popoverWidth - margin;
    popoverX = Math.min(Math.max(margin, x), maxX);

    const spaceBelow = window.innerHeight - y - margin;
    if (spaceBelow >= estimatedHeight) {
      popoverY = Math.max(80, y);
    } else {
      popoverY = Math.max(margin, y - estimatedHeight - margin);
    }
  }

  function toggleSessionDrawer() {
    notesExpanded = !notesExpanded;
  }

  async function toggleReferenceSurface() {
    if (referenceFiles.length === 0) {
      const picked = await pickReferenceFile();
      if (!picked) return;
    }

    referenceDrawerOpen = !referenceDrawerOpen;
  }

  function focusAnnotationComposer() {
    queueMicrotask(() => {
      annotationColumnRef?.focusComposer?.();
    });
  }

  function closeComposer({ discardDraft = true } = {}) {
    if (discardDraft && composerDraftId) {
      discardRationaleDraft(composerDraftId);
    }
    composerOpen = false;
    composerDraft = '';
    composerDraftId = '';
    composerTargetId = '';
  }

  /**
   * @param {import('$lib/utils/diff.js').Change | null} change
   * @param {{ x?: number, y?: number, openPopover?: boolean }} [options]
   */
  function selectChange(change, options = {}) {
    if (!change) return;

    const { x = NaN, y = NaN, openPopover = compactLayout } = options;
    if (composerOpen && $selectedChangeId && $selectedChangeId !== change.id) {
      closeComposer();
    }
    setSelectedChange(change.id);
    const existing = $annotationEntries.find(
      (entry) => entry.status === 'active' && entry.change?.id === change.id
    );
    selectedAnnotationId = existing?.annotation.id || null;
    editorRef?.scrollToChange?.(change.id);

    if (compactLayout) {
      if (openPopover) {
        openChangePopover(change, x, y);
      }
      return;
    }

    clearPopoverState();
    referenceDrawerOpen = false;
  }

  /**
   * @param {import('$lib/utils/diff.js').Change | null} change
   * @param {number} [x]
   * @param {number} [y]
   */
  function openChangePopover(change, x = NaN, y = NaN) {
    if (!change) return;
    const target = ensureTargetForChange(change);
    const existingAnnotation = $annotationEntries.find(
      (entry) => entry.status === 'active' && entry.change?.id === change.id
    );

    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      positionPopoverAt(x, y);
    } else {
      positionPopoverAt(120, 120);
    }

    popoverChangeId = change.id;
    popoverTargetId = target?.id || '';
    popoverText = change.text;
    popoverDraft = existingAnnotation?.annotation.rationale || '';
    popoverAnnotationId = existingAnnotation?.annotation.id || '';
    popoverVisible = true;
  }

  /**
   * @param {number} line
   * @returns {import('$lib/utils/diff.js').Change | null}
   */
  function findNearestChange(line) {
    if (!$visibleChanges || $visibleChanges.length === 0) return null;
    let nearest = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const change of $visibleChanges) {
      const distance = Math.abs((change.location?.line ?? 1) - line);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = change;
      }
    }
    return nearest;
  }

  function handleAnnotationShortcut() {
    const nearest = $selectedChange || findNearestChange($currentLine ?? 1);
    if (!nearest) return;
    selectChange(nearest, { openPopover: compactLayout });
    if (compactLayout) return;
    // The composer lives in the rationale panel, so make sure it is on screen.
    viewMode = 'review';
    rationaleOpen = true;
    handleStartCompose();
  }

  /**
   * @param {import('$lib/utils/diff.js').Change} change
   * @param {number} x
   * @param {number} y
   */
  function handleRailChangeSelect(change, x, y) {
    if (!change) return;
    selectChange(change, { x, y, openPopover: compactLayout });
  }

  /** @param {any} group @param {number} x @param {number} y */
  function handleRailGroupSelect(group, x, y) {
    const change = group?.changes?.[0] || null;
    if (!change) return;
    const target = ensureTargetForChange(change);
    if (target) {
      setSelectedTarget(target.id);
    }
    selectChange(change, { x, y, openPopover: compactLayout });
  }

  /** @param {any} group */
  function targetIdForGroup(group) {
    return (
      $reviewTargets.find((target) =>
        (group.changeIds || []).some((/** @type {string} */ changeId) =>
          target.changeIds?.includes(changeId)
        )
      )?.id || null
    );
  }

  /** @param {string} changeId @param {string} text @param {number} x @param {number} y */
  function handleEditorChangeClick(changeId, text, x, y) {
    const change = $visibleChanges?.find((item) => item.id === changeId) || null;
    if (change) {
      selectChange(change, { x, y, openPopover: compactLayout });
      return;
    }
    // Fallback for stale click payloads.
    if (compactLayout) {
      openChangePopover(
        {
          id: changeId,
          type: 'insertion',
          text,
          editedOffset: 0,
          location: { line: $currentLine ?? 1, col: 0 },
        },
        x,
        y
      );
    }
  }

  /** @param {string} annotationId @param {number} x @param {number} y */
  function handleAnchorSelect(annotationId, x, y) {
    const entry = $annotationEntries.find((item) => item.annotation.id === annotationId) || null;
    if (!entry) return;
    selectedAnnotationId = annotationId;
    if (entry.status === 'active' && entry.change) {
      selectChange(entry.change, { x, y, openPopover: compactLayout });
      return;
    }
    clearSelectedChange();
  }

  /**
   * @param {import('$lib/utils/diff.js').Change} change
   */
  function handleAnnotationCardSelect(change) {
    if (!change) return;
    selectChange(change, { openPopover: compactLayout });
  }

  /**
   * @param {string} annotationId
   */
  function handleAnnotationListSelect(annotationId) {
    const entry = $annotationEntries.find((item) => item.annotation.id === annotationId) || null;
    if (!entry) return;

    selectedAnnotationId = annotationId;
    closeComposer();

    if (entry.status === 'active' && entry.change) {
      selectChange(entry.change, { openPopover: compactLayout });
      return;
    }

    clearSelectedChange();
    referenceDrawerOpen = false;
  }

  function handleStartCompose() {
    const activeChange = $selectedChange || selectedAnnotationEntry?.change || null;
    if (!activeChange && !selectedAnnotationEntry) return;

    const target =
      (selectedAnnotationEntry?.annotation.targetId &&
        $reviewTargets.find((item) => item.id === selectedAnnotationEntry.annotation.targetId)) ||
      $selectedTarget ||
      (activeChange ? ensureTargetForChange(activeChange) : null);
    if (!target) return;

    const initialDraft = selectedAnnotationEntry?.annotation.rationale || '';
    const draft = startRationaleForTarget(target.id, initialDraft);
    composerOpen = true;
    composerDraft = initialDraft;
    composerTargetId = target.id;
    composerDraftId = draft?.id || '';

    if (activeChange) {
      selectedAnnotationId =
        selectedAnnotationEntry?.annotation.id ||
        $annotationEntries.find(
          (entry) => entry.status === 'active' && entry.change?.id === activeChange.id
        )?.annotation.id ||
        null;
    }

    if (!compactLayout) {
      focusAnnotationComposer();
    }
  }

  /** @param {string} value */
  function handleComposeDraftInput(value) {
    composerDraft = value;
    if (composerDraftId) {
      updateRationaleDraftText(composerDraftId, value);
    }
  }

  function handleCancelCompose() {
    closeComposer();
  }

  function handleSaveCompose() {
    const rationale = composerDraft.trim();
    if (!rationale) return;

    const matchedRule = writingRuleMatcher ? writingRuleMatcher(rationale) : null;
    const currentChange = $selectedChange || selectedAnnotationEntry?.change || null;
    const target =
      (composerTargetId && $reviewTargets.find((item) => item.id === composerTargetId)) ||
      $selectedTarget ||
      (currentChange ? ensureTargetForChange(currentChange) : null);

    if (selectedAnnotationEntry) {
      const patch = {
        targetId: target?.id || selectedAnnotationEntry.annotation.targetId || null,
        targetKind: target?.kind || selectedAnnotationEntry.annotation.targetKind || null,
        targetSnapshot: target?.descriptor || selectedAnnotationEntry.annotation.targetSnapshot || null,
        rationale,
        matchedRule,
        resolution: {
          status: target?.status === 'stale' ? 'stale' : 'active',
          strategy: target?.resolution?.strategy || 'exact',
          confidence: target?.resolution?.confidence ?? 1,
          staleReason: target?.resolution?.staleReason || null,
        },
        updatedAt: new Date().toISOString(),
      };
      updateAnnotation(selectedAnnotationEntry.annotation.id, patch);
      selectedAnnotationId = selectedAnnotationEntry.annotation.id;
      closeComposer({ discardDraft: true });
      return;
    }

    if (!currentChange && !target) return;

    const annotation = createAnnotationRecord({
      change: currentChange,
      editedText: $editedPlainText || $editedContent || '',
      rationale,
      matchedRule,
      reviewTarget: target,
    });
    addAnnotation(annotation);
    selectedAnnotationId = annotation.id;
    closeComposer({ discardDraft: true });
  }

  function handleRemoveSelected() {
    const annotationId = selectedAnnotationEntry?.annotation.id || popoverAnnotationId || null;
    if (!annotationId) return;
    removeAnnotation(annotationId);
    if (selectedAnnotationId === annotationId) {
      selectedAnnotationId = null;
    }
    if (popoverAnnotationId === annotationId) {
      popoverAnnotationId = '';
      popoverDraft = '';
      popoverVisible = false;
    }
    closeComposer();
  }

  function handleReattachSelected() {
    if (!selectedAnnotationEntry || !$selectedChange) return;
    const next = reanchorAnnotation(
      selectedAnnotationEntry.annotation,
      $selectedChange,
      $editedPlainText || $editedContent || '',
      $selectedTarget || ensureTargetForChange($selectedChange)
    );
    updateAnnotation(selectedAnnotationEntry.annotation.id, next);
    selectedAnnotationId = next.id;
  }

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function handleNotesChange(event) {
    updateGeneralNotes(event.currentTarget.value);
  }

  /**
   * @param {string} code
   * @param {string} detail
   */
  function handleEditorRuntimeError(code, detail) {
    enterDegradedMode(code, detail);
  }

  /** @param {{ changeId: string, rationale: string }} data */
  function handlePopoverSave(data) {
    const { changeId, rationale } = data;
    const matchedRule = writingRuleMatcher ? writingRuleMatcher(rationale) : null;
    setSelectedChange(changeId);
    const existing = popoverAnnotationId
      ? $annotationEntries.find((entry) => entry.annotation.id === popoverAnnotationId) || null
      : null;
    const change = $visibleChanges.find((entry) => entry.id === changeId) || null;
    const target =
      (popoverTargetId && $reviewTargets.find((entry) => entry.id === popoverTargetId)) ||
      (change ? ensureTargetForChange(change) : null);

    if (existing) {
      updateAnnotation(existing.annotation.id, {
        targetId: target?.id || existing.annotation.targetId || null,
        targetKind: target?.kind || existing.annotation.targetKind || null,
        targetSnapshot: target?.descriptor || existing.annotation.targetSnapshot || null,
        rationale,
        matchedRule,
        resolution: {
          status: target?.status === 'stale' ? 'stale' : 'active',
          strategy: target?.resolution?.strategy || 'exact',
          confidence: target?.resolution?.confidence ?? 1,
          staleReason: target?.resolution?.staleReason || null,
        },
        updatedAt: new Date().toISOString(),
      });
      selectedAnnotationId = existing.annotation.id;
    } else if (change) {
      const annotation = createAnnotationRecord({
        change,
        editedText: $editedPlainText || $editedContent || '',
        rationale,
        matchedRule,
        reviewTarget: target,
      });
      addAnnotation(annotation);
      selectedAnnotationId = annotation.id;
    }

    clearPopoverState();
  }

  /** @param {{ changeId: string }} data */
  function handlePopoverRemove(data) {
    const entry =
      (popoverAnnotationId &&
        $annotationEntries.find((item) => item.annotation.id === popoverAnnotationId)) ||
      $annotationEntries.find(
        (item) => item.status === 'active' && item.change?.id === data.changeId
      );
    if (entry) {
      removeAnnotation(entry.annotation.id);
      if (selectedAnnotationId === entry.annotation.id) {
        selectedAnnotationId = null;
      }
    }
    clearPopoverState();
  }

  function handlePopoverClose() {
    clearPopoverState();
  }

</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if !tauriAvailable}
  <div class="web-fallback">
    <div class="web-fallback-inner">
      <h1>Marginalia runs as a Mac app</h1>
      <p>This review screen needs the desktop app's file access. The homepage has the overview and install steps.</p>
      <div class="web-fallback-actions">
        <a class="btn btn-primary" href="/">Homepage</a>
        <a class="btn" href="https://github.com/samay58/marginalia" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </div>
  </div>
{:else}
  <div class="app">
    <TopBar
      title={titleParts.name}
      folder={titleParts.folder}
      mode={viewMode}
      onModeChange={(mode) => (viewMode = mode)}
      onHelp={() => (helpOpen = true)}
      onDone={handleDone}
    />

    {#if degradedMode && !recoveryCandidate}
      <p class="notice" role="status">Some highlights are unavailable. Editing, rationales and the bundle still work.</p>
    {/if}

    <main class="desk">
      {#if showRail}
        <ChangeRail
          changes={$substantiveChanges}
          groups={$substantiveChangeGroups.map((group) => ({
            ...group,
            targetId: targetIdForGroup(group),
          }))}
          trivialChanges={$trivialChanges}
          trivialCount={$trivialChangeCount}
          annotationChangeIds={$annotatedChangeIds}
          annotationTargetIds={$annotatedTargetIds}
          annotationCount={$annotationEntries.length}
          selectedChangeId={$selectedChangeId}
          selectedTargetId={$selectedTargetId}
          currentLine={$currentLine}
          onSelectChange={handleRailChangeSelect}
          onSelectGroup={handleRailGroupSelect}
        />
      {/if}

      <div class="editor-column">
        <Editor
          bind:this={editorRef}
          initialContent={$editedContent}
          diffResult={$diffResult}
          annotationEntries={$annotationEntries}
          selectedAnnotationId={selectedAnnotationId}
          selectedChangeId={$selectedChangeId}
          onChange={handleContentChange}
          onPlainTextChange={handlePlainTextChange}
          onInitialRender={handleInitialRender}
          onLineChange={handleLineChange}
          getDiffResult={() => $diffResult}
          onClickChange={handleEditorChangeClick}
          onSelectAnchor={handleAnchorSelect}
          onRuntimeError={handleEditorRuntimeError}
        />
      </div>

      {#if showRationale}
        <AnnotationColumn
          bind:this={annotationColumnRef}
          onClose={() => (rationaleOpen = false)}
          selectedChange={$selectedChange}
          selectedAnnotationEntry={selectedAnnotationEntry}
          annotationEntries={$annotationEntries}
          isComposing={composerOpen}
          composerDraft={composerDraft}
          onSelectChange={handleAnnotationCardSelect}
          onSelectAnnotation={handleAnnotationListSelect}
          onStartCompose={handleStartCompose}
          onDraftInput={handleComposeDraftInput}
          onSaveCompose={handleSaveCompose}
          onCancelCompose={handleCancelCompose}
          onRemoveSelected={handleRemoveSelected}
          onReattachSelected={handleReattachSelected}
        />
      {/if}
    </main>

    <SessionDrawer
      open={notesExpanded}
      generalNotes={$generalNotes}
      onNotesInput={handleNotesChange}
    />

    <StatusBar
      edits={editCount}
      rationales={$annotationEntries.length}
      {saveState}
      onShortcut={handleShortcut}
    />
  </div>

  {#if referenceDrawerOpen}
    <div class="scrim" role="presentation" onclick={() => (referenceDrawerOpen = false)}></div>
    <div class="reference-drawer">
      <ReferencePane
        {referenceFiles}
        {activeReferenceIndex}
        onSelectIndex={(index) => (activeReferenceIndex = index)}
        onPickReferenceFile={pickReferenceFile}
      />
    </div>
  {/if}

  <AnnotationPopover
    changeId={popoverChangeId}
    text={popoverText}
    draft={popoverDraft}
    x={popoverX}
    y={popoverY}
    visible={popoverVisible && compactLayout}
    canRemove={!!popoverAnnotationId}
    onDraftInput={(value) => (popoverDraft = value)}
    onSave={handlePopoverSave}
    onRemove={handlePopoverRemove}
    onClose={handlePopoverClose}
  />

  <HelpSheet open={helpOpen} onClose={() => (helpOpen = false)} />

  {#if recoveryCandidate}
    <div class="scrim"></div>
    <div class="recovery" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title" aria-describedby="recovery-copy">
      <h2 id="recovery-title">Resume your last review?</h2>
      <p id="recovery-copy">A review was still open when Marginalia last closed. Resume picks up your edits and rationales where you left them.</p>
      <dl>
        <dt>File</dt>
        <dd>{recoveryCandidate.filePath || 'Unknown file'}</dd>
        <dt>Last saved</dt>
        <dd>{recoveryCandidate.updatedAt ? new Date(recoveryCandidate.updatedAt).toLocaleString() : 'Unknown'}</dd>
      </dl>
      <div class="recovery-actions">
        <button type="button" class="btn btn-danger" onclick={discardRecoveredSession}>Discard</button>
        <button type="button" class="btn btn-primary" onclick={resumeRecoveredSession}>Resume</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    min-height: 0;
    background: var(--canvas);
  }

  .notice {
    padding: var(--space-2) var(--space-5);
    border-bottom: 1px solid var(--rule);
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .desk {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .editor-column {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 30;
  }

  .reference-drawer {
    position: fixed;
    top: var(--topbar-h);
    right: 0;
    bottom: var(--bottombar-h);
    width: min(480px, 44vw);
    background: var(--surface);
    border-left: 1px solid var(--rule);
    box-shadow: var(--shadow-pop);
    z-index: 31;
    animation: slide-in var(--dur) var(--ease);
  }

  @keyframes slide-in {
    from {
      transform: translateX(16px);
      opacity: 0;
    }
  }

  .recovery {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(460px, calc(100vw - 48px));
    padding: var(--space-6);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    z-index: 31;
  }

  .recovery h2 {
    font-size: var(--text-md);
    font-weight: 600;
  }

  .recovery p {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .recovery dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-4);
    margin-top: var(--space-4);
    font-size: var(--text-sm);
  }

  .recovery dt {
    color: var(--ink-3);
  }

  .recovery dd {
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .recovery-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-6);
  }

  .web-fallback {
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: var(--space-6);
  }

  .web-fallback-inner {
    max-width: 30rem;
  }

  .web-fallback h1 {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .web-fallback p {
    margin-top: var(--space-2);
    color: var(--ink-2);
  }

  .web-fallback-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }
</style>
