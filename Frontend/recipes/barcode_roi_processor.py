import os
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from pyzbar.pyzbar import decode

RECIPES_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = RECIPES_DIR / "processed"
BACKEND_PROCESSED_DIR = RECIPES_DIR.parent.parent / "Backend" / "data" / "processed"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
BACKEND_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def locate_barcode_roi(image: np.ndarray) -> Tuple[Optional[Tuple[int, int, int, int]], Optional[str], Optional[str]]:
    """
    Locates barcode bounding box (x, y, w, h) and detected orientation.
    Returns: ((x, y, w, h), orientation, decoded_code)
    """
    h_orig, w_orig = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # 1. Direct PyZbar decode on grayscale
    decoded_objects = decode(gray)

    # 2. Try thresholding if direct grayscale fails (e.g. recipe2)
    if not decoded_objects:
        _, thresh = cv2.threshold(gray, 64, 255, cv2.THRESH_BINARY)
        decoded_objects = decode(thresh)

    # 3. Try Otsu thresholding
    if not decoded_objects:
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        decoded_objects = decode(otsu)

    if decoded_objects:
        obj = decoded_objects[0]
        r = obj.rect
        orientation = getattr(obj, "orientation", "UP")
        code = obj.data.decode("utf-8")
        return (r.left, r.top, r.width, r.height), orientation, code

    # 4. Fallback: Computer Vision Morphological Gradient to find 1D barcode stripes
    try:
        grad_x = cv2.Sobel(gray, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
        grad_y = cv2.Sobel(gray, ddepth=cv2.CV_32F, dx=0, dy=1, ksize=-1)
        gradient = cv2.subtract(grad_x, grad_y)
        gradient = cv2.convertScaleAbs(gradient)

        blurred = cv2.blur(gradient, (9, 9))
        _, thresh = cv2.threshold(blurred, 225, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 7))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        closed = cv2.erode(closed, None, iterations=4)
        closed = cv2.dilate(closed, None, iterations=4)

        contours, _ = cv2.findContours(closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            rect = cv2.boundingRect(c)
            return rect, "UP", None
    except Exception:
        pass

    return None, None, None


def process_and_crop_barcode(
    image_or_path: Any,
    output_filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extracts barcode ROI, rotates to standard horizontal reading format,
    enhances image, saves into processed directory, and decodes the barcode text.
    """
    if isinstance(image_or_path, (str, Path)):
        img_path = Path(image_or_path)
        image = cv2.imread(str(img_path))
        if image is None:
            raise FileNotFoundError(f"Failed to read image at: {img_path}")
        if output_filename is None:
            output_filename = img_path.name
    else:
        image = image_or_path.copy()
        if output_filename is None:
            output_filename = "processed_frame.png"

    h_orig, w_orig = image.shape[:2]
    rect, orientation, decoded_code = locate_barcode_roi(image)

    if rect is not None:
        rx, ry, rw, rh = rect
        # Add 10-15% quiet zone padding
        pad_x = max(24, int(rw * 0.10))
        pad_y = max(24, int(rh * 0.10))
        x1 = max(0, rx - pad_x)
        y1 = max(0, ry - pad_y)
        x2 = min(w_orig, rx + rw + pad_x)
        y2 = min(h_orig, ry + rh + pad_y)
        cropped = image[y1:y2, x1:x2].copy()
    else:
        # If no specific ROI detected, fallback to centered subregion
        cropped = image.copy()

    # Orientation correction: Ensure barcode lines are vertical and text is horizontal
    h_crop, w_crop = cropped.shape[:2]
    if orientation == "LEFT":
        cropped = cv2.rotate(cropped, cv2.ROTATE_90_CLOCKWISE)
    elif orientation == "RIGHT":
        cropped = cv2.rotate(cropped, cv2.ROTATE_90_COUNTERCLOCKWISE)
    elif orientation == "DOWN":
        cropped = cv2.rotate(cropped, cv2.ROTATE_180)
    elif h_crop > w_crop * 1.2:
        # Taller than wide -> Rotate 90 degrees to make it horizontal
        cropped = cv2.rotate(cropped, cv2.ROTATE_90_CLOCKWISE)

    # Standardize maximum viewing size for sharp, fast rendering
    ch, cw = cropped.shape[:2]
    if cw > 1200 or ch > 800:
        scale = min(1200 / cw, 800 / ch)
        cropped = cv2.resize(cropped, (int(cw * scale), int(ch * scale)), interpolation=cv2.INTER_AREA)

    # Save to both Frontend and Backend processed folders
    out_frontend = PROCESSED_DIR / output_filename
    out_backend = BACKEND_PROCESSED_DIR / output_filename
    cv2.imwrite(str(out_frontend), cropped)
    cv2.imwrite(str(out_backend), cropped)

    # Decode from the processed cropped image
    test_gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    decoded_final = decode(test_gray)
    if not decoded_final:
        _, th = cv2.threshold(test_gray, 64, 255, cv2.THRESH_BINARY)
        decoded_final = decode(th)

    final_code = decoded_final[0].data.decode("utf-8") if decoded_final else (decoded_code or "")

    return {
        "code": final_code,
        "processed_image": cropped,
        "processed_path": str(out_frontend),
        "filename": output_filename,
        "status": "OK" if bool(final_code) else "NOK",
        "rect": rect,
    }
