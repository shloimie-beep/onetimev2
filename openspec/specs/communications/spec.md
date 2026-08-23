# Communications Specification

## Purpose

Keep One Time transactional history and adult CRM responsibilities distinct.

## Requirements

### Requirement: Read-only in-app delivery history

One Time Communications SHALL show read-only in-app transactional delivery history
from info@ only.

#### Scenario: An adult reviews delivery history

- **WHEN** an authorized adult opens One Time Communications
- **THEN** the app displays its transactional history without becoming a general CRM
  or message-composition surface.

### Requirement: Adult GHL ownership

GHL SHALL own adult CRM and general communication. The minimal path is signup
projection/pipeline, OT-01 confirmation, one reminder, adult support, suppression,
and Rabbi sender/reply routing.

#### Scenario: A general adult communication is needed

- **WHEN** a non-transactional adult CRM communication is required
- **THEN** it is governed in GHL and does not create Student contacts.

### Requirement: Deferred Telegram split

Telegram SHALL remain later work split between a Platform Console operations bot and
a One Time Rabbi bot.

#### Scenario: Telegram work is proposed

- **WHEN** Telegram functionality is considered
- **THEN** the correct future owner is selected and it does not expand the current
  One Time launch scope.
