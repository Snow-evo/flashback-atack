(() => {
  'use strict';

  const CURRENT_STAGE_KEY = 'traumaRoadmapCurrentStage';
  const NOTES_KEY = 'traumaRoadmapNotes';
  const SAVE_DELAY = 500;

  const storage = getStorage();
  const stageElements = document.querySelectorAll('[data-stage-id]');

  if (!stageElements.length) {
    const warning = document.querySelector('[data-storage-warning]');
    if (!storage && warning) {
      warning.hidden = false;
    }
    return;
  }

  const stageInfo = new Map();
  const noteStatusElements = new Map();

  stageElements.forEach((element) => {
    const stageId = element.dataset.stageId;
    if (!stageId) {
      return;
    }

    const titleElement = element.querySelector('[data-stage-title]');
    const stageTitle = titleElement ? titleElement.textContent.trim() : stageId;

    stageInfo.set(stageId, { element, title: stageTitle });

    const statusElement = element.querySelector('[data-note-status]');
    if (statusElement) {
      statusElement.textContent = '';
      noteStatusElements.set(stageId, statusElement);
    }
  });

  const notesData = loadNotes();

  stageInfo.forEach(({ element }, stageId) => {
    const noteField = element.querySelector('[data-stage-note]');
    if (!noteField) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(notesData, stageId)) {
      noteField.value = notesData[stageId];
    }
  });

  const noteTimers = new Map();
  const stageStatusLabel = document.querySelector('[data-current-stage-label]');
  if (stageStatusLabel && !stageStatusLabel.hasAttribute('aria-live')) {
    stageStatusLabel.setAttribute('aria-live', 'polite');
  }

  let currentStageId = null;
  const storedStageId = loadStage();
  if (storedStageId && stageInfo.has(storedStageId)) {
    currentStageId = storedStageId;
  }

  applyCurrentStage(currentStageId);

  stageInfo.forEach(({ element }, stageId) => {
    const markButton = element.querySelector('[data-stage-action="mark"]');
    if (markButton) {
      markButton.addEventListener('click', () => {
        currentStageId = currentStageId === stageId ? null : stageId;
        applyCurrentStage(currentStageId);
        persistStage(currentStageId);
      });
    }

    const noteField = element.querySelector('[data-stage-note]');
    if (noteField) {
      noteField.addEventListener('input', () => {
        scheduleNoteSave(stageId, noteField.value);
      });

      noteField.addEventListener('blur', () => {
        finalizeNoteSave(stageId, noteField.value);
      });
    }
  });

  const storageWarning = document.querySelector('[data-storage-warning]');
  if (!storage && storageWarning) {
    storageWarning.hidden = false;
  }

  function applyCurrentStage(stageId) {
    const effectiveStageId = stageId && stageInfo.has(stageId) ? stageId : null;
    currentStageId = effectiveStageId;

    stageInfo.forEach(({ element, title }, id) => {
      const isCurrent = id === effectiveStageId;
      element.classList.toggle('is-current', isCurrent);

      const markButton = element.querySelector('[data-stage-action="mark"]');
      if (markButton) {
        const defaultLabel = markButton.dataset.labelMark || 'ここにいるとマーク';
        const currentLabel = markButton.dataset.labelCurrent || '現在地';
        const labelTarget = markButton.querySelector('.roadmap-step__mark-text');
        const text = isCurrent ? currentLabel : defaultLabel;

        if (labelTarget) {
          labelTarget.textContent = text;
        } else {
          markButton.textContent = text;
        }

        markButton.setAttribute('aria-pressed', String(isCurrent));
        markButton.classList.toggle('roadmap-step__mark--current', isCurrent);
      }

      if (isCurrent && stageStatusLabel) {
        stageStatusLabel.textContent = title;
      }
    });

    if (stageStatusLabel && !effectiveStageId) {
      stageStatusLabel.textContent = '未設定';
    }
  }

  function scheduleNoteSave(stageId, value) {
    showNoteStatus(stageId, '保存中…');
    clearPending(stageId);

    const timerId = window.setTimeout(() => {
      saveNote(stageId, value);
      showNoteStatus(stageId, '保存しました');
      noteTimers.delete(stageId);
    }, SAVE_DELAY);

    noteTimers.set(stageId, timerId);
  }

  function finalizeNoteSave(stageId, value) {
    clearPending(stageId);
    saveNote(stageId, value);
    showNoteStatus(stageId, '保存しました');
  }

  function clearPending(stageId) {
    const timerId = noteTimers.get(stageId);
    if (timerId === undefined) {
      return;
    }

    window.clearTimeout(timerId);
    noteTimers.delete(stageId);
  }

  function showNoteStatus(stageId, message) {
    const statusElement = noteStatusElements.get(stageId);
    if (!statusElement) {
      return;
    }

    statusElement.textContent = message;
  }

  function saveNote(stageId, value) {
    if (typeof value === 'string' && value.trim() !== '') {
      notesData[stageId] = value;
    } else {
      delete notesData[stageId];
    }

    persistNotes();
  }

  function persistStage(stageId) {
    if (!storage) {
      return;
    }

    if (stageId) {
      storage.setItem(CURRENT_STAGE_KEY, stageId);
    } else {
      storage.removeItem(CURRENT_STAGE_KEY);
    }
  }

  function persistNotes() {
    if (!storage) {
      return;
    }

    storage.setItem(NOTES_KEY, JSON.stringify(notesData));
  }

  function loadStage() {
    if (!storage) {
      return null;
    }

    const stored = storage.getItem(CURRENT_STAGE_KEY);
    return stored || null;
  }

  function loadNotes() {
    if (!storage) {
      return {};
    }

    const stored = storage.getItem(NOTES_KEY);
    if (!stored) {
      return {};
    }

    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (error) {
      console.warn('保存されたメモの読み込みに失敗しました。データを初期化します。', error);
    }

    return {};
  }

  function getStorage() {
    try {
      const { localStorage } = window;
      const testKey = '__roadmap_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch (error) {
      console.warn('ローカルストレージにアクセスできませんでした。', error);
      return null;
    }
  }
})();
