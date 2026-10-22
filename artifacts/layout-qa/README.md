# Landing layout QA — 2026-10-21

Preview: `http://127.0.0.1:4174/` on the `extended-landing` branch, captured in the Codex in-app browser. Source identity: `src/landing.css` SHA-256 `14a0764924f43a2cd122597fdd87b1351ae1b0bad8941e9983c3bfc18ab17a66`; `LandingPage.tsx` SHA-256 `12692f07bef2c2ad409a04dc1a969c4fa755e93d087144a39284fd0a7c81b83d`.

| Surface and state | Viewport | Evidence | Result |
| --- | --- | --- | --- |
| Hero, default | 1440 × 1000 | `hero-after-1440.png` | Widened columns, readable copy, no clipped imagery |
| FAQ, first answer expanded | 1440 × 1000 | `faq-after-1440.png` | Accordion fills 1348px content container; controls align right |
| Services, default | 640 × 950 | `services-after-640-final.png` | Single column, card text and image fit |
| Why Mirembe, default | 768 × 1000 | `why-after-768-final.png` | Image and content stack before columns get cramped |
| FAQ, first answer expanded | 390 × 900 | `faq-after-390.png` | Rows and dividers span 350px content container |
| Areas, default | 390 × 900 | `areas-after-390-settled.png` | Region cards stack without clipping |
| Footer, default | 390 × 900 | `footer-after-390-final.png` | One column; waitlist button measures 182 × 54px |
| Services, default | 320 × 850 | `services-after-320-final.png` | Card grows to 400px; content fits |

DOM layout checks also covered 1280, 1101, 1024, 710, 709, 600, 599, 430, and 375px. All measured document widths matched their viewports. Browser interactions confirmed FAQ `aria-expanded` changes, mobile navigation opening/closing, the waitlist dialog opening/closing, request feedback, and the ZIP action's initial disabled state. These checks did not submit any external form.
