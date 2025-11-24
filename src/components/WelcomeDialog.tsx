import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Camera, 
  Users, 
  Bell,
  X 
} from 'lucide-react';
import { requestNotificationPermission } from '@/lib/notifications';

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeDialog({ open, onClose }: WelcomeDialogProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Calendar,
      title: 'Welcome to FreeCal!',
      description: 'Calendar to find shared freedom with family & friends',
      action: 'Next',
    },
    {
      icon: Camera,
      title: 'Import with OCR',
      description: 'Take a screenshot of any calendar event and FreeCal will extract all details automatically - even from German calendars!',
      action: 'Next',
    },
    {
      icon: Users,
      title: 'Connect with Others',
      description: 'Send relationship requests to family & friends. Once accepted, you'll see each other's calendars and can find free time together.',
      action: 'Next',
    },
    {
      icon: Bell,
      title: 'Stay Updated',
      description: 'Enable notifications to get alerts about relationship requests and event updates.',
      action: 'Get Started',
      isLast: true,
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const handleNext = async () => {
    if (currentStep.isLast) {
      // Request notification permission on last step
      await requestNotificationPermission();
      localStorage.setItem('welcomeShown', 'true');
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('welcomeShown', 'true');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="max-w-md">
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center py-6 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{currentStep.title}</h2>
            <p className="text-muted-foreground max-w-sm">
              {currentStep.description}
            </p>
          </div>

          <div className="flex gap-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === step
                    ? 'w-8 bg-primary'
                    : index < step
                    ? 'w-2 bg-primary/50'
                    : 'w-2 bg-muted'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3 w-full">
            {!currentStep.isLast && (
              <Button variant="ghost" onClick={handleSkip} className="flex-1">
                Skip
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1">
              {currentStep.action}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
