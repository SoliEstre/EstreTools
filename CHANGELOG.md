# Changelog

## 0.3.1 — 2026-09-07

- Fix section headings disappearing after a Markdown horizontal rule. Hide only
  redundant horizontal rules adjacent to `h2`, preserving headings on screen and
  in print. Add browser coverage for heading visibility in both modes.
- Regenerate existing HTML reports to apply the corrected inline stylesheet.

## 0.3.0 — 2026-09-07

- mdbrown renders Mermaid fences to static inline SVG using local Chrome, Edge or
  Chromium. The finished HTML includes no Mermaid runtime or CDN dependency.
- Per-diagram fullscreen viewer with wheel zoom, drag pan, fit, Escape, focus
  restoration and print styles. Diagrams remain visible with JavaScript disabled.
- Automatic mode retains code with a warning on render failure. `--mermaid`
  requires successful rendering; `--no-mermaid` preserves code explicitly.
- Fix fenced-code verification, including literal Markdown, matching fence types,
  longer enclosing fences, image alt text, and SVG/source integrity checks.
- Add `mdBrown` → `mdbrown` migration metadata, searchable Mermaid metadata,
  installation troubleshooting, ZIP distribution and automated release checks.
- mdbrown is now 0.3.0. md-in-pdf2md remains 0.1.1.
