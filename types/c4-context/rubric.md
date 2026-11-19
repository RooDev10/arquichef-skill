# C4 system context: quality rubric

Use this for the final review, after `build` passes. Look at the PNG, not just the JSON. A diagram is ready when every **must** holds and most **should** hold.

## Modelling (must)

- [ ] The central system is the one the project builds, and there is exactly one.
- [ ] Every person is a role that uses the central system, and only relates to it (`person → system`).
- [ ] Every external system is something the project does not build: existing systems of the same organization are external; internal parts (gateway, database, queue, identity server, warehouse) and cloud infrastructure are not on this diagram.
- [ ] Every arrow points down and goes from the element that starts the interaction to what it depends on. No arrow was inverted for looks.
- [ ] At most one relationship per pair of elements; double interactions are merged into one description.
- [ ] No unconnected boxes.

## Content fidelity (must)

- [ ] Every element and relationship can be traced to the source (`source`) or is marked `inferred`.
- [ ] No invented vendors, protocols or systems. Unknown technologies are left out and explained in `notes`.
- [ ] Contradictions found in the source are recorded in `notes` and reported to the user.
- [ ] Stakeholders left out on purpose (no described interaction) are listed in `notes`.

## Coverage (should)

- [ ] Every audience the source describes (each app, each user story actor) appears as a person.
- [ ] Every third party named in decisions, integrations, regulations and risks appears as an external system.

## Wording (should)

- [ ] Relationship labels are verb phrases from the initiator's point of view ("Envía recordatorios por SMS"), not "Usa".
- [ ] Element descriptions are one sentence each, in `meta.language`.
- [ ] Names match the source's spelling.

## Look (should)

- [ ] No label covers a box or another label, and no text is cut off (the build checks this; confirm by eye).
- [ ] No arrow crosses another one when a different arrangement would avoid it.
- [ ] The key (legend) and the title bar are present.
