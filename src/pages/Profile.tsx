import { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { useRelationships } from '@/hooks/useRelationships';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Mail, UserPlus, Trash2, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ColorPicker } from '@/components/profile/ColorPicker';

export function Profile() {
  const { profile, user, updateProfile, signOut } = useAuth();
  const { relationships, loading: relLoading, refreshRelationships } = useRelationships();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [calendarColor, setCalendarColor] = useState(profile?.calendar_color || 'hsl(217, 91%, 60%)');
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);

  // Sync state when profile updates
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setEmail(profile.email || '');
      setCalendarColor(profile.calendar_color || 'hsl(217, 91%, 60%)');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateProfile({
        display_name: displayName,
        email,
      });
    } catch (error) {
      console.error('Save profile error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = async (color: string) => {
    setCalendarColor(color);
    
    try {
      await updateProfile({
        calendar_color: color,
      });
    } catch (error) {
      console.error('Update color error:', error);
    }
  };

  const handleAddRelationship = async () => {
    if (!user || !searchEmail.trim()) return;

    setSearching(true);

    try {
      // Search for user by email
      const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', searchEmail.trim())
        .single();

      if (searchError || !profiles) {
        toast.error('User not found', {
          description: 'No user found with that email address.',
        });
        return;
      }

      if (profiles.id === user.id) {
        toast.error('Cannot add yourself', {
          description: 'You cannot create a relationship with yourself.',
        });
        return;
      }

      // Check if relationship already exists
      const { data: existing } = await supabase
        .from('relationships')
        .select('*')
        .or(
          `and(user_id.eq.${user.id},related_user_id.eq.${profiles.id}),and(user_id.eq.${profiles.id},related_user_id.eq.${user.id})`
        )
        .single();

      if (existing) {
        toast.error('Relationship exists', {
          description: 'You already have a relationship with this user.',
        });
        return;
      }

      // Create relationship request
      const { error: createError } = await supabase.from('relationships').insert({
        user_id: user.id,
        related_user_id: profiles.id,
        status: 'accepted', // Auto-accept for simplicity in this version
      });

      if (createError) {
        toast.error(`Database Error: ${createError.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      toast.success('Relationship added!', {
        description: `You are now connected with ${profiles.display_name}.`,
      });

      setSearchEmail('');
      setAddDialogOpen(false);
      refreshRelationships();
    } catch (err) {
      console.error('Add relationship error:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleRemoveRelationship = async (relationshipId: string, userName: string) => {
    try {
      const { error } = await supabase
        .from('relationships')
        .delete()
        .eq('id', relationshipId);

      if (error) {
        toast.error(`Database Error: ${error.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      toast.success('Relationship removed', {
        description: `${userName} has been removed from your relationships.`,
      });

      refreshRelationships();
    } catch (err) {
      console.error('Remove relationship error:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (relLoading || !profile) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader
        title="Profile"
        rightAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-20 px-4">
        {/* User info */}
        <div className="py-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-lg"
              style={{ backgroundColor: calendarColor }}
            >
              {profile.display_name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{profile.display_name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {profile.email}
              </p>
            </div>
          </div>

          {/* Calendar color */}
          <div className="bg-card rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">Your Calendar Color</h3>
            <ColorPicker currentColor={calendarColor} onColorChange={handleColorChange} />
          </div>

          {/* Personal settings */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Personal Information</h3>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Relationships */}
        <div className="pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Relationships</h2>
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {relationships.map((rel) => (
              <div
                key={rel.id}
                className="bg-card rounded-xl p-4 flex items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-sm"
                    style={{ backgroundColor: rel.profile.calendar_color }}
                  >
                    {rel.profile.display_name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                      {rel.profile.display_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {rel.profile.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleRemoveRelationship(rel.id, rel.profile.display_name)
                  }
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {relationships.length === 0 && (
              <button
                onClick={() => setAddDialogOpen(true)}
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
            )}
          </div>
        </div>

        {/* About section */}
        <div className="pb-6">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">📱 About Calendar App</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              A production-ready calendar app for managing your events and coordinating
              with partners and family. Track everyone's schedule in one place.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Production</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Relationship Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-[90%] rounded-xl">
          <DialogHeader>
            <DialogTitle>Add Relationship</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-email">Enter Email Address</Label>
              <Input
                id="search-email"
                type="email"
                placeholder="partner@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="bg-card"
              />
              <p className="text-xs text-muted-foreground">
                Search for users by their email address
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddRelationship}
                disabled={searching || !searchEmail.trim()}
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Add Connection'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}