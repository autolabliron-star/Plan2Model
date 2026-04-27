import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Car,
  Copy,
  Trash2,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Fence,
  FileImage,
  FolderOpen,
  Grid3X3,
  Home,
  Layers3,
  Loader2,
  MousePointer2,
  Move3D,
  PaintBucket,
  PencilLine,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Search,
  ShieldCheck,
  Square,
  Trees,
  Undo2,
  Upload,
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { processFloorPlan } from './api.js';

const STORAGE_KEY = 'plan2model.outdoorProject.v1';
const WELCOME_KEY = 'plan2model.hasSeenWelcome.v1';
const PROJECTS_KEY = 'plan2model.savedProjects.v1';
const CURRENT_PROJECT_KEY = 'plan2model.currentProjectId.v1';
const gridMeters = 20;
const snapSize = 0.25;

const defaultLevels = [
  { id: 'ground', name: 'Ground', elevation: 0, visible: true },
  { id: 'level-2', name: 'Level 2', elevation: 3, visible: true },
  { id: 'level-3', name: 'Level 3', elevation: 6, visible: true },
];

const qualityPresets = {
  low: { label: 'Low', pixelRatio: 1, shadows: false, antialias: false, levelOpacity: 0.12 },
  medium: { label: 'Medium', pixelRatio: 1.5, shadows: true, antialias: true, levelOpacity: 0.18 },
  high: { label: 'High', pixelRatio: 2, shadows: true, antialias: true, levelOpacity: 0.26 },
};

const materialPresets = [
  { id: 'concrete', label: 'Concrete', color: '#b8b8b8', roughness: 0.9, unitCost: 95 },
  { id: 'painted-block', label: 'Painted block', color: '#cfd8e3', roughness: 0.72, unitCost: 135 },
  { id: 'brick', label: 'Brick', color: '#b4533b', roughness: 0.82, unitCost: 180 },
  { id: 'timber', label: 'Timber', color: '#8b7355', roughness: 0.7, unitCost: 120 },
  { id: 'steel', label: 'Dark steel', color: '#475569', roughness: 0.46, metalness: 0.25, unitCost: 240 },
  { id: 'gravel', label: 'Gravel', color: '#9ca3af', roughness: 1, unitCost: 35 },
  { id: 'grass', label: 'Grass', color: '#5f8f5b', roughness: 0.95, unitCost: 18 },
  { id: 'glass', label: 'Glass', color: '#93c5fd', roughness: 0.18, metalness: 0, unitCost: 220 },
];

const categories = ['All', 'Structures', 'Boundaries', 'Ground', 'Landscape', 'Vehicles', 'Utilities'];
const homeownerCategories = {
  Boundaries: 'Walls & Gates',
  Ground: 'Ground & Driveways',
  Landscape: 'Garden',
};

const homeownerCategoryOrder = ['All', 'Structures', 'Walls & Gates', 'Ground & Driveways', 'Garden', 'Utilities', 'Vehicles'];

const modelingTools = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'wall', label: 'Draw wall', icon: PencilLine },
  { id: 'slab', label: 'Draw slab', icon: Square },
  { id: 'measure', label: 'Measure', icon: Ruler },
];

const objectCatalog = [
  { type: 'wall', label: 'Block wall', category: 'Boundaries', icon: Fence, size: [4, 2.8, 0.2], materialId: 'painted-block', costModel: 'wallArea', costRate: 135 },
  { type: 'retaining-wall', label: 'Retaining wall', category: 'Boundaries', icon: Fence, size: [5, 1.4, 0.35], materialId: 'concrete', costModel: 'wallArea', costRate: 165 },
  { type: 'fence', label: 'Timber fence', category: 'Boundaries', icon: Fence, size: [5, 1.4, 0.12], materialId: 'timber', costModel: 'length', costRate: 75 },
  { type: 'metal-fence', label: 'Metal fence', category: 'Boundaries', icon: Fence, size: [5, 1.6, 0.1], materialId: 'steel', costModel: 'length', costRate: 120 },
  { type: 'gate', label: 'Swing gate', category: 'Boundaries', icon: Home, size: [3.2, 2.1, 0.18], materialId: 'steel', costModel: 'each', costRate: 950 },
  { type: 'sliding-gate', label: 'Sliding gate', category: 'Boundaries', icon: Home, size: [4.5, 2, 0.18], materialId: 'steel', costModel: 'each', costRate: 1450 },
  { type: 'garage', label: 'Single garage', category: 'Structures', icon: Warehouse, size: [6, 3, 4], materialId: 'painted-block', costModel: 'floorArea', costRate: 650 },
  { type: 'double-garage', label: 'Double garage', category: 'Structures', icon: Warehouse, size: [7, 3.2, 6], materialId: 'painted-block', costModel: 'floorArea', costRate: 680 },
  { type: 'carport', label: 'Open carport', category: 'Structures', icon: Warehouse, size: [5.5, 2.7, 5], materialId: 'steel', costModel: 'floorArea', costRate: 260 },
  { type: 'shed', label: 'Storage shed', category: 'Structures', icon: Box, size: [3, 2.4, 2.5], materialId: 'timber', costModel: 'floorArea', costRate: 320 },
  { type: 'slab', label: 'Concrete slab', category: 'Ground', icon: Grid3X3, size: [5, 0.12, 5], materialId: 'concrete', costModel: 'floorArea', costRate: 95 },
  { type: 'driveway', label: 'Driveway', category: 'Ground', icon: Grid3X3, size: [3.5, 0.08, 8], materialId: 'concrete', costModel: 'floorArea', costRate: 85 },
  { type: 'gravel-pad', label: 'Gravel pad', category: 'Ground', icon: Grid3X3, size: [5, 0.06, 4], materialId: 'gravel', costModel: 'floorArea', costRate: 35 },
  { type: 'lawn', label: 'Lawn area', category: 'Landscape', icon: Trees, size: [6, 0.04, 5], materialId: 'grass', costModel: 'floorArea', costRate: 18 },
  { type: 'tree', label: 'Tree', category: 'Landscape', icon: Trees, size: [1.4, 4, 1.4], materialId: 'grass', costModel: 'each', costRate: 220 },
  { type: 'car', label: 'Car placeholder', category: 'Vehicles', icon: Car, size: [2, 1.5, 4.2], materialId: 'steel', costModel: 'none', costRate: 0 },
  { type: 'parking-space', label: 'Parking space', category: 'Vehicles', icon: Car, size: [2.6, 0.04, 5], materialId: 'gravel', costModel: 'floorArea', costRate: 25 },
  { type: 'water-tank', label: 'Water tank', category: 'Utilities', icon: Box, size: [1.6, 2.1, 1.6], materialId: 'steel', costModel: 'each', costRate: 800 },
  { type: 'utility-box', label: 'Utility box', category: 'Utilities', icon: Box, size: [1, 1.2, 0.6], materialId: 'steel', costModel: 'each', costRate: 350 },
];

const recommendedStarterSets = [
  { id: 'garage-driveway', label: 'Garage + driveway', description: 'A simple parking concept.', types: ['garage', 'driveway'] },
  { id: 'backyard-wall', label: 'Backyard wall', description: 'Boundary wall with a gate.', types: ['wall', 'gate'] },
  { id: 'utility-zone', label: 'Utility zone', description: 'Tank, utility box, and base.', types: ['slab', 'water-tank', 'utility-box'] },
  { id: 'garden-corner', label: 'Garden corner', description: 'Lawn with two trees.', types: ['lawn', 'tree', 'tree'] },
];

const toolHelpText = {
  select: 'Click an object to move, resize, or edit it.',
  wall: 'Click and drag to draw a wall. Release to place.',
  slab: 'Drag a rectangle for concrete, parking, or patio areas.',
  measure: 'Drag between two points to measure.',
};

const starterObjects = [
  makeObject('slab', { id: 'site-slab', label: 'Concrete slab', position: [0, 0, 0], size: [10, 0.12, 7] }),
  makeObject('garage', { id: 'garage-1', position: [-2, 0, -1], size: [5.5, 3, 3.5] }),
  makeObject('wall', { id: 'wall-1', position: [3, 0, 2.2], size: [6, 2.7, 0.2], rotation: 0 }),
];

