import { Request, Response } from 'express';
import { db } from '../db';
import { travelLocations, profiles, relationships } from '../db/schema';
import { eq, or, and, desc, inArray } from 'drizzle-orm';

export const travelLocationController = {
    // Get all locations for the user + locations from relationships where user is tagged
    getLocations: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // Get user's own locations
            const ownLocations = await db.select({
                id: travelLocations.id,
                userId: travelLocations.userId,
                name: travelLocations.name,
                latitude: travelLocations.latitude,
                longitude: travelLocations.longitude,
                country: travelLocations.country,
                city: travelLocations.city,
                visitedDate: travelLocations.visitedDate,
                withRelationshipId: travelLocations.withRelationshipId,
                isWishlist: travelLocations.isWishlist,
                notes: travelLocations.notes,
                createdAt: travelLocations.createdAt,
                updatedAt: travelLocations.updatedAt,
            })
                .from(travelLocations)
                .where(eq(travelLocations.userId, user.id))
                .orderBy(desc(travelLocations.createdAt));

            // Get locations where user is tagged as relationship
            const taggedLocations = await db.select({
                id: travelLocations.id,
                userId: travelLocations.userId,
                name: travelLocations.name,
                latitude: travelLocations.latitude,
                longitude: travelLocations.longitude,
                country: travelLocations.country,
                city: travelLocations.city,
                visitedDate: travelLocations.visitedDate,
                withRelationshipId: travelLocations.withRelationshipId,
                isWishlist: travelLocations.isWishlist,
                notes: travelLocations.notes,
                createdAt: travelLocations.createdAt,
                updatedAt: travelLocations.updatedAt,
            })
                .from(travelLocations)
                .where(eq(travelLocations.withRelationshipId, user.id))
                .orderBy(desc(travelLocations.createdAt));

            // Combine and deduplicate
            const allLocations = [...ownLocations];
            const ownIds = new Set(ownLocations.map(l => l.id));
            for (const loc of taggedLocations) {
                if (!ownIds.has(loc.id)) {
                    allLocations.push(loc);
                }
            }

            // Get profile info for relationship users
            const relationshipIds = allLocations
                .filter(l => l.withRelationshipId)
                .map(l => l.withRelationshipId as string);

            const ownerIds = [...new Set(allLocations.map(l => l.userId))];
            const allUserIds = [...new Set([...relationshipIds, ...ownerIds])];

            let userProfiles: Record<string, { displayName: string; calendarColor: string }> = {};
            if (allUserIds.length > 0) {
                const profilesData = await db.select({
                    id: profiles.id,
                    displayName: profiles.displayName,
                    calendarColor: profiles.calendarColor,
                })
                    .from(profiles)
                    .where(inArray(profiles.id, allUserIds));

                userProfiles = profilesData.reduce((acc, p) => {
                    acc[p.id] = { displayName: p.displayName, calendarColor: p.calendarColor };
                    return acc;
                }, {} as Record<string, { displayName: string; calendarColor: string }>);
            }

            // Enrich locations with profile info
            const enrichedLocations = allLocations.map(loc => ({
                ...loc,
                isOwn: loc.userId === user.id,
                ownerName: userProfiles[loc.userId]?.displayName || 'Unknown',
                ownerColor: userProfiles[loc.userId]?.calendarColor || 'hsl(217, 91%, 60%)',
                withRelationshipName: loc.withRelationshipId
                    ? userProfiles[loc.withRelationshipId]?.displayName || null
                    : null,
            }));

            res.json(enrichedLocations);
        } catch (error) {
            console.error('Error fetching travel locations:', error);
            res.status(500).json({ message: 'Failed to fetch travel locations' });
        }
    },

    // Create a new location
    createLocation: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { name, latitude, longitude, country, city, visitedDate, withRelationshipId, isWishlist, notes } = req.body;

            if (!name || latitude === undefined || longitude === undefined) {
                return res.status(400).json({ message: 'Name, latitude, and longitude are required' });
            }

            const [newLocation] = await db.insert(travelLocations).values({
                userId: user.id,
                name,
                latitude: String(latitude),
                longitude: String(longitude),
                country: country || null,
                city: city || null,
                visitedDate: visitedDate ? new Date(visitedDate) : null,
                withRelationshipId: withRelationshipId || null,
                isWishlist: isWishlist || false,
                notes: notes || null,
            }).returning();

            res.status(201).json(newLocation);
        } catch (error) {
            console.error('Error creating travel location:', error);
            res.status(500).json({ message: 'Failed to create travel location' });
        }
    },

    // Update a location
    updateLocation: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { id } = req.params;
            const { name, latitude, longitude, country, city, visitedDate, withRelationshipId, isWishlist, notes } = req.body;

            // Verify ownership
            const existing = await db.select()
                .from(travelLocations)
                .where(and(eq(travelLocations.id, id), eq(travelLocations.userId, user.id)))
                .limit(1);

            if (existing.length === 0) {
                return res.status(404).json({ message: 'Location not found or not owned by user' });
            }

            const updateData: any = { updatedAt: new Date() };
            if (name !== undefined) updateData.name = name;
            if (latitude !== undefined) updateData.latitude = String(latitude);
            if (longitude !== undefined) updateData.longitude = String(longitude);
            if (country !== undefined) updateData.country = country;
            if (city !== undefined) updateData.city = city;
            if (visitedDate !== undefined) updateData.visitedDate = visitedDate ? new Date(visitedDate) : null;
            if (withRelationshipId !== undefined) updateData.withRelationshipId = withRelationshipId || null;
            if (isWishlist !== undefined) updateData.isWishlist = isWishlist;
            if (notes !== undefined) updateData.notes = notes;

            const [updatedLocation] = await db.update(travelLocations)
                .set(updateData)
                .where(eq(travelLocations.id, id))
                .returning();

            res.json(updatedLocation);
        } catch (error) {
            console.error('Error updating travel location:', error);
            res.status(500).json({ message: 'Failed to update travel location' });
        }
    },

    // Delete a location
    deleteLocation: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { id } = req.params;

            // Verify ownership
            const existing = await db.select()
                .from(travelLocations)
                .where(and(eq(travelLocations.id, id), eq(travelLocations.userId, user.id)))
                .limit(1);

            if (existing.length === 0) {
                return res.status(404).json({ message: 'Location not found or not owned by user' });
            }

            await db.delete(travelLocations)
                .where(eq(travelLocations.id, id));

            res.json({ message: 'Location deleted successfully' });
        } catch (error) {
            console.error('Error deleting travel location:', error);
            res.status(500).json({ message: 'Failed to delete travel location' });
        }
    },
};
