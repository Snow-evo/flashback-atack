(() => {
  'use strict';

  const STORAGE_KEY = 'externalizationPlans';
  const stepsState = {
    current: 0,
    steps: [],
    progressIndicators: [],
  };

  const elements = {
    form: null,
    feedback: null,
    entriesList: null,
    emptyMessage: null,
    clearButton: null,
  };

  const storage = getStorage();
  const entries = storage ? loadEntries() : [];

  whenDocumentReady(() => {
    initializeForm();
    initializeList();
  });

  function whenDocumentReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function initializeForm() {
    const form = document.getElementById('externalization-form');
    if (!form) {
      return;
    }

    elements.form = form;
    elements.feedback = document.getElementById('wizard-feedback');

    stepsState.steps = Array.from(form.querySelectorAll('[data-step-index]'));
    stepsState.progressIndicators = Array.from(
      document.querySelectorAll('[data-progress-step]')
    );

    attachFieldReset('#character-name');
    attachFieldReset('#support-scene');

    form.addEventListener('submit', handleSubmit);

    form.querySelectorAll('[data-action="next"]').forEach((button) => {
      button.addEventListener('click', handleNextStep);
    });

    form.querySelectorAll('[data-action="prev"]').forEach((button) => {
      button.addEventListener('click', handlePreviousStep);
    });

    showStep(0);
  }

  function initializeList() {
    elements.entriesList = document.getElementById('externalization-list');
    elements.emptyMessage = document.querySelector('[data-empty-message]');
    elements.clearButton = document.querySelector('[data-action="clear"]');

    if (elements.entriesList) {
      elements.entriesList.addEventListener('click', handleListClick);
    }

  if (elements.clearButton) {
    elements.clearButton.addEventListener('click', handleClearAll);
    if (!storage) {
      elements.clearButton.title = 'ブラウザの保存機能が利用できないため、ページを離れるとリストが消える可能性があります';
    }
  }

    renderEntries(entries);
  }

  function attachFieldReset(selector) {
    const field = document.querySelector(selector);
    if (!field) {
      return;
    }

    field.addEventListener('input', () => {
      field.setCustomValidity('');
    });
  }

  function handleNextStep(event) {
    event.preventDefault();
    clearFeedback();

    if (!validateStep(stepsState.current)) {
      return;
    }

    const nextIndex = Math.min(stepsState.current + 1, stepsState.steps.length - 1);
    showStep(nextIndex);
  }

  function handlePreviousStep(event) {
    event.preventDefault();
    clearFeedback();

    const previousIndex = Math.max(stepsState.current - 1, 0);
    showStep(previousIndex);
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearFeedback();

    if (!validateStep(0) || !validateStep(1)) {
      return;
    }

    const form = elements.form;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const entry = createEntryFromForm(formData);
    if (!entry) {
      return;
    }

    entries.unshift(entry);
    persistEntries();
    renderEntries(entries);

    form.reset();
    showStep(0);
    const message = storage
      ? '保存しました。日常の中で味方を呼び出してみましょう。'
      : '保存しました（この端末では自動保存が無効のため、ページを離れると内容が消える場合があります）。';
    displayFeedback(message);
  }

  function handleListClick(event) {
    const deleteButton = event.target.closest('[data-action="delete"]');
    if (!deleteButton || !elements.entriesList || !elements.entriesList.contains(deleteButton)) {
      return;
    }

    const entryId = deleteButton.getAttribute('data-entry-id');
    if (!entryId) {
      return;
    }

    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return;
    }

    entries.splice(index, 1);
    persistEntries();
    renderEntries(entries);
  }

  function handleClearAll() {
    if (!entries.length) {
      return;
    }

    entries.splice(0, entries.length);
    persistEntries();
    renderEntries(entries);
    displayFeedback('保存されていたプランを削除しました。');
  }

  function validateStep(stepIndex) {
    const form = elements.form;
    if (!form) {
      return false;
    }

    if (stepIndex === 0) {
      const nameField = form.querySelector('#character-name');
      if (!nameField) {
        return false;
      }

      const value = nameField.value.trim();
      if (!value) {
        nameField.setCustomValidity('責める声に付ける名前を入力してください');
        nameField.reportValidity();
        return false;
      }
      nameField.setCustomValidity('');
      return true;
    }

    if (stepIndex === 1) {
      const sceneField = form.querySelector('#support-scene');
      if (!sceneField) {
        return false;
      }

      const value = sceneField.value.trim();
      if (!value) {
        sceneField.setCustomValidity('現れてほしい場面を書いてください');
        sceneField.reportValidity();
        return false;
      }
      sceneField.setCustomValidity('');
      return true;
    }

    return true;
  }

  function showStep(targetIndex) {
    stepsState.current = targetIndex;

    stepsState.steps.forEach((step, index) => {
      const isCurrent = index === targetIndex;
      step.hidden = !isCurrent;
      if (isCurrent) {
        const firstField = step.querySelector('input, textarea');
        if (firstField) {
          firstField.focus({ preventScroll: true });
        }
      }
    });

    stepsState.progressIndicators.forEach((indicator, index) => {
      indicator.classList.toggle('is-active', index === targetIndex);
      indicator.classList.toggle('is-complete', index < targetIndex);
    });
  }

  function createEntryFromForm(formData) {
    const name = (formData.get('characterName') || '').toString().trim();
    const scene = (formData.get('supportScene') || '').toString().trim();
    if (!name || !scene) {
      return null;
    }

    return {
      id: generateId(),
      createdAt: new Date().toISOString(),
      characterName: name,
      characterPersona: (formData.get('characterPersona') || '').toString().trim(),
      characterSupport: (formData.get('characterSupport') || '').toString().trim(),
      supportScene: scene,
      supportLocation: (formData.get('supportLocation') || '').toString().trim(),
      supportAction: (formData.get('supportAction') || '').toString().trim(),
    };
  }

  function renderEntries(list) {
    if (!elements.entriesList || !elements.emptyMessage) {
      return;
    }

    elements.entriesList.innerHTML = '';

    if (!list.length) {
      elements.entriesList.hidden = true;
      elements.emptyMessage.hidden = false;
      return;
    }

    elements.entriesList.hidden = false;
    elements.emptyMessage.hidden = true;

    list.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'externalization-entry';
      item.dataset.entryId = entry.id;

      const header = document.createElement('div');
      header.className = 'externalization-entry__header';

      const name = document.createElement('h3');
      name.className = 'externalization-entry__name';
      name.textContent = entry.characterName;
      header.appendChild(name);

      const scene = document.createElement('p');
      scene.className = 'externalization-entry__scene';
      scene.textContent = `現れてほしい場面：${entry.supportScene}`;
      header.appendChild(scene);

      item.appendChild(header);

      const bodyList = document.createElement('ul');
      bodyList.className = 'externalization-entry__body';

      if (entry.characterPersona) {
        bodyList.appendChild(createDetailItem('雰囲気や特徴', entry.characterPersona));
      }

      if (entry.characterSupport) {
        bodyList.appendChild(createDetailItem('よく言ってくる言葉', entry.characterSupport));
      }

      if (entry.supportLocation) {
        bodyList.appendChild(createDetailItem('置いておく場所', entry.supportLocation));
      }

      if (entry.supportAction) {
        bodyList.appendChild(createDetailItem('見かけたときの対応', entry.supportAction));
      }

      if (bodyList.children.length) {
        item.appendChild(bodyList);
      }

      const actions = document.createElement('div');
      actions.className = 'externalization-entry__actions';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'text-button externalization-entry__delete';
      deleteButton.dataset.action = 'delete';
      deleteButton.dataset.entryId = entry.id;
      deleteButton.textContent = '削除';

      actions.appendChild(deleteButton);
      item.appendChild(actions);

      elements.entriesList.appendChild(item);
    });
  }

  function createDetailItem(label, value) {
    const item = document.createElement('li');
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${label}：`;
    item.appendChild(labelSpan);

    const text = document.createTextNode(value);
    item.appendChild(text);

    return item;
  }

  function displayFeedback(message) {
    if (!elements.feedback) {
      return;
    }

    elements.feedback.hidden = false;
    elements.feedback.textContent = message;
  }

  function clearFeedback() {
    if (!elements.feedback) {
      return;
    }

    elements.feedback.hidden = true;
    elements.feedback.textContent = '';
  }

  function persistEntries() {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('外部化プランの保存に失敗しました', error);
    }
  }

  function loadEntries() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry) => entry && typeof entry.id === 'string');
    } catch (error) {
      console.error('外部化プランの読み込みに失敗しました', error);
      return [];
    }
  }

  function getStorage() {
    try {
      const testKey = '__externalization_tool__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (error) {
      console.warn('ローカルストレージが利用できません', error);
      return null;
    }
  }

  function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
})();
