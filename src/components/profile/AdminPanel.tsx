import { useState, useEffect } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, X, ChevronDown, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface PendingUser extends Profile {
  created_at: string;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    userId: string | null;
    userName: string;
    action: 'approve' | 'reject' | null;
  }>({
    open: false,
    userId: null,
    userName: '',
    action: null,
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch pending users
      const { data: pending, error: pendingError } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;
      setPendingUsers(pending || []);

      // Fetch approved users
      const { data: approved, error: approvedError } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'approved')
        .order('approved_at', { ascending: false });

      if (approvedError) throw approvedError;
      setApprovedUsers(approved || []);

      // Fetch rejected users
      const { data: rejected, error: rejectedError } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'rejected')
        .order('updated_at', { ascending: false });

      if (rejectedError) throw rejectedError;
      setRejectedUsers(rejected || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.userId || !actionDialog.action || !user) return;

    setProcessing(true);
    try {
      const updates: Partial<Profile> = {
        approval_status: actionDialog.action === 'approve' ? 'approved' : 'rejected',
        is_approved: actionDialog.action === 'approve',
      };

      if (actionDialog.action === 'approve') {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = user.id;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', actionDialog.userId);

      if (error) throw error;

      toast.success(
        actionDialog.action === 'approve' 
          ? `${actionDialog.userName} has been approved!`
          : `${actionDialog.userName} has been rejected`
      );

      // Refresh user lists
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user status');
    } finally {
      setProcessing(false);
      setActionDialog({ open: false, userId: null, userName: '', action: null });
    }
  };

  const openActionDialog = (userId: string, userName: string, action: 'approve' | 'reject') => {
    setActionDialog({
      open: true,
      userId,
      userName,
      action,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const UserCard = ({ 
    user, 
    showActions, 
    actionType 
  }: { 
    user: PendingUser; 
    showActions: boolean;
    actionType?: 'pending' | 'approved' | 'rejected';
  }) => (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{user.display_name}</h4>
            {actionType === 'approved' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                Approved
              </span>
            )}
            {actionType === 'rejected' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                Rejected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-1">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            Registered: {formatDate(user.created_at)}
          </p>
          {user.approved_at && actionType === 'approved' && (
            <p className="text-xs text-muted-foreground">
              Approved: {formatDate(user.approved_at)}
            </p>
          )}
        </div>
      </div>
      
      {showActions && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => openActionDialog(user.id, user.display_name, 'approve')}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => openActionDialog(user.id, user.display_name, 'reject')}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full flex items-center justify-between mb-4 bg-primary/5 border-primary/20"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-semibold">Admin Panel</span>
              {pendingUsers.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {pendingUsers.length}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending" className="relative">
                  Pending
                  {pendingUsers.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {pendingUsers.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-3 mt-4">
                {pendingUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No pending approval requests
                  </div>
                ) : (
                  pendingUsers.map((user) => (
                    <UserCard 
                      key={user.id} 
                      user={user} 
                      showActions={true}
                      actionType="pending"
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-3 mt-4">
                {approvedUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No approved users yet
                  </div>
                ) : (
                  approvedUsers.map((user) => (
                    <UserCard 
                      key={user.id} 
                      user={user} 
                      showActions={false}
                      actionType="approved"
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-3 mt-4">
                {rejectedUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No rejected users
                  </div>
                ) : (
                  rejectedUsers.map((user) => (
                    <UserCard 
                      key={user.id} 
                      user={user} 
                      showActions={false}
                      actionType="rejected"
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => 
        setActionDialog({ ...actionDialog, open })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'approve' ? 'Approve User' : 'Reject User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === 'approve' 
                ? `Are you sure you want to approve ${actionDialog.userName}? They will gain immediate access to the app.`
                : `Are you sure you want to reject ${actionDialog.userName}? They will be notified and won't be able to access the app.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={processing}
              className={actionDialog.action === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                actionDialog.action === 'approve' ? 'Approve' : 'Reject'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
