(() => {
  'use strict';

  const STORAGE_KEY_PROFILE = 'voiceCharacterProfile';
  const STORAGE_KEY_PLACEMENT = 'voiceCharacterPlacement';

  const state = {
    form: null,
    feedback: null,
    selectedSpot: null,
    profile: createEmptyProfile(),
    placement: null,
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
    const form = document.getElementById('character-form');
    if (!form) {
      return;
    }

    state.form = form;
    state.feedback = document.getElementById('form-feedback');

    initializeCharCounters(form);

    form.addEventListener('submit', handleFormSubmit);

    const grid = document.getElementById('placement-grid');
    if (grid) {
      grid.addEventListener('click', handleSpotClick);
    }

    const placeButton = document.getElementById('place-character-button');
    if (placeButton) {
      placeButton.addEventListener('click', handlePlaceCharacter);
    }

    const clearPlacementButton = document.getElementById('clear-placement-button');
    if (clearPlacementButton) {
      clearPlacementButton.addEventListener('click', handleClearPlacement);
    }

    const savedProfile = loadProfile();
    if (savedProfile) {
      state.profile = savedProfile;
      populateForm(savedProfile);
    }

    const savedPlacement = loadPlacement();
    if (savedPlacement) {
      state.placement = savedPlacement;
      state.selectedSpot = savedPlacement.spot || null;
    }

    renderPlacement();
  }

  function createEmptyProfile() {
    return {
      name: '',
      gender: '',
      age: '',
      appearancePreset: '',
      appearanceDetail: '',
      phrases: '',
      reminder: '',
    };
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const form = state.form;
    if (!form) {
      return;
    }

    const formData = new FormData(form);

    const nameRaw = getFormValue(formData, 'name');
    const genderRaw = getFormValue(formData, 'gender');
    const ageRaw = getFormValue(formData, 'age');
    const appearancePresetRaw = getFormValue(formData, 'appearancePreset');
    const appearanceDetailRaw = getFormValue(formData, 'appearanceDetail');
    const phrasesRaw = getFormValue(formData, 'phrases');
    const reminderRaw = getFormValue(formData, 'reminder');

    clearFieldError('name');
    clearFieldError('age');

    const name = sanitizeString(nameRaw, 40);
    if (!name) {
      setFieldError('name', '1〜40文字で入力してください。');
      showFeedback('保存できませんでした。必須項目を確認してください。', true);
      return;
    }

    const gender = sanitizeGender(genderRaw);

    const age = sanitizeAge(ageRaw);
    if (age === null) {
      setFieldError('age', '0〜120の数字を入力してください。');
      showFeedback('保存できませんでした。入力内容を確認してください。', true);
      return;
    }

    const appearancePreset = sanitizeAppearancePreset(appearancePresetRaw);
    const appearanceDetail = sanitizeString(appearanceDetailRaw, 80);
    const phrases = sanitizeMultiline(phrasesRaw, 300);
    const reminder = sanitizeMultiline(reminderRaw, 300);

    const profile = {
      name,
      gender,
      age: age === '' ? '' : String(age),
      appearancePreset,
      appearanceDetail,
      phrases,
      reminder,
    };

    if (!persistProfile(profile)) {
      showFeedback('保存中にエラーが発生しました。ブラウザの設定をご確認ください。', true);
      return;
    }

    state.profile = profile;
    showFeedback('キャラクターを保存しました。置き場所を決めることもできます。');
    renderPlacement();
  }

  function getFormValue(formData, key) {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  }

  function sanitizeString(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    let sanitized = value.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
    }
    return sanitized;
  }

  function sanitizeMultiline(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    let sanitized = value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
    }
    return sanitized.trim();
  }

  function sanitizeGender(value) {
    const allowed = ['', '女性', '男性', '中性', '不明'];
    return allowed.includes(value) ? value : '';
  }

  function sanitizeAppearancePreset(value) {
    const allowed = ['', '影', '霧', '動物', '人物', '物体', 'その他'];
    return allowed.includes(value) ? value : '';
  }

  function sanitizeAge(value) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return '';
    }
    if (!/^\d{1,3}$/.test(trimmed)) {
      return null;
    }
    const ageNumber = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(ageNumber) || ageNumber < 0 || ageNumber > 120) {
      return null;
    }
    return ageNumber;
  }

  function setFieldError(fieldName, message) {
    const errorTarget = document.querySelector(`[data-error-target="${fieldName}"]`);
    if (errorTarget) {
      errorTarget.textContent = message;
    }
  }

  function clearFieldError(fieldName) {
    setFieldError(fieldName, '');
  }

  function showFeedback(message, isError = false) {
    const feedback = state.feedback;
    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    feedback.classList.toggle('is-error', Boolean(isError));
  }

  function initializeCharCounters(form) {
    const fields = form.querySelectorAll('textarea, input[type="text"]');
    fields.forEach((field) => {
      if (!field.id) {
        return;
      }
      updateCharCount(field);
      field.addEventListener('input', () => updateCharCount(field));
    });
  }

  function updateCharCount(field) {
    const target = document.querySelector(`[data-count-for="${field.id}"]`);
    if (!target) {
      return;
    }
    const maxLength = getFieldMaxLength(field);
    target.textContent = `${field.value.length} / ${maxLength}`;
  }

  function getFieldMaxLength(field) {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      if (field.maxLength && field.maxLength > 0) {
        return field.maxLength;
      }
    }
    const attr = field.getAttribute('data-maxlength');
    const parsed = attr ? Number.parseInt(attr, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
  }

  function populateForm(profile) {
    const form = state.form;
    if (!form) {
      return;
    }
    setInputValue(form, 'character-name', profile.name);
    setInputValue(form, 'character-gender', profile.gender);
    setInputValue(form, 'character-age', profile.age);
    setInputValue(form, 'character-appearance', profile.appearancePreset);
    setInputValue(form, 'character-appearance-detail', profile.appearanceDetail);
    setInputValue(form, 'character-phrases', profile.phrases);
    setInputValue(form, 'character-reminder', profile.reminder);
  }

  function setInputValue(form, fieldId, value) {
    const field = form.querySelector(`#${fieldId}`);
    if (!field) {
      return;
    }
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      field.value = typeof value === 'string' ? value : '';
    } else if (field instanceof HTMLTextAreaElement) {
      field.value = typeof value === 'string' ? value : '';
    }
    updateCharCount(field);
  }

  function persistProfile(profile) {
    try {
      window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadProfile() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PROFILE);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return {
        name: sanitizeString(parsed.name ?? '', 40),
        gender: sanitizeGender(parsed.gender ?? ''),
        age: normalizeAgeValue(parsed.age),
        appearancePreset: sanitizeAppearancePreset(parsed.appearancePreset ?? ''),
        appearanceDetail: sanitizeString(parsed.appearanceDetail ?? '', 80),
        phrases: sanitizeMultiline(parsed.phrases ?? '', 300),
        reminder: sanitizeMultiline(parsed.reminder ?? '', 300),
      };
    } catch (error) {
      return null;
    }
  }

  function normalizeAgeValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < 0 || value > 120) {
        return '';
      }
      return String(Math.trunc(value));
    }
    if (typeof value === 'string') {
      const sanitized = sanitizeAge(value);
      if (sanitized === null) {
        return '';
      }
      return sanitized === '' ? '' : String(sanitized);
    }
    return '';
  }

  function handleSpotClick(event) {
    const button = event.target instanceof HTMLElement ? event.target.closest('.placement-spot') : null;
    if (!button || !button.dataset.spot) {
      return;
    }

    event.preventDefault();

    const spot = button.dataset.spot;
    state.selectedSpot = spot;
    updateSpotSelection(spot);
  }

  function updateSpotSelection(activeSpot) {
    const buttons = document.querySelectorAll('.placement-spot');
    buttons.forEach((button) => {
      const isActive = button.dataset.spot === activeSpot;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function handlePlaceCharacter() {
    if (!state.profile || !state.profile.name) {
      showFeedback('キャラクターを先に保存してください。', true);
      return;
    }

    const spot = state.selectedSpot;
    if (!spot) {
      showFeedback('置き場所を選んでください。', true);
      return;
    }

    const placement = { spot };
    if (!persistPlacement(placement)) {
      showFeedback('位置を保存できませんでした。ブラウザの設定をご確認ください。', true);
      return;
    }

    state.placement = placement;
    showFeedback('選んだ場所にそっと置きました。', false);
    renderPlacement();
  }

  function handleClearPlacement() {
    try {
      window.localStorage.removeItem(STORAGE_KEY_PLACEMENT);
    } catch (error) {
      // ignore storage errors on remove
    }
    state.placement = null;
    state.selectedSpot = null;
    updateSpotSelection(null);
    renderPlacement();
    showFeedback('置き場所をリセットしました。');
  }

  function renderPlacement() {
    const display = document.querySelector('[data-character-display]');
    const emptyMessage = document.querySelector('[data-empty-message]');
    const profile = state.profile;
    const placement = state.placement;

    if (!display || !emptyMessage) {
      return;
    }

    if (placement && placement.spot && profile && profile.name) {
      emptyMessage.hidden = true;
      display.hidden = false;
      updateSpotSelection(placement.spot);
      state.selectedSpot = placement.spot;

      setTextContent('placement-name', profile.name);
      setTextContent('placement-gender', profile.gender || '選択なし');
      setTextContent('placement-age', profile.age ? `${profile.age}歳` : '選択なし');
      setTextContent('placement-appearance', formatAppearance(profile));
      setTextContent('placement-phrases', profile.phrases);
      setTextContent('placement-reminder', profile.reminder);
    } else {
      emptyMessage.hidden = false;
      display.hidden = true;
      updateSpotSelection(state.selectedSpot || null);
    }
  }

  function setTextContent(id, value) {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.textContent = value || '';
  }

  function formatAppearance(profile) {
    const parts = [];
    if (profile.appearancePreset) {
      parts.push(profile.appearancePreset);
    }
    if (profile.appearanceDetail) {
      parts.push(profile.appearanceDetail);
    }
    if (!parts.length) {
      return '選択なし';
    }
    return parts.join(' / ');
  }

  function persistPlacement(placement) {
    try {
      window.localStorage.setItem(STORAGE_KEY_PLACEMENT, JSON.stringify(placement));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadPlacement() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PLACEMENT);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const spot = typeof parsed.spot === 'string' ? parsed.spot : '';
      const allowedSpots = ['window', 'sofa', 'shelf', 'door'];
      if (!allowedSpots.includes(spot)) {
        return null;
      }
      return { spot };
    } catch (error) {
      return null;
    }
  }
})();
