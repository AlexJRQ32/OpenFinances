#!/usr/bin/env python3
"""
Generate PWA icons and favicon for OpenFinances from a single source image.

Source:
  assets/icon-source.png        (brand icon, any square size)

Produces:
  public/icon-192.png           (192x192, solid bg — home screen / PWA)
  public/icon-512.png           (512x512, solid bg — home screen / PWA)
  public/icon-maskable-512.png  (512x512, symbol at 65% for maskable safe zone)
  public/apple-touch-icon.png   (180x180, solid bg — iOS home screen)
  public/favicon-196.png        (196x196, transparent — modern browser tab icon)
  app/favicon.ico               (16/32/48/64, transparent — classic favicon)

Requirements: Pillow (pip install pillow)
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install pillow", file=sys.stderr)
    sys.exit(1)


def _load_source(root: Path) -> Image.Image:
    """Load the source icon and center-crop to square."""
    src_path = root / "assets" / "icon-source.png"
    if not src_path.is_file():
        print(f"ERROR: source image not found at {src_path}", file=sys.stderr)
        sys.exit(1)
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    if w != h:
        # Center-crop to square
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
    return img


def _sample_bg_color(img: Image.Image) -> tuple[int, int, int]:
    """Sample the background color from the top-left corner pixel."""
    px = img.getpixel((0, 0))
    return (px[0], px[1], px[2])


def generate_regular(source: Image.Image, size: int, out: Path) -> None:
    """Resize source to size x size with LANCZOS."""
    resized = source.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(out, "PNG")
    print(f"  wrote {out} ({size}x{size})")


def generate_maskable(source: Image.Image, size: int, out: Path) -> None:
    """Maskable icon: bg color fill + 65%-scaled source centered (safe zone)."""
    bg_color = _sample_bg_color(source)
    canvas = Image.new("RGBA", (size, size), (*bg_color, 255))
    symbol_size = int(size * 0.65)
    symbol = source.resize((symbol_size, symbol_size), Image.Resampling.LANCZOS)
    offset = (size - symbol_size) // 2
    canvas.paste(symbol, (offset, offset), symbol)
    canvas.save(out, "PNG")
    print(f"  wrote {out} ({size}x{size}, maskable)")


def generate_favicon(source: Image.Image, out: Path) -> None:
    """ICO with 16x16, 32x32, 48x48 derived from the 512 render."""
    base = source.resize((512, 512), Image.Resampling.LANCZOS)
    base.save(out, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  wrote {out} (ICO: 16x16, 32x32, 48x48)")


# ---------------------------------------------------------------------------
# Transparent favicon pipeline
# ---------------------------------------------------------------------------

_LUM_T0 = 8    # below this luminance → fully transparent
_LUM_T1 = 30   # above this luminance → fully opaque
_CROP_THRESHOLD = 15  # luminance threshold for bounding-box crop
_CROP_PADDING = 0.06  # 6 % padding around the bounding box


def _remove_dark_bg(img: Image.Image) -> Image.Image:
    """Return a copy with the dark background removed.

    Pixels with luminance < T0 become fully transparent.
    Pixels between T0 and T1 get proportional alpha (soft glow preserved).
    Pixels above T1 stay fully opaque.
    """
    img = img.copy()
    pixels = img.load()
    w, h = img.size
    t0, t1 = _LUM_T0, _LUM_T1
    span = t1 - t0
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum <= t0:
                pixels[x, y] = (r, g, b, 0)
            elif lum < t1:
                alpha = int(255 * (lum - t0) / span)
                pixels[x, y] = (r, g, b, alpha)
            # else: keep original (fully opaque)
    return img


def _crop_to_symbol(img: Image.Image) -> Image.Image:
    """Crop to the bounding box of pixels with alpha > 0, plus padding."""
    # Find bounding box of non-transparent pixels
    bbox = img.getbbox()  # returns (left, upper, right, lower) or None
    if bbox is None:
        return img
    left, upper, right, lower = bbox
    bw = right - left
    bh = lower - upper
    pad_x = int(bw * _CROP_PADDING)
    pad_y = int(bh * _CROP_PADDING)
    left = max(0, left - pad_x)
    upper = max(0, upper - pad_y)
    right = min(img.width, right + pad_x)
    lower = min(img.height, lower + pad_y)
    return img.crop((left, upper, right, lower))


def _compute_symbol_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    """Compute bounding box of the symbol using luminance thresholds.

    Pixels with luminance > _CROP_THRESHOLD (15) are considered part of the
    symbol (bright wallet graphic). Returns (left, upper, right, lower) or
    None if no symbol pixels are found.
    """
    pixels = img.load()
    w, h = img.size
    threshold = _CROP_THRESHOLD
    min_x, min_y = w, h
    max_x, max_y = 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum > threshold:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
                found = True
    if not found:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


def _crop_to_symbol_solid(img: Image.Image, padding: float = 0.08) -> tuple[Image.Image, dict]:
    """Crop to the symbol bounding box + padding, keeping SOLID background.

    Unlike _crop_to_symbol (which uses alpha channel for transparent pipeline),
    this uses luminance thresholds to find the symbol and preserves the solid
    background pixels around it.

    Returns (cropped_image, stats_dict).
    """
    w, h = img.size
    bbox = _compute_symbol_bbox(img)
    if bbox is None:
        return img, {"bbox": (0, 0, w, h), "symbol_w": w, "symbol_h": h,
                     "src_w": w, "src_h": h, "fill_pct": 0.0}

    left, upper, right, lower = bbox
    bw = right - left
    bh = lower - upper
    pad_x = int(bw * padding)
    pad_y = int(bh * padding)
    left = max(0, left - pad_x)
    upper = max(0, upper - pad_y)
    right = min(w, right + pad_x)
    lower = min(h, lower + pad_y)

    cropped = img.crop((left, upper, right, lower))
    fill_pct = round(100 * (bw * bh) / (w * h), 1)

    stats = {
        "src_size": f"{w}x{h}",
        "bbox": (left, upper, right, lower),
        "bbox_raw": bbox,
        "symbol_w": bw,
        "symbol_h": bh,
        "src_w": w,
        "src_h": h,
        "crop_size": f"{cropped.width}x{cropped.height}",
        "fill_pct_before": fill_pct,
        "fill_pct_after": round(100 * (bw * bh) / (cropped.width * cropped.height), 1),
    }
    return cropped, stats


def _alpha_stats(img: Image.Image) -> dict:
    """Compute alpha-channel statistics for reporting."""
    pixels = img.load()
    w, h = img.size
    total = w * h
    fully_transparent = 0
    fully_opaque = 0
    semi = 0
    for y in range(h):
        for x in range(w):
            a = pixels[x, y][3]
            if a == 0:
                fully_transparent += 1
            elif a == 255:
                fully_opaque += 1
            else:
                semi += 1
    return {
        "size": f"{w}x{h}",
        "total": total,
        "fully_transparent": fully_transparent,
        "fully_opaque": fully_opaque,
        "semi_transparent": semi,
        "pct_transparent": round(100 * fully_transparent / total, 1),
        "pct_opaque": round(100 * fully_opaque / total, 1),
        "pct_semi": round(100 * semi / total, 1),
    }


def generate_transparent_favicon(source: Image.Image, ico_out: Path, png_out: Path) -> dict:
    """Generate transparent favicon.ico + favicon-196.png.

    Returns alpha stats for the 196 PNG.
    """
    # 1. Remove dark background
    transparent = _remove_dark_bg(source)

    # 2. Crop to symbol bounding box + padding
    cropped = _crop_to_symbol(transparent)

    # 3. Generate favicon-196.png (196x196, transparent)
    favicon_196 = cropped.resize((196, 196), Image.Resampling.LANCZOS)
    favicon_196.save(png_out, "PNG")
    stats = _alpha_stats(favicon_196)
    print(f"  wrote {png_out} (196x196, transparent)")

    # 4. Generate favicon.ico with sizes 16/32/48/64
    # Build each size from the cropped transparent source
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    ico_images = []
    for sz in ico_sizes:
        resized = cropped.resize(sz, Image.Resampling.LANCZOS)
        ico_images.append(resized)
    # Save ICO with multiple sizes
    ico_images[0].save(
        ico_out,
        format="ICO",
        sizes=[s for s in ico_sizes],
        append_images=ico_images[1:],
    )
    print(f"  wrote {ico_out} (ICO: 16x16, 32x32, 48x48, 64x64, transparent)")

    return stats


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    app_dir = root / "app"
    public_dir = root / "public"
    app_dir.mkdir(exist_ok=True)
    public_dir.mkdir(exist_ok=True)

    source = _load_source(root)
    print(f"Loaded source: {source.size[0]}x{source.size[1]}")

    # Compute tight crop around the symbol (solid bg, ~8% padding).
    # Reuses the same luminance thresholds as the transparent pass.
    tight, crop_stats = _crop_to_symbol_solid(source, padding=0.08)
    raw_bbox = crop_stats["bbox_raw"]
    print(
        f"Symbol bbox (lum>{_CROP_THRESHOLD}): "
        f"({raw_bbox[0]}, {raw_bbox[1]})-({raw_bbox[2]}, {raw_bbox[3]})  "
        f"symbol={crop_stats['symbol_w']}x{crop_stats['symbol_h']}  "
        f"src={crop_stats['src_w']}x{crop_stats['src_h']}"
    )
    print(
        f"Symbol fill in source: {crop_stats['fill_pct_before']}%  |  "
        f"Symbol fill in tight crop: {crop_stats['fill_pct_after']}%"
    )

    print("Generating OpenFinances icons from tight crop...")
    generate_regular(tight, 192, public_dir / "icon-192.png")
    generate_regular(tight, 512, public_dir / "icon-512.png")
    generate_maskable(tight, 512, public_dir / "icon-maskable-512.png")
    generate_regular(tight, 180, public_dir / "apple-touch-icon.png")
    generate_favicon(tight, app_dir / "favicon.ico")

    print("Generating transparent favicon pipeline...")
    stats = generate_transparent_favicon(
        source, app_dir / "favicon.ico", public_dir / "favicon-196.png"
    )
    print(f"  Alpha stats (favicon-196.png):")
    print(f"    Fully transparent: {stats['pct_transparent']}% ({stats['fully_transparent']}/{stats['total']})")
    print(f"    Fully opaque:      {stats['pct_opaque']}% ({stats['fully_opaque']}/{stats['total']})")
    print(f"    Semi-transparent:  {stats['pct_semi']}% ({stats['semi_transparent']}/{stats['total']})")
    print("Done.")


if __name__ == "__main__":
    main()
