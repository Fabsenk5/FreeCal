import { useState, useEffect, useCallback } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { api, TravelLocation } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRelationships } from '@/hooks/useRelationships';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, MapPin, Heart, Filter, X, Calendar, User, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

type FilterType = 'all' | 'visited' | 'wishlist';

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    address?: {
        country?: string;
        city?: string;
        town?: string;
        village?: string;
    };
}

// Custom marker icons
const createMarkerIcon = (type: 'visited' | 'wishlist' | 'shared') => {
    const colors = {
        visited: '#3b82f6', // blue
        wishlist: '#ec4899', // pink
        shared: '#22c55e', // green
    };

    return new DivIcon({
        html: `<div style="
            background-color: ${colors[type]};
            width: 24px;
            height: 24px;
            border-radius: ${type === 'wishlist' ? '50% 50% 50% 0' : '50%'};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transform: ${type === 'wishlist' ? 'rotate(-45deg)' : 'none'};
            display: flex;
            align-items: center;
            justify-content: center;
        ">${type === 'wishlist' ? '<span style="transform: rotate(45deg); font-size: 10px;">♥</span>' : ''}</div>`,
        className: 'custom-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    });
};

// Component to handle map click for adding new location
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// Component to center map on user's location
function LocationCenterer({ userLocation }: { userLocation: [number, number] | null }) {
    const map = useMap();

    useEffect(() => {
        if (userLocation) {
            map.flyTo(userLocation, 5, { duration: 1.5 });
        }
    }, [userLocation, map]);

    return null;
}

export function WorldMap() {
    const { user } = useAuth();
    const { relationships } = useRelationships();
    const [locations, setLocations] = useState<TravelLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [relationshipFilter, setRelationshipFilter] = useState<string | null>(null);

    // User's geolocation for map centering
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Add/Edit modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<TravelLocation | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        latitude: '',
        longitude: '',
        country: '',
        city: '',
        visitedDate: '',
        withRelationshipId: '',
        isWishlist: false,
        notes: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selected location for details panel
    const [selectedLocation, setSelectedLocation] = useState<TravelLocation | null>(null);

    // Fetch locations
    const fetchLocations = useCallback(async () => {
        try {
            const { data } = await api.get('/travel-locations');
            setLocations(data);
        } catch (error) {
            console.error('Failed to fetch locations:', error);
            toast.error('Failed to load locations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    // Get user's location for map centering
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation([position.coords.latitude, position.coords.longitude]);
                },
                (error) => {
                    console.log('Geolocation not available:', error.message);
                    // Fall back to default center (already set)
                },
                { timeout: 5000, enableHighAccuracy: false }
            );
        }
    }, []);

    // Search locations using Nominatim
    const searchLocations = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const results = await response.json();
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            searchLocations(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, searchLocations]);

    // Select search result
    const selectSearchResult = (result: NominatimResult) => {
        setFormData({
            ...formData,
            name: result.display_name.split(',')[0],
            latitude: result.lat,
            longitude: result.lon,
            country: result.address?.country || '',
            city: result.address?.city || result.address?.town || result.address?.village || '',
        });
        setSearchQuery('');
        setSearchResults([]);
        setShowAddModal(true);
    };

    // Handle map click to add location
    const handleMapClick = (lat: number, lng: number) => {
        setFormData({
            name: '',
            latitude: String(lat),
            longitude: String(lng),
            country: '',
            city: '',
            visitedDate: '',
            withRelationshipId: '',
            isWishlist: false,
            notes: '',
        });
        setEditingLocation(null);
        setShowAddModal(true);
    };

    // Open edit modal
    const handleEdit = (location: TravelLocation) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            country: location.country || '',
            city: location.city || '',
            visitedDate: location.visitedDate ? location.visitedDate.split('T')[0] : '',
            withRelationshipId: location.withRelationshipId || '',
            isWishlist: location.isWishlist,
            notes: location.notes || '',
        });
        setShowAddModal(true);
        setSelectedLocation(null);
    };

    // Save location
    const saveLocation = async () => {
        if (!formData.name.trim()) {
            toast.error('Location name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                latitude: formData.latitude,
                longitude: formData.longitude,
                country: formData.country || null,
                city: formData.city || null,
                visitedDate: formData.visitedDate || null,
                withRelationshipId: formData.withRelationshipId || null,
                isWishlist: formData.isWishlist,
                notes: formData.notes || null,
            };

            if (editingLocation) {
                await api.put(`/travel-locations/${editingLocation.id}`, payload);
                toast.success('Location updated!');
            } else {
                await api.post('/travel-locations', payload);
                toast.success('Location added!');
            }

            setShowAddModal(false);
            setEditingLocation(null);
            setFormData({
                name: '',
                latitude: '',
                longitude: '',
                country: '',
                city: '',
                visitedDate: '',
                withRelationshipId: '',
                isWishlist: false,
                notes: '',
            });
            fetchLocations();
        } catch (error) {
            console.error('Failed to save location:', error);
            toast.error('Failed to save location');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete location
    const deleteLocation = async (id: string) => {
        if (!confirm('Are you sure you want to delete this location?')) return;

        try {
            await api.delete(`/travel-locations/${id}`);
            toast.success('Location deleted');
            setLocations(prev => prev.filter(l => l.id !== id));
            setSelectedLocation(null);
        } catch (error) {
            console.error('Failed to delete location:', error);
            toast.error('Failed to delete location');
        }
    };

    // Filter locations
    const filteredLocations = locations.filter(loc => {
        if (filter === 'visited' && loc.isWishlist) return false;
        if (filter === 'wishlist' && !loc.isWishlist) return false;
        if (relationshipFilter && loc.withRelationshipId !== relationshipFilter) return false;
        return true;
    });

    // Get marker type
    const getMarkerType = (location: TravelLocation) => {
        if (location.isWishlist) return 'wishlist';
        if (location.withRelationshipId) return 'shared';
        return 'visited';
    };

    // Get accepted relationships for dropdown
    const acceptedRelationships = relationships?.filter(r => r.status === 'accepted') || [];

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-background items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading map...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <MobileHeader title="World Map" />

            {/* Search and Filter Bar */}
            <div className="p-3 space-y-2 bg-card border-b border-border">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search for a location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-[1000] max-h-60 overflow-y-auto">
                            {searchResults.map((result) => (
                                <button
                                    key={result.place_id}
                                    onClick={() => selectSearchResult(result)}
                                    className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0"
                                >
                                    <p className="text-sm font-medium truncate">{result.display_name.split(',')[0]}</p>
                                    <p className="text-xs text-muted-foreground truncate">{result.display_name}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${filter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('visited')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${filter === 'visited'
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        <MapPin className="w-3 h-3" /> Visited
                    </button>
                    <button
                        onClick={() => setFilter('wishlist')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${filter === 'wishlist'
                            ? 'bg-pink-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        <Heart className="w-3 h-3" /> Wishlist
                    </button>
                    {acceptedRelationships.length > 0 && (
                        <select
                            value={relationshipFilter || ''}
                            onChange={(e) => setRelationshipFilter(e.target.value || null)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border-0 focus:ring-2 focus:ring-primary"
                        >
                            <option value="">All People</option>
                            {acceptedRelationships.map((rel) => (
                                <option key={rel.related_user_id} value={rel.related_user_id}>
                                    With {rel.profile?.display_name || 'Unknown'}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative">
                <MapContainer
                    center={[20, 0]}
                    zoom={2}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationCenterer userLocation={userLocation} />
                    <MapClickHandler onLocationSelect={handleMapClick} />

                    {filteredLocations.map((location) => (
                        <Marker
                            key={location.id}
                            position={[parseFloat(location.latitude), parseFloat(location.longitude)]}
                            icon={createMarkerIcon(getMarkerType(location))}
                            eventHandlers={{
                                click: () => setSelectedLocation(location),
                            }}
                        >
                            <Popup>
                                <div className="text-center">
                                    <p className="font-semibold">{location.name}</p>
                                    {location.city && <p className="text-xs text-gray-500">{location.city}, {location.country}</p>}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* FAB for adding location */}
                <button
                    onClick={() => {
                        setEditingLocation(null);
                        setFormData({
                            name: '',
                            latitude: '',
                            longitude: '',
                            country: '',
                            city: '',
                            visitedDate: '',
                            withRelationshipId: '',
                            isWishlist: false,
                            notes: '',
                        });
                        setShowAddModal(true);
                    }}
                    className="absolute bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg flex items-center justify-center z-[500] hover:scale-110 transition-transform"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* Selected Location Details Panel */}
            {selectedLocation && (
                <div className="fixed inset-x-0 bottom-16 bg-card border-t border-border rounded-t-2xl shadow-2xl z-[600] p-4 animate-in slide-in-from-bottom">
                    <button
                        onClick={() => setSelectedLocation(null)}
                        className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedLocation.isWishlist ? 'bg-pink-500/20 text-pink-500' : 'bg-blue-500/20 text-blue-500'
                            }`}>
                            {selectedLocation.isWishlist ? <Heart className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate">{selectedLocation.name}</h3>
                            {selectedLocation.city && (
                                <p className="text-sm text-muted-foreground">{selectedLocation.city}, {selectedLocation.country}</p>
                            )}

                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedLocation.visitedDate && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                                        <Calendar className="w-3 h-3" />
                                        {format(new Date(selectedLocation.visitedDate), 'MMM d, yyyy')}
                                    </span>
                                )}
                                {selectedLocation.withRelationshipName && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded-full">
                                        <User className="w-3 h-3" />
                                        with {selectedLocation.withRelationshipName}
                                    </span>
                                )}
                                {selectedLocation.isWishlist && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-pink-500/20 text-pink-500 px-2 py-1 rounded-full">
                                        <Heart className="w-3 h-3" />
                                        Wishlist
                                    </span>
                                )}
                            </div>

                            {selectedLocation.notes && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{selectedLocation.notes}</p>
                            )}
                        </div>
                    </div>

                    {selectedLocation.isOwn && (
                        <div className="flex gap-2 mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleEdit(selectedLocation)}
                            >
                                <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteLocation(selectedLocation.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Location Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-[700] flex items-end sm:items-center justify-center">
                    <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                            <h2 className="font-bold text-lg">
                                {editingLocation ? 'Edit Location' : 'Add Location'}
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Search inside modal */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search for a place..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-[1000] max-h-48 overflow-y-auto">
                                        {searchResults.map((result) => (
                                            <button
                                                key={result.place_id}
                                                onClick={() => selectSearchResult(result)}
                                                className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
                                            >
                                                <p className="text-sm truncate">{result.display_name}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Name *</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Eiffel Tower"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Latitude</label>
                                    <Input
                                        value={formData.latitude}
                                        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                        placeholder="48.8584"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Longitude</label>
                                    <Input
                                        value={formData.longitude}
                                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                        placeholder="2.2945"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">City</label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="Paris"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Country</label>
                                    <Input
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        placeholder="France"
                                    />
                                </div>
                            </div>

                            {/* Type Toggle */}
                            <div>
                                <label className="text-sm font-medium mb-2 block">Type</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isWishlist: false })}
                                        className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${!formData.isWishlist
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-muted text-muted-foreground'
                                            }`}
                                    >
                                        <MapPin className="w-4 h-4" /> Visited
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isWishlist: true })}
                                        className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${formData.isWishlist
                                            ? 'bg-pink-500 text-white'
                                            : 'bg-muted text-muted-foreground'
                                            }`}
                                    >
                                        <Heart className="w-4 h-4" /> Wishlist
                                    </button>
                                </div>
                            </div>

                            {/* Date (for visited) */}
                            <div>
                                <label className="text-sm font-medium mb-1 block">
                                    {formData.isWishlist ? 'Target Date (optional)' : 'Visited Date'}
                                </label>
                                <Input
                                    type="date"
                                    value={formData.visitedDate}
                                    onChange={(e) => setFormData({ ...formData, visitedDate: e.target.value })}
                                />
                            </div>

                            {/* Relationship */}
                            {acceptedRelationships.length > 0 && (
                                <div>
                                    <label className="text-sm font-medium mb-1 block">
                                        {formData.isWishlist ? 'Dream to visit with' : 'Visited with'}
                                    </label>
                                    <select
                                        value={formData.withRelationshipId}
                                        onChange={(e) => setFormData({ ...formData, withRelationshipId: e.target.value })}
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                    >
                                        <option value="">Solo / Not specified</option>
                                        {acceptedRelationships.map((rel) => (
                                            <option key={rel.related_user_id} value={rel.related_user_id}>
                                                {rel.profile?.display_name || 'Unknown'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="text-sm font-medium mb-1 block">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Add any notes about this place..."
                                    className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                                />
                            </div>

                            <Button
                                onClick={saveLocation}
                                disabled={isSubmitting || !formData.name.trim() || !formData.latitude || !formData.longitude}
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                {editingLocation ? 'Update Location' : 'Add Location'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
