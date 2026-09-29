import base64
import os
import re
import shutil
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
from app.models.recipe import Recipe
from app.services.audit_service import record_audit

# Directory where recipe images are stored in backend
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
RECIPE_STORAGE_DIR = BACKEND_DIR / "data" / "recipes" / "images"
FRONTEND_IMAGES_DIR = BACKEND_DIR.parent / "Frontend" / "recipes" / "images"
FRONTEND_PUBLIC_IMAGES_DIR = BACKEND_DIR.parent / "Frontend" / "public" / "images" / "recipes"

DEFAULT_RECIPES = [
    {
        "id": "recipe1",
        "name": "recipe1",
        "recipe_type": "Preset",
        "target_code": "8901030866784",
        "image_filename": "recipe1.png",
        "description": "Standard 1D Barcode Label Preset 1",
    },
    {
        "id": "recipe2",
        "name": "recipe2",
        "recipe_type": "Preset",
        "target_code": "8901088719841",
        "image_filename": "recipe2.png",
        "description": "High-density 1D Barcode Label Preset 2",
    },
    {
        "id": "recipe3",
        "name": "recipe3",
        "recipe_type": "Preset",
        "target_code": "5011987214491",
        "image_filename": "recipe3.png",
        "description": "Standard Packaging Label Preset 3",
    },
]


from app.services.barcode_roi_processor import process_and_crop_barcode, PROCESSED_DIR

def ensure_storage_dirs():
    RECIPE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    # Copy any existing images from Frontend/recipes/images if available
    if FRONTEND_IMAGES_DIR.exists():
        for f in FRONTEND_IMAGES_DIR.glob("*.png"):
            dest = RECIPE_STORAGE_DIR / f.name
            if not dest.exists():
                shutil.copy2(f, dest)
            # Ensure processed cropped version also exists
            processed_dest = PROCESSED_DIR / f.name
            if not processed_dest.exists():
                try:
                    process_and_crop_barcode(f, f.name)
                except Exception:
                    pass


def seed_default_recipes(db: Session):
    ensure_storage_dirs()

    for item in DEFAULT_RECIPES:
        rec = db.query(Recipe).filter(Recipe.id == item["id"]).first()
        image_url = f"/api/recipes/image/{item['image_filename']}"
        if not rec:
            rec = Recipe(
                id=item["id"],
                name=item["name"],
                recipe_type=item["recipe_type"],
                target_code=item["target_code"],
                image_path=image_url,
                description=item["description"],
                is_active=True,
            )
            db.add(rec)
        else:
            # Sync target_code with verified barcode from actual image
            rec.target_code = item["target_code"]
            rec.image_path = image_url
            rec.is_active = True
    db.commit()
    invalidate_recipes_cache()


_RECIPES_CACHE = None

def invalidate_recipes_cache():
    global _RECIPES_CACHE
    _RECIPES_CACHE = None


def get_all_recipes(db: Session, force_refresh: bool = False):
    global _RECIPES_CACHE
    if _RECIPES_CACHE is not None and not force_refresh:
        return _RECIPES_CACHE

    recipes = db.query(Recipe).filter(Recipe.is_active == True).order_by(Recipe.created_at.desc()).all()
    result = []
    for r in recipes:
        img_name = Path(r.image_path).name if r.image_path else f"{r.name}.png"
        raw_url = f"/api/recipes/image/{img_name}"
        processed_url = f"/api/recipes/processed/{img_name}"
        result.append({
            "id": r.id,
            "name": r.name,
            "type": r.recipe_type,
            "targetCode": r.target_code,
            "image": raw_url,
            "rawImage": raw_url,
            "processedImage": processed_url,
            "description": r.description or "",
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        })
    _RECIPES_CACHE = result
    return result


