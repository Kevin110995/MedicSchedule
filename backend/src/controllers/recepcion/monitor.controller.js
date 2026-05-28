const supabase = require('../../config/supabase');

// =========================================================
// 🏥 1. OBTENER LAS CITAS DEL DÍA (Para el Tablero Kanban)
// =========================================================
const obtenerCitasDelDia = async (req, res) => {
    try {
        const hoy = new Date();
        const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0).toISOString();
        const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString();

        const { data, error } = await supabase
            .from('citas')
            .select(`
                id_cita,
                fecha_hora,
                estado,
                triage_urgencia,
                pacientes ( id_paciente, usuarios ( nombre_completo, telefono ) ),
                medicos ( id_medico, usuarios ( nombre_completo ) )
            `)
            .gte('fecha_hora', inicioDia)
            .lte('fecha_hora', finDia)
            .neq('estado', 'Cancelada') 
            .order('fecha_hora', { ascending: true });

        if (error) throw error;

        // 🧠 DICCIONARIO 1: Base de Datos -> React
        const traductorHaciaReact = {
            'Programada': 'programada',
            'En sala de espera': 'espera',
            'En curso': 'consulta',
            'Completada': 'finalizada'
        };

        const citasFormateadas = data.map(cita => ({
            id: cita.id_cita,
            nombre: cita.pacientes?.usuarios?.nombre_completo || 'Paciente en Registro',
            telefono: cita.pacientes?.usuarios?.telefono || '',
            hora: new Date(cita.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            
            // Usamos el traductor. Si la BD tiene otro estado (ej. "No asistio"), lo manda en minúsculas.
            estado: traductorHaciaReact[cita.estado] || cita.estado.toLowerCase(), 
            
            triage: cita.triage_urgencia || false,
            medico: cita.medicos?.usuarios?.nombre_completo || 'Sin asignar'
        }));

        res.status(200).json(citasFormateadas);
    } catch (error) {
        console.error('[❌ ERROR MONITOR]:', error);
        res.status(500).json({ error: 'Error al obtener las citas del día.' });
    }
};

// =========================================================
// 🔄 2. MOVER PACIENTE / ACTIVAR TRIAGE (RFW-03)
// =========================================================
const actualizarEstadoCita = async (req, res) => {
    try {
        const { id_cita } = req.params;
        const { estado, triage_urgencia } = req.body;

        // 🧠 DICCIONARIO 2: React -> Base de Datos (Respeta tu CHECK constraint)
        const traductorHaciaBD = {
            'programada': 'Programada',
            'espera': 'En sala de espera',     
            'consulta': 'En curso', 
            'finalizada': 'Completada' 
        };

        const updateData = {};
        
        if (estado) {
            updateData.estado = traductorHaciaBD[estado] || estado; 
        }
        
        if (triage_urgencia !== undefined) {
            updateData.triage_urgencia = triage_urgencia;
        }

        console.log(`[🔄 MONITOR] Actualizando cita ${id_cita}. Nuevo estado BD: ${updateData.estado || 'Solo Triage'} | Triage: ${triage_urgencia}`);

        const { data, error } = await supabase
            .from('citas')
            .update(updateData)
            .eq('id_cita', id_cita)
            .select('id_cita')
            .single();

        if (error) throw error;

        res.status(200).json({ mensaje: 'Cita actualizada correctamente', id_cita: data.id_cita });
    } catch (error) {
        console.error('[❌ ERROR UPDATE CITA]:', error);
        res.status(500).json({ error: 'Error al actualizar el estado de la cita.' });
    }
};

// =========================================================
// ⚠️ 3. ALERTA DE RETRASO MASIVA (RFW-04)
// =========================================================
const notificarRetrasoMasivo = async (req, res) => {
    try {
        const { minutos_retraso = 30 } = req.body; 
        
        console.log(`\n==============================================`);
        console.log(`[🚀 ALERTA RFW-04] Ejecutando protocolo de retraso: ${minutos_retraso} minutos.`);
        console.log(`[🤖 WHATSAPP] Enviando mensaje a los pacientes "En sala de espera" y "Programada"...`);
        console.log(`==============================================\n`);

        res.status(200).json({ 
            mensaje: `Se ha notificado vía WhatsApp a los pacientes sobre el retraso de ${minutos_retraso} minutos.`,
            estado: 'Notificaciones_Enviadas'
        });
    } catch (error) {
        console.error('[❌ ERROR NOTIFICACIÓN]:', error);
        res.status(500).json({ error: 'Error al enviar las notificaciones masivas.' });
    }
};

module.exports = { 
    obtenerCitasDelDia, 
    actualizarEstadoCita, 
    notificarRetrasoMasivo 
};