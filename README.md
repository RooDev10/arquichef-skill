# ArquiChef

Skill for Claude that cooks professional architecture sheets from source documents. It ships one diagram type, the **enterprise architecture map**: a single sheet with actors, strategy and capabilities on top, demand and value offer on the sides, the business, application, data and technology layers in the middle, and optional cross-cutting lateral layers such as blockchain.

```
spec (JSON) ──validate──▶ render ──measure in Chrome──▶ HTML + PNG + README
             schema+lint            overflow, split words,
                                    icon overlaps (by spec path)
```

The model writes the content and ArquiChef enforces structure and layout quality, so results look the same every time. The enterprise layout is fixed and reproduces the hand-made Verifish reference sheet 1:1; the spec (format 2) only fills named slots.

## Install

Copy the folder into your skills directory:

```bash
cp -r arquichef ~/.claude/skills/
```

You need **Node.js 18.17+** and **Chrome or Chromium**. Set `ARQUICHEF_CHROME=/absolute/path/to/chrome` if it is not on `PATH`. There are no npm dependencies, so `npm install` is not needed.

## Use

In Claude Code, ask for it naturally, for example: *"Hazme la arquitectura empresarial de este informe, como la imagen de referencia"*. The skill triggers from its description.

From a terminal:

```bash
node bin/arquichef.mjs types
node bin/arquichef.mjs new enterprise mi-empresa.arquichef.json
node bin/arquichef.mjs validate mi-empresa.arquichef.json
node bin/arquichef.mjs check mi-empresa.arquichef.json
node bin/arquichef.mjs build mi-empresa.arquichef.json --out salida/ --name arquitectura-empresarial
node bin/arquichef.mjs migrate vieja.json nueva.json   # format 1 → format 2
```

`build` writes `arquitectura-empresarial.html`, `arquitectura-empresarial.png` (2× density) and `README.md`. It refuses to overwrite files it did not create; use `--force` only when you mean it.

## Layout

```
arquichef/
├── SKILL.md                 instructions for the model (workflow, diagnostics)
├── bin/arquichef.mjs        CLI
├── core/                    shared, type-agnostic modules
│   ├── schema.mjs           dependency-free JSON Schema validator (strict)
│   ├── boxes.mjs            nested box/element renderer
│   ├── page.mjs             sheet + page shell (base styles, fit script, locked-down CSP)
│   ├── chrome.mjs           sandboxed headless Chrome (measure, screenshot)
│   ├── measure-script.mjs   in-page layout checks
│   ├── safe-fs.mjs          safe spec reading and output writing
│   ├── escape.mjs · icons.mjs · registry.mjs
├── types/enterprise/        schema, renderer, theme, migrate, guide, rubric, starter, example
├── references/              security.md · extending.md
├── tests/                   node --test
└── evals/                   test prompts for skill evaluation
```

## Develop

```bash
npm test                       # unit + integration (the browser test is skipped without Chrome)
npm run check:example          # layout check of the Verifish reference example
```

- New diagram type: see `references/extending.md`.
- Security rules for contributors: see `references/security.md`.
- Versioning: SemVer in `VERSION` and `package.json`, with history in `CHANGELOG.md`. The spec format has its own version (`"arquichef": "1"`). Bump it only on breaking spec changes, and keep the old renderer path until specs are migrated.
