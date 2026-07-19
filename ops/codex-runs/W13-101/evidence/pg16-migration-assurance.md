# W13-101 PG16 Migration Assurance

Generated: 2026-07-18T18:12:07.031Z

Status: passed

- PostgreSQL server version num: 160014
- Railway environment: staging
- Railway service: ot99-pg16
- Used Railway TCP proxy: true
- Local migrations: 39
- Latest local migration: 2203_w13_100_student_gamification
- First run applied count: 39
- Second run already-applied count: 39
- Ledger rows: 39
- Latest ledger migration: 2203_w13_100_student_gamification
- Ledger matches normalized checksums: true
- Duplicate numeric prefixes: 0
- Disposable databases created: 1
- Disposable databases dropped: 1
- Remaining W13-101 disposable databases: 0

| Gamification table              | Present |
| ------------------------------- | ------: |
| portal_parent_reward_goals      |    true |
| portal_class_milestones         |    true |
| portal_gamification_corrections |    true |

External effects: production_database=false, providers=false, sends=false, railway_deployment_or_config=false, nonproduction_disposable_database=true.
