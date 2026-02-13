import { Router } from 'express';
import { getEvents, createEvent, updateEvent, deleteEvent, respondToInvite, excludeOccurrence } from '../controllers/eventController';
import { getRelationships, createRelationship, updateRelationship, deleteRelationship } from '../controllers/relationshipController';
import { featureWishlistController } from '../controllers/featureWishlistController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all API routes
router.use(authenticateToken);

// Events
router.get('/events', getEvents);
router.post('/events', createEvent);
router.put('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);
router.put('/events/:id/respond', respondToInvite);
router.post('/events/:id/exclude-occurrence', excludeOccurrence);

// Relationships
router.get('/relationships', getRelationships);
router.post('/relationships', createRelationship);
router.put('/relationships/:id', updateRelationship);
router.delete('/relationships/:id', deleteRelationship);

// Users (Profile & Search)
import { updateProfile, searchUsers, getAllUsers, adminUpdateUser, adminDeleteUser, adminUpdateUserPassword } from '../controllers/userController';

router.put('/users/profile', updateProfile);
router.get('/users/search', searchUsers);

// Admin
router.get('/admin/users', getAllUsers);
router.put('/admin/users/:id', adminUpdateUser);
router.put('/admin/users/:id/password', adminUpdateUserPassword);
router.delete('/admin/users/:id', adminDeleteUser);

// Feature Wishlist Routes
router.get('/feature-wishes', featureWishlistController.getAllWishes);
router.post('/feature-wishes', featureWishlistController.createWish);
router.put('/feature-wishes/:id/status', featureWishlistController.updateWishStatus);
router.delete('/feature-wishes/:id', featureWishlistController.deleteWish);

// Travel Locations (World Map)
import { travelLocationController } from '../controllers/travelLocationController';

router.get('/travel-locations', travelLocationController.getLocations);
router.post('/travel-locations', travelLocationController.createLocation);
router.put('/travel-locations/:id', travelLocationController.updateLocation);
router.delete('/travel-locations/:id', travelLocationController.deleteLocation);

export default router;
