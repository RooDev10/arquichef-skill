# Enterprise map: method

How to turn a source document into a high-quality enterprise architecture sheet with ArquiChef. Read it in order the first time. Afterwards, jump to the section you need.

## Contents

1. Anatomy of the sheet
2. Where the content comes from
3. Band by band: what to put and how
4. Writing style
5. Density targets
6. Layout recipes
7. Spec cheat sheet
8. Gaps, inferences and inconsistencies

---

## 1. Anatomy of the sheet

```
            ┌──────────────────────── ACTORS ─────────────────────────┐
            ├──────────────────── STRATEGIC ALIGNMENT ────────────────┤
            ├──────────────────────── CAPABILITIES ───────────────────┤
┌────────┐  ┌──────────────── BUSINESS ARCHITECTURE ────┐ ┌────────┐ ┌────────┐
│        │  │ frameworks / reference standards (row)    │ │LATERAL │ │        │
│ DEMAND │  │ knowledge │ change │ organization        │ │(e.g.   │ │ VALUE  │
│        │  │           │        │ services            │ │block-  │ │ OFFER  │
│(problem│  │           │        │ processes           │ │chain)  │ │(outcome│
│        │  │           │        │            │ data gov.│ │        │ │        │
│        │  ├──────────── APPLICATION ARCHITECTURE ─────┤ │ cell   │ │        │
│        │  ├──────────────── DATA ARCHITECTURE ────────┤ │ cell   │ │        │
│        │  ├───────────── TECHNOLOGY ARCHITECTURE ─────┤ │ cell   │ │        │
└────────┘  └───────────────────────────────────────────┘ └────────┘ └────────┘
```

- **No connectors.** Meaning comes from containment (an element belongs to its box) and position (the row is the layer). That is what keeps a sheet with 150 elements readable. The only arrows are the small `→` marks the renderer puts between process stages to show reading order.
- **The layout is fixed.** It is a 1:1 copy of the hand-made Verifish sheet: horizontal title bars on every block, coloured layer backgrounds with coloured boxes, ArchiMate glyphs in the corner of every container and element, solid demand/value columns with one centred note, and lateral layers as one continuous column with a cell per layer that fills the row. The spec (format 2) only fills **named slots**; it cannot move, rotate or restyle blocks. Never hand-write HTML for a sheet: always build it with ArquiChef.
- **Top bands** span the main column and the laterals. **Demand** and **value** span the four layers.
- A **lateral** is a cross-cutting concern that touches every layer (blockchain, AI, IoT, security, sustainability...). It has one cell per layer, aligned with that layer's row. Use at most two. Only add one when the source treats the concern as a pillar of the solution, not as a single feature.

## 2. Where the content comes from

| Band | Typical sources in a report, thesis or business plan |
| :--- | :--- |
| Actors | Stakeholders, target segments, user personas, roles and permissions, external systems' owners, regulators |
| Strategy | Mission, vision, business goals and OKRs (SMART goals), business model, strategic plan, policies |
| Capabilities | Epics, feature lists, bounded contexts and core domains, value-proposition claims, turned into "ability to..." nouns |
| Demand | Problem statement (5W+2H), market pain, numbers that quantify the cost of the problem |
| Value offer | Value proposition, quality targets (latency, availability), measurable promises |
| Business | Org structure, partners and channels, business services offered, end-to-end processes and their stages, regulations, standards, methodologies, change management, data governance |
| Application | Systems and modules (bounded contexts), client apps, APIs and integration style, third-party SaaS, legacy systems, scheduled jobs |
| Data | Databases and their purpose, data domains, time series, queues and caches, retention and isolation rules |
| Technology | Deployment and infrastructure diagrams, hosting, devices, networks, CI/CD, security controls, operational risks and their mitigations |
| Laterals | The cross-cutting concern's decisions, components and data, wherever they appear |

Cross-read. The best elements combine two places, for example a goal plus the decision that serves it, or a component plus its deployment node. Architecture decision records (AD-xx), quality attribute scenarios (QA-xx) and constraints (TC-xx) are gold: cite their IDs in `detail`.

## 3. Band by band

