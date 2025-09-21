(() => {
  'use strict';

  const STORAGE_KEY = 'favoriteTips';
  const HEART_PATH =
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

  const favorites = new Set(loadFavorites());
  const buttonRegistry = new Map();

  const init = () => {
    initializeTips();
    initializeBackToTop();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function loadFavorites(serializedValue) {
    if (typeof serializedValue === 'string') {
      return parseFavorites(serializedValue).values;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const { values, migrated } = parseFavorites(stored);

      if (stored && migrated) {
        persistNormalizedFavorites(values);
      }

      return values;
    } catch (error) {
      return [];
    }
  }

  function parseFavorites(serialized) {
    if (!serialized) {
      return { values: [], migrated: false };
    }

    try {
      const parsed = JSON.parse(serialized);
      if (!Array.isArray(parsed)) {
        return { values: [], migrated: false };
      }

      const values = [];
      let migrated = false;

      parsed.forEach((item) => {
        if (typeof item !== 'string') {
          migrated = true;
          return;
        }

        const trimmed = item.trim();
        if (trimmed !== item) {
          migrated = true;
        }

        if (!trimmed) {
          return;
        }

        const normalized = normalizeFavoriteId(trimmed);
        if (!normalized) {
          migrated = true;
          return;
        }

        if (normalized !== trimmed) {
          migrated = true;
        }

        values.push(normalized);
      });

      return { values, migrated };
    } catch (error) {
      return { values: [], migrated: false };
    }
  }

  function persistNormalizedFavorites(values) {
    try {
      const payload = JSON.stringify(Array.from(new Set(values)).sort());
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      // localStorageが利用できない場合は永続化をスキップ
    }
  }

  function normalizeFavoriteId(value) {
    if (!value) {
      return null;
    }

    const tipFormatMatch = value.match(/^tip-(\d+)$/u);
    if (tipFormatMatch) {
      const numericId = Number.parseInt(tipFormatMatch[1], 10);
      if (!Number.isNaN(numericId)) {
        return `tip-${String(numericId).padStart(2, '0')}`;
      }
      return null;
    }

    const legacyFormatMatch = value.match(/^0*(\d+)\s*[:：]/u);
    if (legacyFormatMatch) {
      const numericId = Number.parseInt(legacyFormatMatch[1], 10);
      if (!Number.isNaN(numericId)) {
        return `tip-${String(numericId).padStart(2, '0')}`;
      }
    }

    return null;
  }

  function persistFavorites() {
    try {
      const payload = JSON.stringify(Array.from(favorites).sort());
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      // localStorageが利用できない場合は永続化をスキップ
    }
  }

  function initializeTips() {
    const tipLists = document.querySelectorAll('.tip-list');
    if (!tipLists.length) {
      return;
    }

    tipLists.forEach((list) => {
      const startValue = Number.parseInt(list.getAttribute('start') || '1', 10) || 1;
      const items = Array.from(list.querySelectorAll('li'));

      items.forEach((item, index) => {
        const number = startValue + index;
        const paddedNumber = String(number).padStart(2, '0');

        let numberBadge = item.querySelector('.tip-number');
        if (!numberBadge) {
          numberBadge = document.createElement('span');
          numberBadge.className = 'tip-number';
          numberBadge.setAttribute('aria-hidden', 'true');
          const firstElement = item.firstElementChild;
          item.insertBefore(numberBadge, firstElement);
        }
        numberBadge.textContent = paddedNumber;

        if (!item.dataset.tipId) {
          item.dataset.tipId = `tip-${paddedNumber}`;
        }

        if (!item.querySelector('.tip-content')) {
          const firstDiv = item.querySelector('div');
          if (firstDiv) {
            firstDiv.classList.add('tip-content');
          }
        }

        const heading = item.querySelector('h3');
        const tipTitle = heading ? heading.textContent.trim() : `ヒント${paddedNumber}`;
        const tipId = item.dataset.tipId;

        let button = item.querySelector('.favorite-button');
        if (!button) {
          button = createFavoriteButton(tipId, tipTitle);
          item.appendChild(button);
        } else {
          prepareExistingButton(button, tipId, tipTitle);
        }
      });
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const latestFavorites = new Set(loadFavorites(event.newValue));
      favorites.clear();
      latestFavorites.forEach((value) => favorites.add(value));

      buttonRegistry.forEach((button, id) => {
        updateButtonState(button, favorites.has(id));
      });
    });
  }

  function prepareExistingButton(button, tipId, tipTitle) {
    button.classList.add('favorite-button');
    button.type = 'button';
    button.dataset.favoriteId = tipId;
    button.dataset.labelAdd = `「${tipTitle}」をお気に入りに追加`;
    button.dataset.labelRemove = `「${tipTitle}」のお気に入りを解除`;

    let srText = button.querySelector('.visually-hidden');
    if (!srText) {
      srText = document.createElement('span');
      srText.className = 'visually-hidden';
      button.insertBefore(srText, button.firstChild);
    }

    let heartIcon = button.querySelector('.heart-icon');
    if (!heartIcon) {
      heartIcon = createHeartIcon();
      button.appendChild(heartIcon);
    }

    buttonRegistry.set(tipId, button);
    updateButtonState(button, favorites.has(tipId));

    button.addEventListener('click', () => {
      toggleFavorite(tipId);
    });
  }

  function createFavoriteButton(tipId, tipTitle) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-button';
    button.dataset.favoriteId = tipId;
    button.dataset.labelAdd = `「${tipTitle}」をお気に入りに追加`;
    button.dataset.labelRemove = `「${tipTitle}」のお気に入りを解除`;

    const srText = document.createElement('span');
    srText.className = 'visually-hidden';
    button.appendChild(srText);

    const icon = createHeartIcon();
    button.appendChild(icon);

    buttonRegistry.set(tipId, button);
    updateButtonState(button, favorites.has(tipId));

    button.addEventListener('click', () => {
      toggleFavorite(tipId);
    });

    return button;
  }

  function createHeartIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('heart-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', HEART_PATH);
    svg.appendChild(path);

    return svg;
  }

  function toggleFavorite(tipId) {
    const currentlyFavorite = favorites.has(tipId);

    if (currentlyFavorite) {
      favorites.delete(tipId);
    } else {
      favorites.add(tipId);
    }

    buttonRegistry.forEach((button, id) => {
      if (id === tipId) {
        updateButtonState(button, !currentlyFavorite);
      }
    });

    persistFavorites();
  }

  function updateButtonState(button, isFavorite) {
    button.setAttribute('aria-pressed', String(isFavorite));
    const label = isFavorite ? button.dataset.labelRemove : button.dataset.labelAdd;

    if (label) {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }

    const srText = button.querySelector('.visually-hidden');
    if (srText) {
      srText.textContent = isFavorite ? 'お気に入りを解除' : 'お気に入りに追加';
    }
  }

  function initializeBackToTop() {
    const backToTopButton = document.getElementById('backToTop');
    if (!backToTopButton) {
      return;
    }

    const prefersReducedMotionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const toggleVisibility = () => {
      if (window.scrollY > 240) {
        backToTopButton.classList.add('is-visible');
      } else {
        backToTopButton.classList.remove('is-visible');
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    backToTopButton.addEventListener('click', () => {
      const prefersReducedMotion = Boolean(
        prefersReducedMotionQuery && prefersReducedMotionQuery.matches
      );
      const scrollOptions = prefersReducedMotion ? { top: 0 } : { top: 0, behavior: 'smooth' };
      window.scrollTo(scrollOptions);
    });
  }
})();
