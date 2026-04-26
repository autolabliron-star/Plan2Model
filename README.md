# Plan2Model

Plan2Model is a small MVP web app for outdoor construction layout planning. It can start from a blank site or import a clean black-and-white 2D plan, detect walls with OpenCV, and let the user arrange garages, slabs, walls, fences, gates, cars, trees, and sheds in a combined 2D and 3D editor.

## What This MVP Supports

- Start with a blank outdoor site plan.
- Add common outdoor construction objects from a small object library.
- Search and filter a richer object catalog by outdoor category.
- Draw walls directly on the 2D plan as measured line segments.
- Draw slabs directly on the 2D plan as rectangles.
- Add persistent measurement lines on the active level.
- Snap drawing points to the grid and nearby object corners/centers.
- Move objects in the 2D top-down plan and in the 3D model.
- Rotate objects in the 3D model.
- Resize objects directly on the 2D plan with slide-style handles.
- See selected-object width/depth measurements on the 2D plan.
- Place objects on Ground, Level 2, or Level 3 for simple stacked designs.
- Show/hide levels and view inactive levels faintly in the 2D plan.
- Edit dimensions, position, rotation, material, color, rough cost rate, and notes from a properties panel.
- Duplicate objects.
- Select, hide/show, and remove objects from an outliner.
- Run basic model checks for collisions, missing upper-level support, base-surface requirements, wall proportions, and narrow driveways.
- See red/yellow rule feedback on objects in the 2D plan and 3D model.
- Undo and redo project edits.
- Use Low / Medium / High quality modes to manage GPU load.
- See scene performance stats for visible objects, estimated meshes, and visible levels.
- See an early project cost estimate grouped by category.
- Auto-save the current project to browser local storage.
- Save a local project JSON file.
- Open a saved local project JSON file.
- Export the edited scene as GLB or OBJ from the browser.
- Upload a floor plan image or single/multi-page PDF to add detected walls.
- Convert PDF page 1 to an image.
- Preprocess the image with grayscale conversion, thresholding, Canny edges, and Hough line detection.
- Convert detected wall line segments into editable wall objects.

This is not a BIM tool yet. It is an outdoor-first concept planner for early design decisions. The plan import works best with clean, high-contrast drawings containing straight black walls on a white background. Doors, windows, collaboration, accounts, material libraries, and precise engineering constraints are future work.

## Folder Structure

```text
Plan2Model/
  backend/
    app/
      main.py
      processing.py
      model_generator.py
    storage/
      uploads/
      models/
    requirements.txt
  frontend/
    src/
      App.jsx
      api.js
      main.jsx
      styles.css
    index.html
    package.json
    vite.config.js
  examples/
    simple_floor_plan.png
  README.md
```

## Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will run at `http://localhost:8000`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will run at `http://localhost:5173`.

If your backend runs somewhere else, create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Deploy To Railway

Plan2Model is an isolated monorepo: deploy `backend/` and `frontend/` as two Railway services from the same GitHub repository.

### Files Added For Railway

- `backend/railway.json`: starts FastAPI with `uvicorn` on Railway's `$PORT`.
- `frontend/Dockerfile`: builds the Vite app and serves `dist/` with Caddy.
- `frontend/Caddyfile`: serves the React SPA and falls back to `index.html`.
- `frontend/railway.json`: tells Railway to use the frontend Dockerfile.
- `.gitignore`: excludes local build output, dependencies, and generated storage files.

### 1. Push To GitHub

Railway deployment from the dashboard expects a GitHub repo.

