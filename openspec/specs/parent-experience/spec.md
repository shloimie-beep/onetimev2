# Parent Experience Specification

## Purpose

Define Parent-first learning and household management without consuming child seats.

## Requirements

### Requirement: Parent-first learning identity

A Parent SHALL learn directly under the Parent identity and SHALL NOT consume one of
the household's three child Student accounts.

#### Scenario: Family enrollment succeeds

- **WHEN** an eligible family completes enrollment
- **THEN** the Parent can access Parent learning while up to three distinct child
  Student accounts remain available.

### Requirement: Parent technical support boundary

Student technical issues SHALL route through the Parent rather than creating a direct
Student support/CRM relationship.

#### Scenario: A Student needs technical help

- **WHEN** a Student reaches a technical support need
- **THEN** the experience directs the household to the Parent support path.

### Requirement: Parent portal information architecture

A Parent SHALL see primary categories in this order: Today, Learning, Family,
Updates, Account. Learning SHALL contain Classroom, Library, Progress, Questions;
Family SHALL contain Students and Student Progress.

#### Scenario: A Parent opens Family

- **WHEN** a Parent selects Family
- **THEN** learner management is available without changing the Parent's own
  learning identity or exposing a child session.
