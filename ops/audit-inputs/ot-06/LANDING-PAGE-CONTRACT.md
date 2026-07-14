ChatGPT Pro





















TASK ID: OT-01
ROLE: One Time landing-page evidence compiler
MODE: Read-only analysis; do not edit code or repositories

GOAL

Recover the exact intended One Time One Time landing-page specification from
the repository and its recorded user instructions. Produce a construction-ready
contract, not a general summary and not a redesign.

SOURCES TO INSPECT

Search all relevant:
- One Time public landing-page files and assets
- route registry and provider configuration
- raw-input records
- prompt packets and task specifications
- memory and memory-topic files
- intent-preservation records
- relevant tests
- relevant Git history when available

Search explicitly for references to:
- yellow text
- bullet lists
- Sign Up Now
- Member Login
- logo
- hamburger/mobile menu
- header
- footer
- mobile first viewport
- cards
- One Time branding
- landing-page section order

EVIDENCE RULES

1. Newer explicit user instructions outrank older implementation.
2. Approved durable invariants outrank accidental current styling.
3. Current implementation is evidence, but not automatically the intended result.
4. Record contradictions instead of silently choosing one.
5. Never invent, paraphrase, or “improve” landing-page copy.
6. If exact requested copy cannot be recovered, mark it MISSING EVIDENCE.
7. Cite repository file paths for every recovered requirement.

REQUIRED OUTPUT: LANDING-PAGE-CONTRACT

Include:

1. A section-by-section table containing:
   - stable section ID
   - exact order
   - exact heading
   - exact body copy
   - exact bullets
   - which words or blocks are yellow
   - image/icon/asset
   - buttons and destinations
   - desktop layout
   - mobile layout

2. Exact header contract:
   - logo treatment
   - Member Login
   - Sign Up Now
   - hamburger behavior
   - what remains visible on mobile
   - rule ensuring the primary CTA appears in the initial mobile viewport

3. Exact footer contract.

4. Shared visual invariants:
   - typography and readable contrast
   - card behavior and alignment
   - handling odd card counts without fake blank cards
   - spacing and responsive stacking
   - drawers/expanded cards if present
   - mobile navigation and filters

5. Assets, URLs, SEO metadata, analytics, and form destinations.

6. For every current discrepancy, classify it:
   PRESERVE, REPAIR, REPLACE, DEFER, or RETIRE.

7. Acceptance criteria written as testable Given/When/Then statements for:
   - 360×800 mobile
   - 390×844 mobile
   - tablet
   - desktop

8. A final MISSING EVIDENCE / USER DECISIONS section containing only genuinely
   unresolved conflicts. Do not ask aesthetic questions that repository evidence
   already answers.

Do not write implementation code. Do not modify any repository.
Return only the evidence-backed contract and a short source index.

Worked for 42m 20s
LANDING-PAGE-CONTRACT
0. Evidence authority
Item	Contract
Canonical implementation surface	Repository: shloimie-beep/bnei-neviim-academy. Primary file: public/one-time/index.html. Canonical public route: /one-time. Workspace/project scope: rabbi_sheller_provider / one_time_mishnah_class.
Governing section/order/visual packet	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md, supplemented by the exact-copy packet raw-input/RAW-20260712-004-onetime-landing-visual-revision.md and the July 13 image/crop addendum.
Critical copy conflict	The July 13 operator message said only to “fix the text” and referred to earlier text changes that were not attached. The portal/library removals and replacement wording were subsequently compiled by an agent rather than captured verbatim.
Required handling of that conflict	The newer intent-preservation record explicitly identifies this as a real regression: downstream requirements and tests certified an inference, but the correct flow was to stop until the earlier exact source was attached or the operator restated the changes. Therefore the affected copy fields below are MISSING EVIDENCE, even though the inferred text is currently deployed and tested.
Copy rule	Text shown as exact below must be reproduced verbatim. Text marked MISSING EVIDENCE must not be rewritten, “improved,” reconstructed from context, or replaced with either the older portal wording or the current inferred wording.
1. Section-by-section contract
Stable section ID	Exact order	Exact heading	Exact body copy	Exact bullets / card labels	Yellow words or blocks	Image / icon / asset	Buttons and destinations	Desktop layout	Mobile layout	Evidence
LP-00-CAMPAIGN-TICKER / DOM #rosh-special	After header; before Hero	None	Before the target date: “ROSH HASHANAH SPECIAL • [N] DAYS TO ROSH HASHANAH • JOIN FREE UNTIL ROSH HASHANAH • SIGN UP NOW”. [N] is calculated against the Jerusalem calendar date 2026-09-11, using Asia/Jerusalem. On or after the target date, suppress the ticker unless separately approved replacement copy exists.	None. This is one repeated marquee sentence, not a bullet list.	Entire strip is a neon/chrome-yellow block with dark text.	No image.	Entire strip links to /one-time/signup.	Full-width, directly below the sticky header, normal document flow, horizontally moving, pauses on hover/focus, scrolls away with the page. It must not be duplicated near the footer.	Same placement. Current target height is approximately 36px. With reduced motion, show one static copy and suppress the duplicate marquee copy.	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; current implementation in public/one-time/index.html.
LP-10-HERO	1	“Give your son a love for learning Torah.”	Kicker: “Worldwide Mishnah learning — live from Eretz Yisrael”

Schedule: “Live every day at 7:00 p.m. Israel time.”

