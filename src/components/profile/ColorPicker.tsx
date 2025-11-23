import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

const PRESET_COLORS = [
  { name: 'Blue', value: 'hsl(217, 91%, 60%)' },
  { name: 'Purple', value: 'hsl(262, 83%, 58%)' },
  { name: 'Pink', value: 'hsl(330, 81%, 60%)' },
  { name: 'Red', value: 'hsl(0, 84%, 60%)' },
  { name: 'Orange', value: 'hsl(25, 95%, 53%)' },
  { name: 'Yellow', value: 'hsl(45, 93%, 47%)' },
  { name: 'Green', value: 'hsl(142, 71%, 45%)' },
  { name: 'Teal', value: 'hsl(173, 80%, 40%)' },
  { name: 'Cyan', value: 'hsl(199, 89%, 48%)' },
  { name: 'Indigo', value: 'hsl(243, 75%, 59%)' },
  { name: 'Rose', value: 'hsl(350, 89%, 60%)' },
  { name: 'Emerald', value: 'hsl(160, 84%, 39%)' },
];

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(currentColor);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hexColor = e.target.value;
    setCustomColor(hexColor);
    onColorChange(hexColor);
  };

  return (
    <div className="space-y-4">
      {/* Preset Colors */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-3">
          Preset Colors
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => onColorChange(color.value)}
              className={cn(
                'relative h-12 rounded-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'shadow-sm hover:shadow-md'
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {currentColor === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-1">
                    <Check className="w-4 h-4 text-gray-900" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-3">
          Custom Color
        </h4>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="color"
              value={
                customColor.startsWith('#')
                  ? customColor
                  : '#3B82F6'
              }
              onChange={handleCustomColorChange}
              className="w-full h-12 rounded-lg cursor-pointer border-2 border-border bg-background"
              style={{
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
              }}
            />
          </div>
          <div
            className="w-12 h-12 rounded-lg shadow-sm border-2 border-border flex items-center justify-center"
            style={{ backgroundColor: currentColor }}
          >
            {currentColor === customColor && !PRESET_COLORS.some(c => c.value === currentColor) && (
              <div className="bg-white/90 rounded-full p-1">
                <Check className="w-4 h-4 text-gray-900" />
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Click to choose any custom color
        </p>
      </div>
    </div>
  );
}
