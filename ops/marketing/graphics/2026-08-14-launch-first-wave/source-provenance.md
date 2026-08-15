# Source provenance and safety readback

## Authority chain

- Parent marketing authority: Draft PR #183 exact head `595e38b2c53c7f9dd1b0018ae1954e42061f07f4`.
- Product authority: PR #131 deployed source `0ed5c3955892450d8985765d622d5fb7809b5c95`, inspected read-only and not changed by this packet.
- Legacy evidence: Draft PR #133 exact head `ff8aed26c6a21bf525d18a493e163a2af1288ad5`, preserved without import or mutation.

## Used sources

| Role                 | Source                                                | Drive ID                            | Dimensions |   Bytes | SHA-256                                                            | Safety                                  |
| -------------------- | ----------------------------------------------------- | ----------------------------------- | ---------: | ------: | ------------------------------------------------------------------ | --------------------------------------- |
| Rabbi teaching photo | `Class Photo - Rabbi Eli Teaching - Vertical 01.jpeg` | `16ox_6cfVt6JUn_0DNVjHo7-lF7V5JKbe` |   945x2048 | 141,524 | `1e504b0e9be675e668560d225d2886aee9927ec6667aa2033fbe853fe3d80447` | Rabbi only; no Student; no private data |
| One Time white logo  | `onetimelogo-white.webp`                              | `1uFXCmH5y6LBJiDyi5obMEElcWAEjNdL_` |    400x400 |  27,472 | `6b534dde8625b991cc9ef5e244190de950599718f35113825ab8c4c241edf441` | Text-free transparent brand master      |

Stable Drive view links:

- <https://drive.google.com/file/d/16ox_6cfVt6JUn_0DNVjHo7-lF7V5JKbe/view>
- <https://drive.google.com/file/d/1uFXCmH5y6LBJiDyi5obMEElcWAEjNdL_/view>

## Local render fonts

The renderer uses official Google Fonts source files from `google/fonts` only in the local render cache:

| Font                       | Source                                          | SHA-256                                                            | License                   |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| DM Serif Display Regular   | `ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf` | `8cc3643535edf039aa5d95440a8542735e9197e4f4b8d9303e980fefbf5ab616` | SIL Open Font License 1.1 |
| Montserrat variable weight | `ofl/montserrat/Montserrat[wght].ttf`           | `0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7` | SIL Open Font License 1.1 |

Font files are not added to this packet. Rendered documents may use them under the OFL; the repository already serves its own DM Serif web subset separately.

## Exact derivative lineage

All records below derive from source asset `OTM-A000001`; the six social drafts also place source logo `OTM-A000002` proportionally without changing it.

| Asset ID      | Package                | Format             | File                                     | Dimensions | SHA-256                                                            |
| ------------- | ---------------------- | ------------------ | ---------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `OTM-A000003` | `OTM-CP-001`           | Feed               | `OTM-CP-001-feed-1080x1350.png`          |  1080x1350 | `298ec99d40a1654205ad8447055f320bb65b111d5c1a00768c45b42d191d810d` |
| `OTM-A000005` | `OTM-CP-001`           | Story/Reel         | `OTM-CP-001-story-reel-1080x1920.png`    |  1080x1920 | `3f14ca89837083ef1e7852b9a88198ce593ad1af2e3b71421ae95a7abd42e72b` |
| `OTM-A000007` | `OTM-CP-001`           | Social preview     | `OTM-CP-001-social-preview-1200x630.png` |   1200x630 | `8ec571d22fa5c759dc6833a17a13dbee90f01a9d36c71d94e841143c22480958` |
| `OTM-A000004` | `OTM-CP-002`           | Feed               | `OTM-CP-002-feed-1080x1350.png`          |  1080x1350 | `757da3865ad36f01511dc162607f91c38e87d9af64a2a18c5769f7cdee2f79ec` |
| `OTM-A000006` | `OTM-CP-002`           | Story/Reel         | `OTM-CP-002-story-reel-1080x1920.png`    |  1080x1920 | `7207df6abec243646c04d6418593f194436e52e4a95cd64570e23192ea60a023` |
| `OTM-A000008` | `OTM-CP-002`           | Social preview     | `OTM-CP-002-social-preview-1200x630.png` |   1200x630 | `fa282200c0f40e2c42195794b5df1904b29e23c0b29736a832f0804d2e1fa0ac` |
| `OTM-A000009` | Shared landing handoff | Desktop background | `landing-hero-desktop-1600x900.png`      |   1600x900 | `dd899a4f9f5308f6efe18c8a45045a147d98c76cd8d1929f9023878cb123e7ea` |
| `OTM-A000010` | Shared landing handoff | Mobile background  | `landing-hero-mobile-1080x1600.png`      |  1080x1600 | `a10e151cd30a2582c3c34fa512dd6928005a76aa0f0ff3a2b99e97789a22d238` |

The machine-readable byte counts, 7% outer-edge foreground bounds, and proof-image checksums are in `render-manifest.json` and are verified byte-for-byte by `validate_launch_graphics.py`. The six copy-bearing social renders pass the 7% rule; the two text-free landing backgrounds correctly mark that foreground rule not applicable. The phone proof records an actual 390x844 content viewport separately from its decorative device frame.

## Verified but deliberately unused

| Source                                                | Reason not used                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Class Photo - Rabbi Eli Teaching - Vertical 02.jpeg` | A second person appears on the displayed screen; third-party-media state is not sufficiently narrow for this packet. |
| `feed-template-text-free-1080x1350.webp`              | Contains identifiable Students; no Student imagery is needed for the first wave.                                     |
| `vertical-template-text-free-1080x1920.webp`          | Contains identifiable Students; no Student imagery is needed for the first wave.                                     |

## Allowed transformations

Only crop, resize, mild saturation/brightness reduction, dark gradients, typography, and proportional logo placement are applied. Rabbi Eli's face and body pixels are not generated, restored, reshaped, retouched, replaced, or composited from another frame.

The landing handoff uses crop, resize, mild tonal reduction, and dark gradients only. It is deliberately text-free so the live HTML copy and CTA remain outside this media packet.
