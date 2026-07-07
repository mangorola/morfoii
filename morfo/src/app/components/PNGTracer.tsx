import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload, Download, RotateCcw, ExternalLink } from 'lucide-react';

interface PNGTracerProps {
  imageData?: string;
  onClose?: () => void;
}

export function PNGTracer({ imageData, onClose }: PNGTracerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Preview controls
  const [imageMode, setImageMode] = useState('processed');
  const [showPath, setShowPath] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [fadeImage, setFadeImage] = useState(false);
  
  // Pre-processing controls
  const [stackColors, setStackColors] = useState(true);
  const [numberOfColors, setNumberOfColors] = useState([1]);
  const [selectedColor, setSelectedColor] = useState('#000000');
  
  // Tracing controls
  const [ignoreLessThan, setIgnoreLessThan] = useState([2]);
  const [smoothness, setSmoothness] = useState([10]);
  const [curveOptimisation, setCurveOptimisation] = useState([1]);
  
  // Traced paths
  const [tracedPaths, setTracedPaths] = useState<string[]>([]);

  useEffect(() => {
    if (imageData) {
      loadImageFromData(imageData);
    }
  }, [imageData]);

  const loadImageFromData = (data: string) => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      processImage(img);
    };
    img.src = data;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      loadImageFromData(result);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (img: HTMLImageElement) => {
    if (!img) return;
    
    setIsProcessing(true);
    
    try {
      // Create canvas for image processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Apply pre-processing
      if (stackColors) {
        reduceColors(imageData, numberOfColors[0]);
      }
      
      // Trace the image
      const paths = await traceImage(imageData);
      setTracedPaths(paths);
      
      // Draw preview
      drawPreview(img, paths);
      
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const reduceColors = (imageData: ImageData, colorCount: number) => {
    const { data } = imageData;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (colorCount === 1) {
        // Convert to single color (black/white based on brightness)
        const brightness = (r + g + b) / 3;
        const threshold = 128;
        
        if (brightness < threshold && a > 128) {
          // Keep as black
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        } else {
          // Make transparent
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 0;
        }
      }
    }
  };

  const traceImage = async (imageData: ImageData): Promise<string[]> => {
    const { width, height, data } = imageData;
    
    // Simple edge detection and path tracing
    const isPixelFilled = (x: number, y: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      const idx = (y * width + x) * 4;
      return data[idx + 3] > 128; // Check alpha channel
    };

    // Find contours
    const visited = new Set<string>();
    const contours: Array<{x: number, y: number}[]> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (!visited.has(key) && isPixelFilled(x, y)) {
          const contour = traceContour(x, y, isPixelFilled, visited);
          if (contour.length > ignoreLessThan[0]) {
            contours.push(contour);
          }
        }
      }
    }

    // Convert contours to SVG paths
    return contours.map(contour => contourToPath(contour));
  };

  const traceContour = (
    startX: number, 
    startY: number, 
    isPixelFilled: (x: number, y: number) => boolean,
    visited: Set<string>
  ): Array<{x: number, y: number}> => {
    const contour: Array<{x: number, y: number}> = [];
    const directions = [
      {dx: 1, dy: 0}, {dx: 1, dy: 1}, {dx: 0, dy: 1}, {dx: -1, dy: 1},
      {dx: -1, dy: 0}, {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1}
    ];

    let currentX = startX;
    let currentY = startY;
    let dirIndex = 0;

    do {
      const key = `${currentX},${currentY}`;
      if (!visited.has(key)) {
        contour.push({x: currentX, y: currentY});
        visited.add(key);
      }

      // Find next boundary pixel
      let found = false;
      for (let i = 0; i < 8; i++) {
        const checkDir = (dirIndex + i) % 8;
        const nextX = currentX + directions[checkDir].dx;
        const nextY = currentY + directions[checkDir].dy;

        if (isPixelFilled(nextX, nextY)) {
          currentX = nextX;
          currentY = nextY;
          dirIndex = (checkDir + 6) % 8;
          found = true;
          break;
        }
      }

      if (!found || contour.length > 1000) break;

    } while (!(currentX === startX && currentY === startY) || contour.length < 3);

    return contour;
  };

  const contourToPath = (contour: Array<{x: number, y: number}>): string => {
    if (contour.length < 2) return '';

    // Apply smoothing
    const smoothed = smoothPath(contour, smoothness[0]);
    
    // Apply curve optimization
    const optimized = optimizeCurves(smoothed, curveOptimisation[0]);

    if (optimized.length < 2) return '';

    let path = `M ${optimized[0].x} ${optimized[0].y}`;
    
    for (let i = 1; i < optimized.length; i++) {
      path += ` L ${optimized[i].x} ${optimized[i].y}`;
    }
    
    path += ' Z';
    return path;
  };

  const smoothPath = (points: Array<{x: number, y: number}>, factor: number): Array<{x: number, y: number}> => {
    if (factor <= 1 || points.length < 3) return points;

    const smoothed: Array<{x: number, y: number}> = [];
    const windowSize = Math.min(factor, points.length);

    for (let i = 0; i < points.length; i++) {
      let sumX = 0, sumY = 0, count = 0;

      for (let j = -Math.floor(windowSize / 2); j <= Math.floor(windowSize / 2); j++) {
        const idx = (i + j + points.length) % points.length;
        sumX += points[idx].x;
        sumY += points[idx].y;
        count++;
      }

      smoothed.push({
        x: sumX / count,
        y: sumY / count
      });
    }

    return smoothed;
  };

  const optimizeCurves = (points: Array<{x: number, y: number}>, factor: number): Array<{x: number, y: number}> => {
    if (factor <= 1) return points;

    const optimized: Array<{x: number, y: number}> = [points[0]];
    
    for (let i = factor; i < points.length; i += factor) {
      optimized.push(points[i]);
    }

    if (optimized[optimized.length - 1] !== points[points.length - 1]) {
      optimized.push(points[points.length - 1]);
    }

    return optimized;
  };

  const drawPreview = (img: HTMLImageElement, paths: string[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image (faded if option is enabled)
    if (imageMode === 'processed' || imageMode === 'original') {
      ctx.globalAlpha = fadeImage ? 0.3 : 1;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Draw paths
    if (showPath && paths.length > 0) {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = selectedColor;

      paths.forEach(pathData => {
        const path2D = new Path2D(pathData);
        ctx.fill(path2D);
        
        if (showPoints) {
          // Draw points along the path (simplified)
          ctx.fillStyle = '#ff0000';
          // This would need more complex path parsing to show actual points
          ctx.fillStyle = selectedColor;
        }
      });
    }
  };

  const reset = () => {
    setShowPath(true);
    setShowPoints(true);
    setFadeImage(false);
    setStackColors(true);
    setNumberOfColors([1]);
    setIgnoreLessThan([2]);
    setSmoothness([10]);
    setCurveOptimisation([1]);
    
    if (image) {
      processImage(image);
    }
  };

  const exportSVG = () => {
    if (tracedPaths.length === 0) {
      alert('No paths to export! Please trace an image first.');
      return;
    }

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${image?.width || 800}" height="${image?.height || 800}" viewBox="0 0 ${image?.width || 800} ${image?.height || 800}" xmlns="http://www.w3.org/2000/svg">
  ${tracedPaths.map(path => `<path d="${path}" fill="${selectedColor}" fill-rule="evenodd"/>`).join('\n  ')}
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traced-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (image) {
      processImage(image);
    }
  }, [stackColors, numberOfColors, ignoreLessThan, smoothness, curveOptimisation]);

  useEffect(() => {
    if (image && tracedPaths.length > 0) {
      drawPreview(image, tracedPaths);
    }
  }, [showPath, showPoints, fadeImage, imageMode, selectedColor, tracedPaths]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">PNG Tracer</h2>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="space-y-6">
          {/* Upload */}
          {!imageData && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Image
              </Button>
            </div>
          )}

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Preview</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-blue-600 hover:text-blue-700"
              >
                Reset
              </Button>
            </div>

            <div>
              <Label className="block mb-2">Processed image</Label>
              <Select value={imageMode} onValueChange={setImageMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="processed">Processed image</SelectItem>
                  <SelectItem value="original">Original image</SelectItem>
                  <SelectItem value="paths-only">Paths only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-path">Show path</Label>
                <Switch
                  id="show-path"
                  checked={showPath}
                  onCheckedChange={setShowPath}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-points">Show points</Label>
                <Switch
                  id="show-points"
                  checked={showPoints}
                  onCheckedChange={setShowPoints}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="fade-image">Fade image</Label>
                <Switch
                  id="fade-image"
                  checked={fadeImage}
                  onCheckedChange={setFadeImage}
                />
              </div>
            </div>
          </div>

          {/* Pre-processing Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">Pre-processing</h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="stack-colors">Stack colours</Label>
              <Switch
                id="stack-colors"
                checked={stackColors}
                onCheckedChange={setStackColors}
              />
            </div>

            <div>
              <Label className="block mb-2">Number of colours: {numberOfColors[0]}</Label>
              <Slider
                value={numberOfColors}
                onValueChange={setNumberOfColors}
                min={1}
                max={8}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="block mb-2">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300"
                />
                <span className="text-sm text-gray-600">{selectedColor}</span>
              </div>
            </div>
          </div>

          {/* Tracing Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Tracing</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View docs
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>

            <div>
              <Label className="block mb-2">Ignore less than: {ignoreLessThan[0]}</Label>
              <Slider
                value={ignoreLessThan}
                onValueChange={setIgnoreLessThan}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="block mb-2">Smoothness: {smoothness[0]}</Label>
              <Slider
                value={smoothness}
                onValueChange={setSmoothness}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="block mb-2">Curve optimisation: {curveOptimisation[0]}</Label>
              <Slider
                value={curveOptimisation}
                onValueChange={setCurveOptimisation}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Export */}
          <Button
            onClick={exportSVG}
            disabled={tracedPaths.length === 0 || isProcessing}
            className="w-full flex items-center gap-2"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isProcessing ? 'Processing...' : 'Export SVG'}
          </Button>
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:col-span-2">
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto border border-gray-300 bg-white"
              style={{ maxHeight: '600px' }}
            />
            {!image && (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Upload an image to start tracing
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}