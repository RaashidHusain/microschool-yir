# MicroMuhammad 🌟

A fun, kid-friendly photo journey through our class — styled clean and full-bleed
(à la tesla.com) with a Tesla skeleton and playful, colorful touches.

## What's inside
- **Auto slideshow** — the hero background and the "Our Story" player cycle through
  the photos all by themselves.
- **Gallery** — every photo as a tappable, lazy-loaded thumbnail.
- **Lightbox** — tap any photo to view big; arrow keys / on-screen arrows to move,
  plus its own ▶ Slideshow button.
- **Kid fun** — rotating captions, count-up stats, a "Surprise me 🎉" confetti button.

## Files
```
index.html      markup
styles.css      Tesla-clean + playful styling
app.js          slideshow / gallery / lightbox / confetti logic
images/         web-optimized photos (≤1400px)  ← deployed
thumbs/         small grid thumbnails (≤500px)  ← deployed
images/manifest.json   list of available photo indices
JPEG image-*.JPEG      ORIGINAL full-res photos (NOT deployed — see .vercelignore)
```

## Regenerating optimized images
If you add more `JPEG image-*.JPEG` originals, re-run the optimizer (macOS `sips`):

```bash
ls -1 JPEG\ image-*.JPEG | while read f; do
  n=$(echo "$f" | sed 's/.*-\([0-9]*\)\.JPEG/\1/')
  sips -s format jpeg -s formatOptions 72 -Z 1400 "$f" --out "images/photo-$n.jpg"
  sips -s format jpeg -s formatOptions 60 -Z 500  "$f" --out "thumbs/photo-$n.jpg"
done
# then rebuild the manifest:
python3 - <<'PY'
import json, os
idx=[i for i in range(1000) if os.path.exists(f"images/photo-{i}.jpg")]
json.dump({"count":len(idx),"photos":idx}, open("images/manifest.json","w"))
PY
```

## Deploy to Vercel
This is a zero-config static site.

```bash
npm i -g vercel   # if you don't have it
vercel            # preview deploy
vercel --prod     # production
```

Or push to a Git repo and "Import Project" on vercel.com — no build settings needed
(Framework Preset: **Other**, Output Directory: leave default / root).
