import { Router } from 'express';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../controllers/eventController';
import { getRelationships, createRelationship, updateRelationship, deleteRelationship } from '../controllers/relationshipController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all API routes
router.use(authenticateToken);

// Events
router.get('/events', getEvents);
router.post('/events', createEvent);
router.put('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

// Relationships
router.get('/relationships', getRelationships);
router.post('/relationships', createRelationship);
router.put('/relationships/:id', updateRelationship);
router.delete('/relationships/:id', deleteRelationship);

// Users (Profile & Search)
import { updateProfile, searchUsers, getAllUsers, adminUpdateUser, adminDeleteUser } from '../controllers/userController';

router.put('/users/profile', updateProfile);
router.get('/users/search', searchUsers);

// Admin
router.get('/admin/users', getAllUsers);
router.put('/admin/users/:id', adminUpdateUser);
router.delete('/admin/users/:id', adminDeleteUser);

export default router;
