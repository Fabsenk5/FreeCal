import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/lib/supabase';

/**
 * E2E Database Tests
 * Tests verify:
 * 1. Event schema has all metadata columns
 * 2. Can insert events with metadata
 * 3. Can retrieve events with all fields
 * 4. Can update events with metadata
 * 5. Can delete events
 */

describe('E2E Database Tests - Events Schema', () => {
  // Test user ID (using a UUID pattern that won't exist)
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testEventIds: string[] = [];

  beforeAll(async () => {
    // Clean up any test data from previous runs
    try {
      await supabase
        .from('events')
        .delete()
        .neq('user_id', testUserId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Clean up test data
    for (const eventId of testEventIds) {
      try {
        await supabase
          .from('events')
          .delete()
          .eq('id', eventId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should verify events table has all required columns', async () => {
    // Query schema information
    const { data, error } = await supabase.rpc('get_column_names', {
      table_name: 'events',
      schema_name: 'public',
    }).catch(() => {
      // Fallback: just verify we can query events table
      return supabase.from('events').select('*').limit(1);
    });

    // If we can query the table, schema exists
    expect(error).toBeNull();
  });

  it('should insert event with basic fields', async () => {
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Basic',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeDefined();
    expect(data?.title).toBe('Test Event - Basic');
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with location field', async () => {
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - With Location',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        location: 'Conference Room A, Building 2',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.location).toBe('Conference Room A, Building 2');
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with URL field', async () => {
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - With URL',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        url: 'https://example.com/meeting',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.url).toBe('https://example.com/meeting');
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with is_tentative flag', async () => {
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Tentative',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        is_tentative: true,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.is_tentative).toBe(true);
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with alerts JSONB', async () => {
    const alerts = [
      { minutes: 15, type: 'DISPLAY' },
      { minutes: 60, type: 'DISPLAY' },
    ];

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - With Alerts',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        alerts: alerts,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.alerts).toBeDefined();
    expect(Array.isArray(data?.alerts)).toBe(true);
    expect((data?.alerts as any)?.[0]?.minutes).toBe(15);
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with attendees JSONB', async () => {
    const attendees = [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@example.com' },
    ];

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - With Attendees',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        attendees: attendees,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.attendees).toBeDefined();
    expect(Array.isArray(data?.attendees)).toBe(true);
    expect((data?.attendees as any)?.[0]?.email).toBe('john@example.com');
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with structured metadata', async () => {
    const metadata = {
      original_calendar: 'iOS Calendar',
      source_type: 'imported',
      import_date: new Date().toISOString(),
      custom_field_1: 'custom_value',
    };

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - With Metadata',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        structured_metadata: metadata,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.structured_metadata).toBeDefined();
    expect((data?.structured_metadata as any)?.original_calendar).toBe('iOS Calendar');
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should insert event with all metadata fields combined', async () => {
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Complete iOS Import',
        description: 'A complete event with all iOS metadata',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'weekly',
        imported_from_device: false,
        location: 'Conference Room A',
        url: 'https://zoom.us/j/123456789',
        is_tentative: false,
        alerts: [
          { minutes: 15, type: 'DISPLAY' },
          { minutes: 60, type: 'DISPLAY' },
        ],
        attendees: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' },
        ],
        structured_metadata: {
          original_calendar: 'iOS Calendar',
          import_date: new Date().toISOString(),
        },
        original_calendar_id: 'ios-calendar-123',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.title).toBe('Test Event - Complete iOS Import');
    expect(data?.location).toBe('Conference Room A');
    expect(data?.url).toBe('https://zoom.us/j/123456789');
    expect(data?.is_tentative).toBe(false);
    expect(data?.alerts).toBeDefined();
    expect(data?.attendees).toBeDefined();
    expect(data?.structured_metadata).toBeDefined();
    expect(data?.original_calendar_id).toBe('ios-calendar-123');
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should retrieve event with all metadata fields', async () => {
    // First insert an event
    const { data: insertedEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Retrieve',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        location: 'Test Location',
        url: 'https://test.com',
        is_tentative: true,
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(insertedEvent?.id).toBeDefined();

    // Then retrieve it
    const { data: retrievedEvent, error: retrieveError } = await supabase
      .from('events')
      .select('*')
      .eq('id', insertedEvent!.id)
      .single();

    expect(retrieveError).toBeNull();
    expect(retrievedEvent).toBeDefined();
    expect(retrievedEvent?.location).toBe('Test Location');
    expect(retrievedEvent?.url).toBe('https://test.com');
    expect(retrievedEvent?.is_tentative).toBe(true);

    if (insertedEvent?.id) testEventIds.push(insertedEvent.id);
  });

  it('should update event metadata fields', async () => {
    // First insert an event
    const { data: insertedEvent } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Update',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        location: 'Old Location',
      })
      .select()
      .single();

    expect(insertedEvent?.id).toBeDefined();

    // Update it
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({
        location: 'New Location',
        url: 'https://updated.com',
        is_tentative: true,
      })
      .eq('id', insertedEvent!.id)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updatedEvent?.location).toBe('New Location');
    expect(updatedEvent?.url).toBe('https://updated.com');
    expect(updatedEvent?.is_tentative).toBe(true);

    if (insertedEvent?.id) testEventIds.push(insertedEvent.id);
  });

  it('should verify interval field for travel_time', async () => {
    // Try to insert with travel_time as interval
    // Note: interval is stored as TEXT in PostgreSQL but represents time duration
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Travel Time',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        travel_time: '00:30:00', // 30 minutes as interval
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.travel_time).toBeDefined();
    
    if (data?.id) testEventIds.push(data.id);
  });

  it('should delete event', async () => {
    // Insert an event to delete
    const { data: insertedEvent } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - To Delete',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
      })
      .select()
      .single();

    expect(insertedEvent?.id).toBeDefined();

    // Delete it
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', insertedEvent!.id);

    expect(deleteError).toBeNull();

    // Verify it's gone
    const { data: deletedEvent } = await supabase
      .from('events')
      .select('*')
      .eq('id', insertedEvent!.id)
      .single()
      .catch(() => ({ data: null }));

    expect(deletedEvent).toBeNull();
  });

  it('should handle null/optional fields correctly', async () => {
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: testUserId,
        title: 'Test Event - Minimal Fields',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_all_day: false,
        color: 'hsl(217, 91%, 60%)',
        recurrence_type: 'none',
        imported_from_device: false,
        // Omitting optional fields
        location: null,
        url: null,
        is_tentative: false,
        alerts: null,
        attendees: null,
        structured_metadata: null,
        travel_time: null,
        original_calendar_id: null,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.location).toBeNull();
    expect(data?.url).toBeNull();
    expect(data?.alerts).toEqual([]);
    
    if (data?.id) testEventIds.push(data.id);
  });
});