const demoObjects = [
  makeObject('slab', {
    id: 'demo-main-court',
    label: 'Main concrete court',
    position: [0, 0, 0],
    size: [14, 0.12, 10],
    materialId: 'concrete',
    notes: 'Central work yard and circulation area.',
  }),
  makeObject('driveway', {
    id: 'demo-driveway',
    label: 'Entry driveway',
    position: [-5.2, 0, 6.8],
    size: [3.6, 0.08, 6.4],
    notes: 'Vehicle approach from street.',
  }),
  makeObject('garage', {
    id: 'demo-garage',
    label: 'Client garage',
    position: [-3.4, 0, -1.8],
    size: [6.2, 3.1, 4.4],
    materialId: 'brick',
    notes: 'Main garage volume with masonry finish.',
  }),
  makeObject('carport', {
    id: 'demo-carport',
    label: 'Covered carport',
    position: [4.3, 0, -2.1],
    size: [4.6, 2.7, 5.2],
    rotation: Math.PI / 2,
    notes: 'Secondary covered parking bay.',
  }),
  makeObject('shed', {
    id: 'demo-storage',
    label: 'Tool storage',
    position: [5.1, 0, 3.4],
    size: [2.6, 2.3, 2.2],
    materialId: 'timber',
  }),
  makeObject('wall', {
    id: 'demo-back-wall-left',
    label: 'Rear block wall A',
    position: [-3.55, 0, -5.2],
    size: [6.9, 2.6, 0.22],
    materialId: 'painted-block',
  }),
  makeObject('wall', {
    id: 'demo-back-wall-right',
    label: 'Rear block wall B',
    position: [3.55, 0, -5.2],
    size: [6.9, 2.6, 0.22],
    materialId: 'painted-block',
  }),
  makeObject('wall', {
    id: 'demo-left-wall-rear',
    label: 'Left boundary wall A',
    position: [-7.2, 0, -2.6],
    size: [5.1, 2.3, 0.22],
    rotation: Math.PI / 2,
    materialId: 'painted-block',
  }),
  makeObject('wall', {
    id: 'demo-left-wall-front',
    label: 'Left boundary wall B',
    position: [-7.2, 0, 2.6],
    size: [5.1, 2.3, 0.22],
    rotation: Math.PI / 2,
    materialId: 'painted-block',
  }),
  makeObject('metal-fence', {
    id: 'demo-front-fence',
    label: 'Front metal fence',
    position: [1.6, 0, 5.2],
    size: [8.4, 1.5, 0.12],
  }),
  makeObject('sliding-gate', {
    id: 'demo-sliding-gate',
    label: 'Sliding entry gate',
    position: [-4.6, 0, 5.2],
    size: [4.2, 2, 0.18],
  }),
  makeObject('lawn', {
    id: 'demo-lawn',
    label: 'Soft landscape strip',
    position: [4.2, 0, 6.8],
    size: [5.8, 0.04, 2.4],
  }),
  makeObject('tree', {
    id: 'demo-tree-1',
    label: 'Shade tree',
    position: [6.3, 0, 6.9],
    size: [1.5, 4.4, 1.5],
  }),
  makeObject('tree', {
    id: 'demo-tree-2',
    label: 'Courtyard tree',
    position: [1.5, 0, 6.6],
    size: [1.2, 3.6, 1.2],
  }),
  makeObject('parking-space', {
    id: 'demo-parking-space',
    label: 'Guest parking bay',
    position: [0.4, 0, 2.4],
    size: [2.7, 0.04, 5.1],
  }),
  makeObject('car', {
    id: 'demo-car',
    label: 'Vehicle placeholder',
    position: [0.4, 0, 2.4],
    size: [1.9, 1.35, 4.1],
    color: '#1f6feb',
  }),
  makeObject('water-tank', {
    id: 'demo-water-tank',
    label: 'Utility water tank',
    position: [-6.2, 0, 3.8],
    size: [1.5, 2.2, 1.5],
  }),
  makeObject('utility-box', {
    id: 'demo-utility-box',
    label: 'Electrical utility box',
    position: [-6.2, 0, 2.35],
    size: [0.9, 1.1, 0.6],
  }),
  makeObject('slab', {
    id: 'demo-level-2-terrace',
    label: 'Level 2 terrace deck',
    levelId: 'level-2',
    position: [-3.4, 0, -1.8],
    size: [6.4, 0.16, 4.6],
    materialId: 'concrete',
    notes: 'Simple stacked terrace showing second-level planning.',
  }),
  makeObject('metal-fence', {
    id: 'demo-level-2-guardrail-front',
    label: 'Level 2 guardrail',
    levelId: 'level-2',
    position: [-3.4, 0, 0.55],
    size: [6.3, 1.1, 0.1],
    materialId: 'steel',
  }),
  makeObject('metal-fence', {
    id: 'demo-level-2-guardrail-side',
    label: 'Side guardrail',
    levelId: 'level-2',
    position: [-0.2, 0, -1.8],
    size: [4.5, 1.1, 0.1],
    rotation: Math.PI / 2,
    materialId: 'steel',
  }),
  makeObject('shed', {
    id: 'demo-level-3-lookout',
    label: 'Level 3 lookout room',
    levelId: 'level-3',
    position: [-3.4, 0, -1.8],
    size: [2.8, 2.4, 2.6],
    materialId: 'glass',
    notes: 'Small third-level concept volume to show stacking.',
  }),
];

function makeObject(type, overrides = {}) {
  const template = objectCatalog.find((item) => item.type === type) || objectCatalog[0];
  return {
    id: overrides.id || `${type}-${crypto.randomUUID()}`,
    type,
    label: overrides.label || template.label,
    category: overrides.category || template.category,
    position: overrides.position || [0, 0, 0],
    levelId: overrides.levelId || 'ground',
    rotation: overrides.rotation || 0,
    size: overrides.size || template.size,
    materialId: overrides.materialId || template.materialId,
    color: overrides.color || materialFor(overrides.materialId || template.materialId).color,
    costModel: overrides.costModel || template.costModel,
    costRate: overrides.costRate ?? template.costRate,
    notes: overrides.notes || '',
    hidden: overrides.hidden || false,
  };
}

function materialFor(materialId) {
  return materialPresets.find((material) => material.id === materialId) || materialPresets[0];
}

function displayCategory(category) {
  return homeownerCategories[category] || category;
}

function getObjectTemplate(type) {
  return objectCatalog.find((item) => item.type === type) || objectCatalog[0];
}

function normalizedObject(item) {
  const template = getObjectTemplate(item.type);
  const materialId = item.materialId || template.materialId || 'concrete';
  return {
    ...item,
    levelId: item.levelId || 'ground',
    category: item.category || template.category,
    materialId,
    color: item.color || materialFor(materialId).color,
    costModel: item.costModel || template.costModel || 'none',
    costRate: item.costRate ?? template.costRate ?? 0,
    notes: item.notes || '',
    hidden: item.hidden || false,
  };
}

function snap(value) {
  return Math.round(Number(value) / snapSize) * snapSize;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function quantityFor(item) {
  if (item.costModel === 'floorArea') return item.size[0] * item.size[2];
  if (item.costModel === 'wallArea') return item.size[0] * item.size[1];
  if (item.costModel === 'length') return item.size[0];
  if (item.costModel === 'each') return 1;
  return 0;
}

function unitLabelFor(costModel) {
  if (costModel === 'floorArea' || costModel === 'wallArea') return 'm2';
  if (costModel === 'length') return 'm';
  if (costModel === 'each') return 'each';
  return 'n/a';
}

function estimateObjectCost(item) {
  return quantityFor(item) * Number(item.costRate || 0);
}

function meshEstimateFor(item) {
  if (item.type === 'tree' || item.type === 'car' || item.type === 'garage' || item.type === 'double-garage' || item.type === 'shed') return 2;
  return 1;
}

function getSceneStats(objects, levels) {
  const visibleLevelIds = new Set(levels.filter((level) => level.visible).map((level) => level.id));
  const visibleObjects = objects.map(normalizedObject).filter((item) => visibleLevelIds.has(item.levelId) && !item.hidden);
  return {
    objects: objects.length,
    visibleObjects: visibleObjects.length,
    levels: levels.length,
    visibleLevels: visibleLevelIds.size,
    estimatedMeshes: visibleObjects.reduce((sum, item) => sum + meshEstimateFor(item), 0) + visibleLevelIds.size * 2,
  };
}

function objectFootprint(object) {
  const item = normalizedObject(object);
  const cos = Math.cos(item.rotation);
  const sin = Math.sin(item.rotation);
  const halfWidth = item.size[0] / 2;
  const halfDepth = item.size[2] / 2;
  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, z]) => ({
    x: item.position[0] + cos * x - sin * z,
    z: item.position[2] + sin * x + cos * z,
  }));
}

function footprintBounds(object) {
  const points = objectFootprint(object);
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
  };
}

function boundsArea(bounds) {
  return Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxZ - bounds.minZ);
}

function overlapArea(first, second) {
  const width = Math.max(0, Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX));
  const depth = Math.max(0, Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ));
  return width * depth;
}

function ruleSeverityRank(severity) {
  if (severity === 'error') return 2;
  if (severity === 'warning') return 1;
  return 0;
}

function getRuleSummary(objects, levels) {
  const visibleObjects = objects.map(normalizedObject).filter((object) => !object.hidden);
  const levelMap = new Map(levels.map((level) => [level.id, level]));
  const issues = [];
  const byObject = {};
  const boundsById = new Map(visibleObjects.map((object) => [object.id, footprintBounds(object)]));
  const supportTypes = new Set(['slab', 'driveway', 'gravel-pad', 'garage', 'double-garage', 'shed', 'carport', 'wall', 'retaining-wall']);
  const collisionTypes = new Set(['garage', 'double-garage', 'shed', 'carport', 'water-tank', 'utility-box']);
  const slabRequiredTypes = new Set(['garage', 'double-garage', 'shed', 'carport', 'water-tank', 'utility-box']);
  const upperSupportRequiredTypes = new Set(['slab', 'garage', 'double-garage', 'shed', 'carport', 'water-tank', 'utility-box']);

  const addIssue = (issue) => {
    issues.push(issue);
    issue.objectIds.forEach((id) => {
      byObject[id] = byObject[id] || [];
      byObject[id].push(issue);
    });
  };

  for (let index = 0; index < visibleObjects.length; index += 1) {
    const first = visibleObjects[index];
    if (!collisionTypes.has(first.type)) continue;
    for (let nextIndex = index + 1; nextIndex < visibleObjects.length; nextIndex += 1) {
      const second = visibleObjects[nextIndex];
      if (first.levelId !== second.levelId || !collisionTypes.has(second.type)) continue;
      const overlap = overlapArea(boundsById.get(first.id), boundsById.get(second.id));
      const smallestArea = Math.min(boundsArea(boundsById.get(first.id)), boundsArea(boundsById.get(second.id)));
      if (smallestArea > 0 && overlap / smallestArea > 0.22) {
        addIssue({
          id: `overlap-${first.id}-${second.id}`,
          severity: 'error',
          title: 'Object collision',
          message: `${first.label} overlaps ${second.label}.`,
          objectIds: [first.id, second.id],
        });
      }
    }
  }

  visibleObjects.forEach((object) => {
    const level = levelMap.get(object.levelId) || levels[0];
    const objectBounds = boundsById.get(object.id);
    const objectArea = Math.max(0.01, boundsArea(objectBounds));
    const lowerSupports = visibleObjects.filter((candidate) => {
      const candidateLevel = levelMap.get(candidate.levelId) || levels[0];
      return candidate.id !== object.id && supportTypes.has(candidate.type) && candidateLevel.elevation < level.elevation;
    });
    const upperLevelOverlap = lowerSupports.some((candidate) => overlapArea(objectBounds, boundsById.get(candidate.id)) / objectArea > 0.18);

    if (level.elevation > 0 && upperSupportRequiredTypes.has(object.type) && !upperLevelOverlap) {
      addIssue({
        id: `support-${object.id}`,
        severity: 'error',
        title: 'Missing support below',
        message: `${object.label} is on ${level.name} without enough support below.`,
        objectIds: [object.id],
      });
    }

    if (slabRequiredTypes.has(object.type) && level.elevation === 0) {
      const sameLevelSupports = visibleObjects.filter((candidate) => {
        if (candidate.id === object.id || candidate.levelId !== object.levelId) return false;
        return ['slab', 'driveway', 'gravel-pad'].includes(candidate.type);
      });
      const hasBase = sameLevelSupports.some((candidate) => overlapArea(objectBounds, boundsById.get(candidate.id)) / objectArea > 0.35);
      if (!hasBase) {
        addIssue({
          id: `base-${object.id}`,
          severity: 'warning',
          title: 'Needs base surface',
          message: `${object.label} should sit on a slab, driveway, or gravel pad.`,
          objectIds: [object.id],
        });
      }
    }

    if (['wall', 'retaining-wall'].includes(object.type)) {
      if (object.size[0] > 7) {
        addIssue({
          id: `long-wall-${object.id}`,
          severity: 'warning',
          title: 'Long wall segment',
          message: `${object.label} is longer than 7m. Add posts or split into supported spans.`,
          objectIds: [object.id],
        });
      }
      if (object.size[1] / Math.max(0.05, object.size[2]) > 16) {
        addIssue({
          id: `thin-wall-${object.id}`,
          severity: 'warning',
          title: 'Tall thin wall',
          message: `${object.label} is tall relative to its thickness.`,
          objectIds: [object.id],
        });
      }
    }

    if (object.type === 'driveway' && Math.min(object.size[0], object.size[2]) < 3) {
      addIssue({
        id: `driveway-width-${object.id}`,
        severity: 'warning',
        title: 'Narrow driveway',
        message: `${object.label} is narrower than a practical 3m vehicle path.`,
        objectIds: [object.id],
      });
    }
  });

  return {
    issues,
    byObject,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    severityForObject: (id) => {
      const objectIssues = byObject[id] || [];
      return objectIssues.reduce((highest, issue) => (ruleSeverityRank(issue.severity) > ruleSeverityRank(highest) ? issue.severity : highest), 'ok');
    },
  };
}

