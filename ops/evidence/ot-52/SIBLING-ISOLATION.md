# OT-52P Sibling Isolation

## Server

- Student service methods accept no learner selector.
- Student learner scope is derived from `actor.student_learner`.
- Parent household checks require an authorized household subject.
- Cross-household parent access returns `NOT_FOUND`.

## Router

- Student class launch endpoint is `/classes/:classKey/launch`; no learner path parameter exists.
- Router test submits a body learner attempt and verifies the service receives only `actor.student_learner`.

## UI

- Student portal renders a single learner dashboard.
- Student portal has no sibling selector or household controls.
