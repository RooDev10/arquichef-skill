# GreenFleet — Solution Brief v1.3

## Company

GreenFleet is a Chilean scale-up that helps logistics companies run electric delivery fleets. Its platform plans charging, assigns vehicles to routes and predicts battery health.

- **Mission:** make electric fleets cheaper to run than diesel ones.
- **Vision (2030):** manage 50,000 electric commercial vehicles in Latin America.
- **Business model:** monthly fee per vehicle, plus an "Optimize" add-on billed per kWh saved.

## The problem

Fleet operators that switch to EVs lose 11% of delivery capacity in the first year. Vans wait for chargers, depots exceed their contracted grid power (fines up to USD 4,000 a month), and batteries degrade faster than expected because charging is not scheduled. Dispatchers plan by hand in spreadsheets.

## Stakeholders

- **Fleet manager** (buyer): cost, uptime, sustainability reports.
- **Dispatcher**: assigns vans to routes every morning.
- **Driver**: gets the assigned van and charging instructions in the mobile app.
- **Depot technician**: maintains chargers.
- **Utility company**: sets the contracted power and tariffs.
- **Charger manufacturers**: expose chargers through OCPP 1.6 / 2.0.1.

## Goals (OKR 2027)

- KR1: cut charging energy cost by 18% for pilot customers.
- KR2: zero grid-power penalty months at pilot depots.
- KR3: 95% of vans fully charged before their first route.
- KR4: 4,000 vehicles under management by Q4 2027.

## Capabilities and features

- Smart charging scheduler (respects grid limits and tariffs).
- Route-to-vehicle assignment using state of charge.
- Battery health prediction.
- Charger fleet monitoring and remote reset (OCPP).
- Sustainability reporting (CO₂ avoided, GHG Protocol scope 1 and 2).
- Billing and subscription management.

## AI at the core

AI is the differentiator. It is used across the product:

- **Business:** the "Optimize" add-on is sold on AI-driven savings; every recommendation must be explainable to the fleet manager.
- **Applications:** a forecasting service predicts depot energy demand 24 h ahead; an optimizer (mixed-integer programming plus a learned heuristic) builds charging plans; a battery-health model scores each pack weekly.
- **Data:** a feature store (Feast) keeps telemetry features; models are versioned in MLflow; training data is anonymised per customer.
- **Technology:** training runs on GPU spot instances; models are served with a model server behind the API; drift monitoring raises alerts.

## Architecture decisions

| ID | Decision |
| :--- | :--- |
| ADR-1 | Event-driven microservices: Fleet, Charging, Dispatch, Energy, Billing, Identity, Reporting. |
| ADR-2 | Kafka as the event backbone for telemetry (one message per vehicle every 30 s). |
| ADR-3 | Vehicle telemetry ingested over MQTT from the vans' telematics boxes. |
| ADR-4 | TimescaleDB for telemetry, PostgreSQL for transactional data. |
| ADR-5 | Deployed on AWS (us-east-1 and sa-east-1) on Amazon ECS with Fargate. |
| ADR-6 | Identity with Auth0; every customer is a separate tenant. |
| ADR-7 | Chargers controlled through an OCPP gateway service. |

## Apps

- Web console for fleet managers and dispatchers (Vue 3).
- Driver app (Flutter).
- Public API for customers' ERPs (REST, OpenAPI 3.1).

## Operations

Infrastructure is defined in Terraform and runs on Kubernetes (EKS) in two regions. CI/CD uses GitLab CI. Observability uses Datadog. Data is backed up daily and kept for 90 days. ISO 27001 certification is planned for 2027.

## Regulation and standards

- OCPP 1.6 and 2.0.1 for chargers.
- GHG Protocol for emissions reporting.
- Chile's Law 21.719 on personal data protection.
- ISO 15118 (plug & charge) is on the roadmap.