function createRuleCorrections(objects, levels, ruleSummary) {
  const normalized = objects.map(normalizedObject);
  const byId = new Map(normalized.map((object) => [object.id, object]));
  const supportIds = new Set(normalized.map((object) => object.id));
  const corrections = [];
  const levelById = new Map(levels.map((level) => [level.id, level]));
  const orderedLevels = [...levels].sort((first, second) => first.elevation - second.elevation);

  const addSupportSlab = (object, levelId, labelPrefix) => {
    const id = `auto-support-${object.id}-${levelId}`;
    if (supportIds.has(id)) return;
    supportIds.add(id);
    corrections.push(makeObject('slab', {
      id,
      label: `${labelPrefix} for ${object.label}`,
      levelId,
      position: [...object.position],
      size: [Math.max(1, object.size[0] + 0.6), 0.16, Math.max(1, object.size[2] + 0.6)],
      materialId: 'concrete',
      notes: 'Auto-added by model checks.',
    }));
  };

  ruleSummary.issues.forEach((issue) => {
    const object = byId.get(issue.objectIds[0]);
    if (!object) return;

    if (issue.title === 'Missing support below') {
      const currentLevel = levelById.get(object.levelId) || orderedLevels[0];
      const lowerLevel = [...orderedLevels].reverse().find((level) => level.elevation < currentLevel.elevation);
      if (lowerLevel) addSupportSlab(object, lowerLevel.id, 'Support slab');
    }

    if (issue.title === 'Needs base surface') {
      addSupportSlab(object, object.levelId, 'Base slab');
    }
  });

  return corrections;
}

function cloneObjects(objects) {
  return objects.map((item) => ({
    ...item,
    position: [...item.position],
    size: [...item.size],
  }));
}

function cloneLevels(levels) {
  return levels.map((level) => ({ ...level }));
}

function readSavedProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeProject({ projectName, levels, objects, measurements, selectedId, hasSeenWelcome }) {
  return {
    version: 4,
    projectName,
    hasSeenWelcome,
    lastEditedAt: new Date().toISOString(),
    levels,
    objects,
    measurements,
    selectedId,
  };
}

function demoMeasurements() {
  return [
    { id: 'demo-measure-drive', levelId: 'ground', start: [-7, 6.2], end: [-3.4, 6.2] },
    { id: 'demo-measure-yard', levelId: 'ground', start: [-7, -5.4], end: [7, -5.4] },
  ];
}

function normalizeLevels(levels) {
  if (!Array.isArray(levels) || !levels.length) return cloneLevels(defaultLevels);
  return levels.map((level, index) => ({
    id: level.id || `level-${index}`,
    name: level.name || `Level ${index + 1}`,
    elevation: Number.isFinite(Number(level.elevation)) ? Number(level.elevation) : index * 3,
    visible: level.visible !== false,
  }));
}

function levelFor(levels, levelId) {
  return levels.find((level) => level.id === levelId) || levels[0] || defaultLevels[0];
}

function materialStyle(item) {
  const material = materialFor(item.materialId);
  return {
    color: item.color || material.color,
    roughness: material.roughness ?? 0.65,
    metalness: material.metalness ?? 0.05,
  };
}

function createObject3D(item, { interactive = true, levels = defaultLevels, shadows = true, ruleSeverity = 'ok' } = {}) {
  const object = normalizedObject(item);
  const level = levelFor(levels, object.levelId);
  const group = new THREE.Group();
  group.name = object.label;
  group.userData.planId = object.id;

  const material = new THREE.MeshStandardMaterial({
    ...materialStyle(object),
    emissive: ruleSeverity === 'error' ? '#7f1d1d' : ruleSeverity === 'warning' ? '#854d0e' : '#000000',
    emissiveIntensity: ruleSeverity === 'error' ? 0.22 : ruleSeverity === 'warning' ? 0.16 : 0,
  });

  if (object.type === 'tree') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, object.size[1] * 0.42, 16),
      new THREE.MeshStandardMaterial({ color: '#7c4a2d', roughness: 0.8 }),
    );
    trunk.position.y = (object.size[1] * 0.42) / 2;

    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(object.size[0], object.size[2]) * 0.55, object.size[1] * 0.65, 24),
      material,
    );
    crown.position.y = object.size[1] * 0.72;
    group.add(trunk, crown);
  } else if (object.type === 'car') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(object.size[0], object.size[1] * 0.45, object.size[2]), material);
    body.position.y = object.size[1] * 0.32;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(object.size[0] * 0.72, object.size[1] * 0.38, object.size[2] * 0.45),
      new THREE.MeshStandardMaterial({ color: '#dbeafe', roughness: 0.35 }),
    );
    cabin.position.y = object.size[1] * 0.72;
    cabin.position.z = -object.size[2] * 0.05;
    group.add(body, cabin);
  } else if (object.type === 'garage' || object.type === 'double-garage' || object.type === 'shed') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(object.size[0], object.size[1], object.size[2]), material);
    body.position.y = object.size[1] / 2;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(object.size[0] * 0.46, object.size[1] * 0.58, 0.035),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.55 }),
    );
    door.position.set(0, object.size[1] * 0.32, object.size[2] / 2 + 0.022);
    group.add(body, door);
  } else if (object.type === 'water-tank') {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(object.size[0] / 2, object.size[0] / 2, object.size[1], 32), material);
    tank.position.y = object.size[1] / 2;
    group.add(tank);
  } else {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(object.size[0], object.size[1], object.size[2]), material);
    mesh.position.y = object.size[1] / 2;
    group.add(mesh);
  }

  group.position.set(object.position[0], level.elevation, object.position[2]);
  group.rotation.y = object.rotation;
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = interactive && shadows;
      child.receiveShadow = shadows;
      child.userData.planId = object.id;
    }
  });
  return group;
}

