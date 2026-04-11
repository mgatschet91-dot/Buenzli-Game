/**
 * DEPRECATED: This file is kept for backward compatibility.
 * 
 * All database functions have been moved to @/lib/api/database.ts
 * which supports both Core API and Supabase.
 * 
 * Please update your imports to use:
 *   import { ... } from '@/lib/api/database';
 */

// Re-export everything from the new location
export * from '../api/database';

// Also re-export the municipality setter for convenience
export { setCurrentMunicipality, getCurrentMunicipality } from '../api/database';
