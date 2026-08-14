# Source provenance and safety readback

## Used sources

| Role                 | Source                                                | Drive ID                            | Dimensions |   Bytes | SHA-256                                                            | Safety                                  |
| -------------------- | ----------------------------------------------------- | ----------------------------------- | ---------: | ------: | ------------------------------------------------------------------ | --------------------------------------- |
| Rabbi teaching photo | `Class Photo - Rabbi Eli Teaching - Vertical 01.jpeg` | `16ox_6cfVt6JUn_0DNVjHo7-lF7V5JKbe` |   945×2048 | 141,524 | `1e504b0e9be675e668560d225d2886aee9927ec6667aa2033fbe853fe3d80447` | Rabbi only; no Student; no private data |
| One Time white logo  | `onetimelogo-white.webp`                              | `1uFXCmH5y6LBJiDyi5obMEElcWAEjNdL_` |    400×400 |  27,472 | `6b534dde8625b991cc9ef5e244190de950599718f35113825ab8c4c241edf441` | Text-free transparent brand master      |

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

## Verified but deliberately unused

| Source                                                | Reason not used                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Class Photo - Rabbi Eli Teaching - Vertical 02.jpeg` | A second person appears on the displayed screen; third-party-media state is not sufficiently narrow for this packet. |
| `feed-template-text-free-1080x1350.webp`              | Contains identifiable Students; no Student imagery is needed for the first wave.                                     |
| `vertical-template-text-free-1080x1920.webp`          | Contains identifiable Students; no Student imagery is needed for the first wave.                                     |

## Allowed transformations

Only crop, resize, mild saturation/brightness reduction, dark gradients, typography, and logo placement are applied. Rabbi Eli’s face and body pixels are not generated, restored, reshaped, retouched, or replaced.
