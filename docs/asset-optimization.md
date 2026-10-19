# Production image assets

The page uses `public/hero.webp` as a decorative `<img>` with the existing CSS crop. `public/hero.png` remains the absolute Open Graph and X/Twitter image. The brand mark uses `public/icon.png` for the header and Organization logo URL; `public/favicon.png` is a small 64 × 64 export for the browser tab. The original artwork is retained at `assets/source/mirembe-logo-original.svg`, outside Vite's `public/` directory, so it is not copied to the production output.

The original 112 × 112 SVG has no vector paths. Its only artwork is a 2,000 × 2,000 embedded PNG in a pattern. A 448 × 448 PNG retains four physical pixels for each pixel of the SVG's nominal size and at least five for the site's largest 80 CSS-pixel display. It avoids an SVG wrapper and a 1.1 MB download. The 64-pixel favicon avoids a second request for the full header logo. The logo was compared visually at 58, 80, 112, 224, and 336 physical pixels. Downsampling means the new image is not pixel-identical to a browser scaling the 2,000-pixel source, but the paired renders showed no visible change to color, edges, spacing, or transparency.

| Asset | Original | Production | Change |
| --- | ---: | ---: | ---: |
| Hero PNG → lossless WebP | 1,801,315 B | 1,198,222 B | −603,093 B (33.5%) |
| Raster-wrapped logo SVG → 448 px PNG | 1,156,033 B | 108,364 B | −1,047,669 B (90.6%) |

The favicon is a separate 7,189-byte export of the same artwork. Its savings should not be added to the logo row because both previously used the same SVG file.

The hero WebP and PNG decode to the same 1,672 × 941 RGB pixels: ImageMagick's absolute-error count is zero. The hero is not resized or recompressed at build time. No mobile hero variant was added: the existing CSS uses different crops at mobile and tablet sizes, and a smaller source would need validation at high device pixel ratios before it could replace the 1,672-pixel original. The decorative image keeps empty alt text. The browser discovers it from the generated HTML and the existing `fetchPriority="high"` attribute; no second URL is requested for a preload.

To reproduce from the retained sources with `cwebp` 1.4.0 and ImageMagick 7.1.1-32:

```sh
cwebp -lossless -quiet public/hero.png -o public/hero.webp
python3 - <<'PY'
from pathlib import Path
import base64, re
svg = Path('assets/source/mirembe-logo-original.svg').read_text()
image = re.search(r'data:image/png;base64,([^"\']+)', svg)
assert image and svg.count('<image') == 1 and '<path' not in svg
Path('/tmp/mirembe-logo-source.png').write_bytes(base64.b64decode(image.group(1)))
PY
magick /tmp/mirembe-logo-source.png -filter Lanczos -resize 448x448 -strip -define png:compression-level=9 public/icon.png
magick /tmp/mirembe-logo-source.png -filter Lanczos -resize 64x64 -strip -define png:compression-level=9 public/favicon.png
dwebp public/hero.webp -o /tmp/mirembe-hero-decoded.png
magick compare -metric AE public/hero.png /tmp/mirembe-hero-decoded.png null:
```

The local browser comparison used separate loopback origins, the same application and layout, a 1,280 × 800 viewport at device pixel ratio 1, and a temporary `Cache-Control: no-store` server. The browser's PerformanceObserver reported the hero-description paragraph as desktop LCP in both builds. At 390 × 844, the hero image was LCP in both builds, supporting its existing high fetch priority. Same-origin initial transfer at 1,280 × 800 was 4,066,443 B before and 1,870,020 B after, a 2,196,423 B (54.0%) reduction. The no-store setup transferred the old full logo again as the favicon, exaggerating savings relative to normal caching. The optimized build requests a distinct 7,189-byte favicon. Both builds made 16 same-origin requests, including three image requests (hero, page logo, and favicon) and ten font requests. Desktop LCP observations varied from roughly 100 to 124 ms in both builds; desktop CLS was about 0.0002–0.0003. Mobile LCP was 132 ms before and 104 ms after in these loopback samples, while CLS was about 0.016–0.020. These observations are too variable and local to establish a Core Web Vitals improvement. Decode timing, actual network request priority, browser rendering at high device pixel ratio, and field LCP/CLS still need measurement after deployment.

The page was visually reviewed before and after at 1,440 × 900, 1,280 × 800, 768 × 1,024, 390 × 844, and 375 × 667. The CSS crop and positioning were unchanged. Keep the PNG social image until a separately approved share card is designed and validated.
