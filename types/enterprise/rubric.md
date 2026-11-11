# Enterprise map: quality rubric

Use this for the final review, after `build` passes. Look at the PNG, not just the JSON. A sheet is ready when every **must** holds and most **should** hold.

## Content fidelity (must)

- [ ] Every element can be traced to the source (`source`) or is marked `inferred`.
- [ ] No invented numbers, laws, vendors, or technologies.
- [ ] Contradictions found in the source are recorded in `notes` and reported to the user.
- [ ] Identifiers (decision IDs, class names, roles) are spelled exactly as in the source.

## Coverage (must)

- [ ] Demand and value offer state the problem and the outcome, with numbers when the source has them.
- [ ] Business architecture includes the canonical blocks the source supports: frameworks, knowledge, change, organization, services, processes, data governance.
- [ ] Application architecture shows the core system's modules, the client apps, the integration services and the third parties.
- [ ] Technology architecture shows real nodes (not generic "cloud"), plus risks and security controls.
- [ ] Each lateral layer, if present, has a cell in every layer that the concern really touches.

## Structure and naming (should)

- [ ] Names are nouns, short and parallel within a box (all "Gestión de...", or all plain nouns, not a mix).
- [ ] Details carry the specifics: technology, ID, number.
- [ ] Capabilities are abilities, not features or apps.
- [ ] The same thing is not repeated in two bands, except deliberately in a lateral.

## Readability (should)

- [ ] `build` reports 0 layout errors. Remaining warnings were looked at and accepted.
- [ ] No band looks crowded next to a nearly empty one. Rebalance with `columns` (or `weights` where the schema allows it), or move detail into `summary`.
- [ ] Each box holds at most about 24 direct elements.
- [ ] The whole sheet has about 100 to 200 elements.
- [ ] Every band has a `summary`, so the README explains each layer in plain words.

## Hand-off (must)

- [ ] The spec is saved next to the outputs (`<name>.arquichef.json`) so the user can rebuild it.
- [ ] The report to the user lists the paths, the element count, the inferred items, the notes and any open questions.
