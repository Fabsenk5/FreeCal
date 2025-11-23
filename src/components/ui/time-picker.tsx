import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface TimeValue {
  hours: number
  minutes: number
}

export interface TimePickerProps {
  value?: TimeValue
  onChange?: (value: TimeValue) => void
  label?: string
  className?: string
  minTime?: TimeValue
  maxTime?: TimeValue
}

export function TimePicker({
  value = { hours: 9, minutes: 0 },
  onChange,
  label,
  className,
  minTime,
  maxTime,
}: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = [0, 15, 30, 45]

  const handleHourChange = (hour: string) => {
    const newValue = { ...value, hours: parseInt(hour) }
    onChange?.(newValue)
  }

  const handleMinuteChange = (minute: string) => {
    const newValue = { ...value, minutes: parseInt(minute) }
    onChange?.(newValue)
  }

  const isTimeDisabled = (h: number, m: number) => {
    if (minTime) {
      if (h < minTime.hours || (h === minTime.hours && m < minTime.minutes)) {
        return true
      }
    }
    if (maxTime) {
      if (h > maxTime.hours || (h === maxTime.hours && m > maxTime.minutes)) {
        return true
      }
    }
    return false
  }

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour.toString().padStart(2, '0')}:00 ${period}`
  }

  const formatMinute = (minute: number) => {
    return minute.toString().padStart(2, '0')
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Select
          value={value.hours.toString()}
          onValueChange={handleHourChange}
        >
          <SelectTrigger className="flex-1 bg-card">
            <SelectValue>
              {formatHour(value.hours).split(':')[0]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {hours.map((hour) => (
              <SelectItem
                key={hour}
                value={hour.toString()}
                disabled={isTimeDisabled(hour, value.minutes)}
              >
                {formatHour(hour)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.minutes.toString()}
          onValueChange={handleMinuteChange}
        >
          <SelectTrigger className="w-20 bg-card">
            <SelectValue>
              :{formatMinute(value.minutes)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {minutes.map((minute) => (
              <SelectItem
                key={minute}
                value={minute.toString()}
                disabled={isTimeDisabled(value.hours, minute)}
              >
                :{formatMinute(minute)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export interface TimeRangePickerProps {
  startTime?: TimeValue
  endTime?: TimeValue
  onStartTimeChange?: (value: TimeValue) => void
  onEndTimeChange?: (value: TimeValue) => void
  className?: string
  maxDuration?: number // in hours, max 48
}

export function TimeRangePicker({
  startTime = { hours: 9, minutes: 0 },
  endTime = { hours: 17, minutes: 0 },
  onStartTimeChange,
  onEndTimeChange,
  className,
  maxDuration = 48,
}: TimeRangePickerProps) {
  const getTimeInMinutes = (time: TimeValue) => {
    return time.hours * 60 + time.minutes
  }

  const getDuration = () => {
    let startMinutes = getTimeInMinutes(startTime)
    let endMinutes = getTimeInMinutes(endTime)
    
    // If end is before start, it spans to next day
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60
    }
    
    return endMinutes - startMinutes
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h ${mins}m`
    }
    return `${hours}h ${mins}m`
  }

  const duration = getDuration()
  const isValidDuration = duration <= maxDuration * 60

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-4">
        <TimePicker
          label="Start Time"
          value={startTime}
          onChange={onStartTimeChange}
        />
        <TimePicker
          label="End Time"
          value={endTime}
          onChange={onEndTimeChange}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Duration:</span>
        <span className={cn(
          "font-medium",
          !isValidDuration && "text-destructive"
        )}>
          {formatDuration(duration)}
          {!isValidDuration && ` (max ${maxDuration}h)`}
        </span>
      </div>
      
      {!isValidDuration && (
        <p className="text-xs text-destructive">
          Duration cannot exceed {maxDuration} hours
        </p>
      )}
    </div>
  )
}
