import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Camera, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { processCalendarScreenshot, OCREventData } from '@/utils/calendarOCR';

interface ScreenshotImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (data: OCREventData) => void;
}

export function ScreenshotImportDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ScreenshotImportDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Show preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setProcessing(true);
    setStatus('processing');
    setProgress(0);

    try {
      // Process with OCR
      const eventData = await processCalendarScreenshot(file, (p) => {
        setProgress(p);
      });

      if (!eventData) {
        throw new Error('Could not extract event data from image');
      }

      setStatus('success');
      toast.success('Event extracted from screenshot!', {
        description: `Imported: ${eventData.title}`,
      });

      // Pass data back and close dialog
      setTimeout(() => {
        onImportSuccess(eventData);
        onOpenChange(false);
        resetState();
      }, 1000);
    } catch (error) {
      console.error('OCR import error:', error);
      setStatus('error');
      toast.error('Failed to process screenshot', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const resetState = () => {
    setProcessing(false);
    setProgress(0);
    setStatus('idle');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const handleClose = () => {
    if (!processing) {
      resetState();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90%] rounded-xl">
        <DialogHeader>
          <DialogTitle>Import from Screenshot</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === 'idle' && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Upload a screenshot of your calendar event
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Upload Image</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-sm">Take Photo</span>
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </>
          )}

          {status === 'processing' && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {progress < 80 ? 'Extracting text...' : 'Parsing event data...'}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing screenshot...</span>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                <span className="font-medium">Successfully imported!</span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-destructive">
                <XCircle className="w-6 h-6" />
                <span className="font-medium">Failed to process image</span>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  resetState();
                }}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
