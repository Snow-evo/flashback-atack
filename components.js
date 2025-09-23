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

    const request = loadTemplateMarkup(src)
      .then((html) => {
        if (!html) {
          return null;
        }

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

  function loadTemplateMarkup(src) {
    if (typeof fetch === 'function') {
      return fetch(src, { credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.text();
        })
        .catch((error) => {
          if (shouldFallbackToXhr(error)) {
            return loadTemplateMarkupWithXhr(src);
          }
          throw error;
        });
    }

    return loadTemplateMarkupWithXhr(src);
  }

  function shouldFallbackToXhr(error) {
    if (typeof XMLHttpRequest !== 'function') {
      return false;
    }

    if (window.location.protocol === 'file:') {
      return true;
    }

    return Boolean(error) && error.name === 'TypeError';
  }

  function loadTemplateMarkupWithXhr(src) {
    return new Promise((resolve, reject) => {
      if (typeof XMLHttpRequest !== 'function') {
        reject(new Error('XMLHttpRequest not available'));
        return;
      }

      const request = new XMLHttpRequest();
      request.open('GET', src, true);
      request.responseType = 'text';

      request.onload = () => {
        const { status, responseText } = request;

        if (status >= 200 && status < 300) {
          resolve(responseText);
          return;
        }

        if (status === 0 && responseText) {
          // Local files may report status 0. Treat available content as success.
          resolve(responseText);
          return;
        }

        reject(new Error(`HTTP ${status}`));
      };

      request.onerror = () => {
        reject(new Error('Network error'));
      };

      request.send();
    });
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