No descriptive marketing paragraph.	None.	No headline or schedule words are yellow. Use yellow only for the symmetrical kicker lines, restrained illumination, and the CTA block.	Decorative faded background: /assets/one-time/hero/hero-classroom-background.webp, positioned approximately center 48%, under strong black, yellow, and ice-blue masks. Decorative image semantics: empty alt text/no independent content announcement.	One large “Sign Up Now” button to /one-time/signup.	Full-bleed first-screen hero; one text column, maximum copy width approximately 950px; no separate portrait/media panel; full background grid and layered radial/orbital treatment.	One column, aligned toward the top rather than vertically centered. The kicker lines shorten symmetrically. The CTA is lifted upward and must be fully visible in the initial visual viewport without collision with browser chrome or the WhatsApp launcher.	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; July 13 asset assignment; current implementation.
LP-20-RECEIVE / DOM #receive	2	“What You Receive”	MISSING EVIDENCE — exact final supporting sentence was not recovered.

Older explicit sentence: “A complete online dashboard for learning, progress tracking, reminders, and communication.”

Current inferred sentence: “Everything a family or school needs to join the live class: schedule, class link, review support, reminders, and a clear daily rhythm.”

Neither sentence may be treated as the recovered final instruction.	No bullet list. Use eight title-only feature tiles.

Exact labels that survived both versions:
1. “Live daily Mishnayos class”
5. “Review sheets”
6. “Daily reminders”
7. “Questions with Rabbi Scheller”

Slots 2, 3, 4, and 8 are MISSING EVIDENCE. Current inferred labels are “Class link for each session,” “Review support,” “Family and school signup,” and “Safe class communication”; older explicit labels were “Online class library,” “Student portal,” “Parent portal,” and “Monitored online platform.”	No production-authoritative instruction makes any feature label yellow. Keep card titles white. Yellow is limited to the photo ring, icon rings/glyphs, and restrained edge highlights.	Circular student image: /assets/one-time/students/smiley-kid.png.
Inline SVG icons, consistent size.	None. Do not add a section CTA.	Two-part composition: large circular student image on one side; two-column, four-row feature grid on the other. Tiles stretch to equal height within each row.	Circular image centered above the feature grid, approximately 210–240px. At widths above 680px the feature grid remains two columns; at 680px and below it becomes one column.	Older exact packet and current implementation; missing-copy finding from RAW-007 and the intent gate.
LP-30-GAIN / DOM #gain	3	“What He’ll Gain”	Clarity: “He’ll understand the main points, the questions, and the logic behind each Mishnah—with review sheets and opportunities to ask Rabbi Scheller questions.”

Accomplishment: MISSING EVIDENCE. Older exact paragraph: “One perek a day gives him a clear goal, steady progress, and visible progress badges and milestones in his student portal.” Current inferred paragraph: “One perek a day gives him a clear goal, steady progress, and a real sense of finishing each day’s learning.” Neither is certified final.

Excitement for learning Torah: “A lively class and a real connection with Rabbi Scheller make Torah learning something he looks forward to each day.”	No bullet list. Exactly three editorial benefit cards titled:
1. “Clarity”
2. “Accomplishment”
3. “Excitement for learning Torah”	Titles and body copy stay white/readable. Yellow is limited to icon treatment and restrained edges/glow.	Clarity: /assets/one-time/outcomes/clarity-class.webp, object-position: 50% 25%.

Accomplishment: /assets/one-time/outcomes/accomplishment-lakewood-class.webp, object-position: 50% 48%.

Excitement: /assets/one-time/outcomes/excitement-learning-torah.webp, object-position: 50% 50%, moderate scale(1.1).	None.	Three equal-height cards in one row. Each has a consistent 16:10 image area, icon, title, and aligned body region.	At tablet widths: two columns, with the third card naturally occupying the first cell of the next row—no fake blank card. At 680px and below: one column.	Exact copy packet, current implementation, and asset manifest.
LP-40-HOW / DOM #how-it-works	4	“How It Works”	MISSING EVIDENCE — exact final supporting sentence was not recovered.

Older explicit sentence: “Join the live class now and stay updated as we continue refining the technology that brings Torah learning to boys around the world.”

Current inferred sentence: “Sign up, get the class information, and join the daily 7:00 p.m. live Mishnayos class.”

Neither is certified final.	No bullet list. Exactly three concise step nodes:
1. “Sign up”
2. “Receive the class link”
3. “Enjoy the live class”	Step titles stay white. Icons and the connecting line use yellow plus ice/electric blue.	Inline SVG document, link, and video icons.	None. No CTA in this section. The later three-CTA rule supersedes the earlier instruction that placed a CTA here.	Three equal nodes in one row, joined by one horizontal glowing connector.	One-column vertical sequence joined by a vertical glowing connector.	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; current implementation; RAW-007 intent conflict.
LP-50-WHO / DOM #who	5	“Who It’s For”	“Built for families, homeschoolers, schools, and local boys who want a clear daily Mishnayos rhythm.”	No bullet list. Exactly four audience cards:
1. “Families”
2. “English-speaking homeschoolers”
3. “Schools”
4. “Local boys in Ramat Beit Shemesh Alef”

