# Migrating from 2.x to 3.0

<p align="right">
  <strong>English</strong> | <a href="./migration-to-v3.zh-CN.md">中文</a>
</p>

This guide outlines breaking changes and migration procedures when upgrading from 2.x to 3.0.

## Removed `ignore` API & Markers

`ElementRule` retains only `{ kind: 'atomic', label }` and `{ kind: 'splittable' }`. `PrintRuleConfig.ignore` and all `IGNORE` constants in `PRINT_*` / `PDF_PRINT_*` have been removed. Passing configurations with an `ignore` key (even if empty) or using legacy `{ kind: 'ignore' }` rules will throw explicit descriptive errors.

Layout preparation, resource loading, snapshot cloning, and measurement scan the print root and descendants for `[data-print-ignore]`, `.print-ignore`, `[data-pdf-ignore]`, and `.pdf-ignore`. If any such attribute is present, migration is required. Exports abort immediately when legacy ignore markers are detected, preventing unintended content leakage.

Move interactive controls outside the printable root and remove legacy configurations:

```html
<button id="export">Export Report</button>
<article id="report">
  <h1>Report</h1>
  <p>All rendered content inside this root is included in export.</p>
</article>
```

```ts
await outputDocument({
  element: document.getElementById('report'),
  filename: 'report',
  ruleConfig: {
    atomic: ['.signature'],
    splittable: ['.long-card'],
  },
});
```

Content is not deleted based on buttons, paginators, or arbitrary interactive attributes by default. `display: none`, `visibility: hidden`, and `hidden` attributes are honored via browser CSS rules.

`excludedElements` and `transformSnapshotNode` remain supported for explicit snapshot customization.

## Atomic vs. Splittable

- **Atomic**: Protected as a single indivisible block; throws if height exceeds visible page capacity.
- **Splittable**: Recursively decomposes child nodes. Table rows and selectors registered in `ruleConfig.splittable` are kept intact if they fit within page capacity; if oversized, internal text lines and child elements are measured.

## Snapshots, Debugging & Lifecycle

- Internal scroll containers preserve clipping bounds, `scrollTop`, and `scrollLeft`.
- Fixed and sticky elements are frozen to their current layout geometry.
- Host DOM is never modified during layout or measurement.
- Debug overlays are isolated from target content nodes and do not alter positioning.
- `cleanup()` and session `dispose()` are safe to call multiple times.

## Verification

```sh
npm run check:full
npm run benchmark
npm pack --dry-run
```
