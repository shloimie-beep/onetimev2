## ADDED Requirements

### Requirement: People boundary

One Time SHALL present Families, Parents, Students, Access, and Audit as app-owned identity information and SHALL not present Students as GHL contacts.

#### Scenario: An operator reviews a Student

- **WHEN** an authorized operator opens People / Students
- **THEN** the view shows only One Time identity, household, and access facts without CRM actions or GHL identity.