Only the fourth card has supporting copy: “Free live class at 7:00 p.m.”	The local-class supporting line is yellow-soft. Audience titles remain white. Icons/rings may use yellow accents.	Decorative background: /assets/one-time/backgrounds/who-its-for-norfolk-virginia.webp, desktop focal position approximately center 43%, mobile 50% 44%, under a strong dark overlay. Inline audience icons.	None.	Four aligned cards in one row, over the dark photographic/grid/orbit composition.	Two columns at tablet widths; one column at 680px and below.	Exact copy packet, current implementation, and asset manifest.
LP-60-RABBI / DOM #rabbi	6	Eyebrow: “Meet Rabbi Scheller”
Heading: “A world-renowned Torah teacher.”	“Rabbi Eli Scheller has taught Torah to students and audiences across the Jewish world. His clarity, warmth, and energy help boys understand what they are learning and look forward to coming back.”	None.	No yellow words required. Eyebrow is pale blue/ice; restrained yellow may appear only in surrounding accents.	/assets/one-time/rabbi/rabbi-eli-holding-book.jpg.
Alt: “Rabbi Eli Scheller holding the One Time book”.	None.	Two-column text/photo composition; text left, 4:3 image right.	Text above image in one column.	Exact copy packet and current implementation.
LP-61-TEACHING-GALLERY	6.1, inside Rabbi section	“Teaching Torah Across the Jewish World”	Preserve these current exact location captions:

Atlanta, Georgia — “Rabbi Scheller teaching a large student group.”
Baltimore, Maryland — “Large live teaching session with students.”
Flatbush, New York — “Students gathered for Torah learning.”
Hollywood, Florida — “Classroom teaching with engaged boys.”
Lakewood, New Jersey — “Evening Torah gathering with Rabbi Scheller.”
Miami, Florida — “Large outdoor teaching event.”
Philadelphia, Pennsylvania — “Rabbi Scheller speaking to a full room.”
Silver Spring, Maryland — “Classroom learning with Rabbi Scheller.”	No bullets in rendered UI. Eight carousel slides.	Heading is ice blue. Active pagination indicator is yellow. Captions remain white/pale blue over a dark gradient.	Eight assets under /assets/one-time/rabbi/teaching-locations/, one per named location. Each image uses its recorded object-position and descriptive location alt text.	Previous, Next, Pause/Play, and eight pagination controls. No URL destination. Arrow keys and touch swipe must work.	One 16:9 main image plus a smaller preview of the next image. Auto-advance approximately every 5.6 seconds, pausing on hover/focus.	One full-width 16:9 image; next-image preview hidden. Swipe, controls, dots, keyboard, and reduced-motion behavior remain available.	Current implementation and source-to-destination asset map.
LP-62-PRESS	6.2, after gallery	“As Seen Across the Jewish World”	None.	No bullets. Exact logo sequence: TorahAnytime, 24Six, The Loop, NakiRadio, Mishpacha. Duplicate copies may be aria-hidden only to create a seamless loop.	No yellow text. Logos are transparent, understated, grayscale/brightened; surrounding rule lines may use pale blue.	/assets/one-time/press/torah-anytime.png
/assets/one-time/press/24six.png
/assets/one-time/press/the-loop.png
/assets/one-time/press/naki.webp
/assets/one-time/press/mishpacha.webp	None. Logos are not links unless verified destination URLs are separately configured. No endorsement is implied.	Continuous horizontal marquee inside the Rabbi section.	Same sequence; must remain readable without white logo cards. Reduced motion produces a static row/sequence.	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; current implementation and manifest.
LP-70-FINAL-CTA	7	“Ready to join the live class?”	None.	None.	CTA is a chrome/neon-yellow block with black text. No other words are yellow.	No required image. Restrained blue/yellow background illumination only.	One large “Sign Up Now” button to /one-time/signup.	Concise centered panel immediately before the footer.	Same centered stack, with no overflow or launcher overlap.	Exact later CTA packet and current implementation.
Authoritative page sequence
Sticky header

LP-00-CAMPAIGN-TICKER

LP-10-HERO

LP-20-RECEIVE

LP-30-GAIN

LP-40-HOW

LP-50-WHO

LP-60-RABBI, including LP-61-TEACHING-GALLERY and LP-62-PRESS

LP-70-FINAL-CTA

Canonical footer

The ticker’s top placement supersedes its older position above the footer. The final CTA is a later explicit addition.

