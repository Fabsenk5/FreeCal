import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export interface TimeFrameValue {
  startMinutes: number // 0-2879 (48 hours)
  endMinutes: number   // 0-2879 (48 hours)
}

export interface DualTimeSliderProps {
  value: TimeFrameValue
  onChange: (value: TimeFrameValue) => void
  className?: string
  step?: number // in minutes, default 15
}

/**
 * Converts minutes (0-2879) to formatted time string "Day X HH:MM"
 */
const formatTimeFromMinutes = (totalMinutes: number): string => {
  const day = Math.floor(totalMinutes / (24 * 60)) + 1 // Day 1 or Day 2
  const minutesInDay = totalMinutes % (24 * 60)
  const hours = Math.floor(minutesInDay / 60)
  const minutes = minutesInDay % 60
  
  return `Day ${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Converts minutes to a more readable duration format
 */
const formatDuration = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours === 0 && minutes === 0) {
      return `${days} day${days > 1 ? 's' : ''}`
    }
    if (minutes === 0) {
      return `${days}d ${remainingHours}h`
    }
    return `${days}d ${remainingHours}h ${minutes}m`
  }
  
  if (minutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  
  return `${hours}h ${minutes}m`
}

export function DualTimeSlider({
  value,
  onChange,
  className,
  step = 15,
}: DualTimeSliderProps) {
  const MAX_MINUTES = 2879 // Day 2 23:59 (48 hours - 1 minute)
  
  const handleValueChange = (newValue: number[]) => {
    onChange({
      startMinutes: newValue[0],
      endMinutes: newValue[1],
    })
  }
  
  const duration = value.endMinutes - value.startMinutes
  const startTime = formatTimeFromMinutes(value.startMinutes)
  const endTime = formatTimeFromMinutes(value.endMinutes)
  const durationText = formatDuration(duration)
  
  // Calculate percentage for visual indicators
  const startPercent = (value.startMinutes / MAX_MINUTES) * 100
  const endPercent = (value.endMinutes / MAX_MINUTES) * 100
  const midPoint = (startPercent + endPercent) / 2
  
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Time Frame</Label>
          <span className="text-xs font-medium text-muted-foreground">
            {durationText}
          </span>
        </div>
        
        {/* Dual Slider */}
        <div className="relative pt-2 pb-8">
          <SliderPrimitive.Root
            value={[value.startMinutes, value.endMinutes]}
            onValueChange={handleValueChange}
            min={0}
            max={MAX_MINUTES}
            step={step}
            minStepsBetweenThumbs={step}
            className="relative flex w-full touch-none select-none items-center"
          >
            <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-secondary/50">
              <SliderPrimitive.Range className="absolute h-full bg-primary" />
            </SliderPrimitive.Track>
            
            {/* Start thumb */}
            <SliderPrimitive.Thumb 
              className="block h-6 w-6 rounded-full border-2 border-primary bg-background shadow-lg ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing"
              aria-label="Start time"
            />
            
            {/* End thumb */}
            <SliderPrimitive.Thumb 
              className="block h-6 w-6 rounded-full border-2 border-primary bg-background shadow-lg ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing"
              aria-label="End time"
            />
          </SliderPrimitive.Root>
          
          {/* Time labels below the slider */}
          <div className="absolute left-0 right-0 top-[calc(100%-1.5rem)] flex items-start justify-between text-xs">
            <div className="flex flex-col items-start">
              <span className="font-medium text-foreground">{startTime}</span>
              <span className="text-muted-foreground">Start</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-medium text-foreground">{endTime}</span>
              <span className="text-muted-foreground">End</span>
            </div>
          </div>
        </div>
        
        {/* Day markers */}
        <div className="relative h-6 px-1">
          <div className="absolute inset-x-0 top-0 flex items-center justify-between border-t border-border pt-1">
            <span className="text-[10px] text-muted-foreground font-medium">Day 1 00:00</span>
            <span className="text-[10px] text-muted-foreground font-medium">Day 2 00:00</span>
            <span className="text-[10px] text-muted-foreground font-medium">Day 2 23:59</span>
          </div>
        </div>
      </div>
    </div>
  )
}