function ProjectViewer({
  objects,
  levels,
  ruleSummary,
  selectedId,
  setSelectedId,
  updateObject,
  beginLiveChange,
  updateObjectLive,
  commitLiveChange,
  transformMode,
  quality,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const objectMapRef = useRef(new Map());
  const transformRef = useRef(null);
  const selectedIdRef = useRef(selectedId);
  const updateRef = useRef(updateObject);
  const objectsRef = useRef(objects);
  const levelsRef = useRef(levels);
  const beginLiveChangeRef = useRef(beginLiveChange);
  const updateObjectLiveRef = useRef(updateObjectLive);
  const commitLiveChangeRef = useRef(commitLiveChange);
  const qualityConfig = qualityPresets[quality] || qualityPresets.medium;

  useEffect(() => {
    selectedIdRef.current = selectedId;
    updateRef.current = updateObject;
    objectsRef.current = objects;
    levelsRef.current = levels;
    beginLiveChangeRef.current = beginLiveChange;
    updateObjectLiveRef.current = updateObjectLive;
    commitLiveChangeRef.current = commitLiveChange;
  }, [beginLiveChange, commitLiveChange, levels, objects, selectedId, updateObject, updateObjectLive]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef3f8');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
    camera.position.set(9, 8, 10);

    const qualityConfig = qualityPresets[quality] || qualityPresets.medium;
    const renderer = new THREE.WebGLRenderer({ antialias: qualityConfig.antialias });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityConfig.pixelRatio));
    renderer.shadowMap.enabled = qualityConfig.shadows;
    container.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.target.set(0, 0.7, 0);

    const hemi = new THREE.HemisphereLight('#ffffff', '#a6b0bd', 2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(7, 12, 6);
    sun.castShadow = qualityConfig.shadows;
    sun.shadow.mapSize.width = quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.height = quality === 'high' ? 2048 : 1024;
    scene.add(sun);

    const levelGuides = new THREE.Group();
    levelGuides.name = 'Level guides';
    scene.add(levelGuides);
    levels.forEach((level, index) => {
      if (!level.visible) return;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(gridMeters, gridMeters),
        new THREE.MeshStandardMaterial({
          color: index === 0 ? '#dfe7dc' : '#d8e6f3',
          opacity: index === 0 ? 1 : qualityConfig.levelOpacity,
          transparent: index !== 0,
          roughness: 0.9,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = level.elevation;
      floor.receiveShadow = qualityConfig.shadows;
      levelGuides.add(floor);
      const grid = new THREE.GridHelper(gridMeters, gridMeters, '#8fa097', '#c9d4cf');
      grid.position.y = level.elevation + 0.01;
      levelGuides.add(grid);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const transform = new TransformControls(camera, renderer.domElement);
    transformRef.current = transform;
    const transformHelper = transform.getHelper();
    scene.add(transformHelper);

    transform.addEventListener('dragging-changed', (event) => {
      orbit.enabled = !event.value;
      renderer.shadowMap.enabled = qualityConfig.shadows && !event.value;
      const attached = transform.object;
      const id = attached?.userData.planId;
      if (event.value && id) beginLiveChangeRef.current(id);
      if (!event.value) commitLiveChangeRef.current(id);
    });
    transform.addEventListener('objectChange', () => {
      const attached = transform.object;
      const id = attached?.userData.planId;
      if (!id) return;
      const currentObject = objectsRef.current.find((item) => item.id === id);
      const level = levelFor(levelsRef.current, currentObject?.levelId);
      updateObjectLiveRef.current(id, {
        position: [snap(attached.position.x), 0, snap(attached.position.z)],
        rotation: attached.rotation.y,
      });
      attached.position.y = level.elevation;
    });

    const pickObject = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const hit = hits.find((entry) => entry.object.userData.planId);
      if (hit) {
        setSelectedId(hit.object.userData.planId);
      }
    };
    renderer.domElement.addEventListener('pointerdown', pickObject);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    let frameId;
    const animate = () => {
      orbit.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('pointerdown', pickObject);
      transform.dispose();
      orbit.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [levels, quality, setSelectedId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (const object of objectMapRef.current.values()) {
      scene.remove(object);
    }
    objectMapRef.current.clear();

    objects.forEach((item) => {
      const object = normalizedObject(item);
      if (object.hidden || !levelFor(levels, object.levelId).visible) return;
      const object3D = createObject3D(object, {
        levels,
        shadows: qualityConfig.shadows,
        ruleSeverity: ruleSummary?.severityForObject(object.id) || 'ok',
      });
      objectMapRef.current.set(item.id, object3D);
      scene.add(object3D);
    });
  }, [objects, levels, qualityConfig.shadows, ruleSummary]);

  useEffect(() => {
    const transform = transformRef.current;
    if (!transform) return;
    transform.setMode(transformMode);
    const selected = objectMapRef.current.get(selectedId);
    if (selected) {
      transform.attach(selected);
    } else {
      transform.detach();
    }
  }, [objects, selectedId, transformMode]);

  return <div className="viewer" ref={containerRef} aria-label="Outdoor 3D model editor" />;
}

function TopDownEditor({
  objects,
  levels,
  activeLevelId,
  selectedId,
  setSelectedId,
  updateObject,
  beginLiveChange,
  updateObjectLive,
  commitLiveChange,
  toolMode,
  createObjectFromTool,
  measurements,
  addMeasurement,
  ruleSummary,
}) {
  const [dragId, setDragId] = useState(null);
  const [resizeDrag, setResizeDrag] = useState(null);
  const [draft, setDraft] = useState(null);
  const canvasRef = useRef(null);
  const scale = 32;
  const half = gridMeters / 2;
  const toolLabel = modelingTools.find((tool) => tool.id === toolMode)?.label || 'Select';
  const ruleStatus = ruleSummary?.errors ? 'Blocked' : ruleSummary?.warnings ? 'Needs attention' : 'Looks good';

  const toCanvas = (x, z) => [(x + half) * scale, (z + half) * scale];

  const objectSnapPoints = useMemo(() => {
    const points = [];
    objects.map(normalizedObject).forEach((object) => {
      if (object.hidden || object.levelId !== activeLevelId) return;
      const cos = Math.cos(object.rotation);
      const sin = Math.sin(object.rotation);
      const width = object.size[0] / 2;
      const depth = object.size[2] / 2;
      const localPoints = [
        [0, 0],
        [-width, -depth],
        [width, -depth],
        [width, depth],
        [-width, depth],
      ];
      localPoints.forEach(([lx, lz]) => {
        points.push([
          object.position[0] + cos * lx - sin * lz,
          object.position[2] + sin * lx + cos * lz,
        ]);
      });
    });
    return points;
  }, [activeLevelId, objects]);

  const snapToModel = (x, z) => {
    const gridPoint = [snap(x), snap(z)];
    let nearest = null;
    let nearestDistance = 0.35;
    objectSnapPoints.forEach((point) => {
      const distance = Math.hypot(point[0] - x, point[1] - z);
      if (distance < nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    });
    return nearest ? [snap(nearest[0]), snap(nearest[1])] : gridPoint;
  };

  const fromPointer = (event, shouldSnap = true) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * gridMeters - half;
    const z = ((event.clientY - rect.top) / rect.height) * gridMeters - half;
    return shouldSnap ? snapToModel(x, z) : [x, z];
  };

  const finalizeDraft = (event) => {
    if (!draft) return;
    const end = fromPointer(event);
    const dx = end[0] - draft.start[0];
    const dz = end[1] - draft.start[1];
    const length = Math.hypot(dx, dz);

    if (draft.tool === 'wall' && length >= 0.5) {
      createObjectFromTool('wall', {
        label: 'Drawn wall',
        position: [snap((draft.start[0] + end[0]) / 2), 0, snap((draft.start[1] + end[1]) / 2)],
        size: [Number(length.toFixed(2)), 2.8, 0.22],
        rotation: Math.atan2(dz, dx),
        materialId: 'painted-block',
      });
    }

    if (draft.tool === 'slab' && Math.abs(dx) >= 0.5 && Math.abs(dz) >= 0.5) {
      createObjectFromTool('slab', {
        label: 'Drawn slab',
        position: [snap((draft.start[0] + end[0]) / 2), 0, snap((draft.start[1] + end[1]) / 2)],
        size: [Number(Math.abs(dx).toFixed(2)), 0.12, Number(Math.abs(dz).toFixed(2))],
        materialId: 'concrete',
      });
    }

    if (draft.tool === 'measure' && length >= 0.25) {
      addMeasurement({
        id: `measure-${crypto.randomUUID()}`,
        levelId: activeLevelId,
        start: draft.start,
        end,
      });
    }

    setDraft(null);
  };

  const onPointerMove = (event) => {
    if (draft) {
      setDraft((current) => (current ? { ...current, current: fromPointer(event) } : null));
      return;
    }

    if (resizeDrag) {
      const [x, z] = fromPointer(event, false);
      const dx = x - resizeDrag.pointer[0];
      const dz = z - resizeDrag.pointer[1];
      const cos = Math.cos(resizeDrag.object.rotation);
      const sin = Math.sin(resizeDrag.object.rotation);
      const localDx = cos * dx + sin * dz;
      const localDz = -sin * dx + cos * dz;
      const nextWidth = Math.max(0.25, snap(resizeDrag.object.size[0] + localDx * resizeDrag.handle.x));
      const nextDepth = Math.max(0.25, snap(resizeDrag.object.size[2] + localDz * resizeDrag.handle.z));
      const widthShift = ((nextWidth - resizeDrag.object.size[0]) * resizeDrag.handle.x) / 2;
      const depthShift = ((nextDepth - resizeDrag.object.size[2]) * resizeDrag.handle.z) / 2;
      const worldShiftX = cos * widthShift - sin * depthShift;
      const worldShiftZ = sin * widthShift + cos * depthShift;

      updateObjectLive(resizeDrag.object.id, {
        position: [
          snap(resizeDrag.object.position[0] + worldShiftX),
          0,
          snap(resizeDrag.object.position[2] + worldShiftZ),
        ],
        size: [nextWidth, resizeDrag.object.size[1], nextDepth],
      });
      return;
    }

    if (!dragId) return;
    const [x, z] = fromPointer(event);
    updateObjectLive(dragId, { position: [x, 0, z] });
  };

  const clearInteraction = () => {
    if (dragId) commitLiveChange(dragId);
    if (resizeDrag) commitLiveChange(resizeDrag.object.id);
    setDragId(null);
    setResizeDrag(null);
  };

  const onCanvasPointerDown = (event) => {
    if (toolMode === 'select') {
      setSelectedId('');
      return;
    }
    const point = fromPointer(event);
    setDraft({ tool: toolMode, start: point, current: point });
  };

  const renderDraft = () => {
    if (!draft) return null;
    const [x1, y1] = toCanvas(draft.start[0], draft.start[1]);
    const [x2, y2] = toCanvas(draft.current[0], draft.current[1]);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const length = Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]);
    if (draft.tool === 'slab') {
      return (
        <g className="draft-shape">
          <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={width} height={height} rx="4" />
          <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 10} textAnchor="middle">
            {(width / scale).toFixed(2)}m x {(height / scale).toFixed(2)}m
          </text>
        </g>
      );
    }
    return (
      <g className="draft-shape">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <circle cx={x1} cy={y1} r="5" />
        <circle cx={x2} cy={y2} r="5" />
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10} textAnchor="middle">
          {length.toFixed(2)}m
        </text>
      </g>
    );
  };

  const renderMeasurements = () =>
    measurements
      .filter((measurement) => measurement.levelId === activeLevelId)
      .map((measurement) => {
        const [x1, y1] = toCanvas(measurement.start[0], measurement.start[1]);
        const [x2, y2] = toCanvas(measurement.end[0], measurement.end[1]);
        const length = Math.hypot(measurement.end[0] - measurement.start[0], measurement.end[1] - measurement.start[1]);
        return (
          <g className="persistent-measure" key={measurement.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle">
              {length.toFixed(2)}m
            </text>
          </g>
        );
      });

  const draftStatus = (() => {
    if (!draft) return 'Snap: 0.25m';
    const width = Math.abs(draft.current[0] - draft.start[0]);
    const depth = Math.abs(draft.current[1] - draft.start[1]);
    const length = Math.hypot(width, depth);
    if (draft.tool === 'slab') return `${width.toFixed(2)}m x ${depth.toFixed(2)}m`;
    return `${length.toFixed(2)}m`;
  })();

  return (
    <section
      className={`plan-canvas tool-${toolMode}`}
      ref={canvasRef}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        if (draft) {
          finalizeDraft(event);
          return;
        }
        clearInteraction();
      }}
      onPointerLeave={() => {
        setDraft(null);
        clearInteraction();
      }}
      aria-label="2D top-down outdoor site editor"
    >
      <div className={`canvas-status rule-${ruleSummary?.errors ? 'error' : ruleSummary?.warnings ? 'warning' : 'ok'}`}>
        <strong>{toolLabel}</strong>
        <span>{draftStatus}</span>
        <em>{ruleStatus}</em>
      </div>
      <svg viewBox={`0 0 ${gridMeters * scale} ${gridMeters * scale}`} role="img">
        {Array.from({ length: gridMeters + 1 }, (_, index) => (
          <g key={index}>
            <line x1={index * scale} y1="0" x2={index * scale} y2={gridMeters * scale} />
            <line x1="0" y1={index * scale} x2={gridMeters * scale} y2={index * scale} />
          </g>
        ))}
        {renderMeasurements()}
        {objects.map((item) => {
          const object = normalizedObject(item);
          const level = levelFor(levels, object.levelId);
          if (object.hidden || !level.visible) return null;
          const isActiveLevel = object.levelId === activeLevelId;
          const ruleSeverity = ruleSummary?.severityForObject(object.id) || 'ok';
          const [cx, cy] = toCanvas(item.position[0], item.position[2]);
          const width = Math.max(object.size[0] * scale, 10);
          const depth = Math.max(object.size[2] * scale, 10);
          const isSelected = object.id === selectedId;
          const handles = [
            { key: 'nw', x: -1, z: -1, cursor: 'nwse-resize' },
            { key: 'n', x: 0, z: -1, cursor: 'ns-resize' },
            { key: 'ne', x: 1, z: -1, cursor: 'nesw-resize' },
            { key: 'e', x: 1, z: 0, cursor: 'ew-resize' },
            { key: 'se', x: 1, z: 1, cursor: 'nwse-resize' },
            { key: 's', x: 0, z: 1, cursor: 'ns-resize' },
            { key: 'sw', x: -1, z: 1, cursor: 'nesw-resize' },
            { key: 'w', x: -1, z: 0, cursor: 'ew-resize' },
          ];
          return (
            <g
              key={object.id}
              className={`${isSelected ? 'selected-shape' : ''} ${isActiveLevel ? 'active-level-shape' : 'inactive-level-shape'} rule-${ruleSeverity}`}
              transform={`translate(${cx} ${cy}) rotate(${THREE.MathUtils.radToDeg(object.rotation)})`}
              onPointerDown={(event) => {
                if (toolMode !== 'select') return;
                event.stopPropagation();
                setSelectedId(object.id);
                if (isActiveLevel) {
                  beginLiveChange(object.id);
                  setDragId(object.id);
                }
              }}
            >
              <rect
                x={-width / 2}
                y={-depth / 2}
                width={width}
                height={depth}
                rx="3"
                fill={object.color}
              />
              <text y="4" textAnchor="middle">
                {object.label}
              </text>
              {isSelected && ruleSeverity !== 'ok' && (
                <text y={depth / 2 + 17} textAnchor="middle" className="rule-badge-text">
                  {ruleSeverity === 'error' ? 'Rule error' : 'Rule warning'}
                </text>
              )}
              {!isActiveLevel && (
                <text y="21" textAnchor="middle" className="level-badge-text">
                  {level.name}
                </text>
              )}
              {isSelected && (
                <g>
                  <g className="measurement-lines">
                    <line x1={-width / 2} y1={-depth / 2 - 20} x2={width / 2} y2={-depth / 2 - 20} />
                    <line x1={-width / 2} y1={-depth / 2 - 25} x2={-width / 2} y2={-depth / 2 - 15} />
                    <line x1={width / 2} y1={-depth / 2 - 25} x2={width / 2} y2={-depth / 2 - 15} />
                    <rect x="-36" y={-depth / 2 - 39} width="72" height="18" rx="9" />
                    <text y={-depth / 2 - 26} textAnchor="middle">
                      {object.size[0].toFixed(2)}m
                    </text>
                    <line x1={width / 2 + 20} y1={-depth / 2} x2={width / 2 + 20} y2={depth / 2} />
                    <line x1={width / 2 + 15} y1={-depth / 2} x2={width / 2 + 25} y2={-depth / 2} />
                    <line x1={width / 2 + 15} y1={depth / 2} x2={width / 2 + 25} y2={depth / 2} />
                    <rect x={width / 2 + 24} y="-9" width="72" height="18" rx="9" />
                    <text x={width / 2 + 60} y="4" textAnchor="middle">
                      {object.size[2].toFixed(2)}m
                    </text>
                  </g>
                  <g className="resize-handles">
                    {handles.map((handle) => (
                      <rect
                        key={handle.key}
                        data-testid={`resize-${handle.key}`}
                        className="resize-handle"
                        x={(handle.x * width) / 2 - 5}
                        y={(handle.z * depth) / 2 - 5}
                        width="10"
                        height="10"
                        rx="2"
                        style={{ cursor: handle.cursor }}
                        onPointerDown={(event) => {
                        if (toolMode !== 'select') return;
                        event.stopPropagation();
                        setSelectedId(object.id);
                        beginLiveChange(object.id);
                        setDragId(null);
                          setResizeDrag({
                            object,
                            handle,
                            pointer: fromPointer(event, false),
                          });
                        }}
                      />
                    ))}
                  </g>
                </g>
              )}
            </g>
          );
        })}
        {renderDraft()}
      </svg>
    </section>
  );
}

