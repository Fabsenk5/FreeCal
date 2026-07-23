import { Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabaseAdmin';
import { sendPushNotificationToUser } from '../utils/push';

function formatDateForNotification(dateInput: string | Date): string {
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    } catch {
        return '';
    }
}

/**
 * IDOR guard: the user must be the event owner, an attendee, or a viewer of
 * the event. supabaseAdmin bypasses RLS, so participation must be checked here.
 */
const assertEventAccess = async (userId: string, eventId: string): Promise<boolean> => {
    try {
        const { data: event } = await supabaseAdmin
            .from('events')
            .select('user_id')
            .eq('id', eventId)
            .maybeSingle();

        if (event && event.user_id === userId) return true;

        const { data: attendee } = await supabaseAdmin
            .from('event_attendees')
            .select('id')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();

        if (attendee) return true;

        const { data: viewer } = await supabaseAdmin
            .from('event_viewers')
            .select('id')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();

        return !!viewer;
    } catch (error) {
        console.error('Error checking event access:', error);
        return false;
    }
};

const notifyEventParticipants = async (eventId: string, senderId: string, senderName: string, title: string, body: string) => {
    try {
        const { data: event } = await supabaseAdmin.from('events').select('user_id, title, start_time').eq('id', eventId).single();
        if (!event) return;

        const { data: attendees } = await supabaseAdmin.from('event_attendees').select('user_id').eq('event_id', eventId);
        const { data: viewers } = await supabaseAdmin.from('event_viewers').select('user_id').eq('event_id', eventId);
        
        const attIds = attendees?.map((a: any) => a.user_id) || [];
        const viewIds = viewers?.map((v: any) => v.user_id) || [];
        
        const allParticipants = [...new Set([...attIds, ...viewIds, event.user_id])];
        
        const formattedDate = formatDateForNotification(event.start_time);
        const dateStr = formattedDate ? ` (${formattedDate})` : '';
        const payload = { title: title.replace('{eventTitle}', event.title) + dateStr, body, url: `/?eventId=${eventId}` };
        for (const uId of allParticipants) {
            if (uId !== senderId) {
                sendPushNotificationToUser(uId, payload).catch(console.error);
            }
        }
    } catch (error) {
        console.error('Error notifying participants:', error);
    }
};

