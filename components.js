(() => {
  'use strict';

  const PLACEHOLDER_SELECTOR = '[data-component-src]';
  const templateCache = new Map();

  whenDocumentReady(() => {
    const placeholders = document.querySelectorAll(PLACEHOLDER_SELECTOR);
    placeholders.forEach((placeholder) => {
      const src = placeholder.dataset.componentSrc;
      if (!src) {
        return;
      }

      loadComponent(placeholder, src);
    });

    setupBackToTop();
  });

  function whenDocumentReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function loadComponent(placeholder, src) {
    const name = placeholder.dataset.component || src;

    getTemplate(src)
      .then((template) => {
        if (!template) {
          return;
        }

        const fragment = template.content.cloneNode(true);
        placeholder.replaceWith(fragment);
        document.dispatchEvent(
          new CustomEvent('component:loaded', {
            detail: { name, src },
          })
        );

        if (name === 'back-to-top') {
          setupBackToTop();
        }
      })
      .catch((error) => {
        console.error(`[components] Failed to load ${src}:`, error);
      });
  }

  function getTemplate(src) {
    if (templateCache.has(src)) {
      return templateCache.get(src);
    }

    const request = fetch(src, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((html) => {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template;
      })
      .catch((error) => {
        console.error(`[components] Failed to fetch ${src}:`, error);
        return null;
      });

    templateCache.set(src, request);
    return request;
  }

  function setupBackToTop() {
    const backToTopButton = document.getElementById('backToTop');
    if (!backToTopButton || backToTopButton.dataset.initialized === 'true') {
      return;
    }

    backToTopButton.dataset.initialized = 'true';

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