function Catalog({ addObject, addStarterSet }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const filtered = objectCatalog.filter((item) => {
    const matchesCategory = activeCategory === 'All' || displayCategory(item.category) === activeCategory;
    const matchesQuery = item.label.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Add objects</h2>
        <span className="tag">Homeowner library</span>
      </div>
      <label className="search-field">
        <Search size={16} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search garage, wall, slab..." />
      </label>
      <div className="category-tabs">
        {homeownerCategoryOrder.map((category) => (
          <button
            className={activeCategory === category ? 'active' : ''}
            key={category}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="starter-sets">
        {recommendedStarterSets.map((set) => (
          <button key={set.id} onClick={() => addStarterSet(set)}>
            <strong>{set.label}</strong>
            <span>{set.description}</span>
          </button>
        ))}
      </div>
      <div className="catalog-grid">
        {filtered.map((item) => {
          const Icon = item.icon;
          const material = materialFor(item.materialId);
          return (
            <button key={item.type} className="catalog-button" onClick={() => addObject(item.type)}>
              <Icon size={18} aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{displayCategory(item.category)} · {item.size[0]}m x {item.size[2]}m</small>
              </span>
              <i style={{ '--swatch': material.color }} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ModelingTools({ toolMode, setToolMode, measurements, clearMeasurements, openObjectDrawer }) {
  return (
    <nav className="tool-rail" aria-label="Model tools">
      <div className="tool-grid">
        {modelingTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              className={toolMode === tool.id ? 'active' : ''}
              key={tool.id}
              onClick={() => setToolMode(tool.id)}
              title={tool.label}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{tool.label}</span>
            </button>
          );
        })}
        <button onClick={openObjectDrawer} title="Add object">
          <Plus size={18} aria-hidden="true" />
          <span>Add object</span>
        </button>
      </div>
      <p className="tool-help">{toolHelpText[toolMode]}</p>
      <button className="ghost-button" onClick={clearMeasurements} disabled={!measurements.length}>
        Clear measurements
      </button>
    </nav>
  );
}

function Outliner({ objects, levels, selectedId, setSelectedId, updateObject, removeObject }) {
  const levelNames = new Map(levels.map((level) => [level.id, level.name]));
  const normalized = objects.map(normalizedObject);

  return (
    <section className="panel outliner-panel">
      <div className="panel-heading">
        <h2>Outliner</h2>
        <span className="tag">{normalized.filter((item) => !item.hidden).length} visible</span>
      </div>
      <div className="outliner-list">
        {normalized.map((object) => (
          <div className={selectedId === object.id ? 'active' : ''} key={object.id}>
            <button className="outliner-select" onClick={() => setSelectedId(object.id)}>
              <strong>{object.label}</strong>
              <span>{levelNames.get(object.levelId) || 'Level'} · {object.size[0].toFixed(1)}m</span>
            </button>
            <button
              className="icon-button"
              onClick={() => updateObject(object.id, { hidden: !object.hidden })}
              title={object.hidden ? 'Show object' : 'Hide object'}
              aria-label={object.hidden ? 'Show object' : 'Hide object'}
            >
              {object.hidden ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
            <button
              className="icon-button danger-icon"
              onClick={() => removeObject(object.id)}
              title="Delete object"
              aria-label="Delete object"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function RuleChecksPanel({ ruleSummary, selectedId, setSelectedId, onAutoCorrect }) {
  const selectedIssues = selectedId ? ruleSummary.byObject[selectedId] || [] : [];
  const shownIssues = selectedIssues.length ? selectedIssues : ruleSummary.issues.slice(0, 6);
  const statusLabel = ruleSummary.errors ? 'Blocked' : ruleSummary.warnings ? 'Needs attention' : 'Looks good';

  return (
    <section className={`panel rule-checks ${ruleSummary.errors ? 'has-errors' : ruleSummary.warnings ? 'has-warnings' : 'is-clean'}`}>
      <div className="panel-heading">
        <h2>Build Checks</h2>
        {ruleSummary.issues.length ? <AlertTriangle size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
      </div>
      <div className="rule-score">
        <strong>{statusLabel}</strong>
        <span>{ruleSummary.warnings} warnings</span>
      </div>
      <button className="secondary-button" onClick={onAutoCorrect} disabled={!ruleSummary.issues.length}>
        <ShieldCheck size={18} aria-hidden="true" />
        Auto-fix support
      </button>
      {!ruleSummary.issues.length && <p className="panel-copy">This layout has no obvious support, collision, driveway, or wall-span issues.</p>}
      {!!shownIssues.length && (
        <div className="rule-list">
          {shownIssues.map((issue) => (
            <button
              className={issue.severity}
              key={issue.id}
              onClick={() => setSelectedId(issue.objectIds[0])}
            >
              <span>{issue.severity === 'error' ? 'Blocked' : 'Needs attention'}</span>
              <strong>{issue.title}</strong>
              <small>{issue.message}</small>
              <em>{issue.title.includes('support') || issue.title.includes('base') ? 'Try Auto-fix support' : 'Select object'}</em>
            </button>
          ))}
        </div>
      )}
      {selectedIssues.length > 0 && <p className="panel-copy">Showing checks for the selected object.</p>}
    </section>
  );
}

function Properties({ selected, levels, updateSelected, removeSelected, duplicateSelected }) {
  const object = selected ? normalizedObject(selected) : null;
  if (!selected) {
    return (
      <section className="panel muted-panel">
        <h2>Properties</h2>
        <p>Select an object in 2D or 3D to edit dimensions, material, color, rough cost, and notes.</p>
      </section>
    );
  }

  const setNumber = (path, value) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    if (path === 'x') updateSelected({ position: [snap(next), 0, object.position[2]] });
    if (path === 'z') updateSelected({ position: [object.position[0], 0, snap(next)] });
    if (path === 'width') updateSelected({ size: [Math.max(0.1, next), object.size[1], object.size[2]] });
    if (path === 'height') updateSelected({ size: [object.size[0], Math.max(0.1, next), object.size[2]] });
    if (path === 'depth') updateSelected({ size: [object.size[0], object.size[1], Math.max(0.1, next)] });
    if (path === 'rotation') updateSelected({ rotation: THREE.MathUtils.degToRad(next) });
    if (path === 'costRate') updateSelected({ costRate: Math.max(0, next) });
  };

  const applyMaterial = (materialId) => {
    const material = materialFor(materialId);
    updateSelected({
      materialId,
      color: material.color,
      costRate: object.costRate || material.unitCost,
    });
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Properties</h2>
        <span className="tag">{object.label}</span>
      </div>
      <div className="field-grid">
        <label>
          X
          <input type="number" step="0.25" value={object.position[0]} onChange={(event) => setNumber('x', event.target.value)} />
        </label>
        <label>
          Z
          <input type="number" step="0.25" value={object.position[2]} onChange={(event) => setNumber('z', event.target.value)} />
        </label>
        <label>
          Width
          <input type="number" step="0.25" value={object.size[0]} onChange={(event) => setNumber('width', event.target.value)} />
        </label>
        <label>
          Height
          <input type="number" step="0.1" value={object.size[1]} onChange={(event) => setNumber('height', event.target.value)} />
        </label>
        <label>
          Depth
          <input type="number" step="0.25" value={object.size[2]} onChange={(event) => setNumber('depth', event.target.value)} />
        </label>
        <label>
          Rotate
          <input
            type="number"
            step="5"
            value={Math.round(THREE.MathUtils.radToDeg(object.rotation))}
            onChange={(event) => setNumber('rotation', event.target.value)}
          />
        </label>
      </div>
      <label>
        Level
        <select value={object.levelId} onChange={(event) => updateSelected({ levelId: event.target.value })}>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name} ({level.elevation}m)
            </option>
          ))}
        </select>
      </label>
      <label>
        Material
        <select value={object.materialId} onChange={(event) => applyMaterial(event.target.value)}>
          {materialPresets.map((material) => (
            <option key={material.id} value={material.id}>
              {material.label}
            </option>
          ))}
        </select>
      </label>
      <div className="swatch-grid" aria-label="Material swatches">
        {materialPresets.map((material) => (
          <button
            className={object.materialId === material.id ? 'active' : ''}
            key={material.id}
            onClick={() => applyMaterial(material.id)}
            title={material.label}
            aria-label={material.label}
            style={{ '--swatch': material.color }}
          />
        ))}
      </div>
      <label className="color-field">
        <PaintBucket size={18} aria-hidden="true" />
        Color
        <input type="color" value={object.color} onChange={(event) => updateSelected({ color: event.target.value })} />
      </label>
      <div className="cost-box">
        <div>
          <span>Quantity</span>
          <strong>{quantityFor(object).toFixed(object.costModel === 'each' ? 0 : 1)} {unitLabelFor(object.costModel)}</strong>
        </div>
        <div>
          <span>Rate</span>
          <strong>{formatMoney(object.costRate)}/{unitLabelFor(object.costModel)}</strong>
        </div>
        <div>
          <span>Estimate</span>
          <strong>{formatMoney(estimateObjectCost(object))}</strong>
        </div>
      </div>
      <label>
        Cost rate
        <input type="number" min="0" step="5" value={object.costRate} onChange={(event) => setNumber('costRate', event.target.value)} />
      </label>
      <label>
        Notes
        <textarea value={object.notes} onChange={(event) => updateSelected({ notes: event.target.value })} placeholder="Example: needs power, drainage, or permit check." />
      </label>
      <button className="ghost-button" onClick={duplicateSelected}>
        <Copy size={18} aria-hidden="true" />
        Duplicate object
      </button>
      <button className="danger-button" onClick={removeSelected}>
        Remove object
      </button>
    </section>
  );
}

function CostSummary({ objects }) {
  const normalized = objects.map(normalizedObject);
  const total = normalized.reduce((sum, item) => sum + estimateObjectCost(item), 0);
  const byCategory = categories
    .filter((category) => category !== 'All')
    .map((category) => ({
      category,
      total: normalized
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + estimateObjectCost(item), 0),
    }))
    .filter((item) => item.total > 0);

  return (
    <section className="panel cost-summary">
      <div className="panel-heading">
        <h2>Rough estimate</h2>
        <DollarSign size={18} aria-hidden="true" />
      </div>
      <div className="total-estimate">{formatMoney(total)}</div>
      <p className="panel-copy">Early planning estimate based on editable rates and dimensions.</p>
      <div className="category-costs">
        {byCategory.map((item) => (
          <div key={item.category}>
            <span>{item.category}</span>
            <strong>{formatMoney(item.total)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function LevelsPanel({ levels, activeLevelId, setActiveLevelId, updateLevelVisibility }) {
  return (
    <section className="panel levels-panel">
      <div className="panel-heading">
        <h2>Levels</h2>
        <Layers3 size={18} aria-hidden="true" />
      </div>
      <div className="level-list">
        {levels.map((level) => (
          <div className={activeLevelId === level.id ? 'active' : ''} key={level.id}>
            <button onClick={() => setActiveLevelId(level.id)}>
              <strong>{level.name}</strong>
              <span>{level.elevation}m</span>
            </button>
            <label className="visibility-toggle">
              <input
                type="checkbox"
                checked={level.visible}
                onChange={(event) => updateLevelVisibility(level.id, event.target.checked)}
              />
              Show
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImportPlan({ file, setFile, onImport, isProcessing }) {
  return (
    <section className="panel">
      <h2>Import plan walls</h2>
      <p className="panel-copy">Optional: upload a clean black-and-white plan and add detected walls to this outdoor project.</p>
      <label className="file-button">
        <Upload size={18} aria-hidden="true" />
        Choose plan
        <input type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>
      {file && <div className="selected-file">{file.name}</div>}
      <button className="secondary-button" onClick={onImport} disabled={!file || isProcessing}>
        {isProcessing ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <FileImage size={18} aria-hidden="true" />}
        {isProcessing ? 'Detecting walls' : 'Add detected walls'}
      </button>
    </section>
  );
}

function WelcomeScreen({ onOpenDemo, onStartBlank, onImportPlan }) {
  return (
    <section className="welcome-screen" aria-label="Welcome to Plan2Model">
      <div className="welcome-card">
        <div className="brand-mark large" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <div className="kicker">Outdoor design studio</div>
          <h1>Plan your yard before you build it.</h1>
          <p>Open a polished demo, start with an empty site, or import a floor plan and turn it into an editable 3D layout.</p>
        </div>
        <div className="welcome-actions">
          <button className="primary-button" onClick={onOpenDemo}>
            <Layers3 size={18} aria-hidden="true" />
            Open showcase demo
          </button>
          <button className="secondary-button" onClick={onStartBlank}>
            <Grid3X3 size={18} aria-hidden="true" />
            Start blank yard
          </button>
          <button className="ghost-button" onClick={onImportPlan}>
            <Upload size={18} aria-hidden="true" />
            Import floor plan
          </button>
        </div>
        <div className="next-strip" aria-label="What you can do next">
          {['Draw wall', 'Add garage', 'Change color', 'Check model', 'Export'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommandBar({
  projectName,
  setProjectName,
  objects,
  ruleSummary,
  levels,
  activeLevelId,
  setActiveLevelId,
  workspaceMode,
  setWorkspaceMode,
  undo,
  redo,
  canUndo,
  canRedo,
  exportFormat,
  setExportFormat,
  onExport,
  savedProjects,
  currentProjectId,
  onSwitchProject,
  onSaveProject,
  onNewProject,
}) {
  return (
    <header className="command-bar">
      <div className="command-brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <label>
          <span>Project</span>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
      </div>
      <div className="command-status" aria-label="Project status">
        <span>{objects.length} objects</span>
        <span>{ruleSummary.errors ? 'Blocked' : ruleSummary.warnings ? 'Needs attention' : 'Looks good'}</span>
        <span>{levelFor(levels, activeLevelId).name}</span>
      </div>
      <label className="project-switcher">
        <span>Saved plans</span>
        <select value={currentProjectId} onChange={(event) => onSwitchProject(event.target.value)}>
          {savedProjects.length ? (
            savedProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          ) : (
            <option value={currentProjectId}>Unsaved plan</option>
          )}
        </select>
      </label>
      <div className="level-tabs compact" aria-label="Active level">
        {levels.map((level) => (
          <button
            className={activeLevelId === level.id ? 'active' : ''}
            key={level.id}
            onClick={() => setActiveLevelId(level.id)}
          >
            {level.name}
          </button>
        ))}
      </div>
      <nav className="step-tabs compact" aria-label="Workspace mode">
        {['both', '2d', '3d'].map((view) => (
          <button className={workspaceMode === view ? 'active' : ''} key={view} onClick={() => setWorkspaceMode(view)}>
            {view === 'both' ? '2D + 3D' : view.toUpperCase()}
          </button>
        ))}
      </nav>
      <div className="command-actions">
        <button className="ghost-button icon-text" onClick={undo} disabled={!canUndo}>
          <Undo2 size={17} aria-hidden="true" />
          Undo
        </button>
        <button className="ghost-button icon-text" onClick={redo} disabled={!canRedo}>
          <Redo2 size={17} aria-hidden="true" />
          Redo
        </button>
        <button className="ghost-button icon-text" onClick={onNewProject}>
          <Plus size={17} aria-hidden="true" />
          New
        </button>
        <button className="secondary-button icon-text" onClick={onSaveProject}>
          <Save size={17} aria-hidden="true" />
          Save
        </button>
        <label className="export-select">
          <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
            <option value="glb">GLB</option>
            <option value="obj">OBJ</option>
          </select>
        </label>
        <button className="primary-button icon-text" onClick={onExport}>
          <Download size={17} aria-hidden="true" />
          Export
        </button>
      </div>
    </header>
  );
}

function ObjectDrawer({ isOpen, onClose, addObject, addStarterSet }) {
  if (!isOpen) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="object-drawer" aria-label="Add objects" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading">
          <div>
            <div className="kicker">Object library</div>
            <h2>Add to your plan</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close object library">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <Catalog addObject={addObject} addStarterSet={addStarterSet} />
      </aside>
    </div>
  );
}

function InspectorTabs({
  activeTab,
  setActiveTab,
  selected,
  levels,
  updateSelected,
  removeSelected,
  duplicateSelected,
  ruleSummary,
  selectedId,
  setSelectedId,
  autoCorrectModel,
  objects,
  updateObject,
  removeObject,
  updateLevelVisibility,
  activeLevelId,
  setActiveLevelId,
  file,
  setFile,
  importDetectedWalls,
  isProcessing,
  quality,
  setQuality,
  sceneStats,
  saveProjectFile,
  openProjectFile,
  resetProject,
  loadDemoProject,
}) {
  const tabs = [
    { id: 'properties', label: 'Properties' },
    { id: 'checks', label: 'Checks' },
    { id: 'cost', label: 'Cost' },
    { id: 'layers', label: 'Layers' },
  ];

  return (
    <aside className="inspector-panel">
      <nav className="inspector-tabs" aria-label="Inspector tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="inspector-body">
        {activeTab === 'properties' && (
          <Properties
            selected={selected}
            levels={levels}
            updateSelected={updateSelected}
            removeSelected={removeSelected}
            duplicateSelected={duplicateSelected}
          />
        )}
        {activeTab === 'checks' && (
          <>
            <RuleChecksPanel
              ruleSummary={ruleSummary}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onAutoCorrect={autoCorrectModel}
            />
            <Outliner
              objects={objects}
              levels={levels}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              updateObject={updateObject}
              removeObject={removeObject}
            />
          </>
        )}
        {activeTab === 'cost' && (
          <>
            <CostSummary objects={objects} />
            <section className="panel">
              <h2>Project tools</h2>
              <label className="format-row">
                Quality
                <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                  {Object.entries(qualityPresets).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="stats-grid" aria-label="Scene performance stats">
                <div><span>Visible</span><strong>{sceneStats.visibleObjects}</strong></div>
                <div><span>Meshes</span><strong>{sceneStats.estimatedMeshes}</strong></div>
                <div><span>Levels</span><strong>{sceneStats.visibleLevels}/{sceneStats.levels}</strong></div>
              </div>
              <button className="secondary-button" onClick={saveProjectFile}><Save size={18} aria-hidden="true" />Save JSON</button>
              <button className="ghost-button" onClick={openProjectFile}><FolderOpen size={18} aria-hidden="true" />Open JSON</button>
              <button className="primary-button" onClick={loadDemoProject}><Layers3 size={18} aria-hidden="true" />Load showcase demo</button>
              <button className="ghost-button" onClick={resetProject}><RotateCcw size={18} aria-hidden="true" />Reset local project</button>
            </section>
          </>
        )}
        {activeTab === 'layers' && (
          <>
            <LevelsPanel
              levels={levels}
              activeLevelId={activeLevelId}
              setActiveLevelId={setActiveLevelId}
              updateLevelVisibility={updateLevelVisibility}
            />
            <ImportPlan file={file} setFile={setFile} onImport={importDetectedWalls} isProcessing={isProcessing} />
          </>
        )}
      </div>
    </aside>
  );
}

async function exportScene(objects, format, levels = defaultLevels) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.name = 'Plan2Model Outdoor Project';
  objects.forEach((item) => {
    const object = normalizedObject(item);
    if (!object.hidden) group.add(createObject3D(object, { interactive: false, levels }));
  });
  scene.add(group);

  if (format === 'obj') {
    const text = new OBJExporter().parse(group);
    downloadBlob(text, 'plan2model-project.obj', 'text/plain');
    return;
  }

  try {
    const result = await new GLTFExporter().parseAsync(scene, { binary: true });
    const blob = result instanceof ArrayBuffer
      ? new Blob([result], { type: 'model/gltf-binary' })
      : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
    downloadBlob(blob, 'plan2model-project.glb', blob.type);
  } catch (error) {
    console.error(error);
    throw new Error('Could not export the GLB model.');
  }
}

function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

export default function App() {
  const savedProject = useMemo(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  }, []);
  const initialSavedProjects = useMemo(readSavedProjects, []);
  const initialCurrentProjectId = useMemo(() => {
    const storedId = localStorage.getItem(CURRENT_PROJECT_KEY);
    return storedId || initialSavedProjects[0]?.id || `project-${crypto.randomUUID()}`;
  }, [initialSavedProjects]);
  const storedCurrentProject = initialSavedProjects.find((project) => project.id === initialCurrentProjectId)?.data;
  const initialProjectPayload = storedCurrentProject || savedProject;
  const hasSavedProject = !!(savedProject && !Array.isArray(savedProject) && Array.isArray(savedProject.objects));
  const [objects, setObjects] = useState(() => {
    const savedObjects = Array.isArray(initialProjectPayload) ? initialProjectPayload : initialProjectPayload?.objects;
    return savedObjects ? savedObjects.map(normalizedObject) : cloneObjects(demoObjects).map(normalizedObject);
  });
  const [levels, setLevels] = useState(() => {
    return normalizeLevels(initialProjectPayload?.levels);
  });
  const [measurements, setMeasurements] = useState(() => (Array.isArray(initialProjectPayload?.measurements) ? initialProjectPayload.measurements : demoMeasurements()));
  const [projectName, setProjectName] = useState(initialProjectPayload?.projectName || 'My outdoor plan');
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => localStorage.getItem(WELCOME_KEY) === 'true' || initialProjectPayload?.hasSeenWelcome === true);
  const [savedProjects, setSavedProjects] = useState(initialSavedProjects);
  const [currentProjectId, setCurrentProjectId] = useState(initialCurrentProjectId);
  const [activeInspectorTab, setActiveInspectorTab] = useState('properties');
  const [isObjectDrawerOpen, setIsObjectDrawerOpen] = useState(false);
  const [activeLevelId, setActiveLevelId] = useState('ground');
  const [selectedId, setSelectedId] = useState(initialProjectPayload?.selectedId || (hasSavedProject ? objects[0]?.id : 'demo-garage') || '');
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [workspaceMode, setWorkspaceMode] = useState(() => (window.innerWidth < 920 ? '2d' : 'both'));
  const [toolMode, setToolMode] = useState('select');
  const [transformMode, setTransformMode] = useState('translate');
  const [quality, setQuality] = useState('medium');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [exportFormat, setExportFormat] = useState('glb');
  const projectFileRef = useRef(null);
  const liveChangeStartRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject({
      projectName,
      hasSeenWelcome,
      levels,
      objects,
      measurements,
      selectedId,
    })));
    localStorage.setItem(CURRENT_PROJECT_KEY, currentProjectId);
  }, [currentProjectId, hasSeenWelcome, levels, measurements, objects, projectName, selectedId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (isTyping) return;
      const isUndoShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
      if (isUndoShortcut) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (!selectedId) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, objects, historyPast, historyFuture]);

  const selected = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId]);
  const sceneStats = useMemo(() => getSceneStats(objects, levels), [objects, levels]);
  const ruleSummary = useMemo(() => getRuleSummary(objects, levels), [objects, levels]);

  const commitObjects = (updater, nextSelectedId = selectedId) => {
    setObjects((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      setHistoryPast((past) => [...past.slice(-79), cloneObjects(current)]);
      setHistoryFuture([]);
      setSelectedId(nextSelectedId);
      return cloneObjects(next);
    });
  };

  const updateObject = (id, patch) => {
    commitObjects((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)), id);
  };

  const beginLiveChange = () => {
    if (!liveChangeStartRef.current) {
      liveChangeStartRef.current = cloneObjects(objects);
    }
  };

  const updateObjectLive = (id, patch) => {
    setObjects((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setSelectedId(id);
  };

  const commitLiveChange = (id = selectedId) => {
    const startingObjects = liveChangeStartRef.current;
    if (!startingObjects) return;
    liveChangeStartRef.current = null;
    setHistoryPast((past) => [...past.slice(-79), startingObjects]);
    setHistoryFuture([]);
    if (id) setSelectedId(id);
  };

  const addObject = (type) => {
    const created = makeObject(type, {
      levelId: activeLevelId,
      position: [snap((objects.length % 5) - 2), 0, snap(Math.floor(objects.length / 5) - 1)],
    });
    commitObjects((current) => [...current, created], created.id);
    setToolMode('select');
    setActiveInspectorTab('properties');
    setIsObjectDrawerOpen(false);
  };

  const addStarterSet = (set) => {
    const created = set.types.map((type, index) => makeObject(type, {
      levelId: activeLevelId,
      position: [snap(-2 + index * 1.4), 0, snap(1 + Math.floor(index / 2) * 1.4)],
    }));
    commitObjects((current) => [...current, ...created], created[0]?.id || selectedId);
    setToolMode('select');
    setActiveInspectorTab('properties');
    setIsObjectDrawerOpen(false);
  };

  const createObjectFromTool = (type, overrides) => {
    const created = makeObject(type, {
      ...overrides,
      levelId: activeLevelId,
    });
    commitObjects((current) => [...current, created], created.id);
  };

  const addMeasurement = (measurement) => {
    setMeasurements((current) => [...current, measurement]);
  };

  const currentProjectPayload = () => serializeProject({
    projectName,
    hasSeenWelcome,
    levels,
    objects,
    measurements,
    selectedId,
  });

  const saveCurrentProject = () => {
    const payload = currentProjectPayload();
    const savedRecord = {
      id: currentProjectId,
      name: projectName.trim() || 'Untitled outdoor plan',
      updatedAt: payload.lastEditedAt,
      preview: `${objects.length} objects`,
      data: payload,
    };
    setSavedProjects((current) => {
      const withoutCurrent = current.filter((project) => project.id !== currentProjectId);
      const next = [savedRecord, ...withoutCurrent].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
      return next;
    });
    localStorage.setItem(CURRENT_PROJECT_KEY, currentProjectId);
  };

  const loadSavedProject = (projectId) => {
    const project = savedProjects.find((item) => item.id === projectId);
    if (!project?.data) return;
    const payload = project.data;
    const loadedLevels = normalizeLevels(payload.levels);
    const loadedObjects = Array.isArray(payload.objects) ? payload.objects.map(normalizedObject) : starterObjects;
    setCurrentProjectId(project.id);
    setProjectName(payload.projectName || project.name || 'Saved outdoor plan');
    setLevels(loadedLevels);
    setActiveLevelId(loadedLevels[0]?.id || 'ground');
    setMeasurements(Array.isArray(payload.measurements) ? payload.measurements : []);
    setObjects(cloneObjects(loadedObjects));
    setSelectedId(payload.selectedId || loadedObjects[0]?.id || '');
    setHistoryPast([]);
    setHistoryFuture([]);
    setHasSeenWelcome(true);
    localStorage.setItem(WELCOME_KEY, 'true');
    localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
  };

  const createNewProject = () => {
    const resetObjects = starterObjects.map((item) => ({ ...item, id: `${item.type}-${crypto.randomUUID()}` }));
    const nextProjectId = `project-${crypto.randomUUID()}`;
    setCurrentProjectId(nextProjectId);
    setProjectName('New outdoor plan');
    setLevels(cloneLevels(defaultLevels));
    setActiveLevelId('ground');
    setMeasurements([]);
    setObjects(cloneObjects(resetObjects));
    setSelectedId(resetObjects[0]?.id || '');
    setHistoryPast([]);
    setHistoryFuture([]);
    setHasSeenWelcome(true);
    localStorage.setItem(WELCOME_KEY, 'true');
    localStorage.setItem(CURRENT_PROJECT_KEY, nextProjectId);
  };

  const autoCorrectModel = () => {
    const corrections = createRuleCorrections(objects, levels, ruleSummary);
    if (!corrections.length) return;
    commitObjects((current) => [...current, ...corrections], corrections[0].id);
  };

  const removeSelected = () => {
    commitObjects((current) => current.filter((item) => item.id !== selectedId), '');
  };

  const removeObject = (id) => {
    commitObjects((current) => current.filter((item) => item.id !== id), selectedId === id ? '' : selectedId);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = {
      ...normalizedObject(selected),
      id: `${selected.type}-${crypto.randomUUID()}`,
      label: `${selected.label} copy`,
      position: [snap(selected.position[0] + 0.5), 0, snap(selected.position[2] + 0.5)],
      levelId: selected.levelId || activeLevelId,
      size: [...selected.size],
    };
    commitObjects((current) => [...current, duplicate], duplicate.id);
  };

  const undo = () => {
    setHistoryPast((past) => {
      if (!past.length) return past;
      const previous = past[past.length - 1];
      setHistoryFuture((future) => [cloneObjects(objects), ...future.slice(0, 79)]);
      setObjects(cloneObjects(previous));
      setSelectedId(previous[0]?.id || '');
      return past.slice(0, -1);
    });
  };

  const redo = () => {
    setHistoryFuture((future) => {
      if (!future.length) return future;
      const next = future[0];
      setHistoryPast((past) => [...past.slice(-79), cloneObjects(objects)]);
      setObjects(cloneObjects(next));
      setSelectedId(next[0]?.id || '');
      return future.slice(1);
    });
  };

  const importDetectedWalls = async () => {
    if (!file) return;
    setError('');
    setIsProcessing(true);
    try {
      const payload = await processFloorPlan({
        file,
        settings: { wallHeight: 2.7, wallThickness: 0.2, pixelsPerMeter: 100 },
      });
      const imported = payload.walls.map((wall, index) => {
        const [x1, z1] = wall.start.map((value) => value / 100);
        const [x2, z2] = wall.end.map((value) => value / 100);
        const length = Math.hypot(x2 - x1, z2 - z1);
        return makeObject('wall', {
          id: `detected-wall-${payload.model_id}-${index}`,
          position: [snap((x1 + x2) / 2 - 4), 0, snap((z1 + z2) / 2 - 3)],
          size: [Math.max(0.3, Number(length.toFixed(2))), 2.7, 0.2],
          rotation: Math.atan2(z2 - z1, x2 - x1),
          levelId: activeLevelId,
          materialId: 'painted-block',
        });
      });
      commitObjects((current) => [...current, ...imported], imported[0]?.id || selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveProjectFile = () => {
    downloadBlob(JSON.stringify(currentProjectPayload(), null, 2), `${projectName.trim() || 'plan2model-project'}.json`, 'application/json');
  };

  const loadProjectFile = async (event) => {
    const projectFile = event.target.files?.[0];
    if (!projectFile) return;
    try {
      const text = await projectFile.text();
      const payload = JSON.parse(text);
      const loadedObjects = Array.isArray(payload) ? payload : payload.objects;
      const loadedLevels = normalizeLevels(payload.levels);
      const loadedMeasurements = Array.isArray(payload.measurements) ? payload.measurements : [];
      if (!Array.isArray(loadedObjects)) {
        throw new Error('Project file does not contain an objects array.');
      }
      const normalized = loadedObjects.map((item) => {
        const object = normalizedObject(item);
        return loadedLevels.some((level) => level.id === object.levelId)
          ? object
          : { ...object, levelId: loadedLevels[0].id };
      });
      setLevels(loadedLevels);
      setActiveLevelId(loadedLevels[0]?.id || 'ground');
      setMeasurements(loadedMeasurements);
      setProjectName(payload.projectName || projectFile.name.replace(/\.json$/i, '') || 'Imported project');
      setCurrentProjectId(`project-${crypto.randomUUID()}`);
      setHasSeenWelcome(true);
      localStorage.setItem(WELCOME_KEY, 'true');
      commitObjects(normalized, normalized[0]?.id || '');
      setError('');
    } catch (err) {
      setError(`Could not load project: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const resetProject = () => {
    const resetObjects = starterObjects.map((item) => ({ ...item, id: `${item.type}-${crypto.randomUUID()}` }));
    setLevels(cloneLevels(defaultLevels));
    setActiveLevelId('ground');
    setMeasurements([]);
    setProjectName('Blank yard concept');
    setCurrentProjectId(`project-${crypto.randomUUID()}`);
    setHasSeenWelcome(true);
    localStorage.setItem(WELCOME_KEY, 'true');
    commitObjects(resetObjects, resetObjects[0]?.id || '');
    setError('');
  };

  const loadDemoProject = () => {
    const showcaseLevels = cloneLevels(defaultLevels);
    const showcaseObjects = cloneObjects(demoObjects).map(normalizedObject);
    setLevels(showcaseLevels);
    setActiveLevelId('ground');
    setMeasurements(demoMeasurements());
    setProjectName('Showcase outdoor build');
    setCurrentProjectId(`project-${crypto.randomUUID()}`);
    setHasSeenWelcome(true);
    localStorage.setItem(WELCOME_KEY, 'true');
    setActiveInspectorTab('checks');
    commitObjects(showcaseObjects, 'demo-garage');
    setError('');
  };

  const startBlankProject = () => {
    createNewProject();
    setActiveInspectorTab('properties');
  };

  const startImportFlow = () => {
    setHasSeenWelcome(true);
    localStorage.setItem(WELCOME_KEY, 'true');
    setActiveInspectorTab('layers');
  };

  const updateLevelVisibility = (levelId, visible) => {
    setLevels((current) => current.map((level) => (level.id === levelId ? { ...level, visible } : level)));
  };

  const exportCurrentScene = async () => {
    setError('');
    try {
      await exportScene(objects, exportFormat, levels);
    } catch (err) {
      setError(err.message || 'Export failed.');
    }
  };

  return (
    <main className="app-shell studio-shell">
      {!hasSeenWelcome && (
        <WelcomeScreen
          onOpenDemo={loadDemoProject}
          onStartBlank={startBlankProject}
          onImportPlan={startImportFlow}
        />
      )}

      <CommandBar
        projectName={projectName}
        setProjectName={setProjectName}
        objects={objects}
        ruleSummary={ruleSummary}
        levels={levels}
        activeLevelId={activeLevelId}
        setActiveLevelId={setActiveLevelId}
        workspaceMode={workspaceMode}
        setWorkspaceMode={setWorkspaceMode}
        undo={undo}
        redo={redo}
        canUndo={!!historyPast.length}
        canRedo={!!historyFuture.length}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        onExport={exportCurrentScene}
        savedProjects={savedProjects}
        currentProjectId={currentProjectId}
        onSwitchProject={loadSavedProject}
        onSaveProject={saveCurrentProject}
        onNewProject={createNewProject}
      />

      {error && <div className="error-banner">{error}</div>}

      <div className="studio-layout">
        <ModelingTools
          toolMode={toolMode}
          setToolMode={setToolMode}
          measurements={measurements}
          clearMeasurements={() => setMeasurements([])}
          openObjectDrawer={() => setIsObjectDrawerOpen(true)}
        />

        <section className={`design-stage ${workspaceMode}`}>
          {workspaceMode !== '3d' && (
            <div className="stage-panel">
              <div className="stage-heading">
                <h2>2D site plan</h2>
                <span>{toolHelpText[toolMode]}</span>
              </div>
              <TopDownEditor
                objects={objects}
                levels={levels}
                activeLevelId={activeLevelId}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                updateObject={updateObject}
                beginLiveChange={beginLiveChange}
                updateObjectLive={updateObjectLive}
                commitLiveChange={commitLiveChange}
                toolMode={toolMode}
                createObjectFromTool={createObjectFromTool}
                measurements={measurements}
                addMeasurement={addMeasurement}
                ruleSummary={ruleSummary}
              />
            </div>
          )}
          {workspaceMode !== '2d' && (
            <div className="stage-panel">
              <div className="stage-heading">
                <h2>3D model</h2>
                <div className="mode-controls">
                  {['translate', 'rotate'].map((mode) => (
                    <button className={transformMode === mode ? 'active' : ''} key={mode} onClick={() => setTransformMode(mode)}>
                      <Move3D size={15} aria-hidden="true" />
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <ProjectViewer
                objects={objects}
                levels={levels}
                ruleSummary={ruleSummary}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                updateObject={updateObject}
                beginLiveChange={beginLiveChange}
                updateObjectLive={updateObjectLive}
                commitLiveChange={commitLiveChange}
                transformMode={transformMode}
                quality={quality}
              />
            </div>
          )}
        </section>

        <InspectorTabs
          activeTab={activeInspectorTab}
          setActiveTab={setActiveInspectorTab}
          selected={selected}
          levels={levels}
          updateSelected={(patch) => selected && updateObject(selected.id, patch)}
          removeSelected={removeSelected}
          duplicateSelected={duplicateSelected}
          ruleSummary={ruleSummary}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          autoCorrectModel={autoCorrectModel}
          objects={objects}
          updateObject={updateObject}
          removeObject={removeObject}
          updateLevelVisibility={updateLevelVisibility}
          activeLevelId={activeLevelId}
          setActiveLevelId={setActiveLevelId}
          file={file}
          setFile={setFile}
          importDetectedWalls={importDetectedWalls}
          isProcessing={isProcessing}
          quality={quality}
          setQuality={setQuality}
          sceneStats={sceneStats}
          saveProjectFile={saveProjectFile}
          openProjectFile={() => projectFileRef.current?.click()}
          resetProject={resetProject}
          loadDemoProject={loadDemoProject}
        />
      </div>

      <ObjectDrawer
        isOpen={isObjectDrawerOpen}
        onClose={() => setIsObjectDrawerOpen(false)}
        addObject={addObject}
        addStarterSet={addStarterSet}
      />

      <input
        ref={projectFileRef}
        className="hidden-file"
        type="file"
        accept="application/json,.json"
        onChange={loadProjectFile}
      />
    </main>
  );
}
