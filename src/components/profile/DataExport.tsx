import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { toast } from 'sonner';

export function DataExport() {
  const { events, loading } = useEvents();
  const [exporting, setExporting] = useState(false);

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    setExporting(true);
    try {
      const dataStr = JSON.stringify(events, null, 2);
      downloadFile(dataStr, `family-calendar-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast.success('JSON backup exported successfully');
    } catch (err) {
      console.error('JSON export error:', err);
      toast.error('Failed to export JSON backup');
    } finally {
      setExporting(false);
    }
  };

  const handleExportICS = () => {
    setExporting(true);
    try {
      let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Family Calendar//EN\n";
      
      events.forEach(event => {
        const start = new Date(event.start_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const end = new Date(event.end_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `UID:${event.id}\n`;
        icsContent += `DTSTAMP:${now}\n`;
        icsContent += `DTSTART:${start}\n`;
        icsContent += `DTEND:${end}\n`;
        icsContent += `SUMMARY:${event.title}\n`;
        if (event.description) {
          icsContent += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
        }
        if (event.location) {
          icsContent += `LOCATION:${event.location}\n`;
        }
        icsContent += "END:VEVENT\n";
      });
      
      icsContent += "END:VCALENDAR";
      
      downloadFile(icsContent, `family-calendar-events-${new Date().toISOString().split('T')[0]}.ics`, 'text/calendar');
      toast.success('ICS calendar exported successfully');
    } catch (err) {
      console.error('ICS export error:', err);
      toast.error('Failed to export ICS calendar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 mt-4">
      <h3 className="text-sm font-semibold mb-2">Data Export</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Download a backup of your calendar events. You can use the ICS file to import into other calendar applications like Google Calendar or Apple Calendar.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button 
          variant="outline" 
          onClick={handleExportICS} 
          disabled={loading || exporting || events.length === 0}
          className="flex-1"
        >
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export Calendar (.ics)
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExportJSON} 
          disabled={loading || exporting || events.length === 0}
          className="flex-1"
        >
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Full Backup (.json)
        </Button>
      </div>
      {events.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          No events found to export.
        </p>
      )}
    </div>
  );
}
