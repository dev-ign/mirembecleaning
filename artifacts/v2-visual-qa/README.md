# V2 landing page visual review

Captured October 22, 2026 at exact 1440px and 390px browser widths. Each image places the approved Figma frame on the left and the local implementation on the right. The mobile hero comparison omits the site's 76px navigation header because the Figma hero frame begins below navigation. The holiday floating CTA is hidden in these captures so the underlying layout can be compared; it was checked separately as an interaction state.

| View | Comparison |
| --- | --- |
| Desktop hero | [desktop-hero.jpg](desktop-hero.jpg) |
| Mobile hero | [mobile-hero.jpg](mobile-hero.jpg) |
| Desktop services | [desktop-services.jpg](desktop-services.jpg) |
| Mobile services | [mobile-services.jpg](mobile-services.jpg) |

The hero typography, image placement, button order, mobile facts, and service card composition closely track Figma. The desktop content spans more of the viewport by design: the production container remains 1360px, as requested. The desktop services section is also taller because its wider cards retain readable image and text proportions. The mobile hero image begins about 14px lower than in the reference; the mobile services section height differs by about 14px.

Browser checks covered 1440, 1024, 768, 430, 390, 375, and 320px widths with no horizontal overflow or page errors. A full mobile scroll found no broken image requests. The holiday modal, returning-visitor behavior, floating CTA dismissal, service drawer, and single-open FAQ were exercised in the browser. These checks did not submit live forms or open the external booking destination.

Release copy needs founder confirmation for insurance, bonding, background checks, cleaning guarantee, pricing, and booking availability. The campaign starts October 22 in code because the handoff says holiday appointments are already accepted; the Figma note gives November 1. The permanent generic booking URL remains unconfirmed, so generic Request a Cleaning buttons keep the existing informational toast. The holiday URL is used only by holiday promotional controls.