### Actors
`actors.groups[]`, each with a `label` and `items`, usually three: **external** (customers, end users, market), **internal** (the client organization's roles) and **provider and environment** (your own team, service providers, regulators). Optional `weights` set the relative group widths. Each element is a role or organization, with `detail` saying what they do or which segment they are. Typically 6 to 12 elements.

### Strategic alignment
Mission and vision (short, in `detail`), the measurable goals (one element each, keep the ID: `G1 · ...`), and the business model. Slots: `statements` (mission, vision: left column), `goals` and `model` (they fill the middle and right columns in that order). If the source has policies or programmes it aligns to, put them in `goals` or `model`. Typically 6 to 12 elements.

### Capabilities
What the organization must be *able to do*, written as nouns ("Monitoreo IoT en tiempo real", "Gestión de suscripciones"). They are not features or apps. Derive them from epics and domains. Cover the whole business, not only the software: customer experience, security, continuous delivery, partnerships. The renderer uses up to 7 columns (14 capabilities give two clean rows); `columns` overrides it. Typically 10 to 21 elements.

### Demand and value offer
Two to four short paragraphs each. Demand states the problem and its cost, with numbers if the source has them. Value states the promised outcome, with targets (seconds, percentages) when available. Put the source section in `source`: it is shown under the text.

### Business architecture
Every slot is required; reviewers of enterprise architecture expect all of them. Titles default to the canonical headings in `meta.language`; set `title` only to make one more specific (e.g. `"PROCESOS: CICLO DE VIDA DE LA CITA"`).

| Slot | Drawn as | Content |
| :--- | :--- | :--- |
| `frameworks` | full-width bar on top, dashed boxes | The frameworks that govern each area: "Marcos para la trazabilidad / los procesos / las aplicaciones / los datos / la seguridad / la infraestructura...". Each `detail` names the concrete standards, laws, methods or constraints. |
| `knowledge` | tall left column | How the organization learns and documents (interviews, shared language, documentation). |
| `change` | tall second column | How adoption happens (training, pilots, UX for low digital literacy, migration from old habits). |
| `organization.units[]` | centre, top | Sub-boxes for the client organization, your own team or areas, and partners or channels (`title`, optional `note`, `columns`). |
| `services.external` / `services.internal` | centre, middle | Public services and internal services (rounded). `internal.columns` defaults to 4. |
| `processes.stages[]` | centre, bottom, one horizontal flow with `→` between stages | The end-to-end value stream, 2 to 8 stages (uppercase). |
| `processes.crossCutting[]` | bar under the stages | Cross-cutting processes (billing, support...). |
| `dataGovernance` | tall right column | The life of the data: collection, validation, analysis, consolidation, indicators. |

### Application architecture
- `core`: the core system(s). `title` and `note` (technology, shown in normal weight after the title). One element per module or bounded context, with its domain classification in `tag` (Core / Supporting / Generic) and its responsibility in `detail`. `jobs[]`: background jobs, drawn in a row underneath (use `variant: compact` only if an identifier still does not fit).
- `clients`: web, mobile, landing, with technology in `detail`.
- `itServices`: API style, events, integration patterns, gateways.
- `thirdParty`: payments, messaging, email, maps...
- `legacy` (optional): legacy applications.

### Data architecture
`items`: one row of data stores and data domains, each with its technology and purpose. `governance[]`: the key data rule (isolation, retention, privacy), drawn last with the principle icon. Typically 5 to 9 elements in total.

### Technology architecture
- `nodes[]`: hosting services, managed databases, devices (`icon: device`), CDNs, with region or tier in `detail`. One row on top.
- `risks`: a wide strip; one element per risk paired with its mitigation (`"Red caída → Outbox (AD-10)"`).
- `security`: a wide strip with the main controls (authentication, authorization, signing, secrets).
- `governance`: the right column: CI/CD, testing, architecture rules.

### Lateral layer (optional)
`sections.business / application / data / technology`, each a section (title defaults to NEGOCIO / APLICACIONES / DATOS / TECNOLOGÍA). Give it a cell for every layer on the sheet, or the column shows a gap. Each one answers "what does this layer contribute to the concern?". Two to four elements per cell are enough. The lateral is a lens, not a second copy of the layers.

## 4. Writing style

- **Names are nouns**, up to about 45 characters: "Verificación de lotes por QR". Push specifics to `detail` (up to about 80 characters): technology, IDs, numbers.
- Use UPPERCASE only for band titles, block titles, and emphasis process stages (the renderer uppercases those).
- Keep the source's identifiers exactly as written (`AnchorOutboxWorker`, `ROLE_ADMIN`, `AD-12`).
- Write in one language (`meta.language`). Product names and technical terms stay in their original form.
- Prefer concrete over generic: "Azure App Service · Java 17, Brazil South" beats "Servidor en la nube".

## 5. Density targets

| Band | Elements |
| :--- | :--- |
| Actors | 6 to 12 |
| Strategy | 6 to 12 |
| Capabilities | 10 to 21 |
| Business | 40 to 70 |
| Application | 15 to 30 |
| Data | 5 to 9 |
| Technology | 10 to 20 |
| Each lateral | 8 to 14 |
| **Whole sheet** | **about 100 to 200** |

A box with more than about 24 direct elements is hard to scan: split it into titled sub-boxes.

## 6. Layout recipes

- Default sheet: `meta.width` 2200 with demand, value and one lateral. The main column is then about 1300 px wide.
- An element needs about **130 px** for a short bold name, and about **170 px** for a long single word or identifier. If a box is crowded, lower its `columns`, shorten the `name` and move specifics to `detail`.
- The few layout knobs left are `columns` on a section, `weights` on `actors`, `organization` and `services`, and `columns` on capabilities, data and technology nodes. Everything else is fixed on purpose.
- For long CamelCase identifiers, use `variant: compact`.
- If the sheet looks top-heavy, move detail from crowded bands into the README through `summary`, rather than shrinking text.

## 7. Spec cheat sheet

```jsonc
{
  "arquichef": "2",
  "type": "enterprise",
  "meta": { "title": "...", "organization": "...", "language": "es", "width": 2200,
            "description": "README intro", "sources": [{ "id": "report", "label": "..." }] },
  "actors":       { "title": "ACTORES", "summary": "...", "groups": [{ "label": "Externos", "items": [/* el */] }] },
  "strategy":     { "title": "...", "statements": [/* misión, visión */], "goals": [...], "model": [...] },
  "capabilities": { "title": "CAPACIDADES DE X", "items": [...] },
  "demand":       { "title": "DEMANDA", "paragraphs": ["..."], "source": "report:1.2" },
  "value":        { "title": "OFERTA DE VALOR", "paragraphs": ["..."] },
  "layers": {
    "business":    { "title", "summary", "frameworks": S, "knowledge": S, "change": S,
                     "organization": { "units": [S] }, "services": { "external": S, "internal": S },
                     "processes": { "title", "stages": [el], "crossCutting": [el] }, "dataGovernance": S },
    "application": { "title", "core": { "title", "note", "items": [el], "jobs": [el] },
                     "clients": S, "itServices": S, "thirdParty": S, "legacy": S },
    "data":        { "title", "items": [el], "governance": [el] },
    "technology":  { "title", "nodes": [el], "risks": S, "security": S, "governance": S }
  },
  "laterals": [{ "title": "...", "summary": "...", "icon": "chain",
                 "sections": { "business": S, "application": S, "data": S, "technology": S } }],
  "notes": ["Inconsistency found: ..."]
}
// S  (section): { "title"?, "note"?, "columns"?, "items": [el] }
// el (element): { "name", "detail", "tag", "icon", "variant", "source": "report:4.1", "inferred": true }
```

Icons: `actor goal capability service process function component interface data node device principle framework location value chain risk`. Variants: `dashed rounded emphasis plain compact`.

Every slot has a default icon and look (frameworks: folder, dashed; services: rounded; stages: chevron, uppercase; data: data object; nodes: 3D node; and so on). Set `icon` only when an element is of a different kind, for example `device` among technology nodes or `service` for an API among IT services.

A spec in the old format 1 (free nested boxes) is refused; convert it with `arquichef migrate old.json new.json` and review the result.

## 8. Gaps, inferences and inconsistencies

- **Missing band material:** ask the user. If they cannot provide it, omit optional bands (`actors`, `strategy`, `capabilities`, `demand`, `value`, `layers.data`). The business, application and technology layers are required.
- **Inference:** allowed when it is the obvious reading of the source (a role implied by a permission, a capability implied by an epic). Mark it `"inferred": true`. Do not infer numbers, laws, or vendors.
- **Inconsistency:** pick the most authoritative or most recent statement, usually what is implemented or deployed over what was planned. Record the conflict in `notes` and mention it to the user.