2. Exact header contract
Header element	Exact contract
Container	Sticky at the top. Approximately 76px high on desktop and 68px on mobile. Black/near-black translucent background, fine yellow lower border, backdrop blur, and no heavy black shadow beneath the yellow controls.
Logo lockup	Home link to /one-time, accessible name “One Time Mishnayos home”. Header image: /images/one-time/brand/onetimelogo.webp; approximately 56×56 desktop, 50–54px mobile; object-fit contain; black-backed lockup. Visible text: “One Time Mishnayos” with subtitle “Worldwide Mishnah Learning.”
Visible desktop controls	Only the brand lockup, “Sign Up Now”, and hamburger are visible. Do not display a conventional horizontal section-navigation row. All section navigation remains in the drawer at every viewport.
Sign Up Now	Exact label “Sign Up Now”; destination /one-time/signup; minimum 48px desktop control height and approximately 42px on mobile; yellow/chrome treatment with black text. It remains enabled and visible in the top row.
Member Login	Not a separate visible top-row control. It appears inside the hamburger drawer and in the footer. Exact label “Member Login”; destination /rabbi-member.
Hamburger	Visible at all viewport widths. Initial accessible name “Open navigation”; aria-controls="siteDrawer"; aria-expanded="false". When open, the name changes to “Close navigation.” Minimum 44×44 target; current desktop size 48×48 and mobile size 42×42 must not be reduced further without retaining the 44×44 effective target.
Drawer exact heading	“One Time Menu”.
Drawer exact links and order	1. “What You Receive” → #receive
2. “What He’ll Gain” → #gain
3. “How It Works” → #how-it-works
4. “Who It’s For” → #who
5. “Rabbi Scheller” → #rabbi
6. “Member Login” → /rabbi-member
Drawer exact note	Preserve current exact note: “Live Mishnayos with Rabbi Eli Scheller from Eretz Yisrael.”
Drawer behavior	Right-side modal drawer, maximum width approximately 410px and no wider than 100vw - 24px; dark translucent black/blue background; pale-blue border/shadow; overlay closes it; close button closes it; Escape closes it; selecting a link closes it; keyboard focus is trapped while open; closing restores focus to the hamburger. The floating WhatsApp launcher is hidden while the drawer is open.
What remains visible at 360–390px	Logo image, “One Time Mishnayos”, the subtitle “Worldwide Mishnah Learning” in its compact two-line treatment, “Sign Up Now”, and hamburger. The subtitle must not be completely hidden. Member Login remains available through the drawer.
Initial mobile viewport CTA rule	At 360×800 and 390×844, the sticky-header “Sign Up Now” must be fully visible and unobscured on first paint. The Hero “Sign Up Now” must also be fully visible before scrolling, with safe clearance from bottom browser chrome and the fixed WhatsApp launcher. The page must not achieve this by hiding the logo, subtitle, or hamburger. The Hero CTA upward offset is an intentional preserved correction.
3. Exact footer contract
Footer element	Exact contract
Logo	White-on-black asset /assets/one-time/brand/one-time-logo-white.webp, rendered approximately 112×70, alt “One Time.”
Exact brand line	“One Time Mishnayos with Rabbi Eli Scheller.” This is the last recovered explicit canonical-footer sentence. The current sentence, “Worldwide Mishnah learning with Rabbi Eli Scheller.”, is an implementation discrepancy and must be repaired rather than treated as new approved copy.
Exact links and order	Home → /one-time
Sign Up Now → /one-time/signup
Privacy → /one-time/privacy.html
Terms → /one-time/terms.html
Member Login → /rabbi-member
Social links	Render social-media icons only when a verified real URL is configured. There are no verified social destination URLs in the inspected landing configuration; therefore no social icons are part of the current contract. Never use # placeholders.
Desktop layout	Dark layered black/blue footer with a fine top border. Brand block left; link navigation right; minimum-height approximately 172px; readable spacing.
Mobile layout	Brand image, exact line, and link group centered in a clean vertical stack. No horizontal overflow and no link hidden by the WhatsApp launcher.
Exclusions	No Rosh Hashanah ticker in the footer; no second giant yellow campaign band; no duplicate closing signup section; no unverified social icons; no BNA Academy branding.
Shared use	The same canonical footer content and visual treatment is used on /one-time/signup.
4. Shared visual and interaction invariants
Topic	Contract
One Time branding	Public name: One Time Mishnayos. Brand family is black plus yellow. Do not import the BNA cream/navy/teal/cyan palette.
Exact working palette	Page black #050505; deep blue-black #071117; authoritative yellow #EDE518; yellow-soft #FFF46A; white #FFFFFF; ice #DFF8FF; electric blue #86E8FF. No brown, amber, mustard, beige-gold, or dark-gold gradients.
Yellow scope	Yellow is a focal accent, not a default text color. Use it for CTA/ticker blocks, icons, rings, connectors, active pagination, restrained edges/glow, and the local-class supporting line. Card titles, body copy, hero copy, and section headings stay white or pale blue. No repository-backed production instruction was recovered that makes selected Receive labels yellow.
Typography	Display serif only for H1/H2: current stack Georgia, "Times New Roman", Times, serif. Sans-serif for body, navigation, forms, cards, and buttons: Inter with system fallbacks. Body copy must be at least 16px. Text must remain sharp; glow must not reduce readability.
Contrast	White/pale-blue copy on black or deep-blue surfaces; black copy on yellow controls. Muted copy must still meet WCAG 2.2 AA contrast. No color-only states.
Content width	Current canonical wrapper is 1180px maximum, with 36px aggregate side clearance on larger screens and 28px aggregate side clearance on mobile.
Section spacing	Major section block padding: clamp(52px, 6vw, 82px). Preserve the July 13 reduction; do not reintroduce oversized empty section gaps.
Card surfaces	Premium blue-black gradients, fine translucent ice-blue borders, restrained yellow details, inner highlight, real depth shadow, and small hover lift. Do not use plain white cards, generic stacked bars, casino-style chrome, or repeated identical rows without visual hierarchy.
Receive cards	Eight title-only cards; equal height within each row; identical icon size, padding, and title alignment; CSS Grid stretched rows. Do not add explanatory paragraphs beneath self-explanatory titles.
Benefit cards	Three equal-height editorial cards with consistent image ratio and aligned content regions.
Odd card counts	Render only real cards. Never add an empty or decorative “blank card” to complete a grid. At a two-column tablet breakpoint, the third Gain card naturally starts the next row in the first grid column. Do not invent a placeholder card or unrelated fourth benefit.
Responsive stacking	Receive composition and Rabbi composition stack at 920px and below. Gain and Who grids become two columns at 920px and below. All feature, benefit, audience, and step grids become one column at 680px and below, except the Receive feature grid remains two columns between 681px and 920px.
Bullet lists	No production-authoritative visual bullet list is part of the landing page. Receive content is a feature-tile grid; Gain is a three-card group; How It Works is a three-node journey; Who It’s For is an audience-card grid. Do not convert these to ordinary <ul> bullet panels.
Navigation drawer	The only expandable landing-page content is the navigation drawer. There are no accordion cards, expanding benefit cards, modal signup forms, or hidden detail drawers.
Filters	No landing-page filter control exists or is required. Do not add category, audience, gallery, or press filters.
CTA count	Exactly three large Sign Up Now buttons: Header, Hero, Final CTA. The ticker and footer may contain text links labeled Sign Up Now, but they must not be styled as additional large CTA blocks.
Motion	Hero entrance; once-only section reveals using opacity/transform; restrained card lift; ticker and press marquees; carousel auto-advance. No flashing, blinking, strobing, permanent bounce, or individually delayed body-copy fragments.
Reduced motion	Reveal content immediately; remove translating loops; ticker and press become static; carousel does not auto-advance; button sheen does not loop.
Carousel	Previous/next/pause/dots, ArrowLeft/ArrowRight, swipe threshold, hover/focus pause, stable 16:9 frame, no layout shift. It must also stop advancing while offscreen.
Press marquee	Must pause on hover and keyboard focus, and become static under reduced motion.
Accessibility	Semantic landmarks, skip link, exactly one H1, logical heading hierarchy, visible focus, keyboard-operable drawer/carousel, minimum 44×44 touch targets, useful image alt text, empty alt for decorative imagery, no forced motion, and usable at 200% zoom.
Images/performance	Explicit dimensions or aspect ratio for all content images. Lazy-load below-the-fold images, including noninitial carousel slides. Preserve focal points; never stretch. Target CLS below 0.1 and representative mobile LCP below 2.5 seconds where practical.
Floating WhatsApp	One standard green circular launcher, fixed bottom-right above safe-area insets; current size approximately 64px desktop and 58px at ≤420px. Accessible name “Open WhatsApp for One Time Mishnayos class information.” Hide while the navigation drawer is open. It must not cover CTA controls, carousel controls, form fields, or footer links.
5. Assets, URLs, SEO, analytics, and form destinations
5.1 Asset map
Use	Exact production asset and handling
Header logo	/images/one-time/brand/onetimelogo.webp; contained in black-backed header lockup.
Footer logo	/assets/one-time/brand/one-time-logo-white.webp; white artwork on dark footer.
Hero background	/assets/one-time/hero/hero-classroom-background.webp; decorative; center 48%; strong near-black/yellow/ice-blue overlay masks.
Receive student image	/assets/one-time/students/smiley-kid.png; circular crop; current alt “Smiling One Time Mishnayos student.” Public-photo permission remains subject to ME-02.
Gain — Clarity	/assets/one-time/outcomes/clarity-class.webp; alt “Rabbi Scheller teaching beside a Mishnah text display”; 50% 25% focal position.
Gain — Accomplishment	/assets/one-time/outcomes/accomplishment-lakewood-class.webp; alt “Rabbi Scheller learning with students around a classroom table”; 50% 48% focal position.
Gain — Excitement	/assets/one-time/outcomes/excitement-learning-torah.webp; alt “Students smiling during a One Time Torah learning class”; 50% 50% with scale(1.1).
Who background	/assets/one-time/backgrounds/who-its-for-norfolk-virginia.webp; decorative, dark overlay; 43% desktop/44% mobile focal position.
Rabbi profile	/assets/one-time/rabbi/rabbi-eli-holding-book.jpg; alt “Rabbi Eli Scheller holding the One Time book.”
Gallery	Eight exact assets listed in config/service-provider-sites/one-time.json and ops/ui-audits/2026-07-12-onetime-neon-landing-polish/ASSET-MAP.md.
Press	TorahAnytime, 24Six, The Loop, NakiRadio, Mishpacha assets under /assets/one-time/press/. Do not infer sponsorship or endorsement.
Robot Scheller	/assets/one-time/robot/robot-scheller-whatsapp.png is retained for scoped assistant surfaces, but it is not the public landing launcher. The landing uses the standard WhatsApp launcher.
5.2 URLs and actions
Action	Exact destination / behavior
Canonical landing	https://join.onetimeonetime.com/one-time
Public route	/one-time
Public aliases	/one-time-mishnayos and /one-time/mishnayos canonicalize to /one-time. In the dedicated single-tenant runtime, /, /index.html, /public, and /public/ also serve the One Time landing.
All landing Sign Up Now controls	/one-time/signup
Member Login	/rabbi-member
Privacy	/one-time/privacy.html
Terms	/one-time/terms.html
WhatsApp launcher	/api/one-time/public-whatsapp/redirect?intent=free_class, opened as a new tab with noopener noreferrer; no phone number in markup or repository evidence. If runtime configuration is absent, the server falls back to /one-time/signup.
Carousel controls	Local UI state only; no navigation destination.
No modal signup	Landing CTAs navigate directly to the signup route. Do not restore an inline quick-capture modal.
5.3 Exact SEO metadata
Field	Exact value
<title>	Give Your Son A Love For Learning Torah | One Time Mishnayos
Meta description	A live worldwide Mishnayos class with Rabbi Eli Scheller, built for boys to love learning Torah with clarity, excitement, and steady progress.
Robots	index, follow
Canonical	https://join.onetimeonetime.com/one-time
og:title	Give your son a love for learning Torah.
og:description	Join One Time Mishnayos live from Eretz Yisrael with Rabbi Eli Scheller.
og:url	https://join.onetimeonetime.com/one-time
og:image and secure URL	https://join.onetimeonetime.com/images/one-time/social/one-time-link-preview-icon.png
OG dimensions	1200 × 630
OG alt	One Time black and white logo
og:type	website
Twitter card	summary_large_image
Twitter image	Same link-preview icon URL
Theme color	#050505
Favicon	/images/one-time/social/one-time-icon-32.png
Apple touch icon	/images/one-time/social/one-time-apple-touch-icon.png
Evidence: public/one-time/index.html; exact values are also asserted by the focused landing test.

