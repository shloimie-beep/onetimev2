# One Time Operator Decision Override — Legacy Website as Free-Content Funnel

**Decision ID:** `OT-CTRL-20260816-LEGACY-FREE-CONTENT-FUNNEL`  
**Decision date:** 2026-08-16  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR DECISION — SOURCE OF TRUTH**  
**Integration authority:** PR #131 only

## Decision

The legacy/old One Time website remains a **public free-content website**.

Its purpose is discovery, sharing, organic traffic, and relationship-building through free material such as approved jokes, short Torah content, stories, clips, selected public learning material, and other shareable Rabbi Eli content.

The legacy site is not the paid application and must not become a second member portal, second account system, or second protected content library.

## Funnel role

Canonical customer path:

```text
Legacy public free-content website
→ clear One Time Mishnayos invitation
→ join.onetimeonetime.com landing/signup funnel
→ authenticated paid/free-trial application at app.onetimeonetime.com
```

The legacy site should contain clear, measured calls to action such as:

- `GET FREE ACCESS`
- `SEE ONE TIME MISHNAYOS`
- `JOIN THE LIVE CLASS`
- `MISHNAYOS MADE MEMORABLE`

All conversion CTAs must link to the canonical join/landing flow, not directly to raw Zoom, Vimeo, Drive, payment-provider, or private application resources.

## Content boundary

Allowed on the legacy public site:

- approved jokes and light Rabbi Eli content;
- short public Torah clips;
- selected stories and excerpts;
- approved public promotional videos;
- public samples or previews;
- shareable social/SEO content;
- testimonials or public proof when approved;
- links into the canonical One Time landing funnel.

Not allowed on the legacy public site:

- raw Zoom links;
- raw Vimeo/Drive links;
- protected paid lessons;
- Student credentials or private Student data;
- Parent/Student account management;
- private questions or Rabbi replies;
- duplicate checkout, billing, authentication, or member-library systems;
- claims that conflict with the current paid/free-access offer.

## Attribution

Every funnel link from the legacy site should carry stable attribution, for example:

```text
utm_source=legacy_site
utm_medium=organic_content
utm_campaign=ot_launch_2026_free_access
utm_content=<stable-content-or-creative-id>
```

First/latest attribution and stable creative/content IDs must survive through signup so the legacy site can be measured as a distinct acquisition source.

## Product and domain boundary

- `join.onetimeonetime.com` remains the canonical conversion/signup destination.
- `app.onetimeonetime.com` remains the authenticated product.
- The exact legacy domain/deployment must be identified and recorded before DNS, hosting, redirects, or production content changes.
- This decision alone authorizes no DNS, hosting, deployment, or content migration effect.

## Acceptance

Before treating the legacy site as an active funnel, prove:

1. the exact legacy domain and deployment owner;
2. public pages contain no protected or private resource;
3. primary CTA reaches the canonical landing page;
4. UTM/content attribution survives to Family signup;
5. mobile and desktop CTA paths work;
6. no duplicate account/login/payment system is exposed;
7. public content rights and Student-media permissions are valid;
8. the paid app and current launch offer remain the only conversion source of truth.

## Integration boundary

PR #183 records this decision only. Product, DNS, hosting, analytics, and legacy-site changes must be assigned and integrated through PR #131 or the separately identified legacy-site repository after the controller confirms ownership and non-overlap.