const supabase = require('../../config/supabase');

const { encontrarProximoHueco } = require('../../services/agenda.service');

const getCitas = async (req, res) => {
    try {
        const id_sucursal = req.user.id_sucursal;
        
        // Obtenemos la fecha actual y la de mañana para filtrar por defecto "Hoy"
        // Si el frontend manda fechas, usamos esas
        const { fecha_inicio, fecha_fin } = req.query;
        let query = supabase
            .from('citas')
            .select(`
                id_cita,
                fecha_hora,
                fecha_hora_fin,
                estado,
                motivo_cancelacion,
                notas_adicionales,
                triage_prioridad,
                pacientes ( id_paciente, usuarios ( nombre_completo, telefono ) ),
                medicos ( id_medico, usuarios ( nombre_completo ) )
            `)
            .eq('id_sucursal', id_sucursal)
            .order('fecha_hora', { ascending: true });

        // Si mandan rango de fechas, lo aplicamos
        if (fecha_inicio && fecha_fin) {
            query = query.gte('fecha_hora', fecha_inicio).lte('fecha_hora', fecha_fin);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Formateamos la respuesta para que el Frontend la digiera más fácil
        const citasFormateadas = data.map(cita => ({
            id_cita: cita.id_cita,
            fecha_hora: cita.fecha_hora,
            fecha_hora_fin: cita.fecha_hora_fin,
            estado: cita.estado,
            notas: cita.notas_adicionales,
            triage_prioridad: cita.triage_prioridad,
            paciente: cita.pacientes?.usuarios?.nombre_completo || 'Desconocido',
            telefono_paciente: cita.pacientes?.usuarios?.telefono || 'Sin registro',
            medico: cita.medicos?.usuarios?.nombre_completo || 'No asignado'
        }));

        res.status(200).json(citasFormateadas);
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ error: 'Error interno al cargar la agenda.' });
    }
};

const updateEstadoCita = async (req, res) => {
    try {
        const { id_cita } = req.params;
        const { estado, motivo_cancelacion } = req.body;
        const id_sucursal_admin = req.user.id_sucursal;

        // 1. Validar que la cita pertenece a la sucursal actual
        const { data: citaValidacion } = await supabase
            .from('citas')
            .select('id_sucursal')
            .eq('id_cita', id_cita)
            .single();

        if (!citaValidacion || citaValidacion.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'No tienes permiso para modificar esta cita.' });
        }

        // 2. Preparar la actualización
        const payload = { 
            estado, 
            fecha_actualizacion: new Date().toISOString() 
        };

        if (estado === 'Cancelada' && motivo_cancelacion) {
            payload.motivo_cancelacion = motivo_cancelacion;
        }

        if (estado === 'Confirmada') {
            payload.confirmada_at = new Date().toISOString();
        }

        const { error } = await supabase.from('citas').update(payload).eq('id_cita', id_cita);
        
        if (error) throw error;

        res.status(200).json({ mensaje: `Cita marcada como ${estado}.` });
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({ error: 'No se pudo actualizar el estado de la cita.' });
    }
};