5.4 Analytics/performance telemetry
The landing loads only the first-party deferred script /js/one-time-performance-rum.js. It records route-load/transition timing, FCP, LCP, CLS, long-task duration, resource count/transfer size, viewport, connection type, and cold-start state. It sanitizes paths, allowlists query parameters, carries no_pii_contract: true, and sends same-origin telemetry to /api/performance/rum using sendBeacon or a keepalive POST. No third-party analytics script is part of the recovered landing contract.

5.5 Signup form contract and destination
All landing CTA paths terminate at /one-time/signup. The signup form must retain:

Field / behavior	Contract
Parent or contact name	Required. No student-name field.
Signing up as	Required choice: Family or School.
Location	Required free-text global location field; no fixed city-list match.
Time zone	Capture browser IANA time zone automatically; reveal a required manual IANA time-zone field only if detection fails.
Email	Required and validated.
Phone / WhatsApp	Optional unless reminder preference is WhatsApp or Both.
Reminder preference	Required: Email, WhatsApp, Both, or No daily reminders.
Consent	Required only when Email, WhatsApp, or Both is selected.
Submit label	“Sign Up Now”; loading label “Signing you up…”
API destination	POST /api/one-time/interest with JSON, idempotency key, attribution/referrer, location/timezone metadata, audience classification, and reminder consent.
Success heading	“You’re signed up.”
Success body	“We saved your information and will send the current class details using your selected option.”
Prohibited effects	The public page must not start payment, grant access, open private records, create a Zoom meeting, or expose member/provider/operations data.
6. Current discrepancy register
ID	Current state	Evidence-backed required state	Classification	Evidence paths
D-01	Receive currently uses the sentence “Everything a family or school…” and four inferred replacement labels.	Exact replacement sentence and labels are not recoverable. Do not certify current or older text as final.	DEFER	raw-input/RAW-20260713-007-onetime-landing-text-crop-followup.md; docs/INTENT-PRESERVATION-GATE.md; public/one-time/index.html.
D-02	Accomplishment currently uses “a real sense of finishing each day’s learning.”	Exact replacement for the older portal/badge paragraph is missing.	DEFER	raw-input/RAW-20260712-004-onetime-landing-visual-revision.md; commit 2f6768f3a; current landing.
D-03	How It Works currently uses “Sign up, get the class information…”	Exact replacement for the older “refining the technology…” sentence is missing.	DEFER	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; RAW-007; current landing.
D-04	tests/one-time-focused-landing.test.js positively asserts all three inferred copy changes and negatively forbids the older wording.	The test must not be treated as proof of operator intent. After exact copy is recovered, replace these assertions with the recovered strings and forbidden stale fingerprints.	DEFER	tests/one-time-focused-landing.test.js; intent gate.
D-05	Footer brand line is “Worldwide Mishnah learning with Rabbi Eli Scheller.”	Use the last exact canonical-footer line: “One Time Mishnayos with Rabbi Eli Scheller.”	REPAIR	raw-input/RAW-20260712-004-onetime-landing-visual-revision.md; landing and signup footer files.
D-06	A hidden .site-nav remains in the header DOM despite being display:none.	Drawer-only navigation at every viewport. Remove the dead hidden desktop-nav markup rather than maintaining two navigation definitions.	RETIRE	public/one-time/index.html; latest header packet.
D-07	Older instructions describe the full Robot Scheller character/widget as the landing launcher.	The later correction replaces that public widget with one standard, same-origin WhatsApp launcher and removes public helper-widget scripts. Robot assets remain available only outside the public landing.	REPLACE	ops/prompt-packets/2026-07-12-onetime-crm-portal-production-correction/05-landing-whatsapp-launcher.md; action registry.
D-08	Current post-deadline ticker branch continues to say “JOIN FREE UNTIL ROSH HASHANAH” after the target date.	On or after 2026-09-11 in Jerusalem, suppress the ticker unless exact replacement campaign copy is approved.	REPAIR	public/one-time/index.html; earlier exact countdown instruction.
D-09	config/service-provider-sites/one-time.json nav is ordered Rabbi Eli → Gain → Receive → Who → Member Login and omits How It Works.	Match the authoritative drawer order: Receive → Gain → How → Who → Rabbi Scheller → Member Login.	REPAIR	config/service-provider-sites/one-time.json; current drawer.
D-10	Provider config still names /images/one-time/social/one-time-og-20260622.jpg as the social OG asset.	Align config with the current canonical link-preview icon URL and dimensions used in page metadata/tests.	REPAIR	config/service-provider-sites/one-time.json; public/one-time/index.html.
D-11	Provider config’s press registry omits NakiRadio and uses older /images/ paths/labels.	Align it with the five current /assets/one-time/press/ assets and exact labels.	REPAIR	config/service-provider-sites/one-time.json; current landing/manifest.
D-12	Asset manifest records smilykid.png as held_back_child_permission, while the production landing uses /assets/one-time/students/smiley-kid.png.	Reconcile the manifest with the actual asset assignment and attach permission/provenance evidence. Do not falsely state that public marketing rights were verified.	DEFER	public/assets/one-time/one-time-asset-manifest.json; asset map; current landing.
D-13	All teaching-carousel images are marked loading="eager", and carousel auto-advance continues while offscreen.	Lazy-load below-the-fold/noninitial slides and suspend auto-advance while the carousel is offscreen.	REPAIR	public/one-time/index.html; durable performance packet.
D-14	Press marquee has reduced-motion handling but no explicit hover/focus pause.	Pause the logo marquee on pointer hover and keyboard focus, matching the interaction rule used by the ticker/carousel.	REPAIR	public/one-time/index.html; visual packet.
D-15	Intent-preservation fixtures contain synthetic instructions for nested bullet lists and selected yellow labels.	Do not apply those fixture instructions to the production landing. They test the intent-gate machinery; they are not One Time product authority.	RETIRE from the product contract	ops/intent-preservation/evals/generated/001-containment-versus-repetition/RAW.md; ops/intent-preservation/evals/generated/002-scoped-yellow-styling/RAW.md; docs/INTENT-PRESERVATION-GATE.md.
D-16	Current page has top ticker, exact Hero, required section order, three large CTAs, black/yellow/ice system, selected imagery, and drawer-only visible navigation.	These match the newest explicit visual and asset direction.	PRESERVE	public/one-time/index.html; raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; July 13 task register.
D-17	Current public landing uses the standard WhatsApp launcher with no full phone number in the page and no public helper scripts.	Preserve.	PRESERVE	public/one-time/index.html; launcher packet and action registry.
D-18	Current footer has no social-media icons.	Preserve until real URLs are configured.	PRESERVE	raw-input/RAW-20260712-005-onetime-neon-landing-polish.md; current footer.
D-19	Current metadata uses One Time-specific canonical, favicon, Apple icon, and link-preview image rather than shared Academy assets.	Preserve.	PRESERVE	public/one-time/index.html; focused landing test.
7. Acceptance criteria
7.1 360×800 mobile
Given	When	Then
The landing loads at a 360×800 CSS viewport with default motion settings.	First paint completes without scrolling.	The 68px sticky header shows the logo lockup, “One Time Mishnayos,” “Worldwide Mishnah Learning,” “Sign Up Now,” and hamburger without clipping or horizontal overflow.
The same viewport is at scroll position 0.	The Hero finishes its initial entrance.	Both the header CTA and Hero “Sign Up Now” are fully visible and enabled; neither is obscured by bottom browser chrome or the fixed WhatsApp launcher.
The hamburger has keyboard focus.	Enter or Space opens it.	The drawer fits within 100vw - 24px, focus moves into it, all six links are reachable, Tab is trapped, Escape closes it, and focus returns to the hamburger.
The full page is traversed.	Receive, Gain, How, Who, Rabbi, gallery, final CTA, and footer enter the viewport.	Cards stack in one column; the student image appears above Receive; the How connector is vertical; the gallery preview is absent; no fake blank cards appear; no content or footer link is covered by the launcher.
Reduced motion is enabled.	The page reloads.	Ticker and press movement stop, section content is immediately visible, and the carousel does not auto-advance.
7.2 390×844 mobile
Given	When	Then
The landing loads at 390×844.	First paint completes.	Logo/name/subtitle, header CTA, and hamburger remain visible on one compact header row; “Worldwide Mishnah Learning” is not hidden; no element extends beyond the viewport.
The page remains at the top.	The campaign ticker and Hero render.	The ticker appears exactly once below the header and scrolls with the page. Hero kicker lines are symmetrical, H1 and schedule are unclipped, and the Hero CTA is fully visible before scrolling.
The WhatsApp launcher is present.	The user opens the drawer or reaches any CTA/footer control.	The launcher hides while the drawer is open and never overlaps an actionable control, text-entry field, carousel control, or footer link.
The complete page is inspected.	Responsive layouts are applied.	Receive, Gain, How, and Who use one-column mobile layouts; all card widths and internal padding align; images retain the specified focal subjects; the footer is centered and stacked.
7.3 Tablet — 768×1024
Given	When	Then
The landing loads at 768×1024.	The header is rendered.	The same compact drawer-based header is used; no horizontal desktop-nav row becomes visible.
The content sections render.	The viewport reaches Receive and Gain.	Receive stacks the 240px circular image above a two-column feature grid. Gain uses two columns; its third card begins the next row in the first column with no blank placeholder card.
The viewport reaches How and Who.	Their grids are laid out.	How remains a three-node horizontal journey; Who uses two columns. No label wraps into an unusable or clipped state.
The viewport reaches Rabbi/gallery/footer.	Responsive rules apply.	Rabbi text and photo stack; the carousel displays one main image with the next-image preview hidden; the footer remains a readable two-column composition unless content wrapping requires a clean stack.
Keyboard and reduced-motion tests run.	Drawer, carousel, ticker, and press controls are exercised.	Focus remains visible, controls are operable, motion pauses correctly, and there is no horizontal scrolling at 100% or 200% zoom.
7.4 Desktop — 1440×900
Given	When	Then
The landing loads at 1440×900.	First paint completes.	The header is 76px, uses the compact logo/CTA/hamburger model, and does not expose the hidden horizontal navigation.
The top of the page is viewed.	Header, ticker, and Hero render.	The ticker sits directly below the header; Hero fills the first screen cleanly; background image, grid, orbital lines, and fades do not reduce copy contrast; the main CTA remains prominent.
The middle sections render.	Receive, Gain, How, and Who are inspected.	Receive uses image-plus-two-column-features; Gain is three equal cards; How is three connected nodes; Who is four aligned cards; no oversized empty regions or fake cards appear.
The Rabbi area renders.	Gallery auto-advance begins.	Rabbi text/photo use two columns; gallery shows one 16:9 main image plus the next-image preview; previous/next/pause/dots, keyboard, hover/focus pause, and offscreen suspension work without layout shift.
The final area renders.	Final CTA and footer are inspected.	There is one concise final CTA, then the canonical two-column footer. The WhatsApp launcher does not cover any footer link.
7.5 Functional Given/When/Then requirements at every viewport
Given	When	Then
Any element labeled “Sign Up Now” is activated.	Navigation occurs.	Destination is /one-time/signup; no inline modal, payment flow, access grant, or private portal is opened.
“Member Login” is activated from drawer or footer.	Navigation occurs.	Destination is /rabbi-member.
The WhatsApp launcher is activated.	Runtime configuration exists.	The same-origin redirect opens the configured One Time WhatsApp destination without exposing the full number in page source or repository evidence.
The WhatsApp launcher is activated.	Runtime configuration is missing.	The server falls back safely to /one-time/signup.
The page date reaches 2026-09-11 in Asia/Jerusalem.	The ticker updates.	The expired “Join free until Rosh Hashanah” promotion is not displayed.
The signup form is submitted with valid values.	The POST succeeds.	/api/one-time/interest receives the scoped payload and the exact success heading/body are shown.
The signup form is submitted with WhatsApp or Both selected but no phone.	Validation runs.	Submission is blocked and the phone field receives its exact error.
The signup form uses Email or No reminders.	Validation runs.	Phone remains optional.
Automated copy tests run while ME-01 remains unresolved.	A test attempts to certify current inferred replacement text as operator-approved.	The test must fail or remain explicitly blocked as unresolved rather than converting the inference into durable product intent.
8. MISSING EVIDENCE / USER DECISIONS
ME-01 — Exact July 13 landing replacement copy
The repository does not contain the earlier exact operator wording referenced by RAW-20260713-007. Exact final text is still required for:

