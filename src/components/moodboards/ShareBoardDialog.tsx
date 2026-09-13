import { useState } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
    addMoodBoardMember,
    MoodBoardContact,
    MoodBoardMember,
    MoodBoardRole,
    MoodBoardSummary,
    removeMoodBoardMember,
    updateMoodBoardMemberRole,
} from '@/lib/api';
import { useMoodBoardContacts } from '@/hooks/useMoodBoards';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { InitialAvatar } from './InitialAvatar';
import { MOOD_BOARD_ROLE_LABELS } from './labels';

interface ShareBoardDialogProps {
    board: MoodBoardSummary;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: () => void;
}

const ROLES: MoodBoardRole[] = ['editor', 'viewer'];

export function ShareBoardDialog({ board, open, onOpenChange, onChanged }: ShareBoardDialogProps) {
    const { contacts, loading: contactsLoading } = useMoodBoardContacts(open);
    const [roles, setRoles] = useState<Record<string, MoodBoardRole>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    const memberIds = new Set(board.members.map(member => member.user_id));
    const addableContacts = contacts.filter(contact => !memberIds.has(contact.id));

    const run = async (id: string, action: () => Promise<void>, successMessage: string) => {
        setBusyId(id);
        try {
            await action();
            toast.success(successMessage);
            onChanged();
        } catch (err) {
            console.error('Share board action failed:', err);
            toast.error(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleAdd = (contact: MoodBoardContact) =>
        run(
            contact.id,
            () => addMoodBoardMember(board.id, contact.id, roles[contact.id] ?? 'editor'),
            `${contact.display_name} added`,
        );

    const handleRoleChange = (member: MoodBoardMember, role: MoodBoardRole) =>
        run(
            member.user_id,
            () => updateMoodBoardMemberRole(board.id, member.user_id, role),
            'Role updated',
        );

    const handleRemove = (member: MoodBoardMember) =>
        run(
            member.user_id,
            () => removeMoodBoardMember(board.id, member.user_id),
            `${member.display_name} removed`,
        );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] max-w-[92%] overflow-y-auto rounded-xl">
                <DialogHeader>
                    <DialogTitle>Share “{board.title}”</DialogTitle>
                    <DialogDescription>
                        Only confirmed contacts can be added. Editors may add pins, viewers can comment and vote.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">Members</h4>
                        {board.members.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Not shared yet — only you can see this board.</p>
                        ) : (
                            <div className="space-y-2">
                                {board.members.map(member => (
                                    <div key={member.user_id} className="flex items-center gap-2">
                                        <InitialAvatar name={member.display_name} color={member.calendar_color} />
                                        <span className="min-w-0 flex-1 truncate text-sm">{member.display_name}</span>
                                        <Select
                                            value={member.role}
                                            onValueChange={value => void handleRoleChange(member, value as MoodBoardRole)}
                                            disabled={busyId === member.user_id}
                                        >
                                            <SelectTrigger className="h-8 w-[112px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLES.map(role => (
                                                    <SelectItem key={role} value={role}>
                                                        {MOOD_BOARD_ROLE_LABELS[role]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            disabled={busyId === member.user_id}
                                            onClick={() => void handleRemove(member)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-semibold">Add a contact</h4>
                        {contactsLoading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : addableContacts.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                {contacts.length === 0
                                    ? 'No confirmed contacts yet. Connect with people first.'
                                    : 'All your contacts already have access.'}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {addableContacts.map(contact => (
                                    <div key={contact.id} className="flex items-center gap-2">
                                        <InitialAvatar name={contact.display_name} color={contact.calendar_color} />
                                        <span className="min-w-0 flex-1 truncate text-sm">{contact.display_name}</span>
                                        <Select
                                            value={roles[contact.id] ?? 'editor'}
                                            onValueChange={value =>
                                                setRoles(prev => ({ ...prev, [contact.id]: value as MoodBoardRole }))
                                            }
                                            disabled={busyId === contact.id}
                                        >
                                            <SelectTrigger className="h-8 w-[112px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLES.map(role => (
                                                    <SelectItem key={role} value={role}>
                                                        {MOOD_BOARD_ROLE_LABELS[role]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={busyId === contact.id}
                                            onClick={() => void handleAdd(contact)}
                                        >
                                            {busyId === contact.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <UserPlus className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
