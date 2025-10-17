# Contributor Notes

- Treat [`style-guide.html`](./style-guide.html) and [`style-guide.css`](./style-guide.css) as the single source of truth
  for design tokens, typography scale, layout primitives, and component reference markup.
- When updating a UI pattern that exists in the style guide, adjust it in the style guide first, then port the same
  change into the production pages (for example `index.html`, `roadmap.html`, or related CSS/JS modules).
- Add or modify design tokens inside `styles.css` and reference them from the style guide so designers can preview the
  change. Avoid hard-coding new values directly in page-level files.
