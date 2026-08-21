# Student Experience Specification

## Purpose

Define a private, Rabbi-led Student learning experience with safe support boundaries.

## Requirements

### Requirement: Rabbi-only questions

A Student SHALL ask learning questions only to the Rabbi in a private moderated flow.
Peer chat is out of scope.

#### Scenario: A Student submits a question

- **WHEN** a Student sends a learning prompt
- **THEN** it is scoped to the Student and Rabbi moderation flow and is not public
  class chat.

### Requirement: Parent-routed technical issues

Student technical issues SHALL be routed through the Parent experience.

#### Scenario: A Student cannot use a technical feature

- **WHEN** the issue is technical rather than a learning question
- **THEN** the Student is directed to the Parent support route without creating a
  Student GHL contact.

### Requirement: Student portal information architecture

A Student SHALL see primary categories in this order: Today, Learning, Updates,
Account. Learning SHALL contain Classroom, Library, Progress, Questions.

#### Scenario: A Student opens Account

- **WHEN** a Student opens Account
- **THEN** Billing, household management, and technical-support submission are not
  offered.
