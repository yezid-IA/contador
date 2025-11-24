import { createClient } from '@supabase/supabase-js';

// TODO: Reemplaza con la URL y la Anon Key de TU proyecto de Supabase.
// 1. Ve a tu proyecto en Supabase.
// 2. En el menú de la izquierda, ve a "Project Settings" (el ícono de engranaje).
// 3. Haz clic en "API".
// 4. En esta página encontrarás la "Project URL" y la "Project API Keys" (usa la que dice 'anon' y 'public').

const supabaseUrl = 'https://isixziklusxgunqcanlt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaXh6aWtsdXN4Z3VucWNhbmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzM0NzMsImV4cCI6MjA3OTMwOTQ3M30.sf2CgFQxOVq6KL-gw53OKwC2JvA7KJ4JPuh4pPILyxE';

if (supabaseUrl === 'URL_DE_TU_PROYECTO_SUPABASE' || supabaseAnonKey === 'ANON_KEY_DE_TU_PROYECTO_SUPABASE') {
    console.error("Error: Debes configurar la URL y la Anon Key de Supabase en 'src/supabaseClient.js'");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);