```bash
git init
git add .
git commit -m "Prepare Plan2Model for Railway"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Create The Backend Service

1. In Railway, create a new project.
2. Add a service from your GitHub repo.
3. Set the service root directory to:

```text
/backend
```

4. Make sure Railway uses:

```text
/backend/railway.json
```

5. Deploy the service.
6. In the backend service Settings > Networking, click **Generate Domain**.
7. Test:

```text
https://YOUR-BACKEND-DOMAIN.railway.app/api/health
```

Expected response:

```json
{"status":"ok"}
```

### 3. Create The Frontend Service

1. Add a second Railway service from the same GitHub repo.
2. Set the service root directory to:

```text
/frontend
```

3. Make sure Railway uses:

```text
/frontend/railway.json
```

4. Add this frontend variable before deploying:

```text
VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN.railway.app
```

5. Deploy the frontend service.
6. In the frontend service Settings > Networking, click **Generate Domain**.

### 4. Configure Backend CORS

For a quick MVP demo, set this variable on the backend service:

```text
ALLOWED_ORIGINS=*
```

For a cleaner production setting, use the exact frontend domain instead:

```text
ALLOWED_ORIGINS=https://YOUR-FRONTEND-DOMAIN.railway.app
```

After changing backend variables, redeploy the backend.

### 5. Optional Persistent Storage

Railway service filesystems are not a permanent database. For uploads/generated GLB/OBJ files, add a Railway Volume to the backend and set:

```text
PLAN2MODEL_STORAGE_DIR=/data
```

Without a volume, uploads and generated model files are fine for demos but may disappear after redeploys.

## How To Try It

1. Start the backend.
2. Start the frontend.
3. Open the frontend URL.
4. Add objects from the **Outdoor objects** panel. Use search or category chips to narrow the catalog.
5. Pick the active level from the top level tabs or the **Levels** panel.
6. Use **Model tools** to select, draw walls, draw slabs, or add measurements on the active level.
7. Move objects in the 2D site plan, or select them in the 3D model and use move/rotate controls.
8. Resize objects directly on the 2D plan, or edit exact dimensions, level, position, rotation, material, color, notes, and rough cost rate in the **Properties** panel.
9. Use the **Outliner** to select, hide/show, or remove project objects.
10. Review **Model checks** for collisions, support warnings, base-surface issues, wall span warnings, and driveway width warnings.
11. Optionally upload `examples/simple_floor_plan.png` and click **Add detected walls**.
12. Pick a quality mode in the **Project** panel if the scene feels heavy.
13. Use undo/redo, duplicate objects, export the design as GLB or OBJ, or save/open a local project JSON.

## Model Checks

The rules layer is intentionally practical rather than a real structural solver. It helps catch early design problems during concept planning:

- Collision check: warns when solid objects overlap on the same level.
- Upper-level support check: flags objects on Level 2 or Level 3 when there is no support below.
- Base-surface check: reminds the user when garages, sheds, tanks, utilities, or carports are not sitting on a slab, driveway, or gravel pad.
- Wall sanity check: warns about long wall spans and tall/thin wall proportions.
- Driveway check: warns when a driveway path is narrower than 3m.

These checks are not engineering approvals. They are fast planning feedback for early decisions before a professional review.

## Performance Notes

The app includes a small browser-based 3D performance foundation:

- Low quality caps pixel ratio at `1` and disables shadows.
- Medium quality caps pixel ratio at `1.5` and uses basic shadows.
- High quality caps pixel ratio at `2` and uses higher shadow resolution.
- Shadows are disabled while dragging 3D transform controls, then restored afterward.
- The Project panel shows visible object count, estimated mesh count, and visible levels.
- 2D drag/resize and 3D transform interactions use live updates and collapse the edit into one undo step.

## Outdoor Catalog And Costing

The editor is intentionally SketchUp-simple: place objects quickly, tune dimensions, and keep moving. The current catalog includes:

- Structures: single garage, double garage, open carport, storage shed.
- Boundaries: block wall, retaining wall, timber fence, metal fence, swing gate, sliding gate.
- Ground: concrete slab, driveway, gravel pad.
- Landscape: lawn area, tree.
- Vehicles: car placeholder, parking space.
- Utilities: water tank, utility box.

Cost estimates are rough planning aids, not quotes. They are calculated from each object's editable cost model:

- Floor area: width x depth.
- Wall area: width x height.
- Length: width.
- Each: fixed item quantity.

## API

### `POST /api/process`

Multipart form fields:

- `file`: image or PDF.
- `wall_height`: wall height in meters.
- `wall_thickness`: wall thickness in meters.
- `pixels_per_meter`: image scale.

Response:

```json
{
  "model_id": "uuid",
  "walls": [
    {
      "start": [10, 20],
      "end": [300, 20],
      "length_m": 2.9
    }
  ],
  "wall_count": 1,
  "glb_url": "http://localhost:8000/storage/models/model.glb",
  "obj_url": "http://localhost:8000/storage/models/model.obj"
}
```

## Notes On Detection

The OpenCV pipeline lives in `backend/app/processing.py`. It intentionally favors understandable MVP behavior over architectural completeness:

1. Decode the uploaded image or render the first PDF page.
2. Convert to grayscale.
3. Blur lightly to reduce scanner noise.
4. Threshold to isolate dark plan lines.
5. Run Canny edge detection.
6. Use probabilistic Hough line detection to find straight wall candidates.
7. Keep reasonably long line segments and pass them to geometry generation.

The frontend now turns detected wall lines into editable site objects. The backend geometry code in `backend/app/model_generator.py` is still available for the original generated GLB/OBJ API flow. Each detected line can become one wall box with:

- X/Z position derived from floor-plan pixels.
- Y height set from the settings panel.
- Thickness set from the settings panel.
- Scale controlled by pixels per meter.
