const supabase = require('../config/supabase'); 

// Función auxiliar para evitar el error de sintaxis en Postgres
const cleanEmpty = (val) => (val === '' ? null : val);

const getSucursales = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });
        const { data, error } = await supabase
            .from('sucursales')
            .select('*') 
            .eq('id_institucion', req.user.id_institucion) 
            .order('id_sucursal', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo sucursales' });
    }
};

const createSucursal = async (req, res) => {
    try {
        console.log(`\n========================================`);
        console.log(`📝 [NUEVA SUCURSAL] Petición recibida`);
        console.log(`👤 Usuario logueado:`, req.user.correo_electronico, `| Rol:`, req.user.rol);
        
        if (req.user.rol !== 'Super_Admin') {
            console.log(`❌ ERROR: Acceso denegado. El usuario no es Super_Admin`);
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const { 
            nombre_sede, nombre_corto, direccion, telefono_contacto, email_contacto, 
            tipo_unidad, horario_apertura, horario_cierre, duracion_consulta_minutos, 
            coordenadas_lat, coordenadas_lng, id_estado, servicios_disponibles 
        } = req.body;

        if (!nombre_sede || !direccion) {
            console.log(`❌ ERROR: Faltan nombre_sede o direccion`);
            return res.status(400).json({ error: 'Faltan campos obligatorios.' });
        }

        // Armamos el payload con salvavidas para evitar nulls que rompan la BD
        const payload = {
            id_institucion: req.user.id_institucion || 1, // Salvavidas por si viene undefined
            nombre_sede,
            nombre_corto: cleanEmpty(nombre_corto),
            direccion,
            telefono_contacto: cleanEmpty(telefono_contacto),
            email_contacto: cleanEmpty(email_contacto),
            tipo_unidad: cleanEmpty(tipo_unidad),
            horario_apertura: cleanEmpty(horario_apertura),
            horario_cierre: cleanEmpty(horario_cierre),
            duracion_consulta_minutos: duracion_consulta_minutos || 30,
            coordenadas_lat: coordenadas_lat || null, // Asegurar null si es un string vacío
            coordenadas_lng: coordenadas_lng || null,
            id_estado: id_estado ? parseInt(id_estado) : null,
            servicios_disponibles: servicios_disponibles || [], 
            activa: true
        };

        console.log(`📦 Payload listo para Supabase:`, payload);

        const { data, error } = await supabase.from('sucursales').insert([payload]).select();

        if (error) {
            console.error(`⚠️ [ERROR SUPABASE]:`, error);
            throw error;
        }

        console.log(`✅ [ÉXITO] Sucursal creada con ID: ${data[0].id_sucursal}`);
        console.log(`========================================\n`);

        res.status(201).json({ mensaje: 'Sucursal creada', sucursal: data[0] });
    } catch (err) {
        console.error("❌ [ERROR FATAL CATCH]:", err.message || err);
        res.status(500).json({ error: 'Error creando la sucursal', detalle: err.message || err });
    }
};

const toggleEstatus = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });
        const { error } = await supabase.from('sucursales').update({ activa: req.body.activa }).eq('id_sucursal', req.params.id).eq('id_institucion', req.user.id_institucion);
        if (error) throw error;
        res.status(200).json({ mensaje: 'Estatus actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error actualizando estatus' });
    }
};

const updateSucursal = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });

        const { 
            nombre_sede, nombre_corto, direccion, telefono_contacto, email_contacto, 
            tipo_unidad, horario_apertura, horario_cierre, duracion_consulta_minutos, 
            coordenadas_lat, coordenadas_lng, id_estado, servicios_disponibles 
        } = req.body;

        const payload = {
            nombre_sede,
            nombre_corto: cleanEmpty(nombre_corto),
            direccion,
            telefono_contacto: cleanEmpty(telefono_contacto),
            email_contacto: cleanEmpty(email_contacto),
            tipo_unidad: cleanEmpty(tipo_unidad),
            horario_apertura: cleanEmpty(horario_apertura),
            horario_cierre: cleanEmpty(horario_cierre),
            duracion_consulta_minutos: duracion_consulta_minutos || 30,
            coordenadas_lat,
            coordenadas_lng,
            id_estado: id_estado ? parseInt(id_estado) : null,
            servicios_disponibles: servicios_disponibles || [],
            fecha_actualizacion: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('sucursales')
            .update(payload)
            .eq('id_sucursal', req.params.id)
            .eq('id_institucion', req.user.id_institucion) 
            .select();

        if (error) throw error;
        res.status(200).json({ mensaje: 'Sucursal actualizada', sucursal: data[0] });
    } catch (err) {
        console.error("Error actualizando:", err);
        res.status(500).json({ error: 'Error al actualizar la sucursal' });
    }
};

module.exports = { getSucursales, createSucursal, toggleEstatus, updateSucursal };