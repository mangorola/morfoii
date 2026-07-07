import { useState, useRef, useEffect } from 'react';

interface PigmentConcentration {
  cyan: number;
  magenta: number;
  yellow: number;
  red: number;
  blue: number;
}

type PigmentType = 'cyan' | 'magenta' | 'yellow' | 'red' | 'blue';

const PIGMENTS = [
  { name: 'Cyan', type: 'cyan' as PigmentType, displayColor: 'rgb(0, 255, 255)' },
  { name: 'Magenta', type: 'magenta' as PigmentType, displayColor: 'rgb(255, 0, 255)' },
  { name: 'Yellow', type: 'yellow' as PigmentType, displayColor: 'rgb(255, 255, 0)' },
  { name: 'Red', type: 'red' as PigmentType, displayColor: 'rgb(255, 0, 0)' },
  { name: 'Blue', type: 'blue' as PigmentType, displayColor: 'rgb(0, 0, 255)' },
] as const;

const DENSITY_SCALE_VALUES = [
  { depositBase: 0.15 },   // Soft
  { depositBase: 0.25 },   // Medium
  { depositBase: 0.4 },    // Strong
  { depositBase: 0.6 },    // Very Strong
  { depositBase: 0.9 },    // Saturated
] as const;

export function ColorBlendGrid() {
  const gridRows = 12;
  const gridCols = 20;

  // Store pigment concentrations for each cell
  const [cellPigments, setCellPigments] = useState<Map<number, PigmentConcentration>>(new Map());
  const [selectedPigment, setSelectedPigment] = useState<PigmentType>('cyan');
  const [brushSize, setBrushSize] = useState(0.8);
  const [opticalDensity, setOpticalDensity] = useState(0.9);
  const [densityScaleIndex, setDensityScaleIndex] = useState(3); // 0-4, default to Very Strong (index 3)
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'pixel' | 'smooth'>('grid');
  const [smoothness, setSmoothness] = useState(3);
  const [hoverCellIndex, setHoverCellIndex] = useState<number | null>(null);
  const [toolMode, setToolMode] = useState<'paint' | 'erase' | 'select'>('paint');

  // Undo/Redo history
  const [history, setHistory] = useState<Map<number, PigmentConcentration>[]>([new Map()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRenderKey = useRef<string>('');
  const renderTimeoutRef = useRef<number | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [columnDisplacements, setColumnDisplacements] = useState<Map<number, number>>(new Map());
  const [previewDisplacement, setPreviewDisplacement] = useState(0);
  const [isDraggingColumns, setIsDraggingColumns] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragStartDisplacement, setDragStartDisplacement] = useState(0);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);

  // Paint drag state
  const [isPaintDragEnabled, setIsPaintDragEnabled] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const paintStrokeStateRef = useRef<Map<number, PigmentConcentration> | null>(null);

  // Animation system - Multi-keyframe timeline
  interface Keyframe {
    id: string;
    columnDisplacements: Map<number, number>;
  }

  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [keyframeDuration, setKeyframeDuration] = useState(1000); // milliseconds per keyframe transition
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [pingPongMode, setPingPongMode] = useState(false);
  const animationStartTimeRef = useRef<number>(0);

  // Convert pigment concentrations to visible RGB color using subtractive mixing
  // Simulates light passing through colored acrylic sheets
  const pigmentsToRgb = (pigments: PigmentConcentration, density: number = opticalDensity): string => {
    // Start with white light (full transmission)
    let r = 1.0;
    let g = 1.0;
    let b = 1.0;

    // Subtractive mixing: each pigment layer absorbs certain wavelengths
    // The optical density controls how strongly each layer filters light

    // Cyan acrylic absorbs red wavelengths
    const cyanAbsorption = Math.min(pigments.cyan, 1) * density;
    r *= (1 - cyanAbsorption);

    // Magenta acrylic absorbs green wavelengths
    const magentaAbsorption = Math.min(pigments.magenta, 1) * density;
    g *= (1 - magentaAbsorption);

    // Yellow acrylic absorbs blue wavelengths
    const yellowAbsorption = Math.min(pigments.yellow, 1) * density;
    b *= (1 - yellowAbsorption);

    // Red acrylic absorbs both green and blue wavelengths
    const redAbsorption = Math.min(pigments.red, 1) * density;
    g *= (1 - redAbsorption * 0.8);
    b *= (1 - redAbsorption * 0.8);

    // Blue acrylic absorbs red and green wavelengths
    const blueAbsorption = Math.min(pigments.blue, 1) * density;
    r *= (1 - blueAbsorption * 0.8);
    g *= (1 - blueAbsorption * 0.8);

    // Convert transmitted light to RGB values (0-255 range)
    const finalR = Math.round(r * 255);
    const finalG = Math.round(g * 255);
    const finalB = Math.round(b * 255);

    return `rgb(${finalR}, ${finalG}, ${finalB})`;
  };

  // Get pigment concentrations for a cell (or default white)
  const getCellPigments = (cellIndex: number): PigmentConcentration => {
    return cellPigments.get(cellIndex) || { cyan: 0, magenta: 0, yellow: 0, red: 0, blue: 0 };
  };

  // Get current displacement for a column (either from animation or manual control)
  const getColumnDisplacement = (col: number): number => {
    if (isAnimating && keyframes.length >= 2) {
      // Calculate which keyframe segment we're in
      const totalSegments = keyframes.length - 1;
      const segmentProgress = animationProgress * totalSegments;
      const currentSegment = Math.floor(segmentProgress);
      const segmentLocalProgress = segmentProgress - currentSegment;

      // Clamp to valid segment range
      const fromIndex = Math.min(currentSegment, keyframes.length - 2);
      const toIndex = fromIndex + 1;

      // Get positions from keyframes
      const startPos = keyframes[fromIndex].columnDisplacements.get(col) || 0;
      const endPos = keyframes[toIndex].columnDisplacements.get(col) || 0;

      // Interpolate between keyframes
      return Math.round(startPos + (endPos - startPos) * segmentLocalProgress);
    } else if (isDraggingColumns && selectedColumns.has(col)) {
      // Manual dragging - show preview
      return previewDisplacement;
    } else {
      // Return stored displacement for this column
      return columnDisplacements.get(col) || 0;
    }
  };

  // Get pigment concentrations with column displacement applied
  const getCellPigmentsWithShift = (row: number, col: number): PigmentConcentration => {
    const displacement = getColumnDisplacement(col);

    if (displacement === 0) {
      const cellIndex = row * gridCols + col;
      return getCellPigments(cellIndex);
    }

    // Apply vertical displacement to column (wrapping around)
    let sourceRow = (row - displacement) % gridRows;
    if (sourceRow < 0) sourceRow += gridRows;

    const sourceIndex = sourceRow * gridCols + col;
    return getCellPigments(sourceIndex);
  };

  // Calculate visible color for a cell with optional preview
  const getCellColor = (row: number, col: number, includePreview: boolean = false): string => {
    // Get pigments with column shift applied
    let pigments = getCellPigmentsWithShift(row, col);

    // Apply preview if hovering (only in paint/erase mode, not in select mode, and not while dragging)
    if (includePreview && hoverCellIndex !== null && !isDraggingColumns && (toolMode === 'paint' || toolMode === 'erase')) {
      const hoverRow = Math.floor(hoverCellIndex / gridCols);
      const hoverCol = hoverCellIndex % gridCols;

      const brushRadius = brushSize * 3;

      const distance = Math.sqrt(
        Math.pow(row - hoverRow, 2) + Math.pow(col - hoverCol, 2)
      );

      if (distance <= brushRadius) {
        // Calculate gradient falloff for smooth edges
        const influence = Math.max(0, 1 - Math.pow(distance / brushRadius, 1.5));

        if (toolMode === 'paint') {
          // Apply both optical density and density scale
          const baseDeposit = DENSITY_SCALE_VALUES[densityScaleIndex].depositBase;
          const depositAmount = baseDeposit * influence * opticalDensity;

          // Create preview pigments by adding the deposit
          pigments = { ...pigments };
          pigments[selectedPigment] = Math.min(1, pigments[selectedPigment] + depositAmount);
        } else if (toolMode === 'erase') {
          // Erase preview - reduce all pigments
          const eraseAmount = influence;
          pigments = { ...pigments };
          pigments.cyan = Math.max(0, pigments.cyan * (1 - eraseAmount));
          pigments.magenta = Math.max(0, pigments.magenta * (1 - eraseAmount));
          pigments.yellow = Math.max(0, pigments.yellow * (1 - eraseAmount));
          pigments.red = Math.max(0, pigments.red * (1 - eraseAmount));
          pigments.blue = Math.max(0, pigments.blue * (1 - eraseAmount));
        }
      }
    }

    return pigmentsToRgb(pigments, opticalDensity);
  };

  // Calculate hover scale effect for a cell (only in select mode)
  const getCellHoverScale = (row: number, col: number): number => {
    if (toolMode !== 'select' || hoverCellIndex === null || isDraggingColumns) {
      return 1;
    }

    const hoverRow = Math.floor(hoverCellIndex / gridCols);
    const hoverCol = hoverCellIndex % gridCols;

    // Only affect the exact cell under the cursor
    if (row === hoverRow && col === hoverCol) {
      return 1.10; // 10% pop-out effect
    }

    return 1;
  };

  // Get preview color for deposit strength indicator
  const getDepositPreviewColor = (): string => {
    const basePigments: PigmentConcentration = { cyan: 0, magenta: 0, yellow: 0, red: 0, blue: 0 };
    const depositAmount = DENSITY_SCALE_VALUES[densityScaleIndex].depositBase * opticalDensity;
    basePigments[selectedPigment] = Math.min(1, depositAmount);
    return pigmentsToRgb(basePigments, opticalDensity);
  };

  // Save current state to history
  const saveToHistory = (newState: Map<number, PigmentConcentration>) => {
    // Remove any future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);

    // Limit history to 50 states to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistoryIndex(newHistory.length - 1);
    }

    setHistory(newHistory);
  };

  // Undo last action
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCellPigments(new Map(history[newIndex]));
    }
  };

  // Redo last undone action
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCellPigments(new Map(history[newIndex]));
    }
  };

  // Apply pigment to cells at a specific position (shared by click and drag painting)
  const applyPaintAtPosition = (clickedIndex: number, targetCellPigments: Map<number, PigmentConcentration>) => {
    const clickedRow = Math.floor(clickedIndex / gridCols);
    const clickedCol = clickedIndex % gridCols;
    const brushRadius = brushSize * 3;

    // Apply pigment or erase to all cells within brush radius
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const distance = Math.sqrt(
          Math.pow(row - clickedRow, 2) + Math.pow(col - clickedCol, 2)
        );

        if (distance <= brushRadius) {
          const cellIndex = row * gridCols + col;
          const currentPigments = targetCellPigments.get(cellIndex) || { cyan: 0, magenta: 0, yellow: 0, red: 0, blue: 0 };

          // Calculate gradient falloff for smooth edges
          const influence = Math.max(0, 1 - Math.pow(distance / brushRadius, 1.5));

          if (toolMode === 'paint') {
            // Apply both optical density and density scale
            const baseDeposit = DENSITY_SCALE_VALUES[densityScaleIndex].depositBase;
            const depositAmount = baseDeposit * influence * opticalDensity;

            // Accumulate pigment (can build up indefinitely)
            const newPigments = { ...currentPigments };
            newPigments[selectedPigment] = Math.min(1, currentPigments[selectedPigment] + depositAmount);

            targetCellPigments.set(cellIndex, newPigments);
          } else if (toolMode === 'erase') {
            // Erase pigments
            const eraseAmount = influence;
            const newPigments = { ...currentPigments };
            newPigments.cyan = Math.max(0, currentPigments.cyan * (1 - eraseAmount));
            newPigments.magenta = Math.max(0, currentPigments.magenta * (1 - eraseAmount));
            newPigments.yellow = Math.max(0, currentPigments.yellow * (1 - eraseAmount));
            newPigments.red = Math.max(0, currentPigments.red * (1 - eraseAmount));
            newPigments.blue = Math.max(0, currentPigments.blue * (1 - eraseAmount));

            // Only store if there's still pigment, otherwise remove from map
            if (newPigments.cyan > 0.001 || newPigments.magenta > 0.001 ||
                newPigments.yellow > 0.001 || newPigments.red > 0.001 || newPigments.blue > 0.001) {
              targetCellPigments.set(cellIndex, newPigments);
            } else {
              targetCellPigments.delete(cellIndex);
            }
          }
        }
      }
    }
  };

  // Handle cell click (single click painting or starting drag painting)
  const handleCellClick = (clickedIndex: number, isColumnSelectMode: boolean, e?: React.MouseEvent) => {
    const clickedRow = Math.floor(clickedIndex / gridCols);
    const clickedCol = clickedIndex % gridCols;

    if (isColumnSelectMode) {
      // Column selection mode - start drag on mouse down
      if (e) {
        e.preventDefault();
        handleColumnMouseDown(e, clickedCol);
      } else {
        handleColumnSelection(clickedCol);
      }
    } else {
      // Paint or Erase mode
      if (isPaintDragEnabled) {
        // Start drag painting - initialize stroke state
        setIsPainting(true);
        paintStrokeStateRef.current = new Map(cellPigments);
        applyPaintAtPosition(clickedIndex, paintStrokeStateRef.current);
        setCellPigments(new Map(paintStrokeStateRef.current));
      } else {
        // Single click mode - apply paint and save to history immediately
        const newCellPigments = new Map(cellPigments);
        applyPaintAtPosition(clickedIndex, newCellPigments);
        setCellPigments(newCellPigments);
        saveToHistory(newCellPigments);
      }
    }
  };

  // Handle drag painting
  const handlePaintDrag = (cellIndex: number) => {
    if (!isPainting || !paintStrokeStateRef.current) return;

    applyPaintAtPosition(cellIndex, paintStrokeStateRef.current);
    setCellPigments(new Map(paintStrokeStateRef.current));
  };

  // End paint stroke
  const endPaintStroke = () => {
    if (isPainting && paintStrokeStateRef.current) {
      saveToHistory(new Map(paintStrokeStateRef.current));
      paintStrokeStateRef.current = null;
      setIsPainting(false);
    }
  };

  // Cycle through pigments with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const currentIndex = PIGMENTS.findIndex(p => p.type === selectedPigment);
    let newIndex: number;

    if (e.deltaY > 0) {
      // Scroll down - next pigment
      newIndex = (currentIndex + 1) % PIGMENTS.length;
    } else {
      // Scroll up - previous pigment
      newIndex = (currentIndex - 1 + PIGMENTS.length) % PIGMENTS.length;
    }

    setSelectedPigment(PIGMENTS[newIndex].type);
  };

  // Handle column selection on cell click
  const handleColumnSelection = (clickedCol: number) => {
    // Single selection: replace current selection
    const newSelectedColumns = new Set<number>();
    newSelectedColumns.add(clickedCol);
    setSelectedColumns(newSelectedColumns);
  };

  // Handle direct column dragging - mouse down on column
  const handleColumnMouseDown = (e: React.MouseEvent, col: number) => {
    if (isAnimating) return; // Don't allow manual control during animation
    if (toolMode !== 'select') return;

    // Prevent default browser drag behavior
    e.preventDefault();

    // Select the column if not already selected
    if (!selectedColumns.has(col)) {
      const newSelectedColumns = new Set<number>();
      newSelectedColumns.add(col);
      setSelectedColumns(newSelectedColumns);
    }

    // Get current displacement for this column
    const currentDisplacement = columnDisplacements.get(col) || 0;

    setIsDraggingColumns(true);
    setDragStartY(e.clientY);
    setDragStartDisplacement(currentDisplacement);
    setDraggedColumn(col);
    setPreviewDisplacement(currentDisplacement);
  };

  // Handle mouse move during column drag
  const handleColumnMouseMove = (e: MouseEvent) => {
    if (!isDraggingColumns || dragStartY === null) return;

    // Calculate displacement based on vertical mouse movement
    // Each ~30 pixels of movement = 1 row displacement
    const pixelsPerRow = 30;
    const deltaY = dragStartY - e.clientY; // Inverted: up = positive displacement
    const displacement = Math.round(deltaY / pixelsPerRow);
    const newDisplacement = dragStartDisplacement + displacement;

    // Clamp displacement to grid bounds
    const clampedDisplacement = Math.max(-gridRows, Math.min(gridRows, newDisplacement));
    setPreviewDisplacement(clampedDisplacement);
  };

  // Handle mouse up to end column drag
  const handleColumnMouseUp = () => {
    if (!isDraggingColumns) return;

    // Store the displacement for all selected columns BEFORE ending drag
    // This ensures the stored displacement is used immediately when rendering stops using preview
    const newDisplacements = new Map(columnDisplacements);
    selectedColumns.forEach(col => {
      newDisplacements.set(col, previewDisplacement);
    });
    setColumnDisplacements(newDisplacements);

    // End drag state
    setIsDraggingColumns(false);
    setDragStartY(null);
    setDraggedColumn(null);
  };

  // Set up global mouse event listeners for column dragging and paint dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingColumns) {
        handleColumnMouseUp();
      }
      if (isPainting) {
        endPaintStroke();
      }
    };

    if (isDraggingColumns) {
      window.addEventListener('mousemove', handleColumnMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleColumnMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }

    if (isPainting) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingColumns, isPainting, dragStartY, dragStartDisplacement, previewDisplacement, columnDisplacements, selectedColumns]);

  // Bake displacement when switching from select mode to paint/erase mode
  useEffect(() => {
    if (toolMode === 'paint' || toolMode === 'erase') {
      bakeAllDisplacements();
      setSelectedColumns(new Set());
      setPreviewDisplacement(0);
    }
  }, [toolMode]);

  // Cleanup render timeout on unmount
  useEffect(() => {
    return () => {
      if (renderTimeoutRef.current) {
        cancelAnimationFrame(renderTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Bake all column displacements into cell positions
  const bakeAllDisplacements = () => {
    // Check if any column has non-zero displacement
    const hasDisplacements = Array.from(columnDisplacements.values()).some(d => d !== 0);

    if (hasDisplacements) {
      const newCellPigments = new Map<number, PigmentConcentration>();

      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const cellIndex = row * gridCols + col;
          const pigments = getCellPigmentsWithShift(row, col);

          // Only store cells that have pigment
          if (pigments.cyan > 0 || pigments.magenta > 0 || pigments.yellow > 0 || pigments.red > 0 || pigments.blue > 0) {
            newCellPigments.set(cellIndex, pigments);
          }
        }
      }

      setCellPigments(newCellPigments);
      setColumnDisplacements(new Map());
    }
  };

  // Clear column selection
  const handleClearSelection = () => {
    setSelectedColumns(new Set());
    setPreviewDisplacement(0);
  };

  // Select all columns
  const handleSelectAll = () => {
    const allColumns = new Set<number>();
    for (let i = 0; i < gridCols; i++) {
      allColumns.add(i);
    }
    setSelectedColumns(allColumns);
  };

  // Add a new keyframe with current column positions
  const handleAddKeyframe = () => {
    const newKeyframe: Keyframe = {
      id: `keyframe-${Date.now()}-${Math.random()}`,
      columnDisplacements: new Map(columnDisplacements),
    };
    setKeyframes([...keyframes, newKeyframe]);
    setSelectedKeyframeIndex(keyframes.length);
  };

  // Delete a keyframe by index
  const handleDeleteKeyframe = (index: number) => {
    const newKeyframes = keyframes.filter((_, i) => i !== index);
    setKeyframes(newKeyframes);
    if (selectedKeyframeIndex === index) {
      setSelectedKeyframeIndex(null);
    } else if (selectedKeyframeIndex !== null && selectedKeyframeIndex > index) {
      setSelectedKeyframeIndex(selectedKeyframeIndex - 1);
    }
  };

  // Update the selected keyframe with current positions
  const handleUpdateKeyframe = (index: number) => {
    const newKeyframes = [...keyframes];
    newKeyframes[index] = {
      ...newKeyframes[index],
      columnDisplacements: new Map(columnDisplacements),
    };
    setKeyframes(newKeyframes);
  };

  // Jump to a specific keyframe
  const handleJumpToKeyframe = (index: number) => {
    if (index >= 0 && index < keyframes.length) {
      setSelectedKeyframeIndex(index);
      setColumnDisplacements(new Map(keyframes[index].columnDisplacements));
      setIsAnimating(false);
    }
  };

  // Move a keyframe in the timeline
  const handleMoveKeyframe = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= keyframes.length) return;

    const newKeyframes = [...keyframes];
    const [movedKeyframe] = newKeyframes.splice(fromIndex, 1);
    newKeyframes.splice(toIndex, 0, movedKeyframe);
    setKeyframes(newKeyframes);

    // Update selected index if necessary
    if (selectedKeyframeIndex === fromIndex) {
      setSelectedKeyframeIndex(toIndex);
    } else if (selectedKeyframeIndex !== null) {
      if (fromIndex < selectedKeyframeIndex && toIndex >= selectedKeyframeIndex) {
        setSelectedKeyframeIndex(selectedKeyframeIndex - 1);
      } else if (fromIndex > selectedKeyframeIndex && toIndex <= selectedKeyframeIndex) {
        setSelectedKeyframeIndex(selectedKeyframeIndex + 1);
      }
    }
  };

  // Play animation
  const handlePlayAnimation = () => {
    if (keyframes.length < 2) {
      return; // Need at least 2 keyframes to animate
    }
    setIsAnimating(true);
    animationStartTimeRef.current = Date.now();
  };

  // Pause animation
  const handlePauseAnimation = () => {
    setIsAnimating(false);
  };

  // Stop animation and return to start state
  const handleStopAnimation = () => {
    setIsAnimating(false);
    setAnimationProgress(0);
    if (keyframes.length > 0) {
      setColumnDisplacements(new Map(keyframes[0].columnDisplacements));
    }
  };

  // Clear all keyframes
  const handleClearKeyframes = () => {
    setKeyframes([]);
    setSelectedKeyframeIndex(null);
    setAnimationProgress(0);
    setIsAnimating(false);
  };

  // Reset all column positions
  const handleResetColumns = () => {
    bakeAllDisplacements();
    setSelectedColumns(new Set());
    setPreviewDisplacement(0);
  };

  // Animation loop
  useEffect(() => {
    if (!isAnimating || keyframes.length < 2) return;

    let animationFrameId: number;

    const animate = () => {
      const totalDuration = (keyframes.length - 1) * keyframeDuration;
      const elapsed = Date.now() - animationStartTimeRef.current;
      let progress = elapsed / totalDuration;

      if (progress >= 1) {
        if (loopEnabled) {
          if (pingPongMode) {
            // Reverse animation (not implemented in this version - would need separate backward state)
            animationStartTimeRef.current = Date.now();
            setAnimationProgress(0);
          } else {
            // Loop from start
            animationStartTimeRef.current = Date.now();
            setAnimationProgress(0);
          }
        } else {
          // Stop at end
          setAnimationProgress(1);
          setIsAnimating(false);
          return;
        }
      } else {
        setAnimationProgress(Math.max(0, Math.min(1, progress)));
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isAnimating, keyframeDuration, loopEnabled, pingPongMode, keyframes.length]);

  // Render smooth view to canvas - optimized with GPU-accelerated blur
  useEffect(() => {
    if (viewMode !== 'smooth') {
      // Clear canvas when not in smooth mode to free memory
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 1;
          canvasRef.current.height = 1;
        }
      }
      return;
    }

    if (!canvasRef.current) return;

    // Create a render key to detect actual changes
    // Use lower granularity for animation progress to reduce re-renders (20 steps instead of continuous)
    const animKey = isAnimating ? Math.floor(animationProgress * 20) : 0;
    const renderKey = `${cellPigments.size}-${columnDisplacements.size}-${
      Array.from(selectedColumns).join(',')
    }-${previewDisplacement}-${opticalDensity}-${animKey}`;

    // Skip if nothing changed
    if (renderKey === lastRenderKey.current) return;
    lastRenderKey.current = renderKey;

    // Debounce rapid updates (e.g., during animation)
    if (renderTimeoutRef.current) {
      cancelAnimationFrame(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true, // Better performance for animations
      });
      if (!ctx) return;

      // Use moderate resolution - balance between quality and performance
      const cellSize = 60; // Reduced from 80 for better performance
      const newWidth = gridCols * cellSize;
      const newHeight = gridRows * cellSize;

      // Only resize if needed
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }

      // Disable image smoothing for crisp cell rendering before blur
      ctx.imageSmoothingEnabled = false;

      // Render grid cells efficiently
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const color = getCellColor(row, col, false);
          ctx.fillStyle = color;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    });

    return () => {
      if (renderTimeoutRef.current) {
        cancelAnimationFrame(renderTimeoutRef.current);
      }
    };
  }, [viewMode, cellPigments, selectedColumns, columnDisplacements, isDraggingColumns, previewDisplacement, opticalDensity, animationProgress, isAnimating]);

  return (
    <div className={`size-full flex flex-col overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
      {/* Unified Toolbar - Fully Responsive */}
      <div className={`border-b ${
        isDarkMode
          ? 'bg-neutral-800 border-neutral-700'
          : 'bg-white border-neutral-300'
      }`}>
        <div className="px-2 sm:px-4 py-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Tool Mode Selection */}
            <div className="flex gap-1">
              <button
                onClick={() => setToolMode('paint')}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  toolMode === 'paint'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                Paint
              </button>
              <button
                onClick={() => setToolMode('erase')}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  toolMode === 'erase'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                Erase
              </button>
              <button
                onClick={() => setToolMode('select')}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  toolMode === 'select'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                Animate
              </button>
            </div>

            <div className={`hidden sm:block h-5 w-px ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />

            {/* Undo/Redo */}
            <div className="flex gap-1">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                  historyIndex <= 0
                    ? 'opacity-50 cursor-not-allowed bg-neutral-600 text-neutral-400'
                    : isDarkMode
                    ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                }`}
                title="Undo"
              >
                ↶
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                  historyIndex >= history.length - 1
                    ? 'opacity-50 cursor-not-allowed bg-neutral-600 text-neutral-400'
                    : isDarkMode
                    ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                }`}
                title="Redo"
              >
                ↷
              </button>
            </div>

            {/* Paint/Erase Brush Size and Paint Drag Toggle */}
            {(toolMode === 'paint' || toolMode === 'erase') && (
              <>
                <div className={`hidden sm:block h-5 w-px ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />

                {/* Paint Drag Toggle */}
                <button
                  onClick={() => setIsPaintDragEnabled(!isPaintDragEnabled)}
                  className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 whitespace-nowrap ${
                    isPaintDragEnabled
                      ? isDarkMode
                        ? 'bg-green-600 text-white ring-2 ring-green-400'
                        : 'bg-green-500 text-white ring-2 ring-green-300'
                      : isDarkMode
                      ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                      : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                  }`}
                  title={isPaintDragEnabled ? 'Paint Drag: ON - Click and drag to paint' : 'Paint Drag: OFF - Click individual cells to paint'}
                >
                  Paint Drag: {isPaintDragEnabled ? 'ON' : 'OFF'}
                </button>

                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Brush:
                  </span>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className={`text-xs min-w-[32px] ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {brushSize.toFixed(1)}x
                  </span>
                </div>
              </>
            )}

            {/* Animation Mode Controls */}
            {toolMode === 'select' && (
              <>
                <div className={`hidden sm:block h-5 w-px ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />
                <button
                  onClick={handleSelectAll}
                  className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                    isDarkMode
                      ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                      : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                  }`}
                >
                  Select All
                </button>
                <button
                  onClick={handleClearSelection}
                  className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                    isDarkMode
                      ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                      : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                  }`}
                >
                  Deselect
                </button>
                <button
                  onClick={handleResetColumns}
                  className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                    isDarkMode
                      ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                      : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                  }`}
                >
                  Commit
                </button>
                {selectedColumns.size > 0 && (
                  <span className={`text-xs hidden sm:inline ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    ({selectedColumns.size} col{selectedColumns.size !== 1 ? 's' : ''})
                  </span>
                )}
              </>
            )}

            {/* View Mode */}
            <div className={`hidden lg:block h-5 w-px ml-auto ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  viewMode === 'grid'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('pixel')}
                className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  viewMode === 'pixel'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                Pixel
              </button>
              <button
                onClick={() => setViewMode('smooth')}
                className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  viewMode === 'smooth'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                Smooth
              </button>
            </div>

            {/* Smoothness slider - only show in smooth mode */}
            {viewMode === 'smooth' && (
              <>
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Diffusion:
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.5"
                    value={smoothness}
                    onChange={(e) => setSmoothness(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className={`text-xs min-w-[24px] ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {smoothness.toFixed(1)}
                  </span>
                </div>
              </>
            )}

            {/* Clear & Dark Mode */}
            <button
              onClick={() => {
                const newMap = new Map();
                setCellPigments(newMap);
                saveToHistory(newMap);
              }}
              className="px-2 py-2 sm:py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0"
            >
              Clear
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-2 py-2 sm:py-1.5 rounded transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                isDarkMode
                  ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                  : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
              }`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>

          {/* Paint Mode: Color Palette and Controls Row */}
          {toolMode === 'paint' && (
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-neutral-700">
              {/* Color Palette */}
              <div className="flex gap-1 flex-wrap">
                {PIGMENTS.map((pigment) => (
                  <button
                    key={pigment.type}
                    onClick={() => setSelectedPigment(pigment.type)}
                    className="focus:outline-none"
                    title={pigment.name}
                  >
                    <div
                      className={`w-10 h-10 sm:w-8 sm:h-8 rounded transition-all ${
                        selectedPigment === pigment.type
                          ? 'ring-2 ring-white scale-110'
                          : 'ring-1 ring-neutral-500 hover:ring-neutral-400'
                      }`}
                      style={{
                        backgroundColor: pigment.displayColor,
                      }}
                    />
                  </button>
                ))}
              </div>

              <div className={`hidden sm:block h-5 w-px ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />

              {/* Density */}
              <div className="flex items-center gap-2 min-w-[140px] flex-1 sm:flex-initial">
                <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Density:
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={opticalDensity}
                  onChange={(e) => setOpticalDensity(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className={`text-xs min-w-[28px] ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  {(opticalDensity * 100).toFixed(0)}%
                </span>
              </div>

              <div className={`hidden sm:block h-5 w-px ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />

              {/* Deposit Strength - Stepped Control with Tick Marks */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Deposit:
                </span>
                <div className="relative flex items-center flex-1 sm:flex-initial" style={{ minWidth: '100px', maxWidth: '140px', height: '24px' }}>
                  {/* Tick marks background */}
                  <div className="absolute inset-0 flex justify-between items-center px-1" style={{ pointerEvents: 'none' }}>
                    {[0, 1, 2, 3, 4].map((tick) => (
                      <div
                        key={tick}
                        className={`w-1 rounded-full transition-all ${
                          densityScaleIndex === tick
                            ? 'bg-blue-500 h-6'
                            : isDarkMode
                            ? 'bg-neutral-600 h-4'
                            : 'bg-neutral-400 h-4'
                        }`}
                      />
                    ))}
                  </div>
                  {/* Stepped slider */}
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={densityScaleIndex}
                    onChange={(e) => setDensityScaleIndex(parseInt(e.target.value))}
                    className="deposit-strength-slider absolute inset-0 w-full z-10"
                  />
                </div>
                {/* Color Preview Square */}
                <div
                  className="w-10 h-10 sm:w-6 sm:h-6 rounded border-2 flex-shrink-0"
                  style={{
                    backgroundColor: getDepositPreviewColor(),
                    borderColor: isDarkMode ? '#737373' : '#a3a3a3',
                  }}
                  title="Deposit strength preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Animation Controls - Responsive */}
      {toolMode === 'select' && (
      <div className={`border-b ${
        isDarkMode
          ? 'bg-neutral-800 border-neutral-700'
          : 'bg-white border-neutral-300'
      }`}>
        <div className="px-2 sm:px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Keyframe management */}
            <button
              onClick={handleAddKeyframe}
              className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                isDarkMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              + Keyframe
            </button>
            {selectedKeyframeIndex !== null && (
              <button
                onClick={() => handleUpdateKeyframe(selectedKeyframeIndex)}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  isDarkMode
                    ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                }`}
              >
                Update
              </button>
            )}

            <div className={`hidden sm:block h-5 w-px ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`} />

            {/* Playback controls */}
            <div className="flex gap-1">
              <button
                onClick={handlePlayAnimation}
                disabled={keyframes.length < 2}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                  keyframes.length < 2
                    ? 'opacity-50 cursor-not-allowed bg-neutral-600 text-neutral-400'
                    : isAnimating
                    ? 'bg-green-600 text-white'
                    : isDarkMode
                    ? 'bg-neutral-700 text-white hover:bg-green-600'
                    : 'bg-neutral-200 text-neutral-900 hover:bg-green-500 hover:text-white'
                }`}
              >
                ▶
              </button>
              <button
                onClick={handlePauseAnimation}
                disabled={!isAnimating}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                  !isAnimating
                    ? 'opacity-50 cursor-not-allowed bg-neutral-600 text-neutral-400'
                    : isDarkMode
                    ? 'bg-neutral-700 text-white hover:bg-yellow-600'
                    : 'bg-neutral-200 text-neutral-900 hover:bg-yellow-500'
                }`}
              >
                ⏸
              </button>
              <button
                onClick={handleStopAnimation}
                className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                  isDarkMode
                    ? 'bg-neutral-700 text-white hover:bg-red-600'
                    : 'bg-neutral-200 text-neutral-900 hover:bg-red-500 hover:text-white'
                }`}
              >
                ⏹
              </button>
            </div>

            {/* Speed */}
            <div className="flex items-center gap-2 min-w-[140px] flex-1 sm:flex-initial">
              <span className={`text-xs whitespace-nowrap ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Speed:
              </span>
              <input
                type="range"
                min="200"
                max="3000"
                step="100"
                value={keyframeDuration}
                onChange={(e) => setKeyframeDuration(parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className={`text-xs min-w-[32px] ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {(keyframeDuration / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Loop */}
            <button
              onClick={() => setLoopEnabled(!loopEnabled)}
              className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                loopEnabled
                  ? isDarkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : isDarkMode
                  ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
              }`}
            >
              🔁
            </button>

            {isAnimating && (
              <span className={`text-xs hidden sm:inline ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {Math.round(animationProgress * 100)}%
              </span>
            )}

            {/* Keyframe count */}
            <span className={`text-xs hidden sm:inline sm:ml-auto ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''}
            </span>

            {/* Clear keyframes */}
            <button
              onClick={handleClearKeyframes}
              className={`px-2 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                isDarkMode
                  ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                  : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
              }`}
            >
              Clear All
            </button>
          </div>

          {/* Keyframe Timeline */}
          {keyframes.length > 0 && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-neutral-700 overflow-x-auto pb-1">
              <span className={`text-xs mr-1 flex-shrink-0 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Timeline:
              </span>
              {keyframes.map((keyframe, index) => (
                <div key={keyframe.id} className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleJumpToKeyframe(index)}
                    className={`px-3 py-2 sm:px-2 sm:py-1 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                      selectedKeyframeIndex === index
                        ? isDarkMode
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                          : 'bg-blue-500 text-white ring-2 ring-blue-300'
                        : isDarkMode
                        ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                        : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
                    }`}
                  >
                    {index + 1}
                  </button>
                  <button
                    onClick={() => handleDeleteKeyframe(index)}
                    className={`w-8 h-8 sm:w-4 sm:h-4 rounded text-xs font-bold transition-colors flex items-center justify-center ${
                      isDarkMode
                        ? 'bg-red-700 text-white hover:bg-red-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                    title="Delete keyframe"
                  >
                    ×
                  </button>
                  {index < keyframes.length - 1 && (
                    <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-400'}`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}


      {/* Main color grid workspace */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6 gap-2 sm:gap-4">
        {viewMode === 'smooth' ? (
          /* Smooth interpolated canvas view */
          <div className="relative" style={{
            width: 'min(calc(100vw - 16px), calc((100vh - 200px) * 1.67))',
            height: 'min(calc(100vh - 200px), calc((100vw - 16px) * 0.6))',
          }}>
            <canvas
              ref={canvasRef}
              className={`${
                toolMode === 'paint' || toolMode === 'erase'
                  ? 'cursor-crosshair'
                  : isDraggingColumns
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
              }`}
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'auto',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                filter: `blur(${smoothness * 2}px)`,
                transform: 'translateZ(0)', // Force GPU acceleration
                willChange: 'filter', // Hint browser to optimize filter
                backfaceVisibility: 'hidden', // Additional GPU optimization
              }}
              onMouseDown={(e) => {
                if (toolMode === 'select') {
                  e.preventDefault();
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const col = Math.floor((x / rect.width) * gridCols);
                const row = Math.floor((y / rect.height) * gridRows);
                const index = row * gridCols + col;
                handleCellClick(index, toolMode === 'select', e);
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const col = Math.floor((x / rect.width) * gridCols);
                const row = Math.floor((y / rect.height) * gridRows);
                const index = row * gridCols + col;
                setHoverCellIndex(index);
                if (isPainting && isPaintDragEnabled) {
                  handlePaintDrag(index);
                }
              }}
              onMouseLeave={() => setHoverCellIndex(null)}
              onWheel={handleWheel}
              onTouchStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const touch = e.touches[0];
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                const col = Math.floor((x / rect.width) * gridCols);
                const row = Math.floor((y / rect.height) * gridRows);
                const index = row * gridCols + col;
                handleCellClick(index, toolMode === 'select');
              }}
              onTouchMove={(e) => {
                if (isPainting && isPaintDragEnabled) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touch = e.touches[0];
                  const x = touch.clientX - rect.left;
                  const y = touch.clientY - rect.top;
                  const col = Math.floor((x / rect.width) * gridCols);
                  const row = Math.floor((y / rect.height) * gridRows);
                  const index = row * gridCols + col;
                  handlePaintDrag(index);
                  setHoverCellIndex(index);
                }
              }}
              onTouchEnd={() => {
                if (isPainting) {
                  endPaintStroke();
                }
              }}
            />
          </div>
        ) : (
          /* Grid/Pixel discrete cell view */
          <div
            className={`grid ${viewMode === 'grid' ? 'gap-1' : 'gap-0'}`}
            onWheel={handleWheel}
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              width: 'min(calc(100vw - 16px), calc((100vh - 200px) * 1.67))',
              height: 'min(calc(100vh - 200px), calc((100vw - 16px) * 0.6))',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {Array.from({ length: gridRows * gridCols }).map((_, index) => {
              const row = Math.floor(index / gridCols);
              const col = index % gridCols;
              const color = getCellColor(row, col, true);
              const scale = getCellHoverScale(row, col);

              const cursorStyle = toolMode === 'paint' ? 'cursor-crosshair'
                : toolMode === 'erase' ? 'cursor-crosshair'
                : isDraggingColumns ? 'cursor-grabbing'
                : 'cursor-grab';

              return (
                <div
                  key={index}
                  className={`aspect-square transition-all duration-200 ease-out ${cursorStyle} ${viewMode === 'grid' ? 'rounded-sm' : ''}`}
                  style={{
                    backgroundColor: color,
                    transform: `scale(${scale})`,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: 'none',
                  }}
                  onMouseDown={(e) => handleCellClick(index, toolMode === 'select', e)}
                  onMouseEnter={() => {
                    setHoverCellIndex(index);
                    if (isPainting && isPaintDragEnabled) {
                      handlePaintDrag(index);
                    }
                  }}
                  onMouseLeave={() => setHoverCellIndex(null)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleCellClick(index, toolMode === 'select');
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (isPainting && isPaintDragEnabled) {
                      const touch = e.touches[0];
                      const element = document.elementFromPoint(touch.clientX, touch.clientY);
                      if (element) {
                        const touchIndex = parseInt(element.getAttribute('data-cell-index') || '-1');
                        if (touchIndex >= 0) {
                          handlePaintDrag(touchIndex);
                          setHoverCellIndex(touchIndex);
                        }
                      }
                    }
                  }}
                  onTouchEnd={() => {
                    if (isPainting) {
                      endPaintStroke();
                    }
                  }}
                  data-cell-index={index}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