The What You Receive supporting sentence.

Feature-tile labels for positions 2, 3, 4, and 8.

The Accomplishment benefit paragraph.

The How It Works supporting sentence.

The current deployment and test strings are agent-inferred. The older portal/dashboard/library/badge strings are explicit but were the subject of the later unspecified correction. Neither set is the recovered final contract.

ME-02 — Public-photo permission/provenance
Operator assignment is recorded for the Hero, Gain, Who, Rabbi, student, gallery, and press assets, but broader public-marketing permission is not consistently documented. The clearest unresolved conflict is smilykid.png: the manifest marks it held_back_child_permission, while the live page uses it. The construction contract must not claim verified licensing or child marketing permission until that evidence is attached. No unrelated stock or AI substitute is authorized.

ME-03 — Post–Rosh Hashanah campaign copy
No exact replacement campaign text exists for dates on or after September 11, 2026. The required noninventive fallback is to suppress the ticker. Any continued campaign requires separately supplied exact copy.

Short source index
Source path	Use in this contract
public/one-time/index.html	Current landing markup, exact deployed copy, assets, layout, drawer, ticker, carousel, footer, WhatsApp launcher, metadata.
raw-input/RAW-20260712-005-onetime-neon-landing-polish.md	Newest comprehensive header, ticker, section composition, CTA-count, responsive, and footer direction.
raw-input/RAW-20260712-004-onetime-landing-visual-revision.md	Exact Hero, benefit, Rabbi, local-audience, countdown, and canonical-footer copy.
raw-input/RAW-20260713-005-onetime-landing-image-addendum.md	Operator asset assignments and crop intent.
raw-input/RAW-20260713-007-onetime-landing-text-crop-followup.md	Verbatim vague operator message plus the later agent-compiled copy interpretation.
docs/INTENT-PRESERVATION-GATE.md at ref fd491084…	Newer record identifying RAW-007 as a real intent-regression and requiring exact-copy clarification.
tasks-pending/2026-07-13-onetime-landing-image-addendum.md	Live verification, deployment history, current image/crop and inferred-copy commit evidence.
tests/one-time-focused-landing.test.js	Current executable landing assertions and stale-copy prohibitions; implementation evidence, not independent proof of intent.
config/service-provider-sites/one-time.json	Identity, routes, CTA destinations, asset registry, gallery registry, and stale nav/OG/press discrepancies.
config/brands/one-time.json	Durable One Time black/yellow brand boundary.
ops/route-registry.json and ops/action-registry.json	Public-route, signup security, Member Login, WhatsApp redirect, and action contracts.
public/assets/one-time/one-time-asset-manifest.json	Asset dimensions, alt text, focal guidance, assignment, and provenance gaps.
ops/ui-audits/2026-07-12-onetime-neon-landing-polish/ASSET-MAP.md	Exact teaching-carousel source-to-production mapping.
public/one-time/signup.html	Direct-signup fields, validation, success copy, canonical footer, and /api/one-time/interest submission.
public/js/one-time-performance-rum.js	First-party, no-PII performance telemetry contract.
memory-topics/one-time-rabbi-sheller.md and memory-topics/brand-kits.md	Durable workspace isolation, black/yellow brand, and caution against unpublished portal/library claims.

