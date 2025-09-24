(() => {
  'use strict';

  const placeholders = document.querySelectorAll('[data-include]');
  if (!placeholders.length) {
    document.dispatchEvent(new CustomEvent('components:loaded'));
    return;
  }

  const cache = new Map();

  const tasks = Array.from(placeholders).map((placeholder) => {
    const src = placeholder.getAttribute('data-include');
    if (!src) {
      placeholder.remove();
      return Promise.resolve();
    }

    return loadComponent(src)
      .then((html) => {
        if (!html) {
          placeholder.remove();
          return;
        }

        const template = document.createElement('template');
        template.innerHTML = html;
        const fragment = template.content.cloneNode(true);
        placeholder.replaceWith(fragment);
      })
      .catch((error) => {
        console.error(`コンポーネントの読み込みに失敗しました: ${src}`, error);
        placeholder.remove();
      });
  });

  Promise.allSettled(tasks).finally(() => {
    document.dispatchEvent(new CustomEvent('components:loaded'));
  });

  function loadComponent(src) {
    if (cache.has(src)) {
      return cache.get(src);
    }

    const request = fetch(src, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .catch((error) => {
        cache.delete(src);
        throw error;
      });

    cache.set(src, request);
    return request;
  }
})();
