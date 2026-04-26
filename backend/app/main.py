from pathlib import Path
from typing import Annotated
from uuid import uuid4
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .model_generator import generate_wall_model
from .processing import detect_wall_segments, load_upload_as_image

BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = Path(os.getenv("PLAN2MODEL_STORAGE_DIR", BASE_DIR / "storage")).resolve()
FRONTEND_DIST_DIR = Path(os.getenv("FRONTEND_DIST_DIR", BASE_DIR.parent / "frontend" / "dist")).resolve()
UPLOAD_DIR = STORAGE_DIR / "uploads"
MODEL_DIR = STORAGE_DIR / "models"
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
    if origin.strip()
]

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Plan2Model API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")

if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/process")
async def process_floor_plan(
    file: Annotated[UploadFile, File()],
    wall_height: Annotated[float, Form()] = 3.0,
    wall_thickness: Annotated[float, Form()] = 0.2,
    pixels_per_meter: Annotated[float, Form()] = 100.0,
) -> dict:
    if wall_height <= 0 or wall_thickness <= 0 or pixels_per_meter <= 0:
        raise HTTPException(status_code=400, detail="All numeric settings must be positive.")

    model_id = str(uuid4())
    suffix = Path(file.filename or "upload").suffix.lower() or ".bin"
    upload_path = UPLOAD_DIR / f"{model_id}{suffix}"
    file_bytes = await file.read()
    upload_path.write_bytes(file_bytes)

    try:
        image = load_upload_as_image(file_bytes=file_bytes, filename=file.filename or "")
        walls = detect_wall_segments(image)
        if not walls:
            raise HTTPException(
                status_code=422,
                detail="No wall-like straight lines were detected. Try a cleaner black-and-white plan.",
            )

        glb_path = MODEL_DIR / f"{model_id}.glb"
        obj_path = MODEL_DIR / f"{model_id}.obj"
        generated_walls = generate_wall_model(
            walls=walls,
            glb_path=glb_path,
            obj_path=obj_path,
            wall_height=wall_height,
            wall_thickness=wall_thickness,
            pixels_per_meter=pixels_per_meter,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}") from exc

    return {
        "model_id": model_id,
        "wall_count": len(generated_walls),
        "walls": generated_walls,
        "glb_url": f"/storage/models/{glb_path.name}",
        "obj_url": f"/storage/models/{obj_path.name}",
    }


if FRONTEND_DIST_DIR.exists():
    @app.get("/{path:path}")
    def serve_frontend(path: str) -> FileResponse:
        requested_path = (FRONTEND_DIST_DIR / path).resolve()
        if requested_path.is_file() and FRONTEND_DIST_DIR in requested_path.parents:
            return FileResponse(requested_path)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
