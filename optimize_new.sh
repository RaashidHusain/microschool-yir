#!/bin/bash
# Optimize the newly-added photos (IMG_*.jpeg / "JPEG image-*.jpeg" dropped into
# images/) into the existing photo-N.jpg scheme, continuing from index 294.
#  - web copy: re-encoded JPEG q72 (no upscale; originals are already <=1400px)
#  - thumb:    <=500px JPEG q60
# Originals are moved to originals_2026/ (kept out of the deploy via .vercelignore).
set -u
cd /Users/raashid/MicroMuhammad
mkdir -p originals_2026

n=294
count=0
while IFS= read -r f; do
  src="images/$f"
  [ -f "$src" ] || continue
  sips -s format jpeg -s formatOptions 72        "$src" --out "images/photo-$n.jpg" >/dev/null 2>&1 \
    && sips -s format jpeg -s formatOptions 60 -Z 500 "$src" --out "thumbs/photo-$n.jpg" >/dev/null 2>&1
  if [ -f "images/photo-$n.jpg" ] && [ -f "thumbs/photo-$n.jpg" ]; then
    mv "$src" "originals_2026/$f"
    n=$((n+1)); count=$((count+1))
  else
    echo "FAILED: $f"
  fi
done < <(ls images/ | grep -vE '^photo-|^manifest' | sort)

echo "Converted $count new photos. Indices now 0..$((n-1)) (total $n)."

# Rebuild the manifest from whatever photo-N.jpg files exist.
python3 - <<'PY'
import json, os
idx=[i for i in range(2000) if os.path.exists(f"images/photo-{i}.jpg")]
json.dump({"count":len(idx),"photos":idx}, open("images/manifest.json","w"))
print("manifest:", len(idx), "photos")
PY
