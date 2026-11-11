# Informe del proyecto MediCita (versión 2.1)

## 1. Perfil de la startup

**MediCita** es una startup peruana que ofrece una plataforma SaaS B2B para redes de clínicas privadas medianas. Permite agendar citas, hacer teleconsultas y llevar la historia clínica electrónica en un solo lugar.

- **Misión:** acercar la atención médica a los pacientes reduciendo el tiempo de espera y las citas perdidas mediante tecnología simple.
- **Visión 2029:** ser la plataforma de gestión clínica de referencia para clínicas medianas de la región andina.
- **Modelo de negocio:** suscripción mensual por médico activo (planes Básico y Pro) y un complemento de teleconsulta cobrado por minuto.

## 2. Problemática (5W+2H)

En las clínicas medianas de Lima, Arequipa y Cusco, el 28 % de las citas se pierden por inasistencia y los pacientes esperan en promedio 9 días para una cita con especialista. Las agendas se manejan en Excel y por WhatsApp, y la historia clínica está en papel o repartida en tres sistemas distintos. Cada cita perdida le cuesta a la clínica en promedio S/ 85. Los pacientes de provincias viajan hasta 6 horas para un control de 15 minutos.

## 3. Segmentos y actores

- **Pacientes**: agendan, reciben recordatorios y hacen teleconsultas desde el celular.
- **Médicos**: atienden citas presenciales y teleconsultas, y registran la historia clínica.
- **Personal de admisión**: gestiona la agenda, confirma citas y cobra.
- **Gerencia de la clínica**: decide la compra, revisa indicadores de ocupación y ausentismo.
- **Aseguradoras (EPS)**: validan la cobertura del paciente antes de la cita.
- **SUSALUD**: supervisa a las instituciones prestadoras de salud.

## 4. Objetivos SMART

- **O1:** reducir el ausentismo de 28 % a 15 % en las clínicas piloto en 6 meses.
- **O2:** lograr que el 30 % de los controles de seguimiento se hagan por teleconsulta en 9 meses.
- **O3:** incorporar 12 clínicas y 300 médicos activos en el primer año.
- **O4:** bajar el tiempo de espera para especialista a 4 días en las clínicas piloto.

## 5. Épicas

- **EP01 Agenda inteligente**: reserva en línea, lista de espera y reprogramación automática.
- **EP02 Recordatorios**: SMS y WhatsApp 48 y 2 horas antes, con confirmación de un toque.
- **EP03 Teleconsulta**: videollamada en el navegador, receta electrónica y firma digital.
- **EP04 Historia clínica electrónica (HCE)**: registro por episodio, alergias y antecedentes, interoperable con HL7 FHIR.
- **EP05 Facturación y seguros**: validación de cobertura con EPS y emisión de comprobantes electrónicos SUNAT.
- **EP06 Analítica**: tableros de ocupación, ausentismo y productividad por médico.

## 6. Normativa y estándares

- Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento.
- Ley N.° 30421, Ley Marco de Telesalud.
- Norma Técnica de Salud para la gestión de la Historia Clínica.
- HL7 FHIR R4 para el intercambio de información clínica.
- Facturación electrónica según SUNAT.

## 7. Decisiones de arquitectura

| ID | Decisión |
| :--- | :--- |
| AD-01 | Backend en microservicios por dominio: Agenda, Pacientes, HCE, Teleconsulta, Facturación, Notificaciones e Identidad. |
| AD-02 | Un API Gateway (Kong) delante de los microservicios y autenticación con OAuth 2.0 / OpenID Connect (Keycloak). |
| AD-03 | Comunicación asíncrona entre servicios con RabbitMQ; los recordatorios se programan como eventos diferidos. |
| AD-04 | Base de datos PostgreSQL por servicio; la HCE se cifra en reposo con claves por clínica (KMS). |
| AD-05 | Teleconsulta sobre WebRTC con un servidor TURN propio; las grabaciones no se guardan. |
| AD-06 | Despliegue en AWS (región São Paulo) con Amazon EKS; archivos clínicos en S3 con cifrado. |
| AD-07 | Mensajería con Twilio (SMS) y la API de WhatsApp Business. |
| AD-08 | Analítica con un data warehouse en Amazon Redshift alimentado cada noche. |

## 8. Aplicaciones

- **Portal del paciente** (web responsiva en React) y **app móvil del paciente** (React Native).
- **Consola clínica** para médicos y admisión (Angular).
- **Panel gerencial** con tableros de analítica.

## 9. Atributos de calidad

- Disponibilidad de 99,5 % en horario de atención.
- Recordatorio enviado en menos de 1 minuto después de su hora programada.
- Inicio de teleconsulta en menos de 5 segundos.
- Aislamiento total de los datos entre clínicas (multi-tenant).

## 10. Despliegue y operación

El sistema corre en Google Cloud con Kubernetes (GKE). Hay pipelines de CI/CD en GitHub Actions, pruebas automatizadas con Jest y JUnit, y monitoreo con Grafana y Prometheus. Las copias de seguridad de las bases de datos se hacen cada 6 horas y se guardan 30 días.

## 11. Riesgos

- Mala conectividad en provincias durante la teleconsulta: se reduce la calidad del video y se ofrece llamada de voz.
- Caída del proveedor de SMS: se reintenta por WhatsApp.
- Acceso indebido a la HCE: registro de auditoría de cada lectura y acceso por rol.
