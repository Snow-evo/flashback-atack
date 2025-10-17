(() => {
  'use strict';

  const STORAGE_KEY = 'characterManagerEntries';

  const state = {
    entries: [],
    editingId: null,
    elements: {
      form: null,
      list: null,
      emptyMessage: null,
      feedback: null,
      submitButton: null,
      cancelButton: null,
    },
  };

  whenDocumentReady(init);

  function whenDocumentReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function init() {
    const form = document.getElementById('character-manager-form');
    if (!form) {
      return;
    }

    const { elements } = state;
    elements.form = form;
    elements.list = document.getElementById('character-list');
    elements.emptyMessage = document.querySelector('[data-empty-message]');
    elements.feedback = document.getElementById('character-feedback');
    elements.submitButton = form.querySelector('.character-submit-button');
    elements.cancelButton = form.querySelector('[data-action="cancel-edit"]');

    if (elements.cancelButton) {
      elements.cancelButton.addEventListener('click', handleCancelEdit);
    }

    if (elements.list) {
      elements.list.addEventListener('click', handleListClick);
    }

    form.addEventListener('submit', handleSubmit);

    state.entries = loadEntries();
    renderEntries();
    setEditingState(null);

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      state.entries = deserializeEntries(event.newValue);
      renderEntries();
      if (state.editingId && !state.entries.find((entry) => entry.id === state.editingId)) {
        setEditingState(null);
        form.reset();
        clearFieldError('name');
      }
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const formData = collectFormData();
    const isValid = validateFormData(formData);
    if (!isValid) {
      showFeedback('必須項目を確認してください。', 'error');
      return;
    }

    if (state.editingId) {
      updateEntry(state.editingId, formData);
      showFeedback('責める声キャラクターの情報を更新しました。', 'success');
    } else {
      addEntry(formData);
      showFeedback('責める声キャラクターを保存しました。', 'success');
    }

    renderEntries();
    setEditingState(null);
    clearForm();
  }

  function collectFormData() {
    const form = state.elements.form;
    if (!form) {
      return createEmptyFormData();
    }

    const data = {
      name: getFieldValue('character-name'),
      era: getFieldValue('character-era'),
      gender: getFieldValue('character-gender'),
      appearance: getFieldValue('character-appearance'),
      catchphrase: getFieldValue('character-catchphrase'),
      message: getFieldValue('character-message'),
    };

    return data;
  }

  function createEmptyFormData() {
    return {
      name: '',
      era: '',
      gender: '',
      appearance: '',
      catchphrase: '',
      message: '',
    };
  }

  function getFieldValue(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return '';
    }
    return field.value.trim();
  }

  function validateFormData(data) {
    let isValid = true;

    if (!data.name) {
      setFieldError('name', '名前を入力してください。');
      isValid = false;
    } else {
      clearFieldError('name');
    }

    return isValid;
  }

  function handleCancelEdit() {
    setEditingState(null);
    clearForm();
    showFeedback('編集をキャンセルしました。', 'info');
  }

  function handleListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !state.elements.list || !state.elements.list.contains(button)) {
      return;
    }

    const entryId = button.closest('[data-entry-id]')?.dataset.entryId;
    if (!entryId) {
      return;
    }

    const action = button.dataset.action;
    if (action === 'edit') {
      startEditing(entryId);
    } else if (action === 'delete') {
      deleteEntry(entryId);
      if (state.editingId === entryId) {
        setEditingState(null);
        clearForm();
      }
      renderEntries();
      showFeedback('責める声キャラクターを削除しました。', 'info');
    }
  }

  function startEditing(entryId) {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    const form = state.elements.form;
    if (!form) {
      return;
    }

    setEditingState(entryId);

    form.querySelector('#character-name').value = entry.name;
    form.querySelector('#character-era').value = entry.era || '';
    form.querySelector('#character-gender').value = entry.gender || '';
    form.querySelector('#character-appearance').value = entry.appearance || '';
    form.querySelector('#character-catchphrase').value = entry.catchphrase || '';
    form.querySelector('#character-message').value = entry.message || '';

    clearFieldError('name');
    showFeedback('保存済みの責める声キャラクターを編集中です。完了したら「更新する」を押してください。', 'info');
  }

  function clearForm() {
    const form = state.elements.form;
    if (!form) {
      return;
    }

    form.reset();
    clearFieldError('name');
  }

  function setEditingState(entryId) {
    const { submitButton, cancelButton, form } = state.elements;
    state.editingId = entryId;

    if (submitButton) {
      submitButton.textContent = entryId ? '更新する' : '保存する';
    }

    if (cancelButton) {
      cancelButton.hidden = !entryId;
    }

    if (form) {
      if (entryId) {
        form.dataset.editing = 'true';
      } else {
        form.removeAttribute('data-editing');
      }
    }
  }

  function renderEntries() {
    const list = state.elements.list;
    if (!list) {
      return;
    }

    list.innerHTML = '';

    if (!state.entries.length) {
      toggleEmptyMessage(true);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.entries.forEach((entry) => {
      fragment.appendChild(createEntryElement(entry));
    });

    list.appendChild(fragment);
    toggleEmptyMessage(false);
  }

  function toggleEmptyMessage(shouldShow) {
    const { emptyMessage } = state.elements;
    if (!emptyMessage) {
      return;
    }

    emptyMessage.hidden = !shouldShow;
  }

  function createEntryElement(entry) {
    const item = document.createElement('li');
    item.className = 'character-entry';
    item.dataset.entryId = entry.id;

    const header = document.createElement('div');
    header.className = 'character-entry__header';

    const title = document.createElement('h3');
    title.className = 'character-entry__title';
    title.textContent = entry.name;
    header.appendChild(title);

    const meta = buildMeta(entry);
    if (meta) {
      header.appendChild(meta);
    }

    item.appendChild(header);

    const details = buildDetails(entry);
    if (details) {
      item.appendChild(details);
    }

    const actions = document.createElement('div');
    actions.className = 'character-entry__actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'text-button';
    editButton.dataset.action = 'edit';
    editButton.textContent = '編集';
    actions.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'text-button';
    deleteButton.dataset.action = 'delete';
    deleteButton.textContent = '削除';
    actions.appendChild(deleteButton);

    item.appendChild(actions);

    return item;
  }

  function buildMeta(entry) {
    const metaItems = [];
    if (entry.era) {
      metaItems.push(`年代: ${entry.era}`);
    }
    if (entry.gender) {
      metaItems.push(`性別: ${entry.gender}`);
    }

    if (!metaItems.length) {
      return null;
    }

    const container = document.createElement('div');
    container.className = 'character-entry__meta';

    metaItems.forEach((item) => {
      const span = document.createElement('span');
      span.textContent = item;
      container.appendChild(span);
    });

    return container;
  }

  function buildDetails(entry) {
    const details = [
      { label: '姿の特徴', value: entry.appearance },
      { label: 'よく口にする言葉', value: entry.catchphrase },
      { label: '伝えたい言葉', value: entry.message },
    ].filter((detail) => detail.value);

    if (!details.length) {
      return null;
    }

    const list = document.createElement('dl');
    list.className = 'character-entry__details';

    details.forEach((detail) => {
      const dt = document.createElement('dt');
      dt.textContent = detail.label;
      list.appendChild(dt);

      const dd = document.createElement('dd');
      dd.textContent = detail.value;
      list.appendChild(dd);
    });

    return list;
  }

  function addEntry(data) {
    const now = new Date().toISOString();
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: now,
      updatedAt: now,
      ...data,
    };

    state.entries.unshift(entry);
    saveEntries();
  }

  function updateEntry(entryId, data) {
    const now = new Date().toISOString();
    state.entries = state.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            ...data,
            updatedAt: now,
          }
        : entry,
    );

    saveEntries();
  }

  function deleteEntry(entryId) {
    state.entries = state.entries.filter((entry) => entry.id !== entryId);
    saveEntries();
  }

  function loadEntries() {
    try {
      const storedValue = localStorage.getItem(STORAGE_KEY);
      return deserializeEntries(storedValue);
    } catch (error) {
      console.error('責める声キャラクターの読み込みに失敗しました。', error);
      return [];
    }
  }

  function deserializeEntries(serializedValue) {
    if (!serializedValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(serializedValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => ({
          id: String(item.id || ''),
          name: typeof item.name === 'string' ? item.name : '',
          era: typeof item.era === 'string' ? item.era : '',
          gender: typeof item.gender === 'string' ? item.gender : '',
          appearance: typeof item.appearance === 'string' ? item.appearance : '',
          catchphrase: typeof item.catchphrase === 'string' ? item.catchphrase : '',
          message: typeof item.message === 'string' ? item.message : '',
          createdAt: item.createdAt || '',
          updatedAt: item.updatedAt || item.createdAt || '',
        }))
        .filter((item) => item.id && item.name);
    } catch (error) {
      console.error('責める声キャラクターの解析に失敗しました。', error);
      return [];
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
    } catch (error) {
      console.error('責める声キャラクターの保存に失敗しました。', error);
    }
  }

  function setFieldError(fieldName, message) {
    const form = state.elements.form;
    if (!form) {
      return;
    }

    const fieldWrapper = form.querySelector(`[data-field="${fieldName}"]`);
    const errorElement = fieldWrapper?.querySelector('[data-error-target]');
    if (errorElement) {
      errorElement.textContent = message;
    }

    const input = fieldWrapper?.querySelector('input, textarea');
    if (input) {
      if (message) {
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
      }
    }
  }

  function clearFieldError(fieldName) {
    setFieldError(fieldName, '');
  }

  function showFeedback(message, type) {
    const feedback = state.elements.feedback;
    if (!feedback) {
      return;
    }

    feedback.textContent = message || '';
    feedback.classList.remove('is-success', 'is-error');
    if (type === 'success') {
      feedback.classList.add('is-success');
    } else if (type === 'error') {
      feedback.classList.add('is-error');
    }
  }
})();
