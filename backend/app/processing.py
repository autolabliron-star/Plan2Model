from __future__ import annotations

import math
from dataclasses import dataclass

import cv2
import fitz
import numpy as np


@dataclass(frozen=True)
class WallSegment:
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def length_px(self) -> float:
        return math.hypot(self.x2 - self.x1, self.y2 - self.y1)


def load_upload_as_image(file_bytes: bytes, filename: str) -> np.ndarray:
    """Decode an uploaded image, or render page one of a PDF into an OpenCV BGR image."""
    if filename.lower().endswith(".pdf"):
        document = fitz.open(stream=file_bytes, filetype="pdf")
        if document.page_count == 0:
            raise ValueError("PDF does not contain any pages.")

        page = document.load_page(0)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
            pixmap.height,
            pixmap.width,
            pixmap.n,
        )
        return cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    encoded = np.frombuffer(file_bytes, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unsupported image format.")
    return image


def detect_wall_segments(image: np.ndarray) -> list[WallSegment]:
    """Find straight wall candidates in a clean line drawing.

    The MVP pipeline keeps the steps explicit so it is easy to tune:
    grayscale -> blur -> threshold dark lines -> Canny edges -> probabilistic Hough lines.
    Hough returns many small edge fragments, so a light merge pass combines nearby
    collinear horizontal/vertical candidates into longer wall segments.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    _, binary = cv2.threshold(
        blurred,
        0,
        255,
        cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU,
    )
    edges = cv2.Canny(binary, threshold1=50, threshold2=150, apertureSize=3)

    min_dimension = min(image.shape[:2])
    min_line_length = max(35, int(min_dimension * 0.08))
    raw_lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=45,
        minLineLength=min_line_length,
        maxLineGap=12,
    )

    if raw_lines is None:
        return []

    candidates: list[WallSegment] = []
    for line in raw_lines[:, 0]:
        segment = WallSegment(int(line[0]), int(line[1]), int(line[2]), int(line[3]))
        if segment.length_px < min_line_length:
            continue
        candidates.append(_normalize_segment(segment))

    return _dedupe_segments(_merge_axis_aligned_segments(candidates))


def _normalize_segment(segment: WallSegment) -> WallSegment:
    if (segment.x2, segment.y2) < (segment.x1, segment.y1):
        return WallSegment(segment.x2, segment.y2, segment.x1, segment.y1)
    return segment


def _orientation(segment: WallSegment) -> str:
    angle = abs(math.degrees(math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1)))
    if angle <= 12 or angle >= 168:
        return "h"
    if 78 <= angle <= 102:
        return "v"
    return "d"


def _merge_axis_aligned_segments(segments: list[WallSegment]) -> list[WallSegment]:
    """Merge obvious duplicated Hough fragments for horizontal and vertical walls.

    Clean plans often produce both top and bottom edges of a thick wall. This merge is
    intentionally modest: it only joins segments that are nearly collinear and overlap.
    Diagonal segments are preserved as-is for simple angled walls.
    """
    horizontal: dict[int, list[WallSegment]] = {}
    vertical: dict[int, list[WallSegment]] = {}
    diagonal: list[WallSegment] = []

    snap = 10
    for segment in segments:
        orient = _orientation(segment)
        if orient == "h":
            y = round(((segment.y1 + segment.y2) / 2) / snap) * snap
            x1, x2 = sorted((segment.x1, segment.x2))
            horizontal.setdefault(y, []).append(WallSegment(x1, y, x2, y))
        elif orient == "v":
            x = round(((segment.x1 + segment.x2) / 2) / snap) * snap
            y1, y2 = sorted((segment.y1, segment.y2))
            vertical.setdefault(x, []).append(WallSegment(x, y1, x, y2))
        else:
            diagonal.append(segment)

    merged = diagonal[:]
    for y, grouped in horizontal.items():
        merged.extend(_merge_intervals(grouped, fixed_axis=y, horizontal=True))
    for x, grouped in vertical.items():
        merged.extend(_merge_intervals(grouped, fixed_axis=x, horizontal=False))
    return merged


def _merge_intervals(
    segments: list[WallSegment],
    fixed_axis: int,
    horizontal: bool,
) -> list[WallSegment]:
    intervals = []
    for segment in segments:
        if horizontal:
            start, end = sorted((segment.x1, segment.x2))
        else:
            start, end = sorted((segment.y1, segment.y2))
        intervals.append((start, end))

    intervals.sort()
    merged: list[tuple[int, int]] = []
    for start, end in intervals:
        if not merged or start > merged[-1][1] + 16:
            merged.append((start, end))
        else:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))

    if horizontal:
        return [WallSegment(start, fixed_axis, end, fixed_axis) for start, end in merged]
    return [WallSegment(fixed_axis, start, fixed_axis, end) for start, end in merged]


def _dedupe_segments(segments: list[WallSegment]) -> list[WallSegment]:
    seen: set[tuple[int, int, int, int]] = set()
    deduped: list[WallSegment] = []
    for segment in segments:
        normalized = _normalize_segment(segment)
        key = (
            round(normalized.x1 / 4) * 4,
            round(normalized.y1 / 4) * 4,
            round(normalized.x2 / 4) * 4,
            round(normalized.y2 / 4) * 4,
        )
        if key not in seen:
            seen.add(key)
            deduped.append(normalized)
    return deduped

