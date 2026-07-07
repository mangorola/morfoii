import { useEffect, useRef, useState, useCallback } from 'react';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Trash2, Download, Circle, Square, Waves, Droplet, Undo2, Redo2, Pencil, MousePointer2, Eraser, Copy, Check, Grid3x3 } from 'lucide-react';
import svgPaths from '../imports/svg-ef2s3ska44';
import dropletPaths from '../imports/svg-4deehsgp9w';

interface Shape {
  id: string;
  cx: number;
  cy: number;
  r: number;
  nodeRow: number;
  nodeCol: number;
  type: 'circle' | 'square' | 'union' | 'droplet';
  groupId: number;
}

export function GenerativeIconBuilder() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });
  
  // Tool mode: pencil (draw/click/drag shapes), eraser (remove shapes)
  const [activeTool, setActiveTool] = useState<'pencil' | 'eraser'>('pencil');
  
  // Pencil/Eraser drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingNodesRef = useRef<Set<string>>(new Set());
  const shapesRef = useRef<Shape[]>(shapes);
  shapesRef.current = shapes; // Keep ref in sync with state on every render
  
  // History for undo/redo
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const maxHistorySize = 50;
  
  // Shape type toggle
  const [shapeType, setShapeType] = useState<'circle' | 'square' | 'union' | 'droplet'>('circle');
  
  // Filter controls - enhanced gooeyness with curved response, highest sharpness by default
  const [gooeyness, setGooeyness] = useState([50]); // Default at 50 as requested
  const [sharpness, setSharpness] = useState([50]); // Start with maximum sharpness
  
  // Outline mode toggle
  const [outlineMode, setOutlineMode] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState([3]); // Stroke width for outline mode

  // Stroke merge/isolate mode
  const [strokeMode, setStrokeMode] = useState<'merge' | 'isolate'>('merge');
  const nextGroupIdRef = useRef(1); // Group 0 = merge pool, 1+ = isolated strokes
  const currentStrokeGroupIdRef = useRef(0); // Active group for current stroke

  // Grid size
  const [gridSize, setGridSize] = useState(26);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  
  // Focus main container on load to enable keyboard shortcuts immediately
  useEffect(() => {
    if (mainContainerRef.current) {
      mainContainerRef.current.focus({ preventScroll: true });
    }
  }, []);

  // Color controls
  const [shapeColor, setShapeColor] = useState('#ffccfd');
  const [backgroundColor, setBackgroundColor] = useState('#00663a');
  
  // Grid visibility
  const [showGrid, setShowGrid] = useState(true);

  const CANVAS_WIDTH = canvasDimensions.width;
  const CANVAS_HEIGHT = canvasDimensions.height;
  
  // Keep grid cells square - use the smaller dimension to determine cell size
  // Then calculate how many cells fit in each dimension
  const minDimension = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT);
  const CELL_SIZE = minDimension / gridSize;
  
  // Calculate actual grid dimensions to fill the canvas
  const GRID_COLS = Math.ceil(CANVAS_WIDTH / CELL_SIZE);
  const GRID_ROWS = Math.ceil(CANVAS_HEIGHT / CELL_SIZE);
  const GRID_SIZE = gridSize; // Keep for reference
  
  const CELL_WIDTH = CELL_SIZE;
  const CELL_HEIGHT = CELL_SIZE;
  
  const NODE_COUNT_COLS = GRID_COLS + 1;
  const NODE_COUNT_ROWS = GRID_ROWS + 1;
  const NODE_COUNT = Math.max(NODE_COUNT_COLS, NODE_COUNT_ROWS); // For compatibility
  
  const DEFAULT_RADIUS = CELL_SIZE * 0.65; // 0.65x the cell size

  // Scale factor for guidelines (IconFrame is 48x48, our canvas is 800x800)
  const GUIDELINE_SCALE = CANVAS_WIDTH / 48;

  // Handle grid size change — remap existing shapes to new grid dimensions
  const handleGridSizeChange = (newSize: number) => {
    if (newSize === gridSize) return;
    const newCellWidth = CANVAS_WIDTH / newSize;
    const newCellHeight = CANVAS_HEIGHT / newSize;
    const newNodeCount = newSize + 1;
    const newRadius = newCellWidth * 0.65;

    // Remap existing shapes: clamp node positions and recompute pixel coords
    const remapped = shapes.map(shape => {
      const clampedRow = Math.min(shape.nodeRow, newNodeCount - 1);
      const clampedCol = Math.min(shape.nodeCol, newNodeCount - 1);
      return {
        ...shape,
        nodeRow: clampedRow,
        nodeCol: clampedCol,
        cx: clampedCol * newCellWidth,
        cy: clampedRow * newCellHeight,
        r: newRadius,
      };
    });

    // Deduplicate: if multiple shapes now share the same node, keep only the last one
    const seen = new Map<string, number>();
    remapped.forEach((shape, idx) => {
      seen.set(`${shape.nodeRow}-${shape.nodeCol}`, idx);
    });
    const deduped = remapped.filter((_, idx) => {
      return Array.from(seen.values()).includes(idx);
    });

    setGridSize(newSize);
    setShapes(deduped);
    saveToHistory(deduped);
  };

  // History management functions
  const saveToHistory = useCallback((newShapes: Shape[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newShapes]);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setHistoryIndex(prev => {
      const newIndex = Math.min(prev + 1, maxHistorySize - 1);
      return newIndex;
    });
  }, [historyIndex, maxHistorySize]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setShapes([...history[newIndex]]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setShapes([...history[newIndex]]);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard shortcuts when typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        event.preventDefault();
        
        if (event.shiftKey) {
          // Cmd+Shift+Z for redo
          redo();
        } else {
          // Cmd+Z for undo
          undo();
        }
        return;
      }

      // Tool shortcuts (single key, no modifiers)
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'p':
            setActiveTool('pencil');
            break;
          case 'e':
            setActiveTool('eraser');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Curved mapping function for gooeyness - provides more intuitive control
  const mapGooeyness = (value: number) => {
    // Exponential curve: more precision at lower values, dramatic effect at higher values
    const normalized = value / 100; // Normalize to 0-1
    const curved = Math.pow(normalized, 1.8); // Apply curve (1.8 gives good balance)
    return curved * 60; // Scale to 0-60 range for more dramatic effects
  };

  const actualGooeyness = mapGooeyness(gooeyness[0]);

  // Generate grid lines
  const gridLines = [];
  for (let i = 1; i < GRID_COLS; i++) {
    const x = i * CELL_WIDTH;
    gridLines.push(
      <line key={`v${i}`} x1={x} y1={0} x2={x} y2={CANVAS_HEIGHT} className="stroke-gray-300 stroke-2" opacity="0.5" style={{ mixBlendMode: 'multiply' }} />
    );
  }
  for (let i = 1; i < GRID_ROWS; i++) {
    const y = i * CELL_HEIGHT;
    gridLines.push(
      <line key={`h${i}`} x1={0} y1={y} x2={CANVAS_WIDTH} y2={y} className="stroke-gray-300 stroke-2" opacity="0.5" style={{ mixBlendMode: 'multiply' }} />
    );
  }

  // Generate node indicators (small dots at intersections)
  const nodeIndicators = [];
  for (let row = 0; row < NODE_COUNT_ROWS; row++) {
    for (let col = 0; col < NODE_COUNT_COLS; col++) {
      const x = col * CELL_WIDTH;
      const y = row * CELL_HEIGHT;
      nodeIndicators.push(
        <circle
          key={`node-${row}-${col}`}
          cx={x}
          cy={y}
          r="2"
          fill="#94a3b8"
          opacity="0.4"
          className="hover:opacity-100 transition-opacity"
        />
      );
    }
  }

  // Generate professional icon guidelines based on IconFrame
  const generateGuidelines = () => {
    const guidelineColor = "#D0D5DD";
    const strokeWidth = 0.2 * GUIDELINE_SCALE;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    return (
      <g className="guidelines" opacity="0.6">
        {/* Diagonal lines */}
        <line
          x1={0.0707107 * GUIDELINE_SCALE}
          y1={-0.0707107 * GUIDELINE_SCALE}
          x2={48.0707 * GUIDELINE_SCALE}
          y2={47.9293 * GUIDELINE_SCALE}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={CANVAS_WIDTH}
          y1={0}
          x2={0}
          y2={CANVAS_HEIGHT}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />

        {/* Concentric circles */}
        <circle
          cx={centerX}
          cy={centerY}
          r={20 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={22 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={10 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />

        {/* Rounded rectangles */}
        <rect
          x={6 * GUIDELINE_SCALE}
          y={6 * GUIDELINE_SCALE}
          width={36 * GUIDELINE_SCALE}
          height={36 * GUIDELINE_SCALE}
          rx={4 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <rect
          x={4.00001 * GUIDELINE_SCALE}
          y={7.99999 * GUIDELINE_SCALE}
          width={40 * GUIDELINE_SCALE}
          height={32 * GUIDELINE_SCALE}
          rx={4 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <rect
          x={8 * GUIDELINE_SCALE}
          y={4 * GUIDELINE_SCALE}
          width={32 * GUIDELINE_SCALE}
          height={40 * GUIDELINE_SCALE}
          rx={4 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />

        {/* Grid division lines */}
        <line
          x1={12.1 * GUIDELINE_SCALE}
          y1={0}
          x2={12.1 * GUIDELINE_SCALE}
          y2={CANVAS_HEIGHT}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={0}
          y1={12.1 * GUIDELINE_SCALE}
          x2={CANVAS_WIDTH}
          y2={12.1 * GUIDELINE_SCALE}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={24.1 * GUIDELINE_SCALE}
          y1={0}
          x2={24.1 * GUIDELINE_SCALE}
          y2={CANVAS_HEIGHT}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={0}
          y1={24.1 * GUIDELINE_SCALE}
          x2={CANVAS_WIDTH}
          y2={24.1 * GUIDELINE_SCALE}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={36.1 * GUIDELINE_SCALE}
          y1={0}
          x2={36.1 * GUIDELINE_SCALE}
          y2={CANVAS_HEIGHT}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
        <line
          x1={0}
          y1={36.1 * GUIDELINE_SCALE}
          x2={CANVAS_WIDTH}
          y2={36.1 * GUIDELINE_SCALE}
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />

        {/* Outer border */}
        <rect
          x={0.1 * GUIDELINE_SCALE}
          y={0.1 * GUIDELINE_SCALE}
          width={47.8 * GUIDELINE_SCALE}
          height={47.8 * GUIDELINE_SCALE}
          rx={9.5 * GUIDELINE_SCALE}
          fill="none"
          stroke={guidelineColor}
          strokeWidth={strokeWidth}
        />
      </g>
    );
  };

  const addShape = (nodeRow: number, nodeCol: number, radius = DEFAULT_RADIUS) => {
    // Position at grid node (intersection)
    const cx = nodeCol * CELL_WIDTH;
    const cy = nodeRow * CELL_HEIGHT;
    const newShape: Shape = {
      id: `shape-${Date.now()}-${Math.random()}`,
      cx,
      cy,
      r: radius,
      nodeRow,
      nodeCol,
      type: shapeType,
      groupId: strokeMode === 'merge' ? 0 : nextGroupIdRef.current // Default group ID
    };
    
    const newShapes = [...shapes, newShape];
    setShapes(newShapes);
    saveToHistory(newShapes);
  };

  const removeShape = (shapeId: string) => {
    const newShapes = shapes.filter(shape => shape.id !== shapeId);
    setShapes(newShapes);
    saveToHistory(newShapes);
  };

  const updateShapePosition = (shapeId: string, nodeRow: number, nodeCol: number) => {
    const snappedCx = nodeCol * CELL_WIDTH;
    const snappedCy = nodeRow * CELL_HEIGHT;
    
    const newShapes = shapes.map(shape => 
      shape.id === shapeId 
        ? { ...shape, cx: snappedCx, cy: snappedCy, nodeRow, nodeCol }
        : shape
    );
    
    setShapes(newShapes);
    // Only save to history when dragging ends, not during drag
  };

  const findNearestNode = (svgX: number, svgY: number) => {
    // Find the closest grid node
    const nodeCol = Math.round(svgX / CELL_WIDTH);
    const nodeRow = Math.round(svgY / CELL_HEIGHT);
    
    // Clamp to valid node range
    const clampedNodeCol = Math.max(0, Math.min(NODE_COUNT_COLS - 1, nodeCol));
    const clampedNodeRow = Math.max(0, Math.min(NODE_COUNT_ROWS - 1, nodeRow));
    
    return { nodeRow: clampedNodeRow, nodeCol: clampedNodeCol };
  };

  const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    // Focus the main container to ensure keyboard shortcuts work after interacting with the canvas
    if (mainContainerRef.current && document.activeElement !== mainContainerRef.current) {
      mainContainerRef.current.focus({ preventScroll: true });
    }

    if (activeTool !== 'pencil') return; // Only handle clicks in pencil mode
    if (isDragging || selectedShape || isDrawing) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert to SVG coordinates
    const svgX = (x / rect.width) * CANVAS_WIDTH;
    const svgY = (y / rect.height) * CANVAS_HEIGHT;
    
    const { nodeRow, nodeCol } = findNearestNode(svgX, svgY);
    
    // Check if there's already a shape at this node
    const existingShape = shapes.find(shape => 
      shape.nodeRow === nodeRow && shape.nodeCol === nodeCol
    );
    
    if (existingShape) {
      // Remove existing shape if clicked again
      removeShape(existingShape.id);
    } else {
      // Add new shape
      addShape(nodeRow, nodeCol);
    }
  };

  const handleMouseDown = (event: React.MouseEvent, shapeId?: string) => {
    // Focus the main container to ensure keyboard shortcuts work
    if (mainContainerRef.current && document.activeElement !== mainContainerRef.current) {
      mainContainerRef.current.focus({ preventScroll: true });
    }

    if (activeTool !== 'pencil' || !shapeId) return; // Only allow dragging in pencil mode
    event.stopPropagation();
    
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const svgX = (x / rect.width) * CANVAS_WIDTH;
    const svgY = (y / rect.height) * CANVAS_HEIGHT;
    
    setSelectedShape(shapeId);
    setOffset({
      x: svgX - shape.cx,
      y: svgY - shape.cy
    });
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !selectedShape) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const svgX = (x / rect.width) * CANVAS_WIDTH;
    const svgY = (y / rect.height) * CANVAS_HEIGHT;
    
    const newCx = svgX - offset.x;
    const newCy = svgY - offset.y;
    
    const { nodeRow, nodeCol } = findNearestNode(newCx, newCy);
    
    // Update position during drag (without saving to history)
    updateShapePosition(selectedShape, nodeRow, nodeCol);
  };

  const handleMouseUp = () => {
    if (isDragging && selectedShape) {
      // Save to history when drag ends
      saveToHistory(shapes);
    }
    
    setIsDragging(false);
    setSelectedShape(null);
    setOffset({ x: 0, y: 0 });
  };

  const clearCanvas = () => {
    const newShapes: Shape[] = [];
    setShapes(newShapes);
    saveToHistory(newShapes);
  };

  // Helper to convert client coordinates to SVG coordinates
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      svgX: (x / rect.width) * CANVAS_WIDTH,
      svgY: (y / rect.height) * CANVAS_HEIGHT,
    };
  };

  // Pencil tool: place shapes along the drawing path
  const handlePencilNode = (nodeRow: number, nodeCol: number) => {
    const nodeKey = `${nodeRow}-${nodeCol}`;
    if (drawingNodesRef.current.has(nodeKey)) return; // Already visited in this stroke
    drawingNodesRef.current.add(nodeKey);

    // Skip if a shape already exists at this node
    const existing = shapesRef.current.find(
      (s) => s.nodeRow === nodeRow && s.nodeCol === nodeCol
    );
    if (existing) return;

    const cx = nodeCol * CELL_WIDTH;
    const cy = nodeRow * CELL_HEIGHT;
    const newShape: Shape = {
      id: `shape-${Date.now()}-${Math.random()}`,
      cx,
      cy,
      r: DEFAULT_RADIUS,
      nodeRow,
      nodeCol,
      type: shapeType,
      groupId: currentStrokeGroupIdRef.current,
    };

    setShapes((prev) => {
      const updated = [...prev, newShape];
      shapesRef.current = updated;
      return updated;
    });
  };

  // Eraser tool: remove shapes along the drawing path
  const handleEraserNode = (nodeRow: number, nodeCol: number) => {
    const nodeKey = `${nodeRow}-${nodeCol}`;
    if (drawingNodesRef.current.has(nodeKey)) return;
    drawingNodesRef.current.add(nodeKey);

    setShapes((prev) => {
      const updated = prev.filter(
        (s) => !(s.nodeRow === nodeRow && s.nodeCol === nodeCol)
      );
      shapesRef.current = updated;
      return updated;
    });
  };

  // Pencil/Eraser pointer events on the SVG canvas
  const handleDrawingPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    // Focus the main container to ensure keyboard shortcuts work
    if (mainContainerRef.current && document.activeElement !== mainContainerRef.current) {
      mainContainerRef.current.focus({ preventScroll: true });
    }

    if (activeTool !== 'pencil' && activeTool !== 'eraser') return;

    // Shift key enables dragging - let the shape's onMouseDown handler deal with it
    if (event.shiftKey && activeTool === 'pencil') return;

    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);

    const coords = clientToSvg(event.clientX, event.clientY);
    if (!coords) return;

    const { nodeRow, nodeCol } = findNearestNode(coords.svgX, coords.svgY);

    // Option/Alt key removes shapes
    if (event.altKey && activeTool === 'pencil') {
      // Reset visited nodes for this stroke
      drawingNodesRef.current = new Set();
      setIsDrawing(true);
      handleEraserNode(nodeRow, nodeCol);
      return;
    }

    // Assign a new group ID for this stroke when in isolate mode
    if (activeTool === 'pencil' && strokeMode === 'isolate') {
      currentStrokeGroupIdRef.current = nextGroupIdRef.current++;
    } else {
      currentStrokeGroupIdRef.current = 0;
    }

    // Reset visited nodes for this stroke
    drawingNodesRef.current = new Set();
    setIsDrawing(true);

    if (activeTool === 'pencil') {
      handlePencilNode(nodeRow, nodeCol);
    } else {
      handleEraserNode(nodeRow, nodeCol);
    }
  };

  const handleDrawingPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    if (activeTool !== 'pencil' && activeTool !== 'eraser') return;

    const coords = clientToSvg(event.clientX, event.clientY);
    if (!coords) return;

    const { nodeRow, nodeCol } = findNearestNode(coords.svgX, coords.svgY);

    if (activeTool === 'pencil') {
      // If Alt key is pressed during pencil drawing, erase instead
      if (event.altKey) {
        handleEraserNode(nodeRow, nodeCol);
      } else {
        handlePencilNode(nodeRow, nodeCol);
      }
    } else {
      handleEraserNode(nodeRow, nodeCol);
    }
  };

  const handleDrawingPointerUp = () => {
    if (!isDrawing) return;

    // Only save to history if any nodes were actually affected
    if (drawingNodesRef.current.size > 0) {
      saveToHistory(shapesRef.current);
    }

    setIsDrawing(false);
    drawingNodesRef.current = new Set();
  };

  const renderShape = (shape: Shape) => {
    if (shape.type === 'circle') {
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${shapeColor}" />`;
    } else if (shape.type === 'square') {
      // Square/rectangle with rounded corners
      const size = shape.r * 2;
      const x = shape.cx - shape.r;
      const y = shape.cy - shape.r;
      const cornerRadius = Math.min(size * 0.3, 20);
      return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${shapeColor}" />`;
    } else if (shape.type === 'union') {
      // Union shape - scale and position the path
      const size = shape.r * 2;
      const scale = size / 229; // Original viewBox is 229x229
      const x = shape.cx - shape.r;
      const y = shape.cy - shape.r;
      return `<g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="${svgPaths.p2f8e0900}" fill="${shapeColor}" />
      </g>`;
    } else if (shape.type === 'droplet') {
      // Droplet shape - scale and position the path
      const size = shape.r * 2;
      const scale = size / 377; // Original viewBox is 214x377 (height is larger)
      const x = shape.cx - (214 * scale) / 2; // Center horizontally
      const y = shape.cy - shape.r;
      return `<g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="${dropletPaths.pd8d8f00}" fill="${shapeColor}" />
      </g>`;
    }
    return '';
  };

  // Helper: group shapes by groupId
  const groupShapesByGroupId = (shapesToGroup: Shape[]) => {
    const grouped = new Map<number, Shape[]>();
    shapesToGroup.forEach(shape => {
      const group = grouped.get(shape.groupId) || [];
      group.push(shape);
      grouped.set(shape.groupId, group);
    });
    return grouped;
  };

  // Helper: build SVG content string with grouped filter wrappers for export
  const buildGroupedSvgContent = (shapesToRender: Shape[]) => {
    const grouped = groupShapesByGroupId(shapesToRender);
    return Array.from(grouped.values())
      .map(groupShapes =>
        `<g filter="url(#gooey-filter)">\n            ${groupShapes.map(renderShape).join('\n            ')}\n          </g>`
      )
      .join('\n          ');
  };

  // Export PNG with transparent background
  const exportPNG = async () => {
    if (shapes.length === 0) {
      alert('No shapes to export! Create some shapes first.');
      return;
    }

    setIsExporting(true);

    try {
      // Create high-resolution canvas for export
      const scale = 3; // High resolution for crisp PNG
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH * scale;
      canvas.height = CANVAS_HEIGHT * scale;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Create SVG string without background (transparent) and without guidelines
      const svgString = `
        <svg width="${CANVAS_WIDTH * scale}" height="${CANVAS_HEIGHT * scale}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="gooey-filter">
              <feGaussianBlur in="SourceGraphic" stdDeviation="${actualGooeyness}" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${sharpness[0]} ${-(sharpness[0] / 2) + 1}" result="goo" />
              ${outlineMode ? `
                <feMorphology in="goo" operator="dilate" radius="${outlineWidth[0] / 2}" result="dilated" />
                <feComposite in="dilated" in2="goo" operator="xor" result="outline" />
              ` : ''}
            </filter>
          </defs>
          ${buildGroupedSvgContent(shapes)}
        </svg>
      `;

      // Convert SVG to image and draw to canvas (preserving transparency)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Canvas starts transparent by default, so we don't fill with background
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error('Failed to load SVG image'));
        };
        img.src = svgUrl;
      });

      // Download the PNG
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create PNG blob');
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gooey-icon-${Date.now()}${outlineMode ? '-outline' : ''}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');

    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Failed to export PNG. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy PNG to clipboard
  const copyPNG = async () => {
    if (shapes.length === 0) {
      alert('No shapes to copy! Create some shapes first.');
      return;
    }

    setIsCopying(true);

    try {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH * scale;
      canvas.height = CANVAS_HEIGHT * scale;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const svgString = `
        <svg width="${CANVAS_WIDTH * scale}" height="${CANVAS_HEIGHT * scale}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="gooey-filter">
              <feGaussianBlur in="SourceGraphic" stdDeviation="${actualGooeyness}" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${sharpness[0]} ${-(sharpness[0] / 2) + 1}" result="goo" />
              ${outlineMode ? `
                <feMorphology in="goo" operator="dilate" radius="${outlineWidth[0] / 2}" result="dilated" />
                <feComposite in="dilated" in2="goo" operator="xor" result="outline" />
              ` : ''}
            </filter>
          </defs>
          ${buildGroupedSvgContent(shapes)}
        </svg>
      `;

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error('Failed to load SVG image'));
        };
        img.src = svgUrl;
      });

      // Convert canvas to blob and copy to clipboard
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create PNG blob'));
        }, 'image/png');
      });

      // Try modern Clipboard API first, fall back to execCommand
      let copied = false;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        copied = true;
      } catch {
        // Clipboard API blocked by permissions policy — use execCommand fallback
      }

      if (!copied) {
        const dataUrl = canvas.toDataURL('image/png');
        const container = document.createElement('div');
        container.contentEditable = 'true';
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);

        const imgEl = document.createElement('img');
        imgEl.src = dataUrl;
        container.appendChild(imgEl);

        await new Promise<void>((resolve) => {
          imgEl.onload = () => resolve();
          // If already loaded (data URL), resolve immediately
          if (imgEl.complete) resolve();
        });

        const range = document.createRange();
        range.selectNode(imgEl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('copy');
        selection?.removeAllRanges();
        document.body.removeChild(container);
      }

      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);

    } catch (error) {
      console.error('Error copying PNG:', error);
      alert('Failed to copy PNG to clipboard.');
    } finally {
      setIsCopying(false);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDragging && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const svgX = (x / rect.width) * CANVAS_WIDTH;
        const svgY = (y / rect.height) * CANVAS_HEIGHT;
        
        const newCx = svgX - offset.x;
        const newCy = svgY - offset.y;
        
        const { nodeRow, nodeCol } = findNearestNode(newCx, newCy);
        
        updateShapePosition(selectedShape!, nodeRow, nodeCol);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging && selectedShape) {
        // Save to history when drag ends
        saveToHistory(shapes);
      }
      
      setIsDragging(false);
      setSelectedShape(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, selectedShape, offset, shapes, saveToHistory]);

  useEffect(() => {
    const currentRef = containerRef.current;
    if (!currentRef) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasDimensions({ width, height });
      }
    });

    resizeObserver.observe(currentRef);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={mainContainerRef} tabIndex={-1} className="flex h-screen bg-slate-100 outline-none">
      {/* Left Controls Panel */}
      <div className="w-80 flex flex-col bg-white border-r border-slate-200 shadow-sm z-10 relative h-full shrink-0">
        {/* Header - Sticky */}
        <div className="p-5 border-b border-slate-100 bg-white shrink-0">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Gooey</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create fluid, organic icons with metaball effects. Click nodes to place shapes.
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          
          {/* Section: DRAWING TOOLS */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tools</h3>
            
            <div className="flex gap-2">
              <Button
                variant={activeTool === 'pencil' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTool('pencil')}
                className="flex-1 flex items-center gap-2 h-9"
                title="Pencil (P)"
              >
                <Pencil className="w-4 h-4" />
                <span className="text-xs">Pencil</span>
              </Button>
              <Button
                variant={activeTool === 'eraser' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTool('eraser')}
                className="flex-1 flex items-center gap-2 h-9"
                title="Eraser (E)"
              >
                <Eraser className="w-4 h-4" />
                <span className="text-xs">Eraser</span>
              </Button>
            </div>
          </section>

          {/* Section: SHAPES */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shapes</h3>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={shapeType === 'circle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShapeType('circle')}
                className="flex items-center justify-start gap-2 h-9 px-3"
              >
                <Circle className="w-3.5 h-3.5" />
                <span className="text-xs">Circle</span>
              </Button>
              <Button
                variant={shapeType === 'square' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShapeType('square')}
                className="flex items-center justify-start gap-2 h-9 px-3"
              >
                <Square className="w-3.5 h-3.5" />
                <span className="text-xs">Square</span>
              </Button>
              <Button
                variant={shapeType === 'union' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShapeType('union')}
                className="flex items-center justify-start gap-2 h-9 px-3"
              >
                <Waves className="w-3.5 h-3.5" />
                <span className="text-xs">Union</span>
              </Button>
              <Button
                variant={shapeType === 'droplet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShapeType('droplet')}
                className="flex items-center justify-start gap-2 h-9 px-3"
              >
                <Droplet className="w-3.5 h-3.5" />
                <span className="text-xs">Droplet</span>
              </Button>
            </div>
          </section>

          {/* Section: STROKES */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Strokes</h3>

            <div className="flex gap-2">
              <Button
                variant={strokeMode === 'merge' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setStrokeMode('merge')}
                className="flex-1 h-8 text-[11px]"
              >
                Merge
              </Button>
              <Button
                variant={strokeMode === 'isolate' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setStrokeMode('isolate')}
                className="flex-1 h-8 text-[11px]"
              >
                Isolate
              </Button>
            </div>
          </section>

          {/* Section: STYLE */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Style & Effects</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="shape-color" className="text-xs text-slate-500">Shape</Label>
                <div className="flex gap-2 items-center">
                  <input
                    id="shape-color"
                    type="color"
                    value={shapeColor}
                    onChange={(e) => setShapeColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0"
                  />
                  <input
                    type="text"
                    value={shapeColor}
                    onChange={(e) => setShapeColor(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono bg-slate-50"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="background-color" className="text-xs text-slate-500">Background</Label>
                <div className="flex gap-2 items-center">
                  <input
                    id="background-color"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="gooeyness-slider" className="text-xs font-medium">Gooeyness</Label>
                  <span className="text-[10px] text-slate-400 font-mono">{gooeyness[0]}</span>
                </div>
                <Slider
                  id="gooeyness-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={gooeyness}
                  onValueChange={setGooeyness}
                  className="py-1"
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="sharpness-slider" className="text-xs font-medium">Sharpness</Label>
                  <span className="text-[10px] text-slate-400 font-mono">{sharpness[0]}</span>
                </div>
                <Slider
                  id="sharpness-slider"
                  min={1}
                  max={50}
                  step={1}
                  value={sharpness}
                  onValueChange={setSharpness}
                  className="py-1"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label htmlFor="outline-mode" className="text-xs font-medium cursor-pointer">Outline Mode</Label>
                <Switch
                  id="outline-mode"
                  checked={outlineMode}
                  onCheckedChange={setOutlineMode}
                />
              </div>
              
              {outlineMode && (
                <div className="space-y-1.5 pl-1">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="outline-width-slider" className="text-[11px] text-slate-500">Width</Label>
                    <span className="text-[10px] text-slate-400 font-mono">{outlineWidth[0]}px</span>
                  </div>
                  <Slider
                    id="outline-width-slider"
                    min={1}
                    max={10}
                    step={1}
                    value={outlineWidth}
                    onValueChange={setOutlineWidth}
                    className="py-1"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section: CANVAS */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canvas</h3>
            
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Grid Size</Label>
                <div className="flex gap-2">
                  {([12, 20, 26] as const).map(size => (
                    <Button
                      key={size}
                      variant={gridSize === size ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleGridSizeChange(size)}
                      className="flex-1 h-8 text-xs font-medium px-0"
                    >
                      {size}&times;{size}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="show-grid" className="text-xs font-medium cursor-pointer">Show Grid Overlay</Label>
                <Switch
                  id="show-grid"
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <Button
                  onClick={clearCanvas}
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  title="Clear Canvas"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Clear Canvas
                </Button>
              </div>
            </div>
          </section>

        </div>

        {/* Footer Actions - Sticky */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex gap-2">
            <Button
              onClick={exportPNG}
              className="flex-1 h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white"
              disabled={shapes.length === 0 || isExporting}
            >
              {isExporting ? (
                <div className="w-3.5 h-3.5 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Export PNG
            </Button>
            <Button
              onClick={copyPNG}
              variant="outline"
              className="flex-1 h-9 text-xs relative bg-white"
              disabled={shapes.length === 0 || isCopying}
            >
              {isCopying ? (
                <div className="w-3.5 h-3.5 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : copySuccess ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {copySuccess ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

      </div>

      {/* Right Canvas Area */}
      <div className="flex-1 bg-white w-full h-full" ref={containerRef}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className={`select-none ${
            activeTool === 'pencil' ? 'cursor-crosshair' : 
            'cursor-cell'
          }`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onPointerDown={handleDrawingPointerDown}
          onPointerMove={handleDrawingPointerMove}
          onPointerUp={handleDrawingPointerUp}
        >
          <defs>
            <filter id="gooey-filter">
              <feGaussianBlur 
                in="SourceGraphic" 
                stdDeviation={actualGooeyness} 
                result="blur" 
              />
              <feColorMatrix 
                in="blur" 
                mode="matrix" 
                values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${sharpness[0]} ${-(sharpness[0] / 2) + 1}`}
                result="goo" 
              />
              {outlineMode && (
                <>
                  <feMorphology 
                    in="goo" 
                    operator="dilate" 
                    radius={outlineWidth[0] / 2} 
                    result="dilated" 
                  />
                  <feComposite 
                    in="dilated" 
                    in2="goo" 
                    operator="xor" 
                    result="outline" 
                  />
                </>
              )}
            </filter>
          </defs>
          
          {/* Background */}
          <rect x="0" y="0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={backgroundColor} />
          
          {/* Grid lines */}
          {showGrid && <g>{gridLines}</g>}
          
          {/* Node indicators */}
          {showGrid && <g>{nodeIndicators}</g>}
          
          {/* Shapes with gooey filter — grouped by groupId */}
          {Array.from(groupShapesByGroupId(shapes).entries()).map(([groupId, groupShapes]) => (
            <g key={`group-${groupId}`} filter="url(#gooey-filter)">
              {groupShapes.map((shape) => {
                const shapeCursor = activeTool === 'pencil' ? 'cursor-move' : 'cursor-cell';
                
                if (shape.type === 'circle') {
                  return (
                    <circle
                      key={shape.id}
                      cx={shape.cx}
                      cy={shape.cy}
                      r={shape.r}
                      fill={shapeColor}
                      className={shapeCursor}
                      onMouseDown={(e) => handleMouseDown(e, shape.id)}
                    />
                  );
                } else if (shape.type === 'square') {
                  const size = shape.r * 2;
                  const x = shape.cx - shape.r;
                  const y = shape.cy - shape.r;
                  const cornerRadius = Math.min(size * 0.3, 20);
                  return (
                    <rect
                      key={shape.id}
                      x={x}
                      y={y}
                      width={size}
                      height={size}
                      rx={cornerRadius}
                      ry={cornerRadius}
                      fill={shapeColor}
                      className={shapeCursor}
                      onMouseDown={(e) => handleMouseDown(e, shape.id)}
                    />
                  );
                } else if (shape.type === 'union') {
                  const size = shape.r * 2;
                  const scale = size / 229;
                  const x = shape.cx - shape.r;
                  const y = shape.cy - shape.r;
                  return (
                    <g
                      key={shape.id}
                      transform={`translate(${x}, ${y}) scale(${scale})`}
                      className={shapeCursor}
                      onMouseDown={(e) => handleMouseDown(e, shape.id)}
                    >
                      <path
                        d={svgPaths.p2f8e0900}
                        fill={shapeColor}
                      />
                    </g>
                  );
                } else if (shape.type === 'droplet') {
                  const size = shape.r * 2;
                  const scale = size / 377;
                  const x = shape.cx - (214 * scale) / 2;
                  const y = shape.cy - shape.r;
                  return (
                    <g
                      key={shape.id}
                      transform={`translate(${x}, ${y}) scale(${scale})`}
                      className={shapeCursor}
                      onMouseDown={(e) => handleMouseDown(e, shape.id)}
                    >
                      <path
                        d={dropletPaths.pd8d8f00}
                        fill={shapeColor}
                      />
                    </g>
                  );
                }
                return null;
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}