import cv2
from pyzbar.pyzbar import decode
from pathlib import Path

img_dir = Path(__file__).resolve().parent.parent / "Frontend" / "recipes" / "images"
print(f"Scanning directory: {img_dir}")
for f in img_dir.glob("*.png"):
    img = cv2.imread(str(f))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    dec = decode(gray)
    if not dec:
        _, th = cv2.threshold(gray, 64, 255, cv2.THRESH_BINARY)
        dec = decode(th)
    codes = [d.data.decode("utf-8") for d in dec]
    print(f"File: {f.name} -> Decoded Code: {codes}")
