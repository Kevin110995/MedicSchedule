const supabase = require('../config/supabase');

const formatearFechaParaBD = (fecha) => {
    const tzOffset = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ');
};

const encontrarProximoHueco = async (id_medico, duracionMinutos = 30, memoriaOcupados = []) => {
    let fechaBusqueda = new Date();
    fechaBusqueda.setDate(fechaBusqueda.getDate() + 1);
    fechaBusqueda.setHours(0, 0, 0, 0);
    const ahora = new Date();

    // 👻 EL ESCUDO FANTASMA: Buscamos todas las propuestas activas ANTES de empezar a buscar
    const { data: citasConPropuesta } = await supabase
        .from('citas')
        .select('propuesta_reprogramacion')
        .eq('id_medico', id_medico)
        .eq('estado', 'Reprogramada')
        .not('propuesta_reprogramacion', 'is', null);

    // Filtramos SOLO las que siguen vivas (no han expirado)
    const reservasTemporales = (citasConPropuesta || [])
        .filter(c => new Date(c.propuesta_reprogramacion.expira_at) > ahora)
        .map(c => ({
            inicio: new Date(c.propuesta_reprogramacion.nueva_fecha),
            fin: new Date(c.propuesta_reprogramacion.nueva_fecha_fin)
        }));

    for (let i = 0; i < 15; i++) {
        const diaSemana = fechaBusqueda.getDay();
        
        const { data: horario } = await supabase.from('horarios_medico').select('*').eq('id_medico', id_medico).eq('dia_semana', diaSemana).eq('activo', true).single();

        if (horario) {
            let horaActual = new Date(fechaBusqueda.toISOString().split('T')[0] + 'T' + horario.hora_inicio);
            const horaCierre = new Date(fechaBusqueda.toISOString().split('T')[0] + 'T' + horario.hora_fin);

            while (horaActual < horaCierre) {
                const finSlot = new Date(horaActual.getTime() + duracionMinutos * 60000);
                const inicioStr = formatearFechaParaBD(horaActual);
                const finStr = formatearFechaParaBD(finSlot);

                // 1. Anti-choques de la memoria actual
                if (memoriaOcupados.includes(inicioStr)) {
                    horaActual = finSlot; continue;
                }

                // 2. ¿Choca con alguna Reserva Fantasma de otro paciente que aún no expira?
                const chocaConFantasma = reservasTemporales.some(reserva => 
                    finSlot > reserva.inicio && horaActual < reserva.fin
                );

                if (chocaConFantasma) {
                    horaActual = finSlot; continue;
                }

                // 3. Colisiones en BD real (Citas confirmadas y Bloqueos de admin)
                const { data: ocupado } = await supabase.from('citas').select('id_cita').eq('id_medico', id_medico).in('estado', ['Programada', 'Confirmada']).lt('fecha_hora', finStr).gt('fecha_hora_fin', inicioStr);
                const { data: bloqueado } = await supabase.from('bloqueos_agenda').select('id_bloqueo').eq('id_medico', id_medico).eq('estado_aprobacion', 'Aprobado').lt('fecha_inicio', finStr).gt('fecha_fin', inicioStr);

                if (ocupado.length === 0 && bloqueado.length === 0) {
                    return { inicio: horaActual, fin: finSlot, inicioStr }; 
                }
                horaActual = finSlot;
            }
        }
        fechaBusqueda.setDate(fechaBusqueda.getDate() + 1);
    }
    return null;
};

module.exports = { encontrarProximoHueco };