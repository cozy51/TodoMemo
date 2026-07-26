from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "icons" / "todomemo-icon-source.png"
OUTPUT_DIR = ROOT / "assets" / "icons"
SIZES = (16, 32, 48, 128)


def is_connected_background(pixel):
    red, green, blue, _alpha = pixel
    return min(red, green, blue) >= 218 and max(red, green, blue) - min(red, green, blue) <= 18


def remove_connected_background(image):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue = deque()
    visited = bytearray(width * height)

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        offset = y * width + x
        if visited[offset]:
            continue
        visited[offset] = 1

        pixel = pixels[x, y]
        if not is_connected_background(pixel):
            continue

        minimum = min(pixel[:3])
        alpha = 0 if minimum >= 250 else round(255 * (250 - minimum) / 32)
        pixels[x, y] = (*pixel[:3], max(0, min(255, alpha)))

        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    return rgba


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    icon = remove_connected_background(Image.open(SOURCE))
    master = icon.resize((1024, 1024), Image.Resampling.LANCZOS)
    master.save(OUTPUT_DIR / "todomemo-icon-1024.png", optimize=True)
    print("Wrote assets/icons/todomemo-icon-1024.png")

    for size in SIZES:
        resized = icon.resize((size, size), Image.Resampling.LANCZOS)
        output = OUTPUT_DIR / f"icon-{size}.png"
        resized.save(output, optimize=True)
        print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
