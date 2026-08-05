import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Camera, CalendarPlus } from 'lucide-react';

interface ImportMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectOCR: () => void;
  onSelectICS: () => void;
  /** Show the native iOS Calendar option (only inside the FreeCal iOS app). */
  showNative?: boolean;
  onSelectNative?: () => void;
}

export function ImportMethodDialog({
  open,
  onOpenChange,
  onSelectOCR,
  onSelectICS,
  showNative = false,
  onSelectNative,
}: ImportMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] rounded-xl">
        <DialogHeader>
          <DialogTitle>Import Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {showNative && (
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                onSelectNative?.();
                onOpenChange(false);
              }}
            >
              <CalendarPlus className="w-6 h-6" />
              <span className="text-sm font-medium">iOS Calendar</span>
              <span className="text-xs text-muted-foreground">
                Import directly from your iPhone calendar
              </span>
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => {
              onSelectOCR();
              onOpenChange(false);
            }}
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm font-medium">OCR from Screenshot</span>
            <span className="text-xs text-muted-foreground">
              Import from calendar screenshot
            </span>
          </Button>

          <Button
            variant="outline"
            className="w-full h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => {
              onSelectICS();
              onOpenChange(false);
            }}
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">ICS Import</span>
            <span className="text-xs text-muted-foreground">
              Import from .ics calendar file
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
