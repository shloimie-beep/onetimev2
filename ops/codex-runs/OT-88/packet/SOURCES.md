# Official Source Register

Accessed: 2026-07-15

The packet paraphrases these sources. It does not vendor Zoom code or copy large documentation passages.

## Sources required by the OT-88 specification

1. Zoom Meeting SDK for Web overview  
   https://developers.zoom.us/docs/meeting-sdk/web/

2. Zoom Meeting SDK Web client view  
   https://developers.zoom.us/docs/meeting-sdk/web/client-view/

3. Zoom Meeting SDK Web component-view supported features  
   https://developers.zoom.us/docs/meeting-sdk/web/component-view/supported/

4. Official Zoom Meeting SDK React sample  
   https://github.com/zoom/meetingsdk-react-sample

5. Official Zoom Meeting SDK auth endpoint sample  
   https://github.com/zoom/meetingsdk-auth-endpoint-sample

## Additional official Zoom references used for implementation decisions

6. Component view overview  
   https://developers.zoom.us/docs/meeting-sdk/web/component-view/

7. Browser support and CSP guidance  
   https://developers.zoom.us/docs/meeting-sdk/web/browser-support/

8. Client-view meetings/webinars and registration-token join  
   https://developers.zoom.us/docs/meeting-sdk/web/client-view/meetings-webinars/

9. Component-view meetings/webinars and registration-token join  
   https://developers.zoom.us/docs/meeting-sdk/web/component-view/meetings-webinars/

10. Meeting SDK Web error codes  
    https://developers.zoom.us/docs/meeting-sdk/web/error-codes/

11. Current Meeting SDK Web reference landing page  
    https://marketplacefront.zoom.us/sdk/meeting/web/index.html

12. Client-view `ZoomMtg.init` reference, including invite/header controls  
    https://marketplacefront.zoom.us/sdk/meeting/web/functions/ZoomMtg.init.html

13. Component-view initialization/customization options  
    https://marketplacefront.zoom.us/sdk/meeting/web/components/interfaces/InitOptions.html

14. Component-view event listener reference  
    https://marketplacefront.zoom.us/sdk/meeting/web/components/functions/EmbeddedClient.on.html

15. Zoom support: pinning participant videos  
    https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065767

16. Zoom support: spotlighting participant videos  
    https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066300

## Claim map

| Engineering claim | Primary source(s) |
|---|---|
| The Meeting SDK embeds Zoom meetings/webinars in a web page and offers client and component views. | 1, 6, 11 |
| Meeting SDK use is for human participation, not bots or AI notetakers. | 1, 2, 6 |
| Client view is the recommended mobile/tablet implementation. | 1, 2, 7 |
| Component view is desktop-oriented and has feature differences from client view. | 1, 3, 6, 7 |
| A backend-generated Meeting SDK JWT is required; the SDK secret stays server-side. | 4, 5, 11 |
| Participant joins use role `0`; starting as host requires host authorization. | 4, 5, 9, 11 |
| Registration-required joins use the registrant token (`tk`) obtained server-side. | 4, 8, 9, 11 |
| Client view exposes controls to disable invite and hide the meeting header. | 12 |
| Component view exposes customization surfaces, but exact privacy-safe behavior must be verified against the installed SDK and account settings. | 3, 13 |
| SDK error codes distinguish host-not-started, reconnecting, ended, capacity, locked, blocked-by-admin, and unsupported-version states. | 10 |
| Component view exposes connection, join-speed, network-quality, and participant events useful for minimized telemetry. | 14 |
| Pinning affects the viewer’s local view; spotlighting is a host/co-host control that changes what participants see. | 15, 16 |

## Reverification rule

Zoom enforces a minimum SDK version policy and changes account authorization behavior over time. The Codex run must re-open the official documentation, inspect the version actually installed in the One Time repository, and record the checked version/date in `ops/codex-runs/OT-88/STATE.json`. Do not treat this packet as a version pin.
