import { Router } from 'express';
import { pushController } from '../controllers/pushController';
import { authenticateToken } from '../middleware/auth';
import { pushLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply auth middleware to all API routes
router.use(authenticateToken);

// NOTE: Events, relationships, travel locations and feature wishes are
// handled by the frontend directly against Supabase (protected by RLS).
// Those Express controllers were removed as dead code.

// Push Notifications
router.post('/push/subscribe', pushLimiter, pushController.subscribe);
router.post('/push/test', pushLimiter, pushController.testNotification);
router.post('/push/notify', pushLimiter, pushController.sendNotification);

// Event Details (Comments, Checklist, Editor)
import { eventDetailsController } from '../controllers/eventDetailsController';
router.get('/events/:eventId/comments', eventDetailsController.getComments);
router.post('/events/:eventId/comments', eventDetailsController.addComment);
router.get('/events/:eventId/checklist', eventDetailsController.getChecklist);
router.post('/events/:eventId/checklist', eventDetailsController.addChecklistItem);
router.put('/checklists/:id', eventDetailsController.updateChecklistItem);
router.delete('/checklists/:id', eventDetailsController.deleteChecklistItem);
router.put('/events/:eventId/editors/:userId', eventDetailsController.toggleEditor);

// Users (Profile & Search)
import { updateProfile, searchUsers, getAllUsers, adminUpdateUser, adminDeleteUser, adminUpdateUserPassword } from '../controllers/userController';

router.put('/users/profile', updateProfile);
router.get('/users/search', searchUsers);

// Admin
router.get('/admin/users', getAllUsers);
router.put('/admin/users/:id', adminUpdateUser);
router.put('/admin/users/:id/password', adminUpdateUserPassword);
router.delete('/admin/users/:id', adminDeleteUser);

export default router;
