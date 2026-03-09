<script>
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
  import Header from '$lib/components/Header.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import ChangeRail from '$lib/components/ChangeRail.svelte';
  import AnnotationColumn from '$lib/components/AnnotationColumn.svelte';
  import AnnotationPopover from '$lib/components/AnnotationPopover.svelte';
  import ReferencePane from '$lib/components/ReferencePane.svelte';
  import SessionDrawer from '$lib/components/SessionDrawer.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
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
    diffResult,
    currentLine,
    annotations,
    annotatedChanges,
    slopMatchers,
    startTime,
    initializeWithContent,
    restoreFromSnapshot,
    updateContent,
    updateGeneralNotes,
    setSlopMatchers,
    setAnnotation,
    removeAnnotation,
    setOriginalPlainText,
    originalPlainText,
    updatePlainText,
    editedPlainText,
    selectedChangeId,
    selectedChange,
    rightPaneMode,
    setSelectedChange,
    clearSelectedChange,
    setRightPaneMode,
  } from '$lib/stores/app.js';
  import { generateBundle } from '$lib/utils/bundle.js';
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
  let popoverRationale = $state('');
  let popoverCategory = $state('');
  let isDark = $state(false);
  /** @type {any} */
  let editorRef = $state(null);
  /** @type {any} */
  let annotationColumnRef = $state(null);
  /** @type {Array<{ path: string, name: string, content: string }>} */
  let referenceFiles = $state([]);
  let activeReferenceIndex = $state(0);
  let cliBundleDir = $state('');
  let cliOutPath = $state('');
  let cliPrinciplesPath = $state('');
  let cliInitialPath = $state('');
  /** @type {Array<import('$lib/utils/lint.js').LintMatcher>} */
  let allLintMatchers = $state([]);
  let toneLintEnabled = $state(true);
  /** @type {Set<string>} */
  let mutedLintRuleIds = $state(new Set());
  /** @type {'review' | 'manuscript'} */
  let densityMode = $state('manuscript');
  /** @type {null | ((rationale: string) => string | null)} */
  let writingRuleMatcher = $state(null);
  /** @type {null | (() => void)} */
  let closeRequestedUnlisten = null;
  let isProgrammaticClose = $state(false);
  let isFinalizingClose = $state(false);

  let homeDir = $state('');
  let sessionId = $state('');
  let snapshotPath = $state('');
  let activeSessionStatePath = $state('');
  let autosaveState = $state('idle');
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

  const SNAPSHOT_VERSION = 1;
  const AUTOSAVE_DEBOUNCE_MS = 900;
  const REF_STORAGE_KEY = 'marginalia.references';
  const DENSITY_STORAGE_KEY = 'marginalia.density';

  const liveLintFindings = $derived.by(() =>
    collectLintFindings($editedPlainText || $editedContent || '', $slopMatchers, {
      maxPerRule: 3,
      maxTotal: 12,
    })
  );

  const mutedLintCount = $derived.by(() => mutedLintRuleIds.size);
  const editCount = $derived.by(() => $diffResult?.changes?.length ?? 0);
  const slopLines = $derived.by(() => new Set(liveLintFindings.map((finding) => finding.line)));
  const statusAutosaveLabel = $derived.by(() => getAutosaveLabel());

  /**
   * @param {import('$lib/utils/lint.js').LintMatcher} matcher
   */
  function resolveLintRuleId(matcher) {
    if (matcher.id) return matcher.id;
    const safeLabel = (matcher.label || 'rule')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const safeCategory = (matcher.category || 'lint').toLowerCase();
    return `${safeCategory}.${safeLabel}`;
  }

  function applyLintMatcherFilters() {
    const filtered = allLintMatchers
      .filter((matcher) => {
        if (!toneLintEnabled && matcher.category === 'tone') {
          return false;
        }
        const ruleId = resolveLintRuleId(matcher);
        if (mutedLintRuleIds.has(ruleId)) {
          return false;
        }
        return true;
      })
      .map((matcher) => ({
        ...matcher,
        flags: matcher.flags || 'g',
      }));
    setSlopMatchers(filtered);
    editorRef?.refreshSlop?.();
  }

  /**
   * @param {Array<import('$lib/utils/lint.js').LintMatcher>} matchers
   */
  function setAllLintMatchers(matchers) {
    allLintMatchers = Array.isArray(matchers) ? matchers : [];
    applyLintMatcherFilters();
  }

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

  /**
   * @param {string} reason
   */
  async function persistSnapshot(reason) {
    if (!snapshotPath || !sessionId || !hasInitialDocument || isHydratingSnapshot) return;
    autosaveState = 'saving';
    const serializedAnnotations = Array.from($annotations.entries()).map(([changeId, annotation]) => ({
      changeId,
      annotation,
    }));
    try {
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
        annotations: serializedAnnotations,
        selected_change_id: $selectedChangeId,
        right_pane_mode: $rightPaneMode,
        session_drawer_open: notesExpanded,
        degraded_mode: degradedMode,
        degraded_reasons: [...degradedReasons],
        cli_options: {
          bundle_dir: cliBundleDir || null,
          out_path: cliOutPath || null,
          principles_path: cliPrinciplesPath || null,
        },
      });
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
    if (!snapshotPath || !sessionId || !hasInitialDocument || isHydratingSnapshot) return;
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
    clearSelectedChange();
    setRightPaneMode('annotations');
    const content = await invoke('read_file', { path });
    initializeWithContent(path, content);
    hasInitialDocument = true;
    await activateSession(createSessionId());
    editorRef?.refreshSlop();
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
      restoreDensityMode();
      updateLayoutMode();

      // Check for CLI options and load initial document (or recovery prompt)
      try {
        const cliOptions = await invoke('get_cli_options');
        cliInitialPath = cliOptions?.filePath || '';
        cliBundleDir = cliOptions?.bundleDir || '';
        cliOutPath = cliOptions?.outPath || '';
        cliPrinciplesPath = cliOptions?.principlesPath || '';
        await ensureHomeDir();
        // Always enable built-in tone lint. If a principles file is provided, extend matchers with it.
        setAllLintMatchers(createToneMatchers());
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
        setAllLintMatchers(createToneMatchers());
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
      window.addEventListener('resize', updateLayoutMode);

      await restoreReferenceFiles();

      return () => {
        clearAutosaveTimer();
        mediaQuery.removeEventListener('change', handleChange);
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

    return () => {
      cleanup();
    };
  });

  function updateLayoutMode() {
    if (typeof window === 'undefined') return;
    compactLayout = window.innerWidth < 1180;
    if (!compactLayout) {
      referenceDrawerOpen = false;
    }
  }

  $effect(() => {
    // Trigger autosave when user-editable session data changes.
    $editedContent;
    $editedPlainText;
    $generalNotes;
    $annotations;
    $selectedChangeId;
    $rightPaneMode;
    notesExpanded;
    if (!sessionId || !snapshotPath || !hasInitialDocument || isHydratingSnapshot) return;
    scheduleAutosave('content-change');
  });

  $effect(() => {
    if ($selectedChangeId && !$selectedChange) {
      clearSelectedChange();
    }
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
      setAllLintMatchers([...matchers, ...toneMatchers]);
      editorRef?.refreshSlop();
      if (!cliPrinciplesPath) {
        cliPrinciplesPath = principlesPath;
      }
    } catch (e) {
      console.warn('WRITING.md not available for rule matching:', e);
      const toneMatchers = createToneMatchers();
      setAllLintMatchers(toneMatchers);
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
      startedAt: snapshot.started_at || null,
      selectedChangeId: snapshot.selected_change_id || null,
      rightPaneMode: snapshot.right_pane_mode || 'annotations',
    });

    notesExpanded = snapshot.session_drawer_open === true;
    referenceDrawerOpen = false;

    hasInitialDocument = true;
    sessionId = recoveryCandidate.sessionId || createSessionId();
    snapshotPath = recoveryCandidate.snapshotPath;
    activeSessionStatePath = recoveryCandidate.activeStatePath;
    recoveryCandidate = null;
    isHydratingSnapshot = false;

    await writeActiveSessionState(true, 'recovered');
    await persistSnapshot('recovered-resume');

    // Ensure visual plugins catch up once editor reflects restored state.
    setTimeout(() => {
      editorRef?.refreshDiff?.();
      editorRef?.refreshSlop?.();
    }, 0);
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

  async function handleDone() {
    await persistSnapshot('done-invoked');
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

    const lintFindings = collectLintFindings(editedTextForDiff, $slopMatchers);
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
      annotations: $annotations,
      generalNotes: mergedGeneralNotes,
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
      await deactivateSession('reviewed-with-feedback');
      await closeWindowSafely();
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

    if (event.key === 'Escape') {
      if (popoverVisible) {
        popoverVisible = false;
      } else if (referenceDrawerOpen) {
        referenceDrawerOpen = false;
      } else {
        handleDone();
      }
    }
    if (event.metaKey && event.key === 'Enter') {
      handleDone();
    }
    if (event.metaKey && event.key === 'g') {
      event.preventDefault();
      toggleSessionDrawer();
    }
    if (event.metaKey && event.key === '/') {
      event.preventDefault();
      handleAnnotationShortcut();
    }
    if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      toggleReferenceSurface();
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
    const maxX = window.innerWidth - 384 - margin;
    const maxY = window.innerHeight - 350;
    popoverX = Math.min(Math.max(margin, x), maxX);
    popoverY = Math.min(Math.max(80, y), maxY);
  }

  function toggleSessionDrawer() {
    notesExpanded = !notesExpanded;
  }

  async function toggleReferenceSurface() {
    if (referenceFiles.length === 0) {
      const picked = await pickReferenceFile();
      if (!picked) return;
    }

    if (compactLayout) {
      referenceDrawerOpen = !referenceDrawerOpen;
    } else {
      setRightPaneMode($rightPaneMode === 'reference' ? 'annotations' : 'reference');
    }
  }

  function focusAnnotationComposer() {
    queueMicrotask(() => {
      annotationColumnRef?.focusComposer?.();
    });
  }

  /**
   * @param {import('$lib/utils/diff.js').Change | null} change
   * @param {{ x?: number, y?: number, focusAnnotation?: boolean, openPopover?: boolean }} [options]
   */
  function selectChange(change, options = {}) {
    if (!change) return;

    const { x = NaN, y = NaN, focusAnnotation = false, openPopover = compactLayout } = options;
    setSelectedChange(change.id);
    editorRef?.scrollToChange?.(change.id);

    if (compactLayout) {
      if (openPopover) {
        openChangePopover(change, x, y);
      }
      return;
    }

    referenceDrawerOpen = false;
    setRightPaneMode('annotations');
    if (focusAnnotation) {
      focusAnnotationComposer();
    }
  }

  /**
   * @param {import('$lib/utils/diff.js').Change | null} change
   * @param {number} [x]
   * @param {number} [y]
   */
  function openChangePopover(change, x = NaN, y = NaN) {
    if (!change) return;
    const existingAnnotation = $annotations.get(change.id);

    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      positionPopoverAt(x, y);
    } else {
      positionPopoverAt(120, 120);
    }

    popoverChangeId = change.id;
    popoverText = change.text;
    popoverRationale = existingAnnotation?.rationale || '';
    popoverCategory = existingAnnotation?.category || '';
    popoverVisible = true;
  }

  /**
   * @param {number} line
   * @returns {import('$lib/utils/diff.js').Change | null}
   */
  function findNearestChange(line) {
    if (!$diffResult || $diffResult.changes.length === 0) return null;
    let nearest = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const change of $diffResult.changes) {
      const distance = Math.abs((change.location?.line ?? 1) - line);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = change;
      }
    }
    return nearest;
  }

  function handleAnnotationShortcut() {
    const nearest = findNearestChange($currentLine ?? 1);
    if (!nearest) return;
    selectChange(nearest, { focusAnnotation: true, openPopover: compactLayout });
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

  /** @param {string} changeId @param {string} text @param {number} x @param {number} y */
  function handleEditorChangeClick(changeId, text, x, y) {
    const change = $diffResult?.changes.find((item) => item.id === changeId) || null;
    if (change) {
      selectChange(change, {
        x,
        y,
        focusAnnotation: !compactLayout,
        openPopover: compactLayout,
      });
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

  /** @param {string} changeId @param {number} x @param {number} y */
  function handleAnchorSelect(changeId, x, y) {
    const change = $diffResult?.changes.find((item) => item.id === changeId) || null;
    if (!change) return;
    selectChange(change, { x, y, openPopover: compactLayout });
  }

  /**
   * @param {import('$lib/utils/diff.js').Change} change
   */
  function handleAnnotationCardSelect(change) {
    if (!change) return;
    selectChange(change, { focusAnnotation: true, openPopover: compactLayout });
  }

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function handleNotesChange(event) {
    updateGeneralNotes(event.currentTarget.value);
  }

  /** @param {Event & { currentTarget: HTMLInputElement }} event */
  function handleToneLintToggle(event) {
    toneLintEnabled = event.currentTarget.checked;
    applyLintMatcherFilters();
  }

  /** @param {string} ruleId */
  function ignoreLintRuleForSession(ruleId) {
    if (!ruleId) return;
    const next = new Set(mutedLintRuleIds);
    next.add(ruleId);
    mutedLintRuleIds = next;
    applyLintMatcherFilters();
  }

  function clearIgnoredLintRules() {
    mutedLintRuleIds = new Set();
    applyLintMatcherFilters();
  }

  /**
   * @param {string} code
   * @param {string} detail
   */
  function handleEditorRuntimeError(code, detail) {
    enterDegradedMode(code, detail);
  }

  /** @param {{ changeId: string, rationale: string, category?: string }} data */
  function handlePopoverSave(data) {
    const { changeId, rationale, category } = data;
    const matchedRule = writingRuleMatcher ? writingRuleMatcher(rationale) : null;
    setSelectedChange(changeId);
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

  function getAutosaveLabel() {
    if (!sessionId) return '';
    if (autosaveState === 'saving') return 'Saving...';
    if (autosaveState === 'saved') return 'Saved';
    if (autosaveState === 'error') return 'Autosave error';
    return 'Autosave idle';
  }

  function restoreDensityMode() {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (saved === 'review' || saved === 'manuscript') {
        densityMode = saved;
      }
    } catch {
      // Ignore storage errors and keep default mode.
    }
  }

  /**
   * @param {'review' | 'manuscript'} mode
   */
  function setDensityMode(mode) {
    if (mode !== 'review' && mode !== 'manuscript') return;
    densityMode = mode;
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors in constrained environments.
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if !tauriAvailable}
  <div class="web-fallback">
    <div class="web-fallback-inner glass-surface glass-surface-ambient">
      <div class="web-fallback-badge">Desktop-only review UI</div>
      <h1 class="web-fallback-title">Marginalia Review</h1>
      <p class="web-fallback-copy">
        This route runs inside the Marginalia macOS app (it relies on Tauri file APIs). For the overview and install steps, head to
        the homepage.
      </p>
      <div class="web-fallback-actions">
        <a class="web-fallback-btn control-motion control-focus control-raise" href="/">Go to the homepage</a>
        <a
          class="web-fallback-btn secondary control-motion control-focus control-raise"
          href="https://github.com/samay58/marginalia"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </div>
  </div>
{:else}
<div class="app" class:density-review={densityMode === 'review'} class:density-manuscript={densityMode === 'manuscript'}>
  <Header
    filename={$filename}
    hasChanges={$hasChanges}
    editCount={editCount}
    {densityMode}
    onSetDensity={setDensityMode}
    onDone={handleDone}
  />

  {#if recoveryCandidate}
    <div class="recovery-overlay">
      <div class="recovery-modal glass-surface glass-surface-focal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <h2 id="recovery-title">Resume previous review?</h2>
        <p class="recovery-copy">
          Marginalia found an unfinished review session. You can resume exactly where you left off, or discard it and start fresh.
        </p>
        <dl class="recovery-meta">
          <div>
            <dt>File</dt>
            <dd>{recoveryCandidate.filePath || '(unknown file)'}</dd>
          </div>
          <div>
            <dt>Last autosave</dt>
            <dd>{recoveryCandidate.updatedAt || 'Unknown'}</dd>
          </div>
        </dl>
        <div class="recovery-actions">
          <button class="discard-btn control-motion control-focus control-raise" onclick={discardRecoveredSession}>Discard</button>
          <button class="resume-btn control-motion control-focus control-raise" onclick={resumeRecoveredSession}>Resume Session</button>
        </div>
      </div>
    </div>
  {/if}

  {#if degradedMode && !recoveryCandidate}
    <div class="degraded-banner" role="status" aria-live="polite">
      <span>Degraded mode active. Editing and bundle capture still work; some highlights may be unavailable.</span>
    </div>
  {/if}

  <main class="desk" class:compact={compactLayout}>
    <ChangeRail
      diffResult={$diffResult}
      annotations={$annotations}
      slopLines={slopLines}
      selectedChangeId={$selectedChangeId}
      currentLine={$currentLine}
      onSelectChange={handleRailChangeSelect}
    />

    <div class="editor-column">
      <Editor
        bind:this={editorRef}
        content={$editedContent}
        diffResult={$diffResult}
        annotations={$annotations}
        slopLines={slopLines}
        selectedChangeId={$selectedChangeId}
        {densityMode}
        onChange={handleContentChange}
        onPlainTextChange={handlePlainTextChange}
        onInitialRender={handleInitialRender}
        onLineChange={handleLineChange}
        getDiffResult={() => $diffResult}
        onClickChange={handleEditorChangeClick}
        onSelectAnchor={handleAnchorSelect}
        getSlopMatchers={() => $slopMatchers}
        onRuntimeError={handleEditorRuntimeError}
      />
    </div>

    {#if !compactLayout}
      <section class="right-pane-shell">
        <div class="right-pane-switch">
          <button
            type="button"
            class="mode-option control-motion control-focus"
            class:active={$rightPaneMode === 'annotations'}
            onclick={() => setRightPaneMode('annotations')}
          >
            Annotations
          </button>
          <button
            type="button"
            class="mode-option control-motion control-focus"
            class:active={$rightPaneMode === 'reference'}
            onclick={toggleReferenceSurface}
          >
            {referenceFiles.length > 0 ? 'Reference' : 'Add Reference'}
          </button>
        </div>

        {#if $rightPaneMode === 'reference'}
          <ReferencePane
            {referenceFiles}
            {activeReferenceIndex}
            onSelectIndex={(index) => activeReferenceIndex = index}
            onPickReferenceFile={pickReferenceFile}
          />
        {:else}
          <AnnotationColumn
            bind:this={annotationColumnRef}
            selectedChange={$selectedChange}
            annotations={$annotations}
            annotatedChanges={$annotatedChanges}
            lintFindings={liveLintFindings}
            {densityMode}
            onSelectChange={handleAnnotationCardSelect}
            onSave={handlePopoverSave}
            onRemove={handlePopoverRemove}
          />
        {/if}
      </section>
    {/if}
  </main>

  {#if compactLayout && referenceDrawerOpen}
    <div
      class="reference-drawer-scrim"
      role="button"
      tabindex="-1"
      aria-label="Close reference drawer"
      onclick={() => referenceDrawerOpen = false}
      onkeydown={(event) => event.key === 'Escape' && (referenceDrawerOpen = false)}
    ></div>
    <div class="reference-drawer">
      <ReferencePane
        {referenceFiles}
        {activeReferenceIndex}
        onSelectIndex={(index) => activeReferenceIndex = index}
        onPickReferenceFile={pickReferenceFile}
      />
    </div>
  {/if}

  <SessionDrawer
    open={notesExpanded}
    generalNotes={$generalNotes}
    {toneLintEnabled}
    liveLintFindings={liveLintFindings}
    {mutedLintCount}
    onNotesInput={handleNotesChange}
    onToneLintToggle={handleToneLintToggle}
    onIgnoreLintRule={ignoreLintRuleForSession}
    onClearIgnored={clearIgnoredLintRules}
  />

  <StatusBar
    {editCount}
    slopCount={liveLintFindings.length}
    annotationCount={$annotations.size}
    autosaveLabel={statusAutosaveLabel}
    {degradedMode}
    drawerOpen={notesExpanded}
    {compactLayout}
    rightPaneMode={$rightPaneMode}
    hasReferences={referenceFiles.length > 0}
    onToggleDrawer={toggleSessionDrawer}
    onToggleReference={toggleReferenceSurface}
  />

  <AnnotationPopover
    changeId={popoverChangeId}
    text={popoverText}
    currentRationale={popoverRationale}
    currentCategory={popoverCategory}
    x={popoverX}
    y={popoverY}
    visible={popoverVisible && compactLayout}
    onSave={handlePopoverSave}
    onRemove={handlePopoverRemove}
    onClose={handlePopoverClose}
  />
</div>
{/if}

<style>
  .web-fallback {
    height: 100vh;
    width: 100%;
    display: grid;
    place-items: center;
    padding: 2rem;
    background: var(--paper);
    color: var(--ink);
  }

  .web-fallback-inner {
    max-width: 34rem;
    border-radius: 14px;
    border: 1px solid var(--paper-edge);
    padding: 1.25rem 1.25rem;
  }

  .web-fallback-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--paper-edge);
    background: color-mix(in srgb, var(--paper-bright) 65%, transparent);
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--ink-faded);
  }

  .web-fallback-title {
    margin-top: 0.85rem;
    font-family: var(--font-display);
    font-size: 1.6rem;
    letter-spacing: -0.02em;
  }

  .web-fallback-copy {
    margin-top: 0.65rem;
    color: var(--ink-faded);
    line-height: 1.5;
  }

  .web-fallback-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 1rem;
  }

  .web-fallback-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 80%, transparent);
    background: color-mix(in srgb, var(--paper-bright) 70%, transparent);
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .web-fallback-btn.secondary {
    background: transparent;
    color: var(--ink-faded);
  }

  .app {
    height: 100vh;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto auto;
    background: var(--canvas-paper);
    box-shadow: inset 0 0 200px 60px rgba(0, 0, 0, 0.04);
  }

  .app.density-manuscript {
    --line-height: 1.875rem;
  }

  .app.density-review {
    --line-height: 1.75rem;
    --glass-bg-static: color-mix(in srgb, var(--paper) 95%, transparent);
  }

  .recovery-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--paper) 70%, rgba(0, 0, 0, 0.25));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    z-index: 200;
  }

  .recovery-modal {
    width: min(620px, 100%);
    border: var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    box-shadow: var(--shadow-lg);
  }

  .recovery-modal h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--ink);
    margin: 0;
  }

  .recovery-copy {
    font-family: var(--font-body);
    color: var(--ink-faded);
    line-height: 1.5;
  }

  .recovery-meta {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    border: var(--border-subtle);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--paper-bright) 72%, transparent);
  }

  .recovery-meta div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recovery-meta dt {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
  }

  .recovery-meta dd {
    margin: 0;
    font-family: var(--font-body);
    color: var(--ink);
    font-size: 0.95rem;
    word-break: break-word;
  }

  .recovery-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .discard-btn,
  .resume-btn {
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  }

  .discard-btn {
    background: transparent;
    color: var(--ink-faded);
    border-color: var(--paper-edge);
  }

  .discard-btn:hover {
    color: var(--ink);
    border-color: var(--ink-ghost);
  }

  .resume-btn {
    color: var(--paper-bright);
    background: var(--accent);
  }

  .resume-btn:hover {
    background: var(--accent-hover);
  }

  .degraded-banner {
    border-bottom: 1px solid color-mix(in srgb, var(--slop-line) 30%, transparent);
    background: color-mix(in srgb, var(--slop-bg) 78%, transparent);
    color: color-mix(in srgb, var(--slop-ink) 80%, var(--ink));
    padding: var(--space-2) var(--desk-padding-x);
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    line-height: 1.4;
  }

  .desk {
    min-height: 0;
    display: grid;
    grid-template-columns: var(--desk-rail-width) minmax(0, 1fr) var(--desk-right-width);
    gap: var(--desk-gap);
    padding: var(--space-10) var(--desk-padding-x) 0;
    overflow: hidden;
  }

  .app.density-review .desk {
    padding-top: var(--space-8);
  }

  .desk.compact {
    grid-template-columns: var(--desk-rail-width) minmax(0, 1fr);
  }

  .editor-column {
    min-width: 0;
    overflow: hidden;
    display: flex;
    justify-content: center;
  }

  .right-pane-shell {
    width: var(--desk-right-width);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .right-pane-switch {
    display: flex;
    align-items: center;
    gap: 2px;
    align-self: flex-start;
    margin-bottom: var(--space-3);
    padding: 2px;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 92%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--paper-matte) 72%, transparent);
  }

  .mode-option {
    border: none;
    border-radius: 999px;
    background: transparent;
    padding: 0.35rem 0.7rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-faded);
    cursor: pointer;
  }

  .mode-option.active {
    color: var(--ink);
    background: var(--paper-bright);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .reference-drawer-scrim {
    position: fixed;
    inset: 0;
    background: rgba(25, 20, 15, 0.18);
    z-index: 140;
  }

  .reference-drawer {
    position: fixed;
    top: var(--header-height);
    right: var(--desk-padding-x);
    bottom: calc(var(--status-bar-height) + var(--space-3));
    width: min(24rem, calc(100vw - 2rem));
    z-index: 150;
  }

  .reference-drawer :global(.reference-pane) {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  @media (max-width: 1180px) {
    .desk {
      gap: var(--space-7);
    }
  }

  @media (max-width: 1100px) {
    .desk,
    .app.density-review .desk {
      padding-top: var(--space-7);
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }
  }

  @media (max-width: 920px) {
    .recovery-modal {
      padding: var(--space-4);
    }

    .recovery-actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .discard-btn,
    .resume-btn {
      width: 100%;
    }
  }
</style>
