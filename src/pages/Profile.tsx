import { MobileHeader } from '@/components/calendar/MobileHeader';
import { MOCK_USERS, getCurrentUser } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Mail, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Profile() {
  const currentUser = getCurrentUser();
  const relationships = MOCK_USERS.filter(user => user.id !== currentUser.id);

  const handleAddRelationship = () => {
    toast.info('Add Relationship', {
      description: 'Feature to add new relationships would open here.',
    });
  };

  const handleRemoveRelationship = (userName: string) => {
    toast.success('Relationship removed', {
      description: `${userName} has been removed from your relationships.`,
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader title="Profile" />

      <div className="flex-1 overflow-y-auto pb-20 px-4">
        {/* User info */}
        <div className="py-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-lg">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{currentUser.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {currentUser.email}
              </p>
            </div>
          </div>

          {/* Calendar color */}
          <div className="bg-card rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">Your Calendar Color</h3>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg shadow-sm"
                style={{ backgroundColor: `hsl(var(--user-${currentUser.color}))` }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Blue</p>
                <p className="text-xs text-muted-foreground">
                  Your events appear in this color
                </p>
              </div>
            </div>
          </div>

          {/* Personal settings */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Personal Information</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  defaultValue={currentUser.name}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={currentUser.email}
                  className="bg-background"
                />
              </div>
              <Button className="w-full mt-2">Save Changes</Button>
            </div>
          </div>
        </div>

        {/* Relationships */}
        <div className="pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Relationships</h2>
            <Button
              size="sm"
              onClick={handleAddRelationship}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {relationships.map(user => (
              <div
                key={user.id}
                className="bg-card rounded-xl p-4 flex items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-sm"
                    style={{ backgroundColor: `hsl(var(--user-${user.color}))` }}
                  >
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{user.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.relationshipType}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRelationship(user.name)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add relationship card */}
          <button
            onClick={handleAddRelationship}
            className="w-full mt-3 bg-muted/50 hover:bg-muted rounded-xl p-6 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Add New Relationship</p>
            <p className="text-xs text-muted-foreground">
              Connect with partners or family members
            </p>
          </button>
        </div>

        {/* About section */}
        <div className="pb-6">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">📱 About Calendar App</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              A beautiful mobile calendar app for managing your events and coordinating
              with partners and family. Track everyone's schedule in one place.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Prototype</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
