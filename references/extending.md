# Adding a diagram type

ArquiChef is built so that a new kind of diagram is a new folder, not a change to the core.

## Layout of a type

```
types/<type-id>/
├── type.mjs              # the contract below
├── schema.json           # JSON Schema (subset supported by core/schema.mjs)
├── theme.css             # styles for this type (no spec content ever goes here)
├── guide.md              # the method: what goes where, sources, style, density, layout
├── rubric.md             # the final-review checklist
├── templates/starter.json
└── examples/<real-example>.json
```

`<type-id>` must match `^[a-z][a-z0-9-]{0,40}$`, and `type.mjs` must export `id` equal to the folder name.

## The contract (`type.mjs`)

| Export | Signature | Notes |
| :--- | :--- | :--- |
| `id` | `string` | Folder name. |
| `title` | `string` | One line, shown by `arquichef types`. |
| `schema` | `object` | Parsed `schema.json`. |
| `render(spec)` | → `{ title, lang, css, body, width }` | `body` is HTML that must contain `<div id="fit">` wrapping a `.sheet` of fixed `width`; build it with `renderSheet` from `core/page.mjs`, which also provides the shared base styles. Every element and box should carry `data-path` with its spec path, so layout diagnostics point back to the spec. |
| `lint(spec)` | → `{ errors, warnings, stats: { elements } }` | Rules the schema cannot express: references, density, missing recommended parts. `errors` block the build. |
| `readme(spec, { files })` | → `string` | Markdown explaining the diagram, generated from the spec. |

The CLI takes care of validation, the browser check (`core/measure-script.mjs`), the PNG export, and safe writing. A type never touches the file system or Chrome.

## Reusable building blocks

- `core/boxes.mjs`: nested boxes and elements, layout via `columns`, `weights` or `stack`, invisible groups, and walkers (`walkElements`, `walkBoxes`). Any container-style diagram (capability map, landscape, value stream) can reuse it as is.
- `core/icons.mjs`: the closed icon set. To add an icon, add its SVG path data there.
- `core/escape.mjs`: `escapeHtml`, `escapeMarkdown`, `safeToken`.

Diagrams with connectors (sequence, C4 with arrows, BPMN) need a layout engine. Add it under `core/` as a pure function (spec in, coordinates out) so it can be unit-tested without a browser.

## Checklist for a new type

1. Write `schema.json` first and keep it strict (`additionalProperties: false`, length and count limits).
2. Implement `render`, `lint` and `readme`. Escape everything (see `security.md`).
3. Write a real example, from a real document, as the regression fixture.
4. Add tests under `tests/`: the schema accepts the example and the starter, rendering escapes hostile strings, and the README is stable.
5. Run `node bin/arquichef.mjs check types/<id>/examples/<example>.json` until it reports 0 errors.
6. Document the type in `SKILL.md` (type list and when to use it) and in `CHANGELOG.md`, and bump `VERSION` (minor version for a new type).

## Ideas for next types

- `capability-map`: capabilities only, grouped by domain, with heat (maturity or priority).
- `landscape`: a system landscape without arrows, systems grouped by owner or domain.
- `deployment`: nodes and environments as nested boxes (region → cluster → service).
- `value-stream`: stages × capabilities matrix.
- `c4-container`: requires connectors, so it needs a routing engine in `core/` first.
