# V2 landing page visual review

Captured October 22, 2026 at exact 1440px and 390px browser widths. Each image places the approved Figma frame on the left and the local implementation on the right. The mobile hero comparison omits the site's 76px navigation header because the Figma hero frame begins below navigation. The holiday floating CTA is hidden in these captures so the underlying layout can be compared; it was checked separately as an interaction state.

| View | Comparison |
| --- | --- |
| Desktop hero | [desktop-hero.jpg](desktop-hero.jpg) |
| Mobile hero | [mobile-hero.jpg](mobile-hero.jpg) |
| Desktop services | [desktop-services.jpg](desktop-services.jpg) |
| Mobile services | [mobile-services.jpg](mobile-services.jpg) |

The hero typography, image placement, button order, mobile facts, and service card composition closely track Figma. The desktop content spans more of the viewport by design: the production container remains 1360px, as requested. The desktop services section is also taller because its wider cards retain readable image and text proportions. The mobile hero image begins about 14px lower than in the reference; the mobile services section height differs by about 14px.

Browser checks covered 1440, 1024, 768, 430, 390, 375, and 320px widths with no horizontal overflow or page errors. A full mobile scroll found no broken image requests. These checks did not submit live forms or open the external booking destination.

Release copy needs founder confirmation for insurance, bonding, background checks, cleaning guarantee, pricing, and booking availability. The campaign is enabled immediately; the November and December dates are appointment windows. The only approved ZenMaid destination supplied for this V2 implementation is the holiday booking URL; the final refinement brief directs all general Request a Cleaning links to that same destination.

## Targeted refinement review

Captured October 22, 2026 after the targeted V2 refinements. Compare these local captures with the [desktop](https://www.figma.com/design/eqKrTCbiBByKMwmApQBVje/Mirembe-Cleaning?node-id=58-1411), [mobile](https://www.figma.com/design/eqKrTCbiBByKMwmApQBVje/Mirembe-Cleaning?node-id=62-2041), [holiday](https://www.figma.com/design/eqKrTCbiBByKMwmApQBVje/Mirembe-Cleaning?node-id=67-3746), and [service/FAQ interaction](https://www.figma.com/design/eqKrTCbiBByKMwmApQBVje/Mirembe-Cleaning?node-id=67-3747) frames. The desktop drawer's viewport inset and the 1360px production container intentionally differ from Figma.

| Component | Desktop | Mobile |
| --- | --- | --- |
| Floating holiday CTA | [1440px](refinements/v2_cta_1440.png) | [390px](refinements/v2_cta_390.png), [320px compact](refinements/v2_cta_320.png) |
| Holiday modal | [1440px open](refinements/v2_modal_1440.png) | [390px open](refinements/v2_modal_390.png), [320px scrolled](refinements/v2_modal_320_scrolled.png) |
| Service drawer | [1440px floating](refinements/v2_drawer_1440.png) | [390px sheet](refinements/v2_drawer_390.png) |
| How It Works | [1440px](refinements/v2_how_viewport_1440.png) | [390px](refinements/v2_how_viewport_390.png) |
| Timeline scroll states | [start](refinements/v2_timeline_1440_0.png), [middle](refinements/v2_timeline_1440_0.5.png), [end](refinements/v2_timeline_1440_1.png) | [start](refinements/v2_timeline_390_0.png), [middle](refinements/v2_timeline_390_0.5.png), [end](refinements/v2_timeline_390_1.png) |
| FAQ | [1440px](refinements/v2_faq_viewport_1440.png) | [390px](refinements/v2_faq_viewport_390.png) |
| Footer | [1440px](refinements/v2_footer_viewport_1440.png) | [390px](refinements/v2_footer_viewport_390.png) |

Browser checks covered 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px widths without horizontal overflow or page errors. The holiday modal opened after four seconds with the legacy localStorage key set, opened again after refresh, closed with Escape, deferred behind the waitlist dialog, and scrolled correctly at 320px while its actions remained visible. The booking link pointed to the dedicated holiday ZenMaid URL. FAQ expansion remained single-open; the footer hiring button opened the existing application dialog. Scroll positions at 0%, 50%, and 100% produced matching timeline progress and step states; reduced motion displayed all steps statically. No live submissions were made.

## Final UX and engineering refinements

The latest browser captures show the glass holiday CTA on light and dark sections, the request link moved directly beneath the service cards, and the centered waitlist close icon. The desktop content still uses the 1360px production container.

| View | Desktop | Mobile |
| --- | --- | --- |
| Glass CTA on a light section | [1440px](final-refinements/final_glass_cta_1440.png) | [390px](final-refinements/final_glass_cta_390.png), [320px compact](final-refinements/final_glass_cta_320.png) |
| Glass CTA on How It Works | [1440px](final-refinements/final_glass_on_dark_1440.png) | [390px](final-refinements/final_glass_on_dark_390.png) |
| Services cards and request link | [1440px](final-refinements/final_services_request_1440.png) | [390px](final-refinements/final_services_request_390.png) |
| Waitlist modal close control | [1440px](final-refinements/final_waitlist_1440.png) | [390px](final-refinements/final_waitlist_390.png) |

At 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px, the service-card-to-request gap measured 16–24px, with no horizontal overflow or page errors. Native anchor navigation updated the hash and active link for Services, Why Mirembe, Areas We Serve, and FAQ; the mobile menu closed after selection. Direct `#faq` visits and browser back/forward navigation restored the matching active link. Reduced motion disabled smooth scrolling. The waitlist close SVG measured exactly centered inside its 44px button and Escape dismissal still worked. Every general Request a Cleaning link used the existing ZenMaid holiday booking URL with new-tab attributes. No live bookings or forms were submitted.
