import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  isDarkMode: boolean;
}

interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

export function ColorPicker({ value, onChange, isDarkMode }: ColorPickerProps) {
  const [hsv, setHsv] = useState<HSV>({ h: 0, s: 100, v: 100 });
  const [hexInput, setHexInput] = useState('FF0000');
  const [isDraggingSV, setIsDraggingSV] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const svPickerRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rgb = parseRgbString(value);
    const newHsv = rgbToHsv(rgb);
    setHsv(newHsv);
    setHexInput(rgbToHex(rgb));
  }, [value]);

  function parseRgbString(rgb: string): RGB {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    }
    return { r: 255, g: 0, b: 0 };
  }

  function rgbToHsv(rgb: RGB): HSV {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = max * 100;

    return { h, s, v };
  }

  function hsvToRgb(hsv: HSV): RGB {
    const h = hsv.h;
    const s = hsv.s / 100;
    const v = hsv.v / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
      r = c; g = 0; b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  function rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function hexToRgb(hex: string): RGB | null {
    const cleaned = hex.replace('#', '');
    if (cleaned.length !== 6) return null;

    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }

  function updateColor(newHsv: HSV) {
    setHsv(newHsv);
    const rgb = hsvToRgb(newHsv);
    setHexInput(rgbToHex(rgb));
    onChange(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
  }

  function handleSVPickerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    setIsDraggingSV(true);
    updateSVFromMouse(e);
  }

  function handleHueSliderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    setIsDraggingHue(true);
    updateHueFromMouse(e);
  }

  function updateSVFromMouse(e: React.MouseEvent | MouseEvent) {
    if (!svPickerRef.current) return;
    const rect = svPickerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const s = (x / rect.width) * 100;
    const v = 100 - (y / rect.height) * 100;

    updateColor({ ...hsv, s, v });
  }

  function updateHueFromMouse(e: React.MouseEvent | MouseEvent) {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));

    const h = (x / rect.width) * 360;

    updateColor({ ...hsv, h });
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (isDraggingSV) {
        updateSVFromMouse(e);
      }
      if (isDraggingHue) {
        updateHueFromMouse(e);
      }
    }

    function handleMouseUp() {
      setIsDraggingSV(false);
      setIsDraggingHue(false);
    }

    if (isDraggingSV || isDraggingHue) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingSV, isDraggingHue, hsv]);

  function handleHexInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toUpperCase();
    setHexInput(value);

    const rgb = hexToRgb(value);
    if (rgb) {
      const newHsv = rgbToHsv(rgb);
      setHsv(newHsv);
      onChange(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    }
  }

  const currentHueRgb = hsvToRgb({ h: hsv.h, s: 100, v: 100 });
  const currentHueColor = `rgb(${currentHueRgb.r}, ${currentHueRgb.g}, ${currentHueRgb.b})`;

  return (
    <div className="space-y-3">
      {/* Saturation/Value picker */}
      <div
        ref={svPickerRef}
        className="relative w-full aspect-square rounded-lg overflow-hidden cursor-crosshair select-none"
        style={{
          background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${currentHueColor})`,
        }}
        onMouseDown={handleSVPickerMouseDown}
      >
        {/* Picker handle */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueSliderRef}
        className="relative w-full h-3 rounded-full cursor-pointer select-none"
        style={{
          background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
        }}
        onMouseDown={handleHueSliderMouseDown}
      >
        {/* Hue handle */}
        <div
          className="absolute w-5 h-5 rounded-full border-3 border-white shadow-lg pointer-events-none"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: currentHueColor,
            boxShadow: '0 0 0 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {/* Hex input */}
      <div className="flex gap-2">
        <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border ${
          isDarkMode
            ? 'bg-neutral-700 border-neutral-600'
            : 'bg-neutral-50 border-neutral-300'
        }`}>
          <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Hex
          </span>
          <input
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            maxLength={6}
            className={`flex-1 bg-transparent outline-none text-sm ${
              isDarkMode ? 'text-white' : 'text-neutral-900'
            }`}
          />
        </div>

        {/* Color preview */}
        <div
          className="w-12 h-full rounded border-2"
          style={{
            backgroundColor: value,
            borderColor: isDarkMode ? '#525252' : '#d4d4d4',
          }}
        />
      </div>
    </div>
  );
}
