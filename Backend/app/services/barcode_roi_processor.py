import os
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from pyzbar.pyzbar import decode

SERVICES_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SERVICES_DIR.parent.parent
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
FRONTEND_PROCESSED_DIR = BACKEND_DIR.parent / "Frontend" / "recipes" / "processed"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
FRONTEND_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Re-use detector instance for zero initialization latency
_BARCODE_DETECTOR = cv2.barcode.BarcodeDetector() if hasattr(cv2, 'barcode') else None
_QR_DETECTOR = cv2.QRCodeDetector() if hasattr(cv2, 'QRCodeDetector') else None


def _clean_code(val: Any) -> Optional[str]:
    """Extracts clean non-empty barcode string from detector result."""
    if val is None:
        return None
    if isinstance(val, (list, tuple)):
        for item in val:
            if item and str(item).strip():
                return str(item).strip()
    elif isinstance(val, str) and val.strip():
        return val.strip()
    return None


def locate_barcode_roi(image: np.ndarray) -> Tuple[Optional[Tuple[int, int, int, int]], Optional[str], Optional[str]]:
    """
    Locates barcode bounding box (x, y, w, h) and detected orientation with high performance.
    Returns: ((x, y, w, h), orientation, decoded_code)
    """
    if image is None or image.size == 0:
        return None, None, None

    h_orig, w_orig = image.shape[:2]

    # Pre-scale for rapid C++ detection (prevents 18-second freezes on 4K/12MP mobile photos)
    scale = min(1.0, 1600.0 / max(h_orig, w_orig))
    if scale < 1.0:
        work_img = cv2.resize(image, (int(w_orig * scale), int(h_orig * scale)), interpolation=cv2.INTER_AREA)
    else:
        work_img = image

    # 1. Native OpenCV C++ Barcode Detector (ANY orientation in ~20ms)
    if _BARCODE_DETECTOR is not None:
        try:
            res = _BARCODE_DETECTOR.detectAndDecode(work_img)
            code = _clean_code(res[0])
            points = res[1] if len(res) > 1 else None
            if code and points is not None and len(points) > 0:
                pts_arr = points[0]
                xs = [p[0] for p in pts_arr]
                ys = [p[1] for p in pts_arr]
                orig_x = max(0, int(min(xs) / scale))
                orig_y = max(0, int(min(ys) / scale))
                orig_w = min(w_orig - orig_x, int((max(xs) - min(xs)) / scale))
                orig_h = min(h_orig - orig_y, int((max(ys) - min(ys)) / scale))
                orientation = "LEFT" if orig_h > orig_w * 1.15 else "UP"
                return (orig_x, orig_y, orig_w, orig_h), orientation, code
        except Exception:
            pass

    # 2. PyZbar direct decode on normalized grayscale
    gray_work = cv2.cvtColor(work_img, cv2.COLOR_BGR2GRAY) if len(work_img.shape) == 3 else work_img
    try:
        decoded_objects = decode(gray_work)
        if decoded_objects:
            obj = decoded_objects[0]
            r = obj.rect
            orig_x = max(0, int(r.left / scale))
            orig_y = max(0, int(r.top / scale))
            orig_w = min(w_orig - orig_x, int(r.width / scale))
            orig_h = min(h_orig - orig_y, int(r.height / scale))
            orientation = getattr(obj, "orientation", "UP")
            code = obj.data.decode("utf-8")
            return (orig_x, orig_y, orig_w, orig_h), orientation, code
    except Exception:
        pass

    # 3. Fast Rotated check (for vertical barcodes, ~25ms)
    try:
        rot90 = cv2.rotate(gray_work, cv2.ROTATE_90_CLOCKWISE)
        decoded_rot = decode(rot90)
        if decoded_rot:
            obj = decoded_rot[0]
            r = obj.rect
            # Map back coordinates from 90° clockwise rotation
            h_w, w_w = gray_work.shape[:2]
            scaled_x = r.top
            scaled_y = w_w - r.left - r.width
            scaled_w = r.height
            scaled_h = r.width
            orig_x = max(0, int(scaled_x / scale))
            orig_y = max(0, int(scaled_y / scale))
            orig_w = min(w_orig - orig_x, int(scaled_w / scale))
            orig_h = min(h_orig - orig_y, int(scaled_h / scale))
            return (orig_x, orig_y, orig_w, orig_h), "LEFT", obj.data.decode("utf-8")
    except Exception:
        pass

    # 4. Fast Threshold check
    try:
        _, thresh = cv2.threshold(gray_work, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        decoded_th = decode(thresh)
        if decoded_th:
            obj = decoded_th[0]
            r = obj.rect
            orig_x = max(0, int(r.left / scale))
            orig_y = max(0, int(r.top / scale))
            orig_w = min(w_orig - orig_x, int(r.width / scale))
            orig_h = min(h_orig - orig_y, int(r.height / scale))
            return (orig_x, orig_y, orig_w, orig_h), getattr(obj, "orientation", "UP"), obj.data.decode("utf-8")
    except Exception:
        pass

    # 5. Morphological fallback on downscaled image (fast ~15ms)
    try:
        grad_x = cv2.Sobel(gray_work, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
        grad_y = cv2.Sobel(gray_work, ddepth=cv2.CV_32F, dx=0, dy=1, ksize=-1)
        gradient = cv2.convertScaleAbs(cv2.subtract(grad_x, grad_y))
        blurred = cv2.blur(gradient, (9, 9))
        _, thresh = cv2.threshold(blurred, 225, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 7))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        closed = cv2.erode(closed, None, iterations=2)
        closed = cv2.dilate(closed, None, iterations=2)
        contours, _ = cv2.findContours(closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            rx, ry, rw, rh = cv2.boundingRect(c)
            orig_x = max(0, int(rx / scale))
            orig_y = max(0, int(ry / scale))
            orig_w = min(w_orig - orig_x, int(rw / scale))
            orig_h = min(h_orig - orig_y, int(rh / scale))
            return (orig_x, orig_y, orig_w, orig_h), "UP", None
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
        pad_x = max(24, int(rw * 0.10))
        pad_y = max(24, int(rh * 0.10))
        x1 = max(0, rx - pad_x)
        y1 = max(0, ry - pad_y)
        x2 = min(w_orig, rx + rw + pad_x)
        y2 = min(h_orig, ry + rh + pad_y)
        cropped = image[y1:y2, x1:x2].copy()
    else:
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
        cropped = cv2.rotate(cropped, cv2.ROTATE_90_CLOCKWISE)

    # Standardize maximum viewing size for sharp, fast rendering
    ch, cw = cropped.shape[:2]
    if cw > 1200 or ch > 800:
        scale = min(1200 / cw, 800 / ch)
        cropped = cv2.resize(cropped, (int(cw * scale), int(ch * scale)), interpolation=cv2.INTER_AREA)

    # Save to both Backend and Frontend processed folders
    out_backend = PROCESSED_DIR / output_filename
    out_frontend = FRONTEND_PROCESSED_DIR / output_filename
    cv2.imwrite(str(out_backend), cropped)
    cv2.imwrite(str(out_frontend), cropped)

    # Quick decode verification from the cropped image
    final_code = decoded_code
    if not final_code:
        final_code = decode_barcode_multistrategy(cropped) or ""

    return {
        "code": final_code or "",
        "processed_image": cropped,
        "processed_path": str(out_backend),
        "filename": output_filename,
        "status": "OK" if bool(final_code) else "NOK",
        "rect": rect,
    }


def decode_barcode_multistrategy(image: np.ndarray) -> Optional[str]:
    """
    Blazingly fast barcode extraction with prioritized optical passes:
    1. OpenCV native C++ BarcodeDetector (~20ms) - omnidirectional
    2. Fast grayscale PyZbar (~25ms)
    3. 90-degree rotated BarcodeDetector & PyZbar (vertical barcodes, ~25ms)
    4. 270-degree and 180-degree rotation passes (~25ms)
    5. OpenCV QRCodeDetector for 2D codes (~15ms)
    6. Contrast enhancement (CLAHE) & Otsu threshold (~30ms)
    7. Full-resolution fallback if scaled pass was inconclusive.
    Average total execution time: 20ms - 100ms.
    """
    if image is None or image.size == 0:
        return None

    h, w = image.shape[:2]

    # Pre-scale if image is high resolution (e.g. 12MP/4K phone camera or scanner)
    scale = min(1.0, 1600.0 / max(h, w))
    if scale < 1.0:
        work_img = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        work_img = image

    # Pass 1: OpenCV C++ Barcode Detector (omnidirectional, ultra fast 10-30ms)
    if _BARCODE_DETECTOR is not None:
        try:
            res = _BARCODE_DETECTOR.detectAndDecode(work_img)
            code = _clean_code(res[0])
            if code:
                return code
        except Exception:
            pass

    gray = cv2.cvtColor(work_img, cv2.COLOR_BGR2GRAY) if len(work_img.shape) == 3 else work_img

    # Pass 2: PyZbar grayscale decode (~25ms)
    try:
        decoded = decode(gray)
        if decoded:
            return decoded[0].data.decode("utf-8").strip()
    except Exception:
        pass

    # Pass 3: 90-Degree Clockwise (handles vertical barcodes like mobile container photos, ~25ms)
    try:
        rot90 = cv2.rotate(work_img, cv2.ROTATE_90_CLOCKWISE)
        if _BARCODE_DETECTOR is not None:
            res = _BARCODE_DETECTOR.detectAndDecode(rot90)
            code = _clean_code(res[0])
            if code:
                return code
        rot90_gray = cv2.rotate(gray, cv2.ROTATE_90_CLOCKWISE)
        decoded = decode(rot90_gray)
        if decoded:
            return decoded[0].data.decode("utf-8").strip()
    except Exception:
        pass

    # Pass 4: 270-Degree Counter-Clockwise & 180-Degree (~25ms each)
    for rot in [cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180]:
        try:
            rot_img = cv2.rotate(work_img, rot)
            if _BARCODE_DETECTOR is not None:
                res = _BARCODE_DETECTOR.detectAndDecode(rot_img)
                code = _clean_code(res[0])
                if code:
                    return code
            rot_gray = cv2.rotate(gray, rot)
            decoded = decode(rot_gray)
            if decoded:
                return decoded[0].data.decode("utf-8").strip()
        except Exception:
            pass

    # Pass 5: 2D QR Code Detector (~15ms)
    if _QR_DETECTOR is not None:
        try:
            val, _, _ = _QR_DETECTOR.detectAndDecode(work_img)
            if val and val.strip():
                return val.strip()
        except Exception:
            pass

    # Pass 6: Contrast Equalization (CLAHE) for faint or low-contrast barcodes (~30ms)
    try:
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        if _BARCODE_DETECTOR is not None:
            res = _BARCODE_DETECTOR.detectAndDecode(enhanced)
            code = _clean_code(res[0])
            if code:
                return code
        decoded = decode(enhanced)
        if decoded:
            return decoded[0].data.decode("utf-8").strip()
    except Exception:
        pass

    # Pass 7: Otsu Thresholding (~20ms)
    try:
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        decoded = decode(otsu)
        if decoded:
            return decoded[0].data.decode("utf-8").strip()
    except Exception:
        pass

    # Pass 8: Full resolution fallback on original image if scale < 1.0 (for tiny high-density codes)
    if scale < 1.0 and _BARCODE_DETECTOR is not None:
        try:
            res = _BARCODE_DETECTOR.detectAndDecode(image)
            code = _clean_code(res[0])
            if code:
                return code
        except Exception:
            pass

    return None


def decode_barcode_from_data_url(image_data: str) -> Optional[str]:
    """
    Decodes barcode directly from base64 data URL or raw base64.
    High performance parser with instant array decoding.
    """
    import base64
    if not image_data:
        return None
    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        return decode_barcode_multistrategy(img)
    except Exception as e:
        print(f"Error decoding barcode from image data: {e}")
        return None
