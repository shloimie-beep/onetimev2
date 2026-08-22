## ADDED Requirements

### Requirement: Read-only account-email history

One Time Communications SHALL show only safe, read-only info@ account lifecycle email history and SHALL not become a mailbox, composer, CRM history, or provider console.

#### Scenario: An Admin opens Account Emails

- **WHEN** an authorized Admin opens Communications
- **THEN** only allowed transactional email records with masked destinations and safe delivery state are returned.

#### Scenario: A Rabbi or direct contact route requests history

- **WHEN** a Rabbi requests account-email history or a caller requests a contact communications route
- **THEN** the Rabbi is denied and the contact route is absent; neither path reads broad communications history.
