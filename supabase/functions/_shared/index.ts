import { createClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    },
  })
}

export async function getUserRole(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data?.role ?? 'patient'
}

export async function getUserDoctorId(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('id')
    .eq('profile_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

export async function getUserPatientId(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

export function json(
  body: Record<string, unknown> | Record<string, unknown>[],
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(
  error: string,
  message: string,
  status = 400,
  details?: unknown
): Response {
  return json({ error, message, details }, status)
}
