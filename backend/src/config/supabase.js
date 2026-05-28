require('dotenv').config(); // Esto carga las variables de tu .env
const { createClient } = require('@supabase/supabase-js');

// Extraemos las variables del entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Verificamos que existan para que no truene silenciosamente
if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Faltan las credenciales de Supabase en el archivo .env");
}

// Creamos el cliente en Modo Dios
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false // El backend no guarda sesiones
  }
});

module.exports = supabase;