import { useEffect, useRef, useState } from 'react';
import { Slider } from './ui/slider';
import { Label } from './ui/label';

interface GridCell {
  x: number;
  y: number;
  filled: boolean;
}

export function MetaballGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<GridCell[][]>(() => {
    const initialGrid: GridCell[][] = [];
    for (let row = 0; row < 12; row++) {
      initialGrid[row] = [];
      for (let col = 0; col < 12; col++) {
        initialGrid[row][col] = {
          x: col,
          y: row,
          filled: false
        };
      }
    }
    return initialGrid;
  });

  // Control states
  const [spread, setSpread] = useState([1.2]); // Controls how far the effect extends
  const [blur, setBlur] = useState([0.3]); // Controls edge smoothness
  const [contrast, setContrast] = useState([1.0]); // Controls transition sharpness

  const CELL_SIZE = 50;
  const CIRCLE_RADIUS = 20;
  const GRID_SIZE = 12;
  const CANVAS_SIZE = CELL_SIZE * GRID_SIZE;

  const handleCellClick = (row: number, col: number) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(r => r.map(cell => ({ ...cell })));
      newGrid[row][col].filled = !newGrid[row][col].filled;
      return newGrid;
    });
  };

  const getFilledCells = () => {
    const filled: { row: number; col: number }[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid[row][col].filled) {
          filled.push({ row, col });
        }
      }
    }
    return filled;
  };

  const areDiagonal = (cell1: { row: number; col: number }, cell2: { row: number; col: number }) => {
    const rowDiff = Math.abs(cell1.row - cell2.row);
    const colDiff = Math.abs(cell1.col - cell2.col);
    return rowDiff === 1 && colDiff === 1;
  };

  const getDiagonalPairs = (filledCells: { row: number; col: number }[]) => {
    const pairs: Array<[{ row: number; col: number }, { row: number; col: number }]> = [];
    for (let i = 0; i < filledCells.length; i++) {
      for (let j = i + 1; j < filledCells.length; j++) {
        if (areDiagonal(filledCells[i], filledCells[j])) {
          pairs.push([filledCells[i], filledCells[j]]);
        }
      }
    }
    return pairs;
  };

  const distance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  const drawMetaball = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const d = distance(x1, y1, x2, y2);
    const radius = CIRCLE_RADIUS * spread[0];
    const maxDist = radius * 2.5;
    
    if (d > maxDist) {
      // Too far apart, just draw separate circles
      ctx.beginPath();
      ctx.arc(x1, y1, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(x2, y2, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Calculate connection strength
    const strength = Math.max(0, 1 - d / maxDist);
    const handleLength = radius * (0.5 + strength * 0.5);
    
    // Calculate angle between circles
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpAngle = angle + Math.PI / 2;
    
    // Calculate connection points
    const connectionRadius = radius * (0.6 + strength * 0.4);
    
    // Points on the edge of each circle
    const p1x = x1 + Math.cos(perpAngle) * connectionRadius;
    const p1y = y1 + Math.sin(perpAngle) * connectionRadius;
    const p2x = x1 - Math.cos(perpAngle) * connectionRadius;
    const p2y = y1 - Math.sin(perpAngle) * connectionRadius;
    
    const p3x = x2 + Math.cos(perpAngle) * connectionRadius;
    const p3y = y2 + Math.sin(perpAngle) * connectionRadius;
    const p4x = x2 - Math.cos(perpAngle) * connectionRadius;
    const p4y = y2 - Math.sin(perpAngle) * connectionRadius;
    
    // Control points for smooth curves
    const cp1x = x1 + Math.cos(angle) * handleLength;
    const cp1y = y1 + Math.sin(angle) * handleLength;
    const cp2x = x2 - Math.cos(angle) * handleLength;
    const cp2y = y2 - Math.sin(angle) * handleLength;
    
    // Draw the metaball shape
    ctx.beginPath();
    
    // Start with first circle
    ctx.arc(x1, y1, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add second circle
    ctx.beginPath();
    ctx.arc(x2, y2, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw connection blob
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.bezierCurveTo(
      cp1x + Math.cos(perpAngle) * connectionRadius * 0.5,
      cp1y + Math.sin(perpAngle) * connectionRadius * 0.5,
      cp2x + Math.cos(perpAngle) * connectionRadius * 0.5,
      cp2y + Math.sin(perpAngle) * connectionRadius * 0.5,
      p3x, p3y
    );
    ctx.lineTo(p4x, p4y);
    ctx.bezierCurveTo(
      cp2x - Math.cos(perpAngle) * connectionRadius * 0.5,
      cp2y - Math.sin(perpAngle) * connectionRadius * 0.5,
      cp1x - Math.cos(perpAngle) * connectionRadius * 0.5,
      cp1y - Math.sin(perpAngle) * connectionRadius * 0.5,
      p2x, p2y
    );
    ctx.closePath();
    ctx.fill();
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    const filledCells = getFilledCells();
    const diagonalPairs = getDiagonalPairs(filledCells);

    if (filledCells.length === 0) return;

    // Set up drawing context
    ctx.fillStyle = '#3b82f6';
    ctx.globalCompositeOperation = 'source-over';
    
    // Apply blur if enabled
    if (blur[0] > 0) {
      ctx.filter = `blur(${blur[0]}px)`;
    }

    // Keep track of which cells are part of diagonal pairs
    const cellsInPairs = new Set<string>();
    diagonalPairs.forEach(([cell1, cell2]) => {
      cellsInPairs.add(`${cell1.row},${cell1.col}`);
      cellsInPairs.add(`${cell2.row},${cell2.col}`);
    });

    // Draw metaballs for diagonal pairs
    diagonalPairs.forEach(([cell1, cell2]) => {
      const x1 = cell1.col * CELL_SIZE + CELL_SIZE / 2;
      const y1 = cell1.row * CELL_SIZE + CELL_SIZE / 2;
      const x2 = cell2.col * CELL_SIZE + CELL_SIZE / 2;
      const y2 = cell2.row * CELL_SIZE + CELL_SIZE / 2;
      
      drawMetaball(ctx, x1, y1, x2, y2);
    });

    // Reset filter for regular circles
    ctx.filter = 'none';

    // Draw regular circles for cells not in pairs
    filledCells.forEach(({ row, col }) => {
      const cellKey = `${row},${col}`;
      if (!cellsInPairs.has(cellKey)) {
        const centerX = col * CELL_SIZE + CELL_SIZE / 2;
        const centerY = row * CELL_SIZE + CELL_SIZE / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, CIRCLE_RADIUS * spread[0], 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  useEffect(() => {
    drawCanvas();
  }, [grid, spread, blur, contrast]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      handleCellClick(row, col);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <h2>12x12 Grid Canvas with Metaball Effect</h2>
      <p className="text-muted-foreground">Click on cells to add circles. Diagonal circles will merge with a gooey effect!</p>
      
      {/* Controls */}
      <div className="flex gap-8 w-full max-w-2xl">
        <div className="flex-1">
          <Label htmlFor="spread-slider">Spread: {spread[0].toFixed(1)}</Label>
          <Slider
            id="spread-slider"
            min={0.8}
            max={2.0}
            step={0.1}
            value={spread}
            onValueChange={setSpread}
            className="mt-2"
          />
        </div>
        
        <div className="flex-1">
          <Label htmlFor="blur-slider">Blur: {blur[0].toFixed(1)}</Label>
          <Slider
            id="blur-slider"
            min={0}
            max={1.0}
            step={0.1}
            value={blur}
            onValueChange={setBlur}
            className="mt-2"
          />
        </div>
        
        <div className="flex-1">
          <Label htmlFor="contrast-slider">Smoothness: {contrast[0].toFixed(1)}</Label>
          <Slider
            id="contrast-slider"
            min={0.5}
            max={2.0}
            step={0.1}
            value={contrast}
            onValueChange={setContrast}
            className="mt-2"
          />
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onClick={handleCanvasClick}
        className="border border-gray-300 cursor-pointer"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      />
      
      <div className="flex gap-4">
        <button
          onClick={() => setGrid(prevGrid => prevGrid.map(row => row.map(cell => ({ ...cell, filled: false }))))}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Clear Grid
        </button>
        
        <button
          onClick={() => {
            setSpread([1.2]);
            setBlur([0.3]);
            setContrast([1.0]);
          }}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
        >
          Reset Controls
        </button>
      </div>
    </div>
  );
}