export const eventDetailsController = {
    getComments: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        const user = (req as any).user;
        try {
            if (!user || !(await assertEventAccess(user.id, eventId))) {
                return res.status(403).json({ message: 'Not authorized to view this event' });
            }

            const { data: comments, error } = await supabaseAdmin
                .from('event_comments')
                .select('id, event_id, user_id, content, created_at, profiles!event_comments_user_id_fkey(display_name, avatar_url)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = comments.map((c: any) => ({
                id: c.id,
                eventId: c.event_id,
                userId: c.user_id,
                content: c.content,
                createdAt: c.created_at,
                user: {
                    displayName: c.profiles?.display_name,
                    avatarUrl: c.profiles?.avatar_url,
                }
            }));

            res.json(formatted);
        } catch (error) {
            console.error('Error fetching comments:', error);
            res.status(500).json({ message: 'Failed to fetch comments' });
        }
    },

    addComment: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        const { content } = req.body;
        const user = (req as any).user;

        try {
            if (!user || !(await assertEventAccess(user.id, eventId))) {
                return res.status(403).json({ message: 'Not authorized to comment on this event' });
            }

            const { data: newComment, error } = await supabaseAdmin
                .from('event_comments')
                .insert({
                    event_id: eventId,
                    user_id: user.id,
                    content
                })
                .select()
                .single();

            if (error) throw error;

            // Notify others
            const senderName = user.user_metadata?.display_name || user.email || 'Someone';
            notifyEventParticipants(
                eventId,
                user.id,
                senderName,
                'New comment on {eventTitle}',
                `${senderName}: ${content}`
            );

            res.status(201).json({
                id: newComment.id,
                eventId: newComment.event_id,
                userId: newComment.user_id,
                content: newComment.content,
                createdAt: newComment.created_at
            });
        } catch (error) {
            console.error('Error adding comment:', error);
            res.status(500).json({ message: 'Failed to add comment' });
        }
    },

    // Checklists
    getChecklist: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        const user = (req as any).user;
        try {
            if (!user || !(await assertEventAccess(user.id, eventId))) {
                return res.status(403).json({ message: 'Not authorized to view this event' });
            }

            const { data: items, error } = await supabaseAdmin
                .from('event_checklists')
                .select('*')
                .eq('event_id', eventId);
            
            if (error) throw error;

            const formatted = items.map((i: any) => ({
                id: i.id,
                eventId: i.event_id,
                title: i.title,
                isCompleted: i.is_completed,
                createdAt: i.created_at
            }));

            res.json(formatted);
        } catch (error) {
            console.error('Error fetching checklist:', error);
            res.status(500).json({ message: 'Failed to fetch checklist' });
        }
    },

    addChecklistItem: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        const { title } = req.body;

        try {
            const user = (req as any).user;
            if (!user || !(await assertEventAccess(user.id, eventId))) {
                return res.status(403).json({ message: 'Not authorized to modify this event' });
            }

            const { data: newItem, error } = await supabaseAdmin
                .from('event_checklists')
                .insert({
                    event_id: eventId,
                    title
                })
                .select()
                .single();

            if (error) throw error;

            const senderName = user?.user_metadata?.display_name || user?.email || 'Someone';
            notifyEventParticipants(
                eventId,
                user.id,
                senderName,
                'Checklist updated in {eventTitle}',
                `${senderName} added: ${title}`
            );
            
            res.status(201).json({
                id: newItem.id,
                eventId: newItem.event_id,
                title: newItem.title,
                isCompleted: newItem.is_completed,
                createdAt: newItem.created_at
            });
        } catch (error) {
            console.error('Error adding checklist item:', error);
            res.status(500).json({ message: 'Failed to add checklist item' });
        }
    },

    updateChecklistItem: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { isCompleted, title } = req.body;

        try {
            const user = (req as any).user;

            // Resolve the event via the item to check participation before writing
            const { data: existingItem, error: fetchError } = await supabaseAdmin
                .from('event_checklists')
                .select('event_id')
                .eq('id', id)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (!existingItem) {
                return res.status(404).json({ message: 'Checklist item not found' });
            }

            if (!user || !(await assertEventAccess(user.id, existingItem.event_id))) {
                return res.status(403).json({ message: 'Not authorized to modify this event' });
            }

            const updateData: any = {};
            if (isCompleted !== undefined) updateData.is_completed = isCompleted;
            if (title !== undefined) updateData.title = title;

            const { data: updatedItem, error } = await supabaseAdmin
                .from('event_checklists')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            const senderName = user?.user_metadata?.display_name || user?.email || 'Someone';
            const actionText = isCompleted ? 'completed' : 'updated';
            notifyEventParticipants(
                updatedItem.event_id,
                user.id,
                senderName,
                'Checklist updated in {eventTitle}',
                `${senderName} ${actionText}: ${updatedItem.title}`
            );

            res.json({
                id: updatedItem.id,
                eventId: updatedItem.event_id,
                title: updatedItem.title,
                isCompleted: updatedItem.is_completed,
                createdAt: updatedItem.created_at
            });
        } catch (error) {
            console.error('Error updating checklist item:', error);
            res.status(500).json({ message: 'Failed to update checklist item' });
        }
    },

    deleteChecklistItem: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const user = (req as any).user;

            // Resolve the event via the item to check participation before writing
            const { data: existingItem, error: fetchError } = await supabaseAdmin
                .from('event_checklists')
                .select('event_id')
                .eq('id', id)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (!existingItem) {
                return res.status(404).json({ message: 'Checklist item not found' });
            }

            if (!user || !(await assertEventAccess(user.id, existingItem.event_id))) {
                return res.status(403).json({ message: 'Not authorized to modify this event' });
            }

            const { error } = await supabaseAdmin.from('event_checklists').delete().eq('id', id);
            if (error) throw error;
            res.json({ message: 'Item deleted' });
        } catch (error) {
            console.error('Error deleting checklist item:', error);
            res.status(500).json({ message: 'Failed to delete checklist item' });
        }
    },

    // Editor Toggle
    toggleEditor: async (req: Request, res: Response) => {
        const { eventId, userId } = req.params;
        const { isEditor } = req.body;
        const currentUser = (req as any).user;

        try {
            // Only event owner can toggle editors
            const { data: event, error: evError } = await supabaseAdmin
                .from('events')
                .select('user_id')
                .eq('id', eventId)
                .single();

            if (evError || !event || event.user_id !== currentUser.id) {
                return res.status(403).json({ message: 'Not authorized to change roles' });
            }

            // Try updating attendee
            const { data: updatedAtt, error: attError } = await supabaseAdmin
                .from('event_attendees')
                .update({ is_editor: isEditor })
                .eq('event_id', eventId)
                .eq('user_id', userId)
                .select();

            if (attError) throw attError;

            // Try updating viewer if not attendee (column is user_id, not viewer_id)
            let updatedView = [];
            if (!updatedAtt || updatedAtt.length === 0) {
                const { data, error: viewError } = await supabaseAdmin
                    .from('event_viewers')
                    .update({ is_editor: isEditor })
                    .eq('event_id', eventId)
                    .eq('user_id', userId)
                    .select();
                if (viewError) throw viewError;
                updatedView = data || [];
            }

            if ((!updatedAtt || updatedAtt.length === 0) && updatedView.length === 0) {
                return res.status(404).json({ message: 'User is not a participant' });
            }

            res.json({ message: 'Role updated successfully', isEditor });
        } catch (error) {
            console.error('Error toggling editor role:', error);
            res.status(500).json({ message: 'Failed to update role' });
        }
    }
};
