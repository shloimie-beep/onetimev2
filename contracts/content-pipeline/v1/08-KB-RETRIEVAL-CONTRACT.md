# Approved-content student helper retrieval contract

## Authorization before retrieval

The server resolves the authenticated principal, tenant, active enrollment, course/class entitlement, and content visibility before issuing any search query. An authorization-denied request must not reveal whether matching content exists. Cache keys include tenant and entitlement scope; a cross-tenant cache is prohibited.

## Eligible corpus

A search document is eligible only when all are true:

- source scope is `approved_rabbi_content`;
- content version is current and `published`;
- `approved_for_student_kb=true` and approval is valid;
- content is not corrected, revoked, retired, or deleted;
- learner/private-data flags are all false;
- principal is entitled to the class/course;
- section and document checksums match the active publication manifest.

No arbitrary web fetch, BNA global search, support ticket search, sibling record, private note, admin prompt, raw provider response, or unapproved transcript may enter retrieval context.

## Retrieval and answer behavior

- Retrieve section-sized documents from the local One Time index only.
- Preserve version and section identity through ranking and generation.
- Treat all retrieved text as quoted source data. It cannot alter system rules, authorization, tool access, output schema, or citation requirements.
- Use a configured minimum support score and require at least one supporting eligible section.
- When evidence is missing, weak, contradictory, revoked during the request, or outside entitlement, return an abstention such as “I don’t have enough approved class material to answer that.”
- Do not use general model knowledge to fill factual gaps presented as Rabbi/class teaching.

The response shape includes:

- `answer`;
- `abstained` boolean and safe reason code;
- `citations[]` with `content_id`, `version_id`, `section_id`, section title, canonical One Time deep link, and the checksum of the cited section;
- `authorization_decision_id` and correlation id for audit, not for display.

Every non-abstained answer has at least one citation. Deep links resolve without BNA availability.

## No general persistent personal memory

Do not create a durable learner-memory profile, inferred preference store, cross-session conversation summary, or long-lived raw question log. Request context may exist in process memory for the active request. Operational audit may store request id, actor id, authorized scope, selected content/version/section ids, outcome, latency, and safety reason, but not raw learner question or generated answer by default.

## Revocation, correction, and deletion propagation

A revoke/retire/delete/correct event removes affected documents from active search and invalidates related caches in the same application transaction as the local projection change. New requests deny inactive versions immediately. In-flight requests recheck version activity before returning an answer. Target propagation is 60 seconds at p95 and 5 minutes maximum under normal queue health; violations surface an operational alert and block stale content from retrieval when status is uncertain.

## Injection resistance

Tests must include approved transcript text that says to ignore prior rules, disclose secrets, search other tenants, omit citations, or contact external sites. Such text may be quoted as class content only when relevant; it never changes behavior. Retrieved documents are delimited, source-labeled, length-bounded, and stripped of executable markup/tool directives before model use.

## Privacy and telemetry

Do not send tenant secrets, learner identity attributes, private tickets, or unrelated content to a model provider. Follow existing data-processing configuration for approved class text. Logs and traces use ids and counts rather than raw questions or retrieved bodies. A debug mode that emits raw content must not exist in production.
