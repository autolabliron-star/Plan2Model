const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

export function absoluteApiUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

export async function processFloorPlan({ file, settings }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('wall_height', settings.wallHeight);
  formData.append('wall_thickness', settings.wallThickness);
  formData.append('pixels_per_meter', settings.pixelsPerMeter);

  const response = await fetch(`${API_BASE_URL}/api/process`, {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || 'Plan processing failed.');
  }
  return payload;
}