const aprobarBloqueo = async (req, res) => {
    try {
        const { id_bloqueo } = req.params;
        console.log(`\n==============================================`);
        console.log(`[🔍 DEBUG] 1. INICIANDO APROBACIÓN DE BLOQUEO ID: ${id_bloqueo}`);

        // 1. Obtener los datos del bloqueo
        const { data: bloqueo, error: errBloqueo } = await supabase
            .from('bloqueos_agenda')
            .select('*')
            .eq('id_bloqueo', id_bloqueo)
            .single();

        if (errBloqueo || !bloqueo) {
            console.log(`[❌ ERROR] Bloqueo no encontrado en Supabase:`, errBloqueo);
            return res.status(404).json({ error: 'Bloqueo no encontrado' });
        }

        console.log(`[✅ OK] Bloqueo leído: Médico ${bloqueo.id_medico} | Desde: ${bloqueo.fecha_inicio} | Hasta: ${bloqueo.fecha_fin}`);

        // 2. Cambiar el estatus del bloqueo a Aprobado
        await supabase.from('bloqueos_agenda').update({ estado_aprobacion: 'Aprobado' }).eq('id_bloqueo', id_bloqueo);
        console.log(`[✅ OK] Estatus del bloqueo cambiado a Aprobado en la BD.`);

        // 🛡️ LIMPIEZA DE FECHAS
        const inicioStr = String(bloqueo.fecha_inicio).replace('T', ' ').substring(0, 19);
        const finStr = String(bloqueo.fecha_fin).replace('T', ' ').substring(0, 19);
        
        console.log(`[🔍 DEBUG] 2. BUSCANDO COLISIONES...`);
        console.log(`         ¿Cita_Inicio < ${finStr} Y Cita_Fin > ${inicioStr}?`);

        // 3. Buscar las citas atrapadas (¡Agregamos los IDs necesarios para clonar la cita señuelo!)
        const { data: citasAfectadas, error: errBusqueda } = await supabase
            .from('citas')
            .select(`
                id_cita, estado, fecha_hora, fecha_hora_fin,
                id_institucion, id_sucursal, id_paciente,
                pacientes ( id_usuario, usuarios (nombre_completo) )
            `)
            .eq('id_medico', bloqueo.id_medico)
            .in('estado', ['Programada', 'Confirmada'])
            .lt('fecha_hora', finStr) 
            .gt('fecha_hora_fin', inicioStr);

        if (errBusqueda) {
            console.error(`[❌ ERROR] Falló la búsqueda de citas en Supabase:`, errBusqueda);
            throw errBusqueda;
        }

        console.log(`[✅ OK] Supabase devolvió ${citasAfectadas ? citasAfectadas.length : 0} citas afectadas.`);

        let notificacionesEnviadas = 0;
        const huecosUsadosEstaVez = []; // 🧠 AQUÍ ESTÁ LA MEMORIA ANTI-CHOQUES

        // 4. EL MOTOR DE REPROGRAMACIÓN
        if (citasAfectadas && citasAfectadas.length > 0) {
            console.log(`[🔍 DEBUG] 3. INICIANDO MOTOR DE REPROGRAMACIÓN...`);
            
            for (const cita of citasAfectadas) {
                console.log(`----------------------------------------------`);
                console.log(`[⚙️ PROCESANDO] Cita ID: ${cita.id_cita} | Fecha Original: ${cita.fecha_hora}`);
                
                // 🎯 Buscamos el hueco respetando la memoria de este ciclo
                const propuesta = await encontrarProximoHueco(bloqueo.id_medico, 30, huecosUsadosEstaVez);
                console.log(`[💡 PROPUESTA ALGORITMO]:`, propuesta ? `${propuesta.inicio} a ${propuesta.fin}` : 'NO HAY HUECOS (Entrará a Salvavidas)');
                
                const nombrePaciente = cita.pacientes?.usuarios?.nombre_completo?.split(' ')[0] || 'Paciente';

                if (propuesta) {
                    // ⏱️ CÁLCULO DE EXPIRACIÓN DINÁMICA
                    const ahora = new Date();
                    const fechaPropuesta = new Date(propuesta.inicio);
                    const horasFaltantes = (fechaPropuesta.getTime() - ahora.getTime()) / (1000 * 60 * 60);

                    let fechaExpiracion;
                    if (horasFaltantes > 27) { 
                        fechaExpiracion = new Date(ahora.getTime() + 24 * 60 * 60 * 1000); 
                    } else {
                        fechaExpiracion = new Date(fechaPropuesta.getTime() - 3 * 60 * 60 * 1000); 
                    }

                    // 🧠 Registramos en la memoria del ciclo actual
                    huecosUsadosEstaVez.push(propuesta.inicioStr);

                    // 🛡️ REGRESAMOS AL FORMATO UTC OFICIAL (Con la 'Z' para Supabase)
                    // 1. Calculamos tu desfase horario local en milisegundos
                    const tzOffset = new Date().getTimezoneOffset() * 60000;

                    // 2. Aplicamos el desfase y limpiamos las letras ('T' y 'Z') para dejar tu hora local pura
                    const inicioLocal = new Date(new Date(propuesta.inicio).getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ');
                    const finLocal = new Date(new Date(propuesta.fin).getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ');

                    // 🚨 EL PARCHE SALVA-VIDAS: Cita Señuelo usando el UTC correcto
                    const { data: citaSenuelo, error: errSenuelo } = await supabase
                        .from('citas')
                        .insert([{
                            id_institucion: cita.id_institucion,
                            id_sucursal: cita.id_sucursal,
                            id_paciente: cita.id_paciente,
                            id_medico: bloqueo.id_medico,
                            fecha_hora: inicioLocal,     // 👈 "2026-04-17T10:00:00.000Z"
                            fecha_hora_fin: finLocal,    // 👈 "2026-04-17T10:30:00.000Z"
                            estado: 'Programada', 
                            notas_adicionales: 'RESERVA_FANTASMA_NO_TOCAR'
                        }])
                        .select('id_cita')
                        .single();

                    if (errSenuelo) {
                        console.error(`[❌ ERROR SEÑUELO] No se pudo crear la cita de respaldo:`, errSenuelo);
                    }

                    const idCitaFantasma = citaSenuelo ? citaSenuelo.id_cita : null;

                    // 🎯 EL JSON SEGURO: Usamos el UTC oficial para que todo coincida
                    const datosPropuesta = { 
                        nueva_fecha: inicioLocal, 
                        nueva_fecha_fin: finLocal,
                        expira_at: fechaExpiracion.toISOString(),
                        id_cita_fantasma: idCitaFantasma 
                    };

                    const { error: errUpdate } = await supabase
                        .from('citas')
                        .update({ 
                            estado: 'Reprogramada', 
                            motivo_cancelacion: `Bloqueo: ${bloqueo.titulo}`,
                            propuesta_reprogramacion: datosPropuesta
                        })
                        .eq('id_cita', cita.id_cita);

                    if (errUpdate) {
                        console.error(`[❌ ERROR AL ACTUALIZAR CITA ${cita.id_cita}]:`, errUpdate);
                    } else {
                        console.log(`[✅ OK] Cita ${cita.id_cita} actualizada. Señuelo ID: ${idCitaFantasma}`);
                    }

                    // Formateamos las fechas para el WhatsApp (Esto se queda en horario local para el paciente)
                    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
                    const fechaLegible = fechaPropuesta.toLocaleString('es-MX', opcionesFecha);
                    const limiteLegible = fechaExpiracion.toLocaleString('es-MX', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

                    const mensaje = `Hola ${nombrePaciente}, el médico tuvo una emergencia 🚨. Hemos reservado un nuevo espacio para ti: *${fechaLegible}*. \n\n✅ Responde *1* para confirmar.\n❌ Responde *2* para rechazar y liberar el espacio.\n\n⏳ Tienes hasta el *${limiteLegible}* para confirmar o el sistema liberará el espacio automáticamente.`;

                    const { error: errNotif } = await supabase.from('notificaciones').insert([{
                        id_usuario: cita.pacientes.id_usuario, id_cita: cita.id_cita,
                        tipo: 'REPROGRAMACION_AUTO', titulo: 'Cambio de horario',
                        mensaje: mensaje, programada_para: new Date()
                    }]);

                    if (errNotif) {
                        console.error(`[❌ ERROR AL CREAR NOTIFICACIÓN PARA CITA ${cita.id_cita}]:`, errNotif);
                    } else {
                        console.log(`[✅ OK] Notificación creada para paciente: ${nombrePaciente}.`);
                    }

                } else {
                    console.log(`[⚠️ ADVERTENCIA] Ejecutando Salvavidas para cita ${cita.id_cita}...`);
                    const { error: errUpdateSalva } = await supabase
                        .from('citas')
                        .update({ estado: 'Reprogramada', motivo_cancelacion: `Bloqueo: ${bloqueo.titulo} (Sin espacios automáticos)`})
                        .eq('id_cita', cita.id_cita);
                    
                    if (errUpdateSalva) console.error(`[❌ ERROR SALVAVIDAS CITA ${cita.id_cita}]:`, errUpdateSalva);

                    const mensajeManual = `Hola ${nombrePaciente}, el médico tuvo una emergencia imprevista 🚨 y tuvimos que suspender la consulta. Por favor comunícate con recepción para buscarte un nuevo espacio manualmente.`;

                    await supabase.from('notificaciones').insert([{
                        id_usuario: cita.pacientes.id_usuario, id_cita: cita.id_cita,
                        tipo: 'ALERTA_URGENTE', titulo: 'Cita suspendida',
                        mensaje: mensajeManual, programada_para: new Date()
                    }]);
                }
                
                notificacionesEnviadas++;
            }
        } else {
            console.log(`[⚠️ ADVERTENCIA] El motor no arrancó porque Supabase dijo que había 0 citas afectadas.`);
        }

        console.log(`[🏁 FIN] Proceso de aprobación terminado. Respondiendo al frontend...`);
        console.log(`==============================================\n`);

        res.status(200).json({ 
            mensaje: 'Bloqueo aprobado procesado.',
            pacientes_reprogramados: notificacionesEnviadas
        });

    } catch (error) {
        console.error('\n[❌ FATAL ERROR] CATCH BLOCK ALCANZADO:', error);
        res.status(500).json({ error: 'Ocurrió un error al procesar el bloqueo.' });
    }
};

const rechazarBloqueo = async (req, res) => {
    try {
        const { id_bloqueo } = req.params;

        // Solo cambiamos el estatus a "Rechazado" para que el médico lo vea en su panel
        const { error } = await supabase
            .from('bloqueos_agenda')
            .update({ estado_aprobacion: 'Rechazado', activo: false }) // Lo ponemos inactivo para que no estorbe
            .eq('id_bloqueo', id_bloqueo);

        if (error) throw error;

        res.status(200).json({ mensaje: 'Solicitud de bloqueo rechazada.' });
    } catch (error) {
        console.error('Error al rechazar bloqueo:', error);
        res.status(500).json({ error: 'Ocurrió un error al rechazar el bloqueo.' });
    }
};

module.exports = {
    getCitas,
    updateEstadoCita,
    aprobarBloqueo,
    rechazarBloqueo // 👈 ¡No olvides exportarla!
};