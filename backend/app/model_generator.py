from __future__ import annotations

import math
from pathlib import Path

import trimesh

from .processing import WallSegment


def generate_wall_model(
    walls: list[WallSegment],
    glb_path: Path,
    obj_path: Path,
    wall_height: float,
    wall_thickness: float,
    pixels_per_meter: float,
) -> list[dict]:
    """Extrude each detected 2D wall segment into a simple 3D box.

    Coordinate convention:
    - Floor-plan image X becomes model X.
    - Floor-plan image Y becomes model Z.
    - Model Y is height.

    Each wall box starts as a unit-aligned box whose local X dimension is the wall
    length. It is then rotated around the vertical Y axis and translated to the
    segment midpoint.
    """
    scene = trimesh.Scene()
    generated: list[dict] = []

    for index, wall in enumerate(walls):
        dx_px = wall.x2 - wall.x1
        dz_px = wall.y2 - wall.y1
        length_m = math.hypot(dx_px, dz_px) / pixels_per_meter
        if length_m <= 0:
            continue

        mid_x = ((wall.x1 + wall.x2) / 2) / pixels_per_meter
        mid_z = ((wall.y1 + wall.y2) / 2) / pixels_per_meter
        angle = math.atan2(dz_px, dx_px)

        mesh = trimesh.creation.box(extents=(length_m, wall_height, wall_thickness))
        mesh.apply_translation((0, wall_height / 2, 0))

        rotation = trimesh.transformations.rotation_matrix(angle, (0, 1, 0))
        mesh.apply_transform(rotation)
        mesh.apply_translation((mid_x, 0, mid_z))

        scene.add_geometry(mesh, node_name=f"wall_{index}", geom_name=f"wall_{index}")

        generated.append(
            {
                "start": [wall.x1, wall.y1],
                "end": [wall.x2, wall.y2],
                "length_m": round(length_m, 3),
            }
        )

    glb_bytes = scene.export(file_type="glb")
    glb_path.write_bytes(glb_bytes)
    obj_text = scene.export(file_type="obj")
    obj_path.write_text(obj_text, encoding="utf-8")

    return generated
