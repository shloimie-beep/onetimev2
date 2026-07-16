# OT-108 Asset Use Matrix

Generated from `apps/web/public/assets` with SHA-256 and image dimensions via
the repository `sharp` dependency. Scene descriptions avoid identifying people.

| Asset                                                                                    | Dimensions |  Bytes | SHA-256                                                            | Current use before OT-108                                          | OT-108 decision                                                                 |
| ---------------------------------------------------------------------------------------- | ---------: | -----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `apps/web/public/assets/brand/onetimelogo.webp`                                          |    400x400 |  27472 | `6B534DDE8625B991CC9EF5E244190DE950599718F35113825AB8C4C241EDF441` | Header/footer brand mark.                                          | Preserve; enlarge visually through CSS without adding boxed/bordered treatment. |
| `apps/web/public/assets/hero/hero-classroom-background.webp`                             |   1680x944 | 122576 | `FB254878EDF9F07DDA24DA07ED9B5609A4C591CE9275D1A2476C30C8AE438DAC` | Hero background.                                                   | Preserve; add code-native depth overlays only.                                  |
| `apps/web/public/assets/students/smiley-kid.png`                                         |    337x600 | 425977 | `7C61ACDC2F459497A89D68450ACA6C7F48AFE8A3731FC6F1AD14CB028984E279` | Receive image and Retention benefit card, causing duplicate use.   | Use once in Receive only; remove from Retention.                                |
| `apps/web/public/assets/outcomes/clarity-class.webp`                                     |   945x2048 |  96992 | `41D9073D928ACB220ADDE01FA5BD41ADBE28FEE00C5621B58EB36DC75DF430C8` | Approved Clarity asset exists but is unused in current content.    | Restore to Clarity card.                                                        |
| `apps/web/public/assets/outcomes/excitement-learning-torah.webp`                         |   945x2048 | 101038 | `EB143C328912118D6F32A46700BD717804A2D75CC1EAB880FDB63A29CC49615D` | A Love of Learning card.                                           | Preserve as the learning-love card.                                             |
| `apps/web/public/assets/outcomes/accomplishment-toronto-class.jpg`                       |   1200x745 | 196528 | `17239865937B2B112272C2E57C43BC61A64B5CE38611CCF7DC90472970109C76` | Progress card.                                                     | Preserve for Progress.                                                          |
| `apps/web/public/assets/backgrounds/who-its-for-norfolk-virginia.webp`                   |  1800x1350 | 424050 | `BAB5E4511DF37C97D081A6C79B476829D34B8E6195F8456F9DEBA5F5D3B6F023` | Who section background.                                            | Preserve.                                                                       |
| `apps/web/public/assets/rabbi/rabbi-eli-holding-book.jpg`                                |  1600x1067 | 205532 | `BAC24630186E190F11848D3177040553445310B50B91E42CEA2C42BCA328AC16` | Rabbi section portrait/book scene.                                 | Preserve.                                                                       |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-atlanta-georgia.webp`    |   1600x714 | 102348 | `CEE5B5E07CE91ABBDBB8A15EA94856258B4EB719CCEE634D130DA96F4A1D8935` | Gallery slide and incorrectly used for Clarity card before OT-108. | Keep in gallery only; remove from Clarity.                                      |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-baltimore-maryland.webp` |  1600x1066 | 129700 | `E3811BCABF61C134A5613565BB60CEEA0FA059F1AD6C43F534132865C11074EA` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-flatbush-ny.webp`        |  1600x1200 | 217942 | `A17E0D69959A03316419218591D60C165855F301F40172CEF30AB35382A37DF9` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-hollywood-florida.webp`  |  1600x1200 | 188400 | `8DE5CDA1101C31AC72F4FEDC52A71F843E3D0B385F3DB84D27FF806251B92465` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-lakewood-nj.webp`        |  1600x1200 | 151776 | `A45AF465B12D2CA7C26B8C6549D74C53EE630E0D5E9AF77E7C63749783EE52C6` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-miami-florida.webp`      |  1600x1200 | 189200 | `A22CEF0EF287DC452E9B0E1F4B757AB2AB3DD8573A0DE2C703A19099C718A577` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-philadelphia.webp`       |  1600x1200 | 168846 | `59BC07EE73EE8C21053BA918064BFB1311FD7D486E96263C719F050F91883349` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/rabbi/teaching-locations/rabbi-scheller-silver-spring.webp`      |  1600x1200 | 288018 | `CFCCFC0F2F26677C658F74E174250CB1AAAE1261BEF0F5F67746DF19DE23C52D` | Gallery slide.                                                     | Preserve in centered color carousel.                                            |
| `apps/web/public/assets/press/torah-anytime.png`                                         |    133x100 |  27080 | `A424BB407E07A69C4DBFE7510231D2B353FFCE7B07322FA3B0EA1D4AC3C74282` | Press strip.                                                       | Preserve; not part of OT-108 image carousel.                                    |
| `apps/web/public/assets/press/24six.png`                                                 |    131x100 |   8584 | `7F7848F3E8DE7722601FE3557EAB3FB2CDE55A17C0D503E7FACAF51B37DB2045` | Press strip.                                                       | Preserve.                                                                       |
| `apps/web/public/assets/press/the-loop.png`                                              |    202x100 |  29590 | `648EAC401664FDCB64E7ACA77C7C254C73C5DB07B31B976C57778C8CE874E49C` | Press strip.                                                       | Preserve.                                                                       |
| `apps/web/public/assets/press/naki.webp`                                                 |    244x100 |   2552 | `A555167715C32184194126D721089CE638F3FD8D4164B9283ACED441FA82BF00` | Press strip.                                                       | Preserve.                                                                       |
| `apps/web/public/assets/press/mishpacha.webp`                                            |    338x100 |   6976 | `68B9B6EA2082BDDC88A42164803F2483047368FD81265143EE5DB99A63749DFF` | Press strip.                                                       | Preserve.                                                                       |

## Source Evidence

- `ops/audit-inputs/ot-06/ASSET-MAP.md` assigns `clarity-class.webp` to Clarity
  and `smiley-kid.png` to the Receive image.
- `ops/evidence/ot-73/COPY-AND-PLACEMENT-LEDGER.md` records the current
  duplicate/student-image and Clarity mismatch as visual corrections to
  preserve or repair under later packets.
- Live staging inspected at `https://ot99-web-staging.up.railway.app/` on
  2026-07-16 and still showed the duplicated student asset in the source HTML.

## Missing Assets

No missing approved OT-108 image asset was found for the Clarity/Retention
correction. The previously missing `Toronto.jpg` issue is already resolved in
this base as `apps/web/public/assets/outcomes/accomplishment-toronto-class.jpg`.