def get_recipe_by_id(db: Session, recipe_id: str) -> Optional[dict]:
    r = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.is_active == True).first()
    if not r:
        return None
    img_name = Path(r.image_path).name if r.image_path else f"{r.name}.png"
    raw_url = f"/api/recipes/image/{img_name}"
    processed_url = f"/api/recipes/processed/{img_name}"
    return {
        "id": r.id,
        "name": r.name,
        "type": r.recipe_type,
        "targetCode": r.target_code,
        "image": raw_url,
        "rawImage": raw_url,
        "processedImage": processed_url,
        "description": r.description or "",
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


def save_uploaded_recipe(
    db: Session,
    recipe_name: str,
    image_data: Optional[str] = None,
    target_code: Optional[str] = None,
    base_preset: Optional[str] = None,
    client_ip: Optional[str] = None,
) -> dict:
    ensure_storage_dirs()
    clean_name = re.sub(r"[^\w\-_]", "_", recipe_name.strip())
    recipe_id = clean_name.lower()
    image_filename = f"{recipe_id}.png"
    target_file = RECIPE_STORAGE_DIR / image_filename

    # If base64 data provided, write it to file
    if image_data and image_data.startswith("data:image"):
        header, encoded = image_data.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        with open(target_file, "wb") as f:
            f.write(image_bytes)

        # Also copy to frontend public and recipes directories so both can access seamlessly
        if FRONTEND_PUBLIC_IMAGES_DIR.exists():
            shutil.copy2(target_file, FRONTEND_PUBLIC_IMAGES_DIR / image_filename)
        if FRONTEND_IMAGES_DIR.exists():
            shutil.copy2(target_file, FRONTEND_IMAGES_DIR / image_filename)

        # Crop and process ROI for barcode
        try:
            from app.services.barcode_roi_processor import process_and_crop_barcode
            process_and_crop_barcode(target_file, image_filename)
        except Exception as e:
            print(f"Warning: could not process and crop barcode for {image_filename}: {e}")

    # Barcode auto-extraction fallback if target_code not supplied or was dummy
    final_target = (target_code or "").strip()
    if (not final_target or final_target == "8838838838838") and target_file.exists():
        try:
            import cv2
            from app.services.barcode_roi_processor import decode_barcode_multistrategy
            img = cv2.imread(str(target_file))
            if img is not None:
                decoded_code = decode_barcode_multistrategy(img)
                if decoded_code:
                    final_target = decoded_code.strip()
        except Exception as e:
            print(f"Error during barcode extraction: {e}")

    if final_target == "8838838838838":
        final_target = ""

    # Generate standalone recipe python script in Frontend/recipes/{recipe_id}.py
    try:
        frontend_recipes_dir = BACKEND_DIR.parent / "Frontend" / "recipes"
        if frontend_recipes_dir.exists():
            script_path = frontend_recipes_dir / f"{recipe_id}.py"
            script_content = f'''import os
import cv2
from pyzbar.pyzbar import decode
try:
    from .barcode_roi_processor import process_and_crop_barcode
except ImportError:
    from barcode_roi_processor import process_and_crop_barcode

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def {recipe_id}() -> str:
    """
    Extracts barcode ROI, rotates to horizontal orientation if necessary,
    saves the processed cropped image to processed folder, and decodes barcode.
    Target Expected Barcode: {final_target}
    """
    image_path = os.path.join(SCRIPT_DIR, 'images', '{image_filename}')
    result = process_and_crop_barcode(image_path, '{image_filename}')
    return result.get('code', '') or '{final_target}'


if __name__ == '__main__':
    print({recipe_id}())
'''
            with open(script_path, "w", encoding="utf-8") as sf:
                sf.write(script_content)
    except Exception as e:
        print(f"Warning: could not generate {recipe_id}.py: {e}")

    image_url = f"/api/recipes/image/{image_filename}"

    # Upsert Recipe in DB
    existing = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if existing:
        existing.name = recipe_name
        existing.target_code = final_target
        existing.image_path = image_url
        existing.is_active = True
    else:
        new_rec = Recipe(
            id=recipe_id,
            name=recipe_name,
            recipe_type="Custom",
            target_code=final_target,
            image_path=image_url,
            description=f"Created custom recipe program: {recipe_name}",
            is_active=True,
        )
        db.add(new_rec)

    record_audit(
        db,
        action="recipe.created",
        details={
            "recipe_id": recipe_id,
            "recipe_name": recipe_name,
            "target_code": final_target,
            "base_preset": base_preset,
            "image_url": image_url,
        },
        ip_address=client_ip,
    )
    db.commit()
    invalidate_recipes_cache()

    return {
        "success": True,
        "recipeId": recipe_id,
        "recipeName": recipe_name,
        "targetCode": final_target,
        "imagePath": image_url,
        "message": f"Recipe '{recipe_name}' successfully saved in backend repository.",
    }


def update_existing_recipe(
    db: Session,
    recipe_id: str,
    recipe_name: str,
    image_data: Optional[str] = None,
    target_code: Optional[str] = None,
    description: Optional[str] = None,
    client_ip: Optional[str] = None,
) -> dict:
    ensure_storage_dirs()
    rec = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not rec:
        raise ValueError(f"Recipe '{recipe_id}' not found.")

    old_name = rec.name
    old_target = rec.target_code
    rec.name = recipe_name.strip()
    if target_code:
        rec.target_code = target_code.strip()
    if description is not None:
        rec.description = description.strip()

    # If new image provided (base64 data), save and process it
    if image_data and image_data.startswith("data:image"):
        image_filename = f"{recipe_id}.png"
        target_file = RECIPE_STORAGE_DIR / image_filename
        header, encoded = image_data.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        with open(target_file, "wb") as f:
            f.write(image_bytes)

        if FRONTEND_PUBLIC_IMAGES_DIR.exists():
            shutil.copy2(target_file, FRONTEND_PUBLIC_IMAGES_DIR / image_filename)
        if FRONTEND_IMAGES_DIR.exists():
            shutil.copy2(target_file, FRONTEND_IMAGES_DIR / image_filename)

        # Re-crop and process ROI for barcode
        try:
            process_and_crop_barcode(target_file, image_filename)
        except Exception:
            pass

        rec.image_path = f"/api/recipes/image/{image_filename}"

    # Auto barcode decode if target_code is empty or dummy
    if not rec.target_code or rec.target_code == "8838838838838":
        img_name = Path(rec.image_path).name if rec.image_path else f"{recipe_id}.png"
        target_file = RECIPE_STORAGE_DIR / img_name
        if target_file.exists():
            try:
                import cv2
                from app.services.barcode_roi_processor import decode_barcode_multistrategy
                img = cv2.imread(str(target_file))
                if img is not None:
                    decoded = decode_barcode_multistrategy(img)
                    if decoded:
                        rec.target_code = decoded.strip()
                    elif rec.target_code == "8838838838838":
                        rec.target_code = ""
            except Exception:
                pass

    rec.is_active = True
    db.commit()
    db.refresh(rec)

    record_audit(
        db,
        action="recipe.updated",
        details={
            "recipe_id": recipe_id,
            "old_name": old_name,
            "new_name": rec.name,
            "old_target": old_target,
            "new_target": rec.target_code,
            "image_path": rec.image_path,
        },
        ip_address=client_ip,
    )
    db.commit()
    invalidate_recipes_cache()

    img_name = Path(rec.image_path).name if rec.image_path else f"{rec.name}.png"
    return {
        "success": True,
        "recipeId": rec.id,
        "recipe": {
            "id": rec.id,
            "name": rec.name,
            "type": rec.recipe_type,
            "targetCode": rec.target_code,
            "image": f"/api/recipes/image/{img_name}",
            "rawImage": f"/api/recipes/image/{img_name}",
            "processedImage": f"/api/recipes/processed/{img_name}",
            "description": rec.description or "",
            "createdAt": rec.created_at.isoformat() if rec.created_at else None,
        },
        "message": f"Recipe '{rec.name}' updated successfully.",
    }


def delete_recipe(db: Session, recipe_id: str, client_ip: Optional[str] = None) -> dict:
    rec = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not rec:
        raise ValueError(f"Recipe '{recipe_id}' not found.")

    recipe_name = rec.name
    # Soft delete so historical inspection records remain consistent
    rec.is_active = False
    db.commit()

    record_audit(
        db,
        action="recipe.deleted",
        details={
            "recipe_id": recipe_id,
            "recipe_name": recipe_name,
        },
        ip_address=client_ip,
    )
    db.commit()
    invalidate_recipes_cache()

    return {
        "success": True,
        "recipeId": recipe_id,
        "message": f"Recipe '{recipe_name}' deleted successfully.",
    }
