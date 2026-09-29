from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from pathlib import Path

from app.db.database import get_db
from app.services.recipe_service import (
    get_all_recipes,
    get_recipe_by_id,
    save_uploaded_recipe,
    update_existing_recipe,
    delete_recipe,
    RECIPE_STORAGE_DIR,
)
from app.services.image_cache_service import (
    get_raw_image_bytes,
    get_processed_image_bytes,
    get_all_demo_filenames,
)

router = APIRouter(tags=["recipes"])


class SaveRecipePayload(BaseModel):
    recipeName: str
    imageData: Optional[str] = None
    targetCode: Optional[str] = None
    basePreset: Optional[str] = None


class UpdateRecipePayload(BaseModel):
    recipeName: str
    targetCode: Optional[str] = None
    imageData: Optional[str] = None
    description: Optional[str] = None


class DecodeBarcodePayload(BaseModel):
    imageData: str



@router.get("/recipes")
def list_recipes(response: Response, db: Session = Depends(get_db)):
    """Fetch all available recipes from backend database."""
    response.headers["Cache-Control"] = "public, max-age=3, stale-while-revalidate=30"
    return get_all_recipes(db)


@router.get("/recipes/demo-image-list")
def list_demo_images():
    """Returns list of all demo container images for frontend browser preloading."""
    return get_all_demo_filenames()


@router.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: str, db: Session = Depends(get_db)):
    """Fetch details of a specific recipe."""
    rec = get_recipe_by_id(db, recipe_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return rec


@router.get("/recipes/image/{filename}")
def get_recipe_image(filename: str):
    """Serve high-performance web-optimized recipe reference image directly from RAM cache (<0.5ms)."""
    cached_bytes = get_raw_image_bytes(filename)
    if cached_bytes:
        return Response(
            content=cached_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=3600"},
        )

    file_path = RECIPE_STORAGE_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        # Fallback check in frontend recipes folder
        fallback = Path(__file__).resolve().parent.parent.parent.parent / "Frontend" / "recipes" / "images" / filename
        demo_fallback = Path(__file__).resolve().parent.parent.parent.parent / "demo_folder_images" / filename
        if fallback.exists():
            file_path = fallback
        elif demo_fallback.exists():
            file_path = demo_fallback
        else:
            raise HTTPException(status_code=404, detail="Recipe image not found")
    return FileResponse(file_path, media_type="image/png")


@router.get("/recipes/processed/{filename}")
def get_processed_recipe_image(filename: str):
    """Serve high-performance cropped barcode ROI image directly from RAM cache (<0.5ms)."""
    cached_bytes = get_processed_image_bytes(filename)
    if cached_bytes:
        return Response(
            content=cached_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=3600"},
        )

    processed_dir = Path(__file__).resolve().parent.parent.parent / "data" / "processed"
    file_path = processed_dir / filename
    if not file_path.exists() or not file_path.is_file():
        fallback = Path(__file__).resolve().parent.parent.parent.parent / "Frontend" / "recipes" / "processed" / filename
        demo_fallback = Path(__file__).resolve().parent.parent.parent.parent / "demo_folder_images" / filename
        if fallback.exists():
            file_path = fallback
        elif demo_fallback.exists():
            file_path = demo_fallback
        else:
            # If not yet generated, fallback to standard recipe image
            raw_path = RECIPE_STORAGE_DIR / filename
            if raw_path.exists():
                file_path = raw_path
            else:
                raise HTTPException(status_code=404, detail="Processed recipe image not found")
    return FileResponse(file_path, media_type="image/png")


@router.post("/recipes/decode-barcode")
@router.post("/decode-barcode")
def decode_barcode_endpoint(payload: DecodeBarcodePayload):
    """
    Decodes the authentic barcode string from an uploaded or captured image data URL.
    Called automatically during recipe creation when an image is selected.
    """
    from app.services.barcode_roi_processor import decode_barcode_from_data_url
    barcode = decode_barcode_from_data_url(payload.imageData)
    if barcode:
        return {
            "success": True,
            "barcode": barcode,
            "message": f"Successfully extracted barcode: {barcode}"
        }
    return {
        "success": False,
        "barcode": None,
        "message": "No readable barcode detected in the provided image."
    }


@router.post("/save-recipe")
@router.post("/recipes/save")
def save_recipe(payload: SaveRecipePayload, request: Request, db: Session = Depends(get_db)):
    """Save newly created or uploaded recipe to backend database and file storage."""
    client_ip = request.client.host if request.client else None
    result = save_uploaded_recipe(
        db,
        recipe_name=payload.recipeName,
        image_data=payload.imageData,
        target_code=payload.targetCode,
        client_ip=client_ip,
    )
    return result


@router.put("/recipes/{recipe_id}")
@router.post("/recipes/{recipe_id}/update")
def update_recipe_endpoint(recipe_id: str, payload: UpdateRecipePayload, request: Request, db: Session = Depends(get_db)):
    """Update recipe name, target barcode, image, and description."""
    client_ip = request.client.host if request.client else None
    try:
        return update_existing_recipe(
            db,
            recipe_id=recipe_id,
            recipe_name=payload.recipeName,
            image_data=payload.imageData,
            target_code=payload.targetCode,
            description=payload.description,
            client_ip=client_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update recipe: {e}")


@router.delete("/recipes/{recipe_id}")
def delete_recipe_endpoint(recipe_id: str, request: Request, db: Session = Depends(get_db)):
    """Delete / deactivate recipe from database and repository."""
    client_ip = request.client.host if request.client else None
    try:
        return delete_recipe(db, recipe_id=recipe_id, client_ip=client_ip)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete recipe: {e}")
