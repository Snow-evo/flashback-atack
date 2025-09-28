(() => {
  'use strict';

  const STORAGE_KEY_PROFILES = 'voiceCharacterProfiles';
  const STORAGE_KEY_PLACEMENTS = 'voiceCharacterPlacements';
  const LEGACY_PROFILE_KEY = 'voiceCharacterProfile';
  const LEGACY_PLACEMENT_KEY = 'voiceCharacterPlacement';
  const SPOT_LABELS = {
    window: '窓辺',
    sofa: 'ソファのそば',
    shelf: '棚の上',
    door: 'ドアのそば',
  };

  const state = {
    form: null,
    feedback: null,
    savedList: null,
    createButton: null,
    selectedSpot: null,
    profiles: [],
    placements: {},
    activeProfileId: null,
    profile: createEmptyProfile(),
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
    state.savedList = document.getElementById('saved-characters-list');
    state.createButton = document.getElementById('create-character-button');

    initializeCharCounters(form);

    form.addEventListener('submit', handleFormSubmit);

    if (state.savedList) {
      state.savedList.addEventListener('click', handleSavedListClick);
    }

    if (state.createButton) {
      state.createButton.addEventListener('click', handleCreateNewProfile);
    }

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

    state.profiles = loadProfiles();
    state.placements = loadPlacements(state.profiles);

    if (state.profiles.length > 0) {
      const firstProfileId = state.profiles[0].id;
      setActiveProfile(firstProfileId);
    } else {
      populateForm(state.profile);
      renderPlacement();
    }

    renderProfileList();
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

    const activeId = state.activeProfileId;
    let updatedProfiles;

    if (activeId) {
      updatedProfiles = state.profiles.map((item) => {
        if (item.id === activeId) {
          return { id: activeId, ...profile };
        }
        return item;
      });
    } else {
      const newId = generateProfileId();
      updatedProfiles = [{ id: newId, ...profile }, ...state.profiles];
      state.activeProfileId = newId;
    }

    if (!persistProfiles(updatedProfiles)) {
      showFeedback('保存中にエラーが発生しました。ブラウザの設定をご確認ください。', true);
      return;
    }

    state.profiles = updatedProfiles;
    const currentId = state.activeProfileId;
    if (!currentId) {
      // In case persistence failed to set id earlier.
      const first = state.profiles[0];
      state.activeProfileId = first ? first.id : null;
    }

    state.profile = profile;
    renderProfileList();
    renderPlacement();
    showFeedback('キャラクターを保存しました。置き場所を決めることもできます。');
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

  function persistProfiles(profiles) {
    try {
      window.localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadProfiles() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PROFILES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map((item) => sanitizeProfileRecord(item))
            .filter(Boolean);
          if (sanitized.length) {
            return sanitized;
          }
        }
      }
    } catch (error) {
      // fall through to legacy load
    }

    const legacy = loadLegacyProfile();
    if (legacy) {
      persistProfiles([legacy]);
      removeLegacyProfile();
      return [legacy];
    }

    return [];
  }

  function loadLegacyProfile() {
    try {
      const stored = window.localStorage.getItem(LEGACY_PROFILE_KEY);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return {
        id: generateProfileId(),
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

  function removeLegacyProfile() {
    try {
      window.localStorage.removeItem(LEGACY_PROFILE_KEY);
    } catch (error) {
      // ignore storage removal errors
    }
  }

  function sanitizeProfileRecord(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }
    const rawId = typeof record.id === 'string' ? record.id : '';
    const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    if (!id) {
      return null;
    }
    return {
      id,
      name: sanitizeString(record.name ?? '', 40),
      gender: sanitizeGender(record.gender ?? ''),
      age: normalizeAgeValue(record.age),
      appearancePreset: sanitizeAppearancePreset(record.appearancePreset ?? ''),
      appearanceDetail: sanitizeString(record.appearanceDetail ?? '', 80),
      phrases: sanitizeMultiline(record.phrases ?? '', 300),
      reminder: sanitizeMultiline(record.reminder ?? '', 300),
    };
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

    const activeId = state.activeProfileId;
    if (!activeId) {
      showFeedback('キャラクターを保存してから置き場所を決めてください。', true);
      return;
    }

    const spot = state.selectedSpot;
    if (!spot) {
      showFeedback('置き場所を選んでください。', true);
      return;
    }

    const updatedPlacements = { ...state.placements, [activeId]: spot };

    if (!persistPlacements(updatedPlacements)) {
      showFeedback('位置を保存できませんでした。ブラウザの設定をご確認ください。', true);
      return;
    }

    state.placements = updatedPlacements;
    showFeedback('選んだ場所にそっと置きました。', false);
    renderPlacement();
  }

  function handleClearPlacement() {
    const activeId = state.activeProfileId;
    if (!activeId || !state.placements[activeId]) {
      showFeedback('リセットする置き場所がありません。');
      return;
    }

    const updatedPlacements = { ...state.placements };
    delete updatedPlacements[activeId];

    if (!persistPlacements(updatedPlacements)) {
      showFeedback('置き場所をリセットできませんでした。ブラウザの設定をご確認ください。', true);
      return;
    }

    state.placements = updatedPlacements;
    state.selectedSpot = null;
    updateSpotSelection(null);
    renderPlacement();
    showFeedback('置き場所をリセットしました。');
  }

  function renderPlacement() {
    const emptyMessage = document.querySelector('[data-empty-message]');
    const list = document.getElementById('placement-list');
    if (!emptyMessage || !list) {
      return;
    }

    const activeId = state.activeProfileId;
    const savedSpotForActive = activeId ? state.placements[activeId] : null;
    const selectedForHighlight = state.selectedSpot || savedSpotForActive || null;
    updateSpotSelection(selectedForHighlight);

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    const placedProfiles = state.profiles.filter((profile) => state.placements[profile.id]);

    if (!placedProfiles.length) {
      emptyMessage.hidden = false;
      list.hidden = true;
      return;
    }

    emptyMessage.hidden = true;
    list.hidden = false;

    placedProfiles.forEach((profile) => {
      const spot = state.placements[profile.id];
      const item = document.createElement('li');
      item.className = 'placement-list__item';
      if (profile.id === activeId) {
        item.classList.add('is-active');
      }

      const character = document.createElement('div');
      character.className = 'placement-character';

      const header = document.createElement('div');
      header.className = 'placement-header';

      const name = document.createElement('h3');
      name.className = 'placement-name';
      name.textContent = profile.name;

      const location = document.createElement('span');
      location.className = 'placement-location';
      location.textContent = formatSpotLabel(spot);

      header.appendChild(name);
      header.appendChild(location);
      character.appendChild(header);

      const details = document.createElement('dl');
      details.className = 'placement-details';
      appendDetail(details, '性別', profile.gender || '選択なし');
      appendDetail(details, '年齢', profile.age ? `${profile.age}歳` : '選択なし');
      appendDetail(details, '姿', formatAppearance(profile));
      character.appendChild(details);

      const phrases = document.createElement('p');
      phrases.className = 'placement-phrases';
      setParagraphText(phrases, profile.phrases, 'よく言う言葉は未入力です');
      character.appendChild(phrases);

      const reminder = document.createElement('p');
      reminder.className = 'placement-reminder';
      setParagraphText(reminder, profile.reminder, '伝えたい言葉は未入力です');
      character.appendChild(reminder);

      item.appendChild(character);
      list.appendChild(item);
    });
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

  function persistPlacements(placements) {
    try {
      if (!placements || !Object.keys(placements).length) {
        window.localStorage.removeItem(STORAGE_KEY_PLACEMENTS);
      } else {
        window.localStorage.setItem(STORAGE_KEY_PLACEMENTS, JSON.stringify(placements));
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadPlacements(existingProfiles = []) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PLACEMENTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const allowedSpots = ['window', 'sofa', 'shelf', 'door'];
          const sanitized = Object.entries(parsed).reduce((acc, [key, value]) => {
            if (typeof key !== 'string' || typeof value !== 'string') {
              return acc;
            }
            const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
            if (!sanitizedKey || !allowedSpots.includes(value)) {
              return acc;
            }
            acc[sanitizedKey] = value;
            return acc;
          }, {});
          if (Object.keys(sanitized).length) {
            return sanitized;
          }
        }
      }
    } catch (error) {
      // fall through to legacy load
    }

    const legacy = loadLegacyPlacement(existingProfiles);
    if (legacy) {
      persistPlacements(legacy);
      removeLegacyPlacement();
      return legacy;
    }

    return {};
  }

  function loadLegacyPlacement(existingProfiles) {
    try {
      const stored = window.localStorage.getItem(LEGACY_PLACEMENT_KEY);
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
      const profiles = Array.isArray(existingProfiles) && existingProfiles.length ? existingProfiles : loadProfiles();
      const firstProfileId = profiles[0] ? profiles[0].id : null;
      if (!firstProfileId) {
        return null;
      }
      return { [firstProfileId]: spot };
    } catch (error) {
      return null;
    }
  }

  function removeLegacyPlacement() {
    try {
      window.localStorage.removeItem(LEGACY_PLACEMENT_KEY);
    } catch (error) {
      // ignore storage removal errors
    }
  }

  function generateProfileId() {
    return `char_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function handleSavedListClick(event) {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-profile-id]') : null;
    if (!button) {
      return;
    }
    const id = button.getAttribute('data-profile-id');
    if (!id) {
      return;
    }
    setActiveProfile(id);
    showFeedback('保存したキャラクターを開きました。');
  }

  function handleCreateNewProfile() {
    state.activeProfileId = null;
    state.profile = createEmptyProfile();
    state.selectedSpot = null;
    populateForm(state.profile);
    updateSpotSelection(null);
    renderPlacement();
    renderProfileList();
    clearFieldError('name');
    clearFieldError('age');
    showFeedback('新しいキャラクターを作成できます。');
  }

  function setActiveProfile(profileId) {
    const targetProfile = state.profiles.find((item) => item.id === profileId);
    if (!targetProfile) {
      return;
    }
    state.activeProfileId = targetProfile.id;
    state.profile = {
      name: targetProfile.name,
      gender: targetProfile.gender,
      age: targetProfile.age,
      appearancePreset: targetProfile.appearancePreset,
      appearanceDetail: targetProfile.appearanceDetail,
      phrases: targetProfile.phrases,
      reminder: targetProfile.reminder,
    };
    state.selectedSpot = state.placements[profileId] || null;
    populateForm(state.profile);
    clearFieldError('name');
    clearFieldError('age');
    renderProfileList();
    renderPlacement();
  }

  function renderProfileList() {
    const list = state.savedList;
    if (!list) {
      return;
    }

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (!state.profiles.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'saved-characters__empty';
      emptyItem.textContent = '保存したキャラクターはまだありません。';
      list.appendChild(emptyItem);
      return;
    }

    state.profiles.forEach((profile) => {
      const item = document.createElement('li');
      item.className = 'saved-characters__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'saved-characters__button';
      if (profile.id === state.activeProfileId) {
        button.classList.add('is-active');
      }
      button.setAttribute('data-profile-id', profile.id);

      const name = document.createElement('span');
      name.className = 'saved-characters__name';
      name.textContent = profile.name;

      const meta = document.createElement('span');
      meta.className = 'saved-characters__meta';
      meta.textContent = formatProfileMeta(profile);

      button.appendChild(name);
      button.appendChild(meta);

      const details = document.createElement('div');
      details.className = 'saved-characters__details';

      const appearanceValue = formatAppearance(profile);
      details.appendChild(createProfileDetail('姿', appearanceValue, !profile.appearancePreset && !profile.appearanceDetail));

      const phrasesValue = formatListPreview(profile.phrases);
      details.appendChild(createProfileDetail('よく言う言葉', phrasesValue, !profile.phrases));

      const reminderValue = formatListPreview(profile.reminder);
      details.appendChild(createProfileDetail('伝えたい言葉', reminderValue, !profile.reminder));

      button.appendChild(details);
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function createProfileDetail(label, value, isEmpty) {
    const detail = document.createElement('p');
    detail.className = 'saved-characters__detail';

    const labelElement = document.createElement('span');
    labelElement.className = 'saved-characters__detail-label';
    labelElement.textContent = label;

    const valueElement = document.createElement('span');
    valueElement.className = 'saved-characters__detail-value';
    if (isEmpty) {
      valueElement.classList.add('is-empty');
    }
    valueElement.textContent = value || '未入力';

    detail.appendChild(labelElement);
    detail.appendChild(valueElement);
    return detail;
  }

  function formatListPreview(text) {
    if (!text) {
      return '未入力';
    }
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return '未入力';
    }
    const preview = normalized.split('\n').slice(0, 2).join('\n');
    return truncateText(preview, 120);
  }

  function truncateText(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength - 1)}…`;
  }

  function appendDetail(list, term, value) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value || '選択なし';
    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  }

  function setParagraphText(element, value, emptyMessage) {
    if (!value) {
      element.textContent = `（${emptyMessage}）`;
      element.classList.add('is-empty');
      return;
    }
    element.textContent = value;
    element.classList.remove('is-empty');
  }

  function formatSpotLabel(spot) {
    return SPOT_LABELS[spot] || '未設定の場所';
  }

  function formatProfileMeta(profile) {
    const parts = [];
    if (profile.age) {
      parts.push(`${profile.age}歳`);
    }
    if (profile.gender) {
      parts.push(profile.gender);
    }
    if (!parts.length && profile.appearancePreset) {
      parts.push(profile.appearancePreset);
    }
    return parts.join(' / ') || '詳細なし';
  }
})();
