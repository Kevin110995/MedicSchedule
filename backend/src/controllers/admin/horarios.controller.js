const supabase = require('../../config/supabase');

// ==========================================
// 1. HORARIOS DE SUCURSAL
// ==========================================
const getHorariosSucursal = async (req, res) => {
    try {
        const { data, error } = await supabase.from('horarios_sucursal').select('*').eq('id_sucursal', req.user.id_sucursal).order('dia_semana', { ascending: true });
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener horarios de sucursal.' });
    }
};

const upsertHorarioSucursal = async (req, res) => {
    try {
        const { dias, hora_inicio, hora_fin, activo } = req.body;
        const id_sucursal = req.user.id_sucursal;

        const filas = dias.map(dia => ({
            id_sucursal, dia_semana: dia, hora_inicio, hora_fin, activo
        }));

        const { error } = await supabase.from('horarios_sucursal').upsert(filas, { onConflict: 'id_sucursal, dia_semana' });
        if (error) throw error;
        
        res.status(200).json({ mensaje: 'Horario de sucursal actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo guardar el horario.' });
    }
};

// ==========================================
// 2. PERSONAL Y SUS TURNOS
// ==========================================
const getPersonalList = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('id_usuario, nombre_completo, rol, medicos(id_medico)')
            .eq('id_sucursal', req.user.id_sucursal)
            .in('rol', ['Medico', 'Recepcionista'])
            .eq('estatus', true);
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar el personal.' });
    }
};

const upsertHorarioPersonal = async (req, res) => {
    try {
        const { id_objetivo, rol_objetivo, dias, hora_inicio, hora_fin, activo } = req.body;
        const tabla = rol_objetivo === 'Medico' ? 'horarios_medico' : 'horarios_recepcionista';
        const columnaId = rol_objetivo === 'Medico' ? 'id_medico' : 'id_recepcionista';

        const filas = dias.map(dia => ({
            [columnaId]: id_objetivo, dia_semana: dia, hora_inicio, hora_fin, activo
        }));

        const { error } = await supabase.from(tabla).upsert(filas, { onConflict: `${columnaId}, dia_semana, hora_inicio` });
        if (error) throw error;
        
        res.status(200).json({ mensaje: 'Turnos asignados correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar turnos.' });
    }
};

// ==========================================
// 3. BANDEJA DE PERMISOS
// ==========================================
const getPermisosPendientes = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bloqueos_agenda')
            .select(`
                id_bloqueo, titulo, fecha_inicio, fecha_fin, tipo, estado_aprobacion, 
                medicos!inner( usuarios!inner( nombre_completo, id_sucursal ) )
            `)
            .eq('medicos.usuarios.id_sucursal', req.user.id_sucursal)
            .eq('estado_aprobacion', 'Pendiente')
            .order('fecha_inicio', { ascending: true });

        if (error) throw error;
        
        const formateado = data.map(b => ({
            id_bloqueo: b.id_bloqueo, 
            medico: b.medicos?.usuarios?.nombre_completo || 'Desconocido',
            titulo: b.titulo, tipo: b.tipo, inicio: b.fecha_inicio, fin: b.fecha_fin
        }));
        res.status(200).json(formateado);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar permisos.' });
    }
};

const responderPermiso = async (req, res) => {
    try {
        const { id_bloqueo } = req.params;
        const { respuesta } = req.body;
        const { error } = await supabase.from('bloqueos_agenda').update({ estado_aprobacion: respuesta, activo: respuesta === 'Aprobado' }).eq('id_bloqueo', id_bloqueo);
        if (error) throw error;
        res.status(200).json({ mensaje: `Permiso ${respuesta.toLowerCase()} exitosamente.` });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el permiso.' });
    }
};

const getHorarioPersonalEspecifico = async (req, res) => {
    try {
        const { id, rol } = req.params;
        const tabla = rol === 'Medico' ? 'horarios_medico' : 'horarios_recepcionista';
        const col = rol === 'Medico' ? 'id_medico' : 'id_recepcionista';
        
        const { data, error } = await supabase.from(tabla).select('*').eq(col, id).order('dia_semana', { ascending: true });
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar el horario del empleado.' });
    }
};

module.exports = { getHorariosSucursal, upsertHorarioSucursal, getPersonalList, upsertHorarioPersonal, getPermisosPendientes, responderPermiso, getHorarioPersonalEspecifico };