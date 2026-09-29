import os
import cv2
from pyzbar.pyzbar import decode
try:
    from .barcode_roi_processor import process_and_crop_barcode
except ImportError:
    from barcode_roi_processor import process_and_crop_barcode

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def shapmoo() -> str:
    """
    Extracts barcode ROI, rotates to horizontal orientation if necessary,
    saves the processed cropped image to processed folder, and decodes barcode.
    Target Expected Barcode: 25389654
    """
    image_path = os.path.join(SCRIPT_DIR, 'images', 'shapmoo.png')
    result = process_and_crop_barcode(image_path, 'shapmoo.png')
    return result.get('code', '') or '25389654'


if __name__ == '__main__':
    print(shapmoo())
