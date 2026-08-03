# Prompt Index

Every link is a complete paste-ready `START_OR_RESUME` prompt. Use C00 first, then only prompts authorized by the committed ready queue.

| Prompt | Wave | Kind | Codex setting | Coverage | Start gate |
|---|---:|---|---|---|---|
| [C00](prompts/C00-START-OR-RESUME.md) | 0 | controller | SOL / Extra High | 0 req / 0 cases | Immediate/ready queue |
| [F01](prompts/F01-START-OR-RESUME.md) | 1 | foundation | SOL / Extra High | 8 req / 8 cases | C00 |
| [I36](prompts/I36-START-OR-RESUME.md) | 1 | integration | SOL / Extra High | 0 req / 0 cases | C00 |
| [F02](prompts/F02-START-OR-RESUME.md) | 2 | foundation | SOL / Extra High | 1 req / 1 cases | F01 |
| [F07](prompts/F07-START-OR-RESUME.md) | 2 | foundation | TERRA / High | 9 req / 9 cases | F01 |
| [P31](prompts/P31-START-OR-RESUME.md) | 2 | implementation | TERRA / High | 8 req / 8 cases | F01 |
| [P35](prompts/P35-START-OR-RESUME.md) | 2 | implementation | SOL / Extra High | 8 req / 8 cases | F01 |
| [F03](prompts/F03-START-OR-RESUME.md) | 3 | foundation | SOL / Extra High | 16 req / 22 cases | F02 |
| [F04](prompts/F04-START-OR-RESUME.md) | 3 | foundation | SOL / Extra High | 4 req / 4 cases | F02 |
| [F05](prompts/F05-START-OR-RESUME.md) | 3 | foundation | SOL / Extra High | 3 req / 3 cases | F02 |
| [P15](prompts/P15-START-OR-RESUME.md) | 3 | implementation | SOL / High | 14 req / 14 cases | F02, F07 |
| [F06](prompts/F06-START-OR-RESUME.md) | 4 | foundation | SOL / Extra High | 3 req / 3 cases | F04, F05 |
| [P10](prompts/P10-START-OR-RESUME.md) | 4 | implementation | SOL / High | 8 req / 8 cases | F03, F04, F07 |
| [P11](prompts/P11-START-OR-RESUME.md) | 4 | implementation | SOL / High | 3 req / 3 cases | F05, F07 |
| [P12](prompts/P12-START-OR-RESUME.md) | 4 | implementation | SOL / High | 7 req / 7 cases | F03, F04, F07 |
| [P14](prompts/P14-START-OR-RESUME.md) | 4 | implementation | SOL / High | 10 req / 10 cases | F03, F04, F07 |
| [P22](prompts/P22-START-OR-RESUME.md) | 4 | implementation | SOL / High | 11 req / 12 cases | F02, F05, F07 |
| [P23](prompts/P23-START-OR-RESUME.md) | 4 | implementation | SOL / High | 2 req / 3 cases | F05, F07 |
| [P24](prompts/P24-START-OR-RESUME.md) | 4 | implementation | SOL / High | 7 req / 7 cases | F03, F04, F05, F07 |
| [P32](prompts/P32-START-OR-RESUME.md) | 4 | implementation | SOL / Extra High | 5 req / 8 cases | F02, F03, F04, F05, F07 |
| [P08](prompts/P08-START-OR-RESUME.md) | 5 | implementation | SOL / High | 5 req / 6 cases | F03, F04, F06, F07 |
| [P13](prompts/P13-START-OR-RESUME.md) | 5 | implementation | SOL / High | 3 req / 3 cases | P12, F07 |
| [P16](prompts/P16-START-OR-RESUME.md) | 5 | implementation | SOL / Extra High | 7 req / 7 cases | F04, F05, P15 |
| [P21](prompts/P21-START-OR-RESUME.md) | 5 | implementation | SOL / High | 8 req / 9 cases | F05, F06, P14 |
| [P25](prompts/P25-START-OR-RESUME.md) | 5 | implementation | SOL / Extra High | 12 req / 13 cases | F04, F05, F06, F07 |
| [P26](prompts/P26-START-OR-RESUME.md) | 5 | implementation | SOL / Extra High | 9 req / 10 cases | F03, F04, F05, F06 |
| [P27](prompts/P27-START-OR-RESUME.md) | 5 | implementation | SOL / Extra High | 3 req / 3 cases | F04, F06 |
| [P33](prompts/P33-START-OR-RESUME.md) | 5 | implementation | SOL / Extra High | 5 req / 5 cases | F05, F06 |
| [P09](prompts/P09-START-OR-RESUME.md) | 6 | implementation | SOL / High | 4 req / 4 cases | P08 |
| [P17](prompts/P17-START-OR-RESUME.md) | 6 | implementation | SOL / Extra High | 10 req / 10 cases | F05, F06, P16 |
| [P18](prompts/P18-START-OR-RESUME.md) | 6 | implementation | SOL / Extra High | 5 req / 6 cases | F05, P16, P32 |
| [P19](prompts/P19-START-OR-RESUME.md) | 6 | implementation | SOL / High | 6 req / 6 cases | F05, F06, P16 |
| [P28](prompts/P28-START-OR-RESUME.md) | 6 | implementation | SOL / High | 9 req / 10 cases | F06, P27, P31 |
| [P34](prompts/P34-START-OR-RESUME.md) | 6 | implementation | SOL / Extra High | 6 req / 7 cases | P33 |
| [P20](prompts/P20-START-OR-RESUME.md) | 7 | implementation | SOL / Extra High | 6 req / 7 cases | F05, P19 |
| [P29](prompts/P29-START-OR-RESUME.md) | 7 | implementation | SOL / High | 12 req / 12 cases | P28, P31 |
| [P30](prompts/P30-START-OR-RESUME.md) | 7 | implementation | SOL / High | 3 req / 6 cases | P28, P31 |
| [V37](prompts/V37-START-OR-RESUME.md) | 9 | verification | SOL / Extra High | verifies 48 req / 55 cases | I36 |
| [V38](prompts/V38-START-OR-RESUME.md) | 9 | verification | SOL / High | verifies 58 req / 58 cases | I36 |
| [V39](prompts/V39-START-OR-RESUME.md) | 9 | verification | SOL / Extra High | verifies 46 req / 49 cases | I36 |
| [V40](prompts/V40-START-OR-RESUME.md) | 9 | verification | SOL / Extra High | verifies 18 req / 23 cases | I36 |
| [V41](prompts/V41-START-OR-RESUME.md) | 9 | verification | SOL / Extra High | verifies 27 req / 29 cases | I36 |
| [V42](prompts/V42-START-OR-RESUME.md) | 9 | verification | SOL / High | verifies 24 req / 28 cases | I36 |
| [V43](prompts/V43-START-OR-RESUME.md) | 9 | verification | SOL / Extra High | verifies 19 req / 20 cases | I36 |
| [R44](prompts/R44-START-OR-RESUME.md) | 10 | operator_acceptance | SOL / Extra High | 2 req / 2 cases | V37, V38, V39, V40, V41, V42, V43 |
| [R45](prompts/R45-START-OR-RESUME.md) | 11 | release | SOL / Extra High | 1 req / 1 cases | R44, V43 |

Fresh windows use the same prompt again. The remote branch plus runtime state/handoff supplies continuity.
