(() => {
  'use strict';

  const STORAGE_KEY = 'innerCriticCharacterProfile';
  const PLACE_LABEL_SET = 'ここに置いておく';
  const PLACE_LABEL_REMOVE = 'ここから連れ戻す';

  const form = document.getElementById('voice-character-form');
  if (!form) {
    return;
  }

  const elements = {
    name: document.getElementById('voice-name'),
    gender: document.getElementById('voice-gender'),
    age: document.getElementById('voice-age'),
    appearance: document.getElementById('voice-appearance'),
    appearanceNote: document.getElementById('voice-appearance-note'),
    appearanceNoteGroup: document.getElementById('appearance-note-group'),
    phrases: document.getElementById('voice-phrases'),
    message: document.getElementById('voice-message'),
    storageWarning: document.querySelector('[data-storage-warning]'),
    counters: document.querySelectorAll('[data-count-for]'),
    preview: {
      name: document.querySelector('[data-preview="name"]'),
      meta: document.querySelector('[data-preview="meta"]'),
      appearance: document.querySelector('[data-preview="appearance"]'),
      phrases: document.querySelector('[data-preview="phrases"]'),
      message: document.querySelector('[data-preview="message"]'),
    },
    placement: {
      button: document.querySelector('[data-action="toggle-placement"]'),
      status: document.querySelector('[data-placement-status]'),
      empty: document.querySelector('[data-room-empty]'),
      character: document.querySelector('[data-room-character]'),
      name: document.querySelector('[data-room-name]'),
      note: document.querySelector('[data-room-note]'),
    },
  };

  const storage = createStorage();
  if (!storage && elements.storageWarning) {
    elements.storageWarning.hidden = false;
  }

  const state = {
    data: {
      name: '',
      gender: '',
      age: '',
      appearance: '',
      appearanceNote: '',
      phrases: '',
      message: '',
      placed: false,
    },
  };

  loadStoredData();
  bindEvents();
  updatePreview();
  updatePlacement();
  updateCounters();

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    const nextData = storage ? storage.load(event.newValue) : null;
    if (!nextData) {
      return;
    }
    state.data = nextData;
    syncFormFields();
    updatePreview();
    updatePlacement();
    updateCounters();
  });

  function bindEvents() {
    form.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      handleFieldUpdate(target);
    });

    form.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      handleFieldUpdate(target);
    });

    if (elements.appearance) {
      elements.appearance.addEventListener('change', handleAppearanceChange);
      handleAppearanceChange();
    }

    if (elements.placement.button) {
      elements.placement.button.addEventListener('click', () => {
        state.data.placed = !state.data.placed;
        persistState();
        updatePlacement(true);
      });
    }
  }

  function handleFieldUpdate(target) {
    switch (target.id) {
      case 'voice-name':
        state.data.name = sanitizeText(elements.name ? elements.name.value : '', 40);
        break;
      case 'voice-gender':
        state.data.gender = sanitizeText(elements.gender ? elements.gender.value : '', 12);
        break;
      case 'voice-age': {
        const ageValue = elements.age ? sanitizeNumber(elements.age.value) : '';
        state.data.age = ageValue;
        if (elements.age && ageValue !== elements.age.value) {
          elements.age.value = ageValue;
        }
        break;
      }
      case 'voice-appearance':
        state.data.appearance = sanitizeText(elements.appearance ? elements.appearance.value : '', 20);
        if (state.data.appearance !== 'custom' && elements.appearanceNote) {
          elements.appearanceNote.value = '';
          state.data.appearanceNote = '';
        }
        break;
      case 'voice-appearance-note':
        state.data.appearanceNote = sanitizeText(elements.appearanceNote ? elements.appearanceNote.value : '', 120);
        if (elements.appearanceNote && state.data.appearanceNote !== elements.appearanceNote.value) {
          elements.appearanceNote.value = state.data.appearanceNote;
        }
        break;
      case 'voice-phrases':
        state.data.phrases = sanitizeMultiline(elements.phrases ? elements.phrases.value : '', 200);
        if (elements.phrases && state.data.phrases !== elements.phrases.value) {
          elements.phrases.value = state.data.phrases;
        }
        break;
      case 'voice-message':
        state.data.message = sanitizeMultiline(elements.message ? elements.message.value : '', 200);
        if (elements.message && state.data.message !== elements.message.value) {
          elements.message.value = state.data.message;
        }
        break;
      default:
        break;
    }

    if (target.hasAttribute('data-count-for') || target.id === 'voice-appearance-note' || target.id === 'voice-phrases' || target.id === 'voice-message') {
      updateCounters();
    }

    persistState();
    updatePreview();
    updatePlacement();
  }

  function handleAppearanceChange() {
    if (!elements.appearance || !elements.appearanceNoteGroup) {
      return;
    }
    const shouldShowCustom = elements.appearance.value === 'custom';
    elements.appearanceNoteGroup.hidden = !shouldShowCustom;
  }

  function sanitizeText(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength);
  }

  function sanitizeMultiline(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[\u0000-\u001F\u007F]/g, (char) => (char === '\n' || char === '\r' ? char : '')).replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
  }

  function sanitizeNumber(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) {
      return '';
    }
    const number = Number.parseInt(digits, 10);
    if (!Number.isFinite(number) || number < 1) {
      return '';
    }
    if (number > 130) {
      return '130';
    }
    return String(number);
  }

  function persistState() {
    if (!storage) {
      return;
    }
    storage.save(state.data);
  }

  function updatePreview() {
    const { name, meta, appearance, phrases, message } = elements.preview;
    if (name) {
      name.textContent = state.data.name || '（未設定）';
    }

    if (meta) {
      const genderLabel = getGenderLabel(state.data.gender);
      const ageLabel = state.data.age ? `${state.data.age}歳` : '';
      if (genderLabel && ageLabel) {
        meta.textContent = `${genderLabel} / ${ageLabel}`;
      } else if (genderLabel) {
        meta.textContent = genderLabel;
      } else if (ageLabel) {
        meta.textContent = ageLabel;
      } else {
        meta.textContent = '性別・年齢は未設定';
      }
    }

    if (appearance) {
      appearance.textContent = getAppearanceLabel();
    }

    if (phrases) {
      phrases.textContent = state.data.phrases || '（まだ入力されていません）';
    }

    if (message) {
      message.textContent = state.data.message || '（まだ入力されていません）';
    }
  }

  function getGenderLabel(value) {
    switch (value) {
      case 'female':
        return '女性的';
      case 'male':
        return '男性的';
      case 'neutral':
        return '中性的';
      case 'other':
        return 'その他の性質';
      default:
        return '';
    }
  }

  function getAppearanceLabel() {
    const appearanceValue = state.data.appearance;
    if (!appearanceValue) {
      return '（未設定）';
    }
    const labels = {
      shadow: '影のような存在',
      child: '小さな子ども',
      mentor: '厳しい先生',
      relative: '親しい人に似ている',
      future: '未来の自分',
      custom: state.data.appearanceNote ? state.data.appearanceNote : '（自由記入を追加してください）',
    };
    return Object.prototype.hasOwnProperty.call(labels, appearanceValue)
      ? labels[appearanceValue]
      : '（未設定）';
  }

  function updatePlacement(showStatus = false) {
    const { button, status, empty, character, name, note } = elements.placement;
    if (button) {
      const isPlaced = Boolean(state.data.placed);
      button.setAttribute('aria-pressed', String(isPlaced));
      button.textContent = isPlaced ? PLACE_LABEL_REMOVE : PLACE_LABEL_SET;
    }

    const hasName = Boolean(state.data.name);
    const displayName = hasName ? state.data.name : 'キャラクター';

    if (state.data.placed && character && name && note) {
      if (empty) {
        empty.hidden = true;
      }
      character.hidden = false;
      name.textContent = displayName;
      const summary = state.data.message || state.data.phrases || getAppearanceLabel();
      note.textContent = summary || 'ここで静かに過ごしています。';
    } else {
      if (empty) {
        empty.hidden = false;
      }
      if (character) {
        character.hidden = true;
      }
    }

    if (status) {
      if (showStatus) {
        status.textContent = state.data.placed
          ? `${displayName}を部屋に置きました。必要なときだけ話しかけましょう。`
          : `${displayName}を一度手元に戻しました。落ち着いたらまた置き直せます。`;
      } else {
        status.textContent = '';
      }
    }
  }

  function updateCounters() {
    if (!elements.counters) {
      return;
    }
    elements.counters.forEach((counter) => {
      const targetId = counter.dataset.countFor;
      if (!targetId) {
        return;
      }
      const field = document.getElementById(targetId);
      if (!field || !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
        return;
      }
      const currentLength = field.value.length;
      const maxLength = field.maxLength > 0 ? field.maxLength : null;
      const suffix = maxLength ? `${currentLength} / ${maxLength}` : `${currentLength}`;
      counter.textContent = suffix;
    });
  }

  function loadStoredData() {
    if (!storage) {
      syncFormFields();
      return;
    }
    const stored = storage.load();
    if (!stored) {
      syncFormFields();
      return;
    }
    state.data = stored;
    syncFormFields();
  }

  function syncFormFields() {
    if (elements.name) {
      elements.name.value = state.data.name;
    }
    if (elements.gender) {
      elements.gender.value = state.data.gender;
    }
    if (elements.age) {
      elements.age.value = state.data.age;
    }
    if (elements.appearance) {
      elements.appearance.value = state.data.appearance;
    }
    if (elements.appearanceNote) {
      elements.appearanceNote.value = state.data.appearanceNote;
    }
    if (elements.phrases) {
      elements.phrases.value = state.data.phrases;
    }
    if (elements.message) {
      elements.message.value = state.data.message;
    }
    handleAppearanceChange();
  }

  function createStorage() {
    try {
      const testKey = `${STORAGE_KEY}__test`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return {
        load(rawValue) {
          try {
            const value = typeof rawValue === 'string' ? rawValue : window.localStorage.getItem(STORAGE_KEY);
            if (!value) {
              return null;
            }
            const parsed = JSON.parse(value);
            if (!parsed || typeof parsed !== 'object') {
              return null;
            }
            return {
              name: sanitizeText(parsed.name || '', 40),
              gender: sanitizeText(parsed.gender || '', 12),
              age: sanitizeNumber(typeof parsed.age === 'string' ? parsed.age : String(parsed.age || '')),
              appearance: sanitizeText(parsed.appearance || '', 20),
              appearanceNote: sanitizeText(parsed.appearanceNote || '', 120),
              phrases: sanitizeMultiline(parsed.phrases || '', 200),
              message: sanitizeMultiline(parsed.message || '', 200),
              placed: Boolean(parsed.placed),
            };
          } catch (error) {
            console.error('保存済みデータの読み込みに失敗しました', error);
            return null;
          }
        },
        save(data) {
          try {
            const payload = JSON.stringify({
              name: data.name,
              gender: data.gender,
              age: data.age,
              appearance: data.appearance,
              appearanceNote: data.appearanceNote,
              phrases: data.phrases,
              message: data.message,
              placed: Boolean(data.placed),
            });
            window.localStorage.setItem(STORAGE_KEY, payload);
          } catch (error) {
            console.error('データの保存に失敗しました', error);
          }
        },
      };
    } catch (error) {
      console.warn('ローカルストレージが利用できません', error);
      return null;
    }
  }
})();
