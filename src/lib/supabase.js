import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mynektdohwpzfbmgfunp.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bmVrdGRvaHdwemZibWdmdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTcwMjQsImV4cCI6MjA5NjMzMzAyNH0.mhQIXbVgWkpVxvcOXs80KIoqSphde9juPLlZJJrkOhs'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// Generic helpers
export const dbGet = async (table, filters = {}) => {
  let q = sb.from(table).select('*')
  Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v) })
  const { data, error } = await q
  if (error) { console.error('dbGet', table, error); return [] }
  return data || []
}

export const dbInsert = async (table, row) => {
  const { data, error } = await sb.from(table).insert(row).select().single()
  if (error) { console.error('dbInsert', table, error); return null }
  return data
}

export const dbUpdate = async (table, id, row) => {
  const { data, error } = await sb.from(table).update(row).eq('id', id).select().single()
  if (error) { console.error('dbUpdate', table, error); return null }
  return data
}

export const dbUpsert = async (table, row, conflict) => {
  const { data, error } = await sb.from(table).upsert(row, { onConflict: conflict }).select().single()
  if (error) { console.error('dbUpsert', table, error); return null }
  return data
}

export const dbDelete = async (table, id) => {
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) { console.error('dbDelete', table, error); return false }
  return true
}
