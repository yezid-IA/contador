import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURACIÓN SUPABASE - LA CALERA QMS
// ============================================
// Proyecto: La Calera QMS
// URL: https://cexjoiwaezupoqppcxpo.supabase.co
// Fecha actualización: Febrero 9, 2026

const supabaseUrl = 'https://cexjoiwaezupoqppcxpo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNleGpvaXdhZXp1cG9xcHBjeHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDM1MzcsImV4cCI6MjA4NjE3OTUzN30.rra0u5fJ6gSHXTpBzCbgYUqRcBOIhxSSF4Y53RopZgg';

// Validación de configuración
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Credenciales de Supabase no configuradas');
} else {
    console.log('✅ Supabase configurado correctamente');
    console.log(`📍 Proyecto: ${supabaseUrl}`);
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// INFORMACIÓN DE ACCESO
// ============================================
// Anon Key (Public - Cliente): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNleGpvaXdhZXp1cG9xcHBjeHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDM1MzcsImV4cCI6MjA4NjE3OTUzN30.rra0u5fJ6gSHXTpBzCbgYUqRcBOIhxSSF4Y53RopZgg
// Service Role (Servidor): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNleGpvaXdhZXp1cG9xcHBjeHBvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwMzUzNywiZXhwIjoyMDg2MTc5NTM3fQ.9NL3uitPvewtGonTOwh0OCkK5stor6YR4qgjf-Pkqww