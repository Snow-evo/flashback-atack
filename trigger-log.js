(() => {
  'use strict';

  const STORAGE_KEY = 'triggerLogs';
  let formFeedback = null;
  let logList = null;
  let emptyMessage = null;
  let triggerForm = null;
  let submitButton = null;
  let cancelEditButton = null;
  let editingNotice = null;
  let editingEntryId = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const form = document.getElementById('trigger-log-form');
    if (!form) {
      return;
    }

    triggerForm = form;
    formFeedback = document.getElementById('form-feedback');
    logList = document.getElementById('log-list');
    emptyMessage = document.querySelector('[data-empty-message]');
    submitButton = form.querySelector('.log-submit-button');
    cancelEditButton = form.querySelector('[data-action="cancel-edit"]');
    editingNotice = document.getElementById('editing-notice');

    if (cancelEditButton) {
      cancelEditButton.addEventListener('click', handleCancelEdit);
    }

    setEditingUiState(false);

    initializeTagGroups();
    initializeCharCounters(form);
    renderLogs(loadLogs());

    form.addEventListener('submit', (event) => handleSubmit(event, form));

    const clearButton = document.querySelector('[data-action="clear-logs"]');
    if (clearButton) {
      clearButton.addEventListener('click', handleClearLogs);
    }

    if (logList) {
      logList.addEventListener('click', handleLogListClick);
    }
  }

  function initializeTagGroups() {
    const groups = document.querySelectorAll('[data-tag-group]');
    groups.forEach((group) => {
      group.addEventListener('click', (event) => {
        const button = event.target.closest('.tag-chip');
        if (!button || !group.contains(button)) {
          return;
        }

        event.preventDefault();

        const shouldSelect = !button.classList.contains('is-selected');
        button.classList.toggle('is-selected', shouldSelect);
        button.setAttribute('aria-pressed', shouldSelect ? 'true' : 'false');

        const groupName = group.dataset.tagGroup;
        if (groupName) {
          setGroupError(groupName, '');
        }

        if (button.dataset.controls) {
          toggleOtherField(button, shouldSelect);
        }
      });
    });
  }

  function toggleOtherField(button, shouldShow) {
    const fieldId = button.dataset.controls;
    if (!fieldId) {
      return;
    }

    const field = document.getElementById(fieldId);
    if (!field) {
      return;
    }

    const input = field.querySelector('input[type="text"]');
    button.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');

    if (shouldShow) {
      field.hidden = false;
      if (input) {
        input.focus({ preventScroll: true });
      }
    } else {
      field.hidden = true;
      if (input) {
        input.value = '';
        updateCharCount(input);
        setInputError(input, input.id, '');
      }
    }
  }

  function setEditingUiState(isEditing, entry) {
    if (triggerForm) {
      if (isEditing) {
        triggerForm.dataset.editing = 'true';
      } else {
        triggerForm.removeAttribute('data-editing');
      }
    }

    if (submitButton) {
      submitButton.textContent = isEditing ? '更新する' : '記録する';
    }

    if (cancelEditButton) {
      cancelEditButton.hidden = !isEditing;
    }

    if (editingNotice) {
      if (isEditing) {
        const formattedTimestamp = entry && typeof entry.createdAt === 'string' ? formatDateTime(entry.createdAt) : '';
        const message = formattedTimestamp
          ? `${formattedTimestamp} の記録を編集中です。変更後に「更新する」を押してください。`
          : '保存済みの記録を編集中です。変更後に「更新する」を押してください。';
        editingNotice.hidden = false;
        editingNotice.textContent = message;
      } else {
        editingNotice.hidden = true;
        editingNotice.textContent = '';
      }
    }
  }

  function initializeCharCounters(form) {
    const fields = form.querySelectorAll('textarea, input[type="text"]');
    fields.forEach((field) => {
      if (!field.id) {
        return;
      }

      updateCharCount(field);

      field.addEventListener('input', () => {
        updateCharCount(field);

        if (field.classList.contains('is-invalid')) {
          const maxLength = getFieldMaxLength(field);
          const trimmedLength = field.value.trim().length;
          if (trimmedLength > 0 && field.value.length <= maxLength) {
            setInputError(field, field.id, '');
          }
        }
      });
    });
  }

  function handleSubmit(event, form) {
    event.preventDefault();

    const triggerSelection = collectGroupSelection('trigger');
    const emotionSelection = collectGroupSelection('emotion');
    const actionSelection = collectGroupSelection('action');
    const detailsField = form.querySelector('#trigger-details');
    const detailsValue = detailsField ? detailsField.value.trim() : '';

    let isValid = true;

    if (!triggerSelection.labels.length && !(triggerSelection.otherSelected && triggerSelection.otherValue)) {
      setGroupError('trigger', 'トリガーを1つ以上 選んでね');
      isValid = false;
    }

    if (triggerSelection.otherSelected) {
      isValid = validateOtherInput('trigger', triggerSelection.otherValue) && isValid;
    }

    if (emotionSelection.otherSelected) {
      isValid = validateOtherInput('emotion', emotionSelection.otherValue) && isValid;
    }

    if (actionSelection.otherSelected) {
      isValid = validateOtherInput('action', actionSelection.otherValue) && isValid;
    }

    if (detailsField && detailsField.value.length > getFieldMaxLength(detailsField)) {
      detailsField.value = detailsField.value.slice(0, getFieldMaxLength(detailsField));
      setInputError(detailsField, detailsField.id, '1000文字以内で入力してください');
      isValid = false;
    }

    if (!isValid) {
      showFeedback('入力内容をご確認ください。', true);
      return;
    }

    const logs = loadLogs();
    if (editingEntryId) {
      let targetFound = false;
      const updatedLogs = logs.map((item) => {
        if (item.id !== editingEntryId) {
          return item;
        }

        targetFound = true;
        return {
          ...item,
          triggers: triggerSelection.labels,
          triggerOther: triggerSelection.otherSelected ? triggerSelection.otherValue : '',
          details: detailsValue,
          emotions: emotionSelection.labels,
          emotionOther: emotionSelection.otherSelected ? emotionSelection.otherValue : '',
          actions: actionSelection.labels,
          actionOther: actionSelection.otherSelected ? actionSelection.otherValue : '',
        };
      });

      if (!targetFound) {
        showFeedback('編集対象の記録が見つかりませんでした。', true);
        resetFormState(form);
        return;
      }

      if (!persistLogs(updatedLogs)) {
        showFeedback('記録の更新に失敗しました。', true);
        return;
      }

      renderLogs(updatedLogs);
      showFeedback('記録を更新しました。');
      resetFormState(form);
      return;
    }

    const entry = {
      id: generateEntryId(),
      createdAt: new Date().toISOString(),
      triggers: triggerSelection.labels,
      triggerOther: triggerSelection.otherSelected ? triggerSelection.otherValue : '',
      details: detailsValue,
      emotions: emotionSelection.labels,
      emotionOther: emotionSelection.otherSelected ? emotionSelection.otherValue : '',
      actions: actionSelection.labels,
      actionOther: actionSelection.otherSelected ? actionSelection.otherValue : '',
    };

    const updatedLogs = [entry, ...logs];

    if (!persistLogs(updatedLogs)) {
      showFeedback('記録の保存に失敗しました。', true);
      return;
    }

    renderLogs(updatedLogs);
    showFeedback('記録したよ。深呼吸はどう？');
    resetFormState(form);
  }

  function handleLogListClick(event) {
    const editButton = event.target.closest('.log-entry__edit');
    if (editButton) {
      const entryElement = editButton.closest('.log-entry');
      if (!entryElement || !entryElement.dataset.entryId) {
        return;
      }

      startEditingEntry(entryElement.dataset.entryId);
      return;
    }

    const deleteButton = event.target.closest('.log-entry__delete');
    if (!deleteButton) {
      return;
    }

    const entry = deleteButton.closest('.log-entry');
    if (!entry || !entry.dataset.entryId) {
      return;
    }

    const timestampElement = entry.querySelector('.log-entry__timestamp');
    const displayTime = timestampElement ? timestampElement.textContent.trim() : '';
    const confirmMessage = displayTime
      ? `${displayTime}の記録を削除しますか？\n削除すると元に戻せません。`
      : 'この記録を削除しますか？\n削除すると元に戻せません。';
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    const entryId = entry.dataset.entryId;
    const logs = loadLogs();
    const updatedLogs = logs.filter((item) => item.id !== entryId);

    if (!persistLogs(updatedLogs)) {
      showFeedback('削除に失敗しました。', true);
      return;
    }

    const wasEditing = editingEntryId === entryId;
    renderLogs(updatedLogs);
    if (triggerForm && wasEditing) {
      resetFormState(triggerForm);
      showFeedback('編集中の記録が削除されました。');
    } else {
      showFeedback('記録を削除しました。');
    }
  }

  function startEditingEntry(entryId) {
    if (!triggerForm) {
      return;
    }

    const logs = loadLogs();
    const entry = logs.find((item) => item.id === entryId);
    if (!entry) {
      showFeedback('記録の読み込みに失敗しました。', true);
      return;
    }

    editingEntryId = entryId;
    resetFormState(triggerForm, { keepEditing: true });

    applyGroupSelectionFromEntry('trigger', entry.triggers, entry.triggerOther);
    applyGroupSelectionFromEntry('emotion', entry.emotions, entry.emotionOther);
    applyGroupSelectionFromEntry('action', entry.actions, entry.actionOther);

    const detailsField = triggerForm.querySelector('#trigger-details');
    if (detailsField) {
      detailsField.value = typeof entry.details === 'string' ? entry.details : '';
      updateCharCount(detailsField);
      setInputError(detailsField, detailsField.id, '');
    }

    setEditingUiState(true, entry);

    if (triggerForm.scrollIntoView) {
      triggerForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const firstInteractive = triggerForm.querySelector('.tag-chip');
    if (firstInteractive) {
      firstInteractive.focus({ preventScroll: true });
    }

    showFeedback('保存済みの記録を編集中です。変更後に「更新する」を押してください。');
  }

  function handleClearLogs() {
    const logs = loadLogs();
    if (!logs.length) {
      showFeedback('保存されている記録はありません。');
      return;
    }

    const confirmed = window.confirm('すべての記録を削除しますか？');
    if (!confirmed) {
      return;
    }

    if (!persistLogs([])) {
      showFeedback('削除に失敗しました。', true);
      return;
    }

    const wasEditing = Boolean(editingEntryId);
    renderLogs([]);
    if (triggerForm && wasEditing) {
      resetFormState(triggerForm);
    }
    showFeedback('すべての記録を削除しました。');
  }

  function handleCancelEdit() {
    if (!triggerForm) {
      return;
    }

    const wasEditing = Boolean(editingEntryId);
    resetFormState(triggerForm);

    if (wasEditing) {
      showFeedback('編集をやめました。');
    }
  }

  function collectGroupSelection(groupName) {
    const group = document.querySelector(`[data-tag-group="${groupName}"]`);
    const labels = [];
    let otherSelected = false;
    let otherValue = '';

    if (!group) {
      return { labels, otherSelected, otherValue };
    }

    const buttons = group.querySelectorAll('.tag-chip.is-selected');
    buttons.forEach((button) => {
      const value = button.dataset.value;
      const label = (button.dataset.label || button.textContent || '').trim();
      if (value === 'other') {
        otherSelected = true;
      } else if (label) {
        labels.push(label);
      }
    });

    const otherField = document.querySelector(`[data-other-field="${groupName}"]`);
    if (otherField && !otherField.hidden) {
      const input = otherField.querySelector('input[type="text"]');
      if (input) {
        otherValue = input.value.trim();
      }
    }

    return { labels, otherSelected, otherValue };
  }

  function applyGroupSelectionFromEntry(groupName, labels, otherValue) {
    const group = document.querySelector(`[data-tag-group="${groupName}"]`);
    const normalizedLabels = Array.isArray(labels)
      ? labels
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item !== '')
      : [];
    const labelSet = new Set(normalizedLabels);
    const trimmedOther = typeof otherValue === 'string' ? otherValue.trim() : '';

    if (group) {
      const buttons = group.querySelectorAll('.tag-chip');
      buttons.forEach((button) => {
        const label = (button.dataset.label || button.textContent || '').trim();
        const isOther = button.dataset.value === 'other';
        const shouldSelect = isOther ? Boolean(trimmedOther) : Boolean(label && labelSet.has(label));

        button.classList.toggle('is-selected', shouldSelect);
        button.setAttribute('aria-pressed', shouldSelect ? 'true' : 'false');
        if (button.dataset.controls) {
          button.setAttribute('aria-expanded', shouldSelect ? 'true' : 'false');
        }
      });

      setGroupError(groupName, '');
    }

    const otherField = document.querySelector(`[data-other-field="${groupName}"]`);
    if (otherField) {
      const input = otherField.querySelector('input[type="text"]');
      const shouldShow = Boolean(trimmedOther);
      otherField.hidden = !shouldShow;
      if (input) {
        input.value = shouldShow ? trimmedOther : '';
        updateCharCount(input);
        setInputError(input, input.id, '');
      }
    }
  }

  function validateOtherInput(groupName, value) {
    const field = document.querySelector(`[data-other-field="${groupName}"]`);
    if (!field) {
      return true;
    }

    const input = field.querySelector('input[type="text"]');
    if (!input) {
      return true;
    }

    const trimmedValue = value.trim();
    const maxLength = getFieldMaxLength(input);
    let valid = true;

    if (!trimmedValue) {
      setInputError(input, input.id, '1文字以上で入力してください');
      valid = false;
    } else if (trimmedValue.length > maxLength) {
      setInputError(input, input.id, `${maxLength}文字以内で入力してください`);
      valid = false;
    } else {
      setInputError(input, input.id, '');
    }

    return valid;
  }

  function setGroupError(groupName, message) {
    const group = document.querySelector(`[data-tag-group="${groupName}"]`);
    const errorTargets = document.querySelectorAll(`[data-error-target="${groupName}"]`);

    errorTargets.forEach((element) => {
      element.textContent = message;
    });

    if (!group) {
      return;
    }

    const field = group.closest('.form-field');
    if (message) {
      group.classList.add('is-invalid');
      if (field) {
        field.classList.add('has-error');
      }
    } else {
      group.classList.remove('is-invalid');
      if (field && !field.querySelector('.is-invalid')) {
        field.classList.remove('has-error');
      }
    }
  }

  function setInputError(input, targetName, message) {
    if (!input || !targetName) {
      return;
    }

    const errorTargets = document.querySelectorAll(`[data-error-target="${targetName}"]`);
    errorTargets.forEach((element) => {
      element.textContent = message;
    });

    if (message) {
      input.classList.add('is-invalid');
      const field = input.closest('.form-field');
      if (field) {
        field.classList.add('has-error');
      }
    } else {
      input.classList.remove('is-invalid');
      const field = input.closest('.form-field');
      if (field && !field.querySelector('.is-invalid')) {
        field.classList.remove('has-error');
      }
    }
  }

  function resetFormState(form, options = {}) {
    const { keepEditing = false } = options;
    form.reset();

    const tagButtons = form.querySelectorAll('.tag-chip');
    tagButtons.forEach((button) => {
      button.classList.remove('is-selected');
      button.setAttribute('aria-pressed', 'false');
      if (button.dataset.controls) {
        button.setAttribute('aria-expanded', 'false');
      }
    });

    const otherFields = form.querySelectorAll('[data-other-field]');
    otherFields.forEach((field) => {
      field.hidden = true;
      const input = field.querySelector('input[type="text"]');
      if (input) {
        input.value = '';
        setInputError(input, input.id, '');
        updateCharCount(input);
      }
    });

    const textAreas = form.querySelectorAll('textarea');
    textAreas.forEach((textarea) => {
      setInputError(textarea, textarea.id, '');
      updateCharCount(textarea);
    });

    const groups = form.querySelectorAll('[data-tag-group]');
    groups.forEach((group) => {
      group.classList.remove('is-invalid');
    });

    form.querySelectorAll('[data-error-target]').forEach((element) => {
      element.textContent = '';
    });

    form.querySelectorAll('.form-field').forEach((field) => {
      field.classList.remove('has-error');
    });

    if (!keepEditing) {
      editingEntryId = null;
      setEditingUiState(false);
    }
  }

  function renderLogs(logs) {
    if (!logList) {
      return;
    }

    logList.innerHTML = '';

    if (!Array.isArray(logs) || logs.length === 0) {
      if (emptyMessage) {
        emptyMessage.classList.remove('is-hidden');
      }
      return;
    }

    if (emptyMessage) {
      emptyMessage.classList.add('is-hidden');
    }

    logs.forEach((entry) => {
      const listItem = document.createElement('li');
      listItem.className = 'log-entry';
      if (typeof entry.id === 'string') {
        listItem.dataset.entryId = entry.id;
      }

      const header = document.createElement('div');
      header.className = 'log-entry__header';

      const timeElement = document.createElement('time');
      timeElement.className = 'log-entry__timestamp';
      if (entry.createdAt) {
        timeElement.dateTime = entry.createdAt;
      }
      timeElement.textContent = formatDateTime(entry.createdAt);
      header.appendChild(timeElement);

      const displayTime = timeElement.textContent || '';

      const actions = document.createElement('div');
      actions.className = 'log-entry__actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'text-button log-entry__edit';
      editButton.textContent = '編集';
      if (displayTime) {
        editButton.setAttribute('aria-label', `${displayTime}の記録を編集`);
      }
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'text-button log-entry__delete';
      deleteButton.textContent = '削除';
      if (displayTime) {
        deleteButton.setAttribute('aria-label', `${displayTime}の記録を削除`);
      }
      actions.appendChild(deleteButton);

      header.appendChild(actions);

      listItem.appendChild(header);

      const body = document.createElement('div');
      body.className = 'log-entry__body';

      const triggerGroup = createChipsGroup('トリガー', entry.triggers, entry.triggerOther, true);
      if (triggerGroup) {
        body.appendChild(triggerGroup);
      }

      if (entry.details) {
        const detailGroup = document.createElement('div');
        detailGroup.className = 'log-entry__group';
        const heading = document.createElement('h3');
        heading.textContent = '詳細';
        detailGroup.appendChild(heading);

        const paragraph = document.createElement('p');
        paragraph.className = 'log-entry__details';
        paragraph.textContent = entry.details;
        detailGroup.appendChild(paragraph);
        body.appendChild(detailGroup);
      }

      const emotionGroup = createChipsGroup('感情', entry.emotions, entry.emotionOther);
      if (emotionGroup) {
        body.appendChild(emotionGroup);
      }

      const actionGroup = createChipsGroup('行動', entry.actions, entry.actionOther);
      if (actionGroup) {
        body.appendChild(actionGroup);
      }

      listItem.appendChild(body);
      logList.appendChild(listItem);
    });
  }

  function createChipsGroup(title, labels, otherValue, alwaysShow) {
    const effectiveLabels = Array.isArray(labels) ? labels.filter((label) => typeof label === 'string' && label.trim() !== '') : [];
    const trimmedOther = typeof otherValue === 'string' ? otherValue.trim() : '';

    if (!effectiveLabels.length && !trimmedOther && !alwaysShow) {
      return null;
    }

    const group = document.createElement('div');
    group.className = 'log-entry__group';

    const heading = document.createElement('h3');
    heading.textContent = title;
    group.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'log-entry__chips';

    effectiveLabels.forEach((label) => {
      const item = document.createElement('li');
      item.className = 'log-chip';
      item.textContent = label;
      list.appendChild(item);
    });

    if (trimmedOther) {
      const item = document.createElement('li');
      item.className = 'log-chip log-chip--other';
      item.textContent = `✍ ${trimmedOther}`;
      list.appendChild(item);
    }

    if (!list.children.length && alwaysShow) {
      const item = document.createElement('li');
      item.className = 'log-chip log-chip--other';
      item.textContent = '記録なし';
      list.appendChild(item);
    }

    group.appendChild(list);
    return group;
  }

  function loadLogs() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((entry) => sanitizeEntry(entry))
        .filter((entry) => entry !== null);
    } catch (error) {
      return [];
    }
  }

  function sanitizeEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const sanitized = {
      id: typeof entry.id === 'string' ? entry.id : generateEntryId(),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      triggers: Array.isArray(entry.triggers) ? entry.triggers.filter((item) => typeof item === 'string') : [],
      triggerOther: typeof entry.triggerOther === 'string' ? entry.triggerOther : '',
      details: typeof entry.details === 'string' ? entry.details : '',
      emotions: Array.isArray(entry.emotions) ? entry.emotions.filter((item) => typeof item === 'string') : [],
      emotionOther: typeof entry.emotionOther === 'string' ? entry.emotionOther : '',
      actions: Array.isArray(entry.actions) ? entry.actions.filter((item) => typeof item === 'string') : [],
      actionOther: typeof entry.actionOther === 'string' ? entry.actionOther : '',
    };

    return sanitized;
  }

  function persistLogs(logs) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      return true;
    } catch (error) {
      return false;
    }
  }

  function updateCharCount(field) {
    const countTarget = document.querySelector(`[data-count-for="${field.id}"]`);
    if (!countTarget) {
      return;
    }

    const maxLength = getFieldMaxLength(field);
    const currentLength = field.value.length;
    countTarget.textContent = `${currentLength} / ${maxLength}`;
  }

  function getFieldMaxLength(field) {
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      if (field.maxLength && field.maxLength > 0) {
        return field.maxLength;
      }
    }
    const maxAttr = field.getAttribute('data-maxlength');
    const parsed = maxAttr ? Number.parseInt(maxAttr, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
  }

  function showFeedback(message, isError = false) {
    if (!formFeedback) {
      return;
    }

    formFeedback.textContent = message;
    formFeedback.classList.toggle('is-error', Boolean(isError));
  }

  function formatDateTime(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  function generateEntryId() {
    const random = Math.random().toString(16).slice(2);
    return `log-${Date.now()}-${random}`;
  }
})();
