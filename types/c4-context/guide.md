# C4 system context: method

How to turn a source document into a correct C4 system context diagram (level 1 of the C4 model) with ArquiChef. A context diagram answers one question: **what are we building, who uses it, and what does it need from the outside world?** It does not show anything inside the system.

## Contents

1. Anatomy of the diagram
2. The three kinds of element
3. Relationships: the rules
4. Where the content comes from
5. Writing style
6. Gaps, inferences and inconsistencies
7. Spec cheat sheet

---

## 1. Anatomy of the diagram

```
   [ Person ]  [ Person ]  [ Person ]  [ External that calls us ]
         \          |          /              /
          ↓         ↓         ↓              ↓
              [ CENTRAL SYSTEM (the one we build) ]
               /          |            \
              ↓           ↓             ↓
   [ External ]     [ External ]     [ External ]      ← what we depend on
```

- **Arrows always point down.** The element that starts an interaction is drawn above the element it depends on. Reading top to bottom tells the chain of dependencies.
- **The layout is automatic.** The spec lists elements and relationships, never positions. The layered layout engine places people (and external systems that call us) on top, the central system in the middle, and its dependencies below, with orthogonal arrows and labels that never cover a box.
- The diagram has a title bar with the view name, and a key (legend) at the bottom, as C4 recommends for every diagram.

## 2. The three kinds of element

| Kind | What it is | Typical wording in a source |
| :--- | :--- | :--- |
| **Person** (`people`) | A role that **uses or takes part in** the central system. | Actors, user profiles, segments, "the patient can…", user stories |
| **Central system** (`system`) | The system **this project is going to build**. Exactly one. | "The platform/app/system we propose…", the project scope, the product name |
| **External system** (`externals`) | Any software system **we do not build** but that the central system **needs** for some feature, or that calls it. | Third-party APIs, SaaS, payment gateways, messaging providers, government services, existing systems |

Decision rules:

- **Existing systems of the same organization are external.** A clinic's HIS, a company's ERP or legacy CRM: if this project does not build it, it is external, even if the client owns it.
- **Internal parts are not external systems.** API gateways, databases, queues, identity servers we deploy, data warehouses, TURN servers: they are containers *inside* the central system and belong on the container diagram. Record them in `notes` if the source stresses them.
- **Cloud infrastructure is not an external system** (AWS, GCP, Kubernetes, S3). It is deployment.
- **A regulator or organization with no described interaction is left out.** Mention it in `notes` (e.g. a supervisory body listed as a stakeholder but never connected to the system).
- **People are roles, not individuals or departments in general.** "Personal de admisión", not "Ana" and not "the clinic".

## 3. Relationships: the rules

`from` is always the element that **starts** the interaction; `to` is what it uses or depends on. These are **errors** in `lint` (the build refuses the spec):

1. **A person only relates to the central system, and the person starts it.** `person → system`. Never `person ↔ external` (if a provider sends an SMS to a patient, that is an internal detail of the reminder feature, not a relationship on this diagram) and never `system → person` (write it from the person's side: the patient *receives reminders from* the system becomes part of `paciente → sistema`, e.g. "Agenda citas y confirma recordatorios").
2. **Arrows always point down, so no cycles.** A callback or webhook from an external system back to the central system closes a cycle; describe the interaction once, from the element that starts it, and drop the reverse. Never invert an arrow to make the picture tidier: the direction carries the meaning.
3. **At most one relationship per pair of elements**, in either direction. If the system does two things with the same external system, merge them into one description: "Lee datos del paciente y registra atenciones".
4. **Every element has at least one relationship.** An unconnected box does not belong on a context diagram.

An **external system that calls the central system** (e.g. an insurer's portal querying our API) is allowed: it is drawn on the top row, in grey, with its arrow pointing down into the system. A relationship between two external systems is a warning: keep it only when the central system relies on it.

## 4. Where the content comes from

| Need | Look in |
| :--- | :--- |
| Central system name and one-line purpose | Company/product profile, executive summary, project scope |
| People | Actors and segments, user stories ("Como paciente…"), epics, use cases |
| What each person does with the system | Epics, user stories, functional requirements, application list (one app per audience) |
| External systems | Architecture decisions, integrations, non-functional requirements, risks ("if the SMS provider fails…"), regulations (tax authority, health registries) |
| Technology of each relationship | Architecture decisions, integration sections, standards (HL7 FHIR, OAuth, SMTP) |

Read the whole source before writing. Externals often hide in risks and decisions, not in an integrations section.

## 5. Writing style

- **Names**: as the source spells them. Products by product name ("Twilio", "WhatsApp Business"), institutions by their usual short name ("SUNAT", "Aseguradoras (EPS)").
- **Element descriptions**: one sentence on what it is or does, ending with a full stop. People: what they do. Externals: what they provide.
- **Relationship descriptions**: a verb phrase from the point of view of `from`, no full stop: "Envía recordatorios por SMS", "Valida la cobertura del paciente". Avoid bare "Usa".
- **Technology**: the protocol or integration mechanism ("HTTPS", "API REST", "HL7 FHIR", "API de Twilio"). If the source does not say, leave it out and say so in `notes`; do not guess a protocol.
- Write in `meta.language` throughout.

## 6. Gaps, inferences and inconsistencies

- Every element and relationship should have `source` (`<source-id>:<section>`). If you add something the source does not state, set `"inferred": true`; it is starred on the diagram and in the README.
- Contradictions in the source (two different clouds, two names for the same provider) go in `notes` and in your report to the user. For a context diagram, most infrastructure contradictions do not change the picture, but record them: the container diagram will need the answer.
- If the source never says what the central system is, or names no users, ask the user instead of inventing it.

## 7. Spec cheat sheet

```json
{
  "arquichef": "1",
  "type": "c4-context",
  "meta": { "title": "…", "organization": "…", "language": "es", "sources": [{ "id": "informe", "label": "…" }] },
  "system": { "id": "medicita", "name": "MediCita", "description": "…", "source": "informe:1" },
  "people": [{ "id": "paciente", "name": "Paciente", "description": "…", "source": "informe:3" }],
  "externals": [{ "id": "twilio", "name": "Twilio", "description": "…", "source": "informe:7" }],
  "relationships": [
    { "from": "paciente", "to": "medicita", "description": "Agenda citas…", "technology": "HTTPS", "source": "informe:8" },
    { "from": "medicita", "to": "twilio", "description": "Envía recordatorios por SMS", "technology": "API de Twilio" }
  ],
  "notes": ["…"]
}
```

Ids: lowercase, digits and hyphens (`pasarela-pagos`). Limits: 8 people, 12 externals, 30 relationships; names up to 40 characters, descriptions up to 160 (relationships 90). A complete real example is `examples/medicita.json`.
