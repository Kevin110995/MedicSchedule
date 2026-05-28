const supabase = require('../config/supabase'); 

const getDashboardMetrics = async (req, res) => {
    try {
        // 1. Extraemos id_usuario también
        const { id_usuario, rol, id_sucursal, id_institucion } = req.user;
        const hoy = new Date();
        const inicioDia = new Date(hoy.setHours(0,0,0,0)).toISOString();
        const finDia = new Date(hoy.setHours(23,59,59,999)).toISOString();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

        // ==========================================
        // OBTENER FOTO, INSTITUCIÓN Y SUCURSAL DEL USUARIO
        // ==========================================
        const { data: userData } = await supabase
            .from('usuarios')
            .select(`
                nombre_completo,
                avatar_url, 
                rol,
                instituciones (nombre_institucion),
                sucursales (nombre_corto, nombre_sede) 
            `)
            .eq('id_usuario', id_usuario)
            .single();

        const infoUsuario = {
            nombre: userData?.nombre_completo || 'Administrador',
            foto: userData?.avatar_url || null,
            rol: userData?.rol || rol,
            institucion: userData?.instituciones?.nombre_institucion || 'Sin Institución',
            // 👇 NUEVO: Extraemos la sucursal
            sucursal: userData?.sucursales?.nombre_corto || userData?.sucursales?.nombre_sede || 'Sucursal Local'
        };
        // ==========================================

        if (rol === 'Super_Admin') {
            // 1. KPIs Globales
            const { count: totalPacientes } = await supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('id_institucion_preferida', id_institucion);
            const { count: totalClinicas } = await supabase.from('sucursales').select('*', { count: 'exact', head: true }).eq('id_institucion', id_institucion).eq('activa', true);
            const { count: totalMedicos } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('id_institucion', id_institucion).eq('rol', 'Medico').eq('estatus', true);

            // 2. Extraer TODAS las citas del mes para comparar sucursales
            const { data: citasMes } = await supabase
                .from('citas')
                .select('estado, fecha_hora, sucursales(nombre_corto, nombre_sede)')
                .eq('id_institucion', id_institucion)
                .gte('fecha_hora', inicioMes);

            let citasHoyGlobal = 0;
            const eficienciaSucursales = {};
            const crecimientoDiario = {}; // 👈 NUEVO: Objeto para agrupar por día

            if (citasMes) {
                citasMes.forEach(cita => {
                    // 1. Contar citas de hoy
                    if (cita.fecha_hora >= inicioDia && cita.fecha_hora <= finDia) {
                        citasHoyGlobal++; 
                    }

                    // 2. Lógica para Eficiencia por Sucursal (lo que ya funcionaba)
                    const nombreSucursal = cita.sucursales?.nombre_corto || cita.sucursales?.nombre_sede || 'Desconocida';
                    if (!eficienciaSucursales[nombreSucursal]) {
                        eficienciaSucursales[nombreSucursal] = { nombre: nombreSucursal, completadas: 0, fugas: 0 };
                    }
                    if (cita.estado === 'Completada') {
                        eficienciaSucursales[nombreSucursal].completadas++;
                    } else if (cita.estado === 'Cancelada' || cita.estado === 'No asistio') {
                        eficienciaSucursales[nombreSucursal].fugas++;
                    }

                    // 3. NUEVO: Lógica para la gráfica de Crecimiento / Análisis
                    // Extraemos el día y mes (ej. "05 abr")
                    const fechaObj = new Date(cita.fecha_hora);
                    const diaFormateado = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                    
                    if (!crecimientoDiario[diaFormateado]) {
                        crecimientoDiario[diaFormateado] = { 
                            fecha: diaFormateado, 
                            total_citas: 0,
                            timestamp: fechaObj.setHours(0,0,0,0) // Usado solo para ordenar
                        };
                    }
                    crecimientoDiario[diaFormateado].total_citas++;
                });
            }

            const comparativaArray = Object.values(eficienciaSucursales);
            
            // 4. Convertimos a arreglo y ordenamos cronológicamente
            const crecimientoArray = Object.values(crecimientoDiario)
                .sort((a, b) => a.timestamp - b.timestamp)
                .map(({ fecha, total_citas }) => ({ fecha, total_citas })); // Limpiamos el timestamp

            return res.status(200).json({ 
                rol, 
                usuario: infoUsuario,
                metricas: {
                    clinicas_activas: totalClinicas || 0,
                    medicos_red: totalMedicos || 0,
                    pacientes_globales: totalPacientes || 0,
                    citas_hoy: citasHoyGlobal
                },
                graficas: {
                    crecimiento: crecimientoArray, // 👈 AHORA SÍ MANDAMOS DATOS
                    eficiencia_sucursales: comparativaArray
                } 
            });

        } else if (rol === 'Administrador') {
            if (!id_sucursal) return res.status(400).json({ error: 'Sin sucursal asignada.' });

            // 1. KPIs de HOY y Flujo de Horas (Lo que borramos por error)
            const { data: citasHoy } = await supabase
                .from('citas')
                .select('estado, fecha_hora')
                .eq('id_sucursal', id_sucursal)
                .gte('fecha_hora', inicioDia)
                .lte('fecha_hora', finDia);

            let completadas = 0, perdidas = 0;
            const flujoHoras = {};

            (citasHoy || []).forEach(cita => {
                if (cita.estado === 'Completada') completadas++;
                if (cita.estado === 'Cancelada' || cita.estado === 'No asistio') perdidas++;

                const hora = new Date(cita.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute:'2-digit' });
                if (!flujoHoras[hora]) flujoHoras[hora] = { hora, programadas: 0 };
                flujoHoras[hora].programadas++;
            });

            // 2. CORRECCIÓN: PACIENTES ASIGNADOS A ESTA SUCURSAL
            // Ahora consultamos directamente la tabla 'pacientes' filtrando por la sede preferida
            const { count: totalPacientesSede, error: errorPacientes } = await supabase
                .from('pacientes')
                .select('*', { count: 'exact', head: true })
                .eq('id_sucursal_preferida', id_sucursal);

            if (errorPacientes) {
                console.error("Error al contar pacientes:", errorPacientes);
            }
            

            // 3. CORRECCIÓN: RANKING DE MÉDICOS
            const { data: medicosSucursal } = await supabase
                .from('usuarios')
                .select('id_usuario, nombre_completo, medicos(id_medico)')
                .eq('id_sucursal', id_sucursal)
                .eq('rol', 'Medico');

            const ranking = [];
            
            if (medicosSucursal && medicosSucursal.length > 0) {
                const idsMedicos = medicosSucursal.map(m => {
                    return Array.isArray(m.medicos) ? m.medicos[0]?.id_medico : m.medicos?.id_medico;
                }).filter(Boolean);
                
                if (idsMedicos.length > 0) {
                    const { data: calificaciones } = await supabase
                        .from('calificaciones')
                        .select('id_medico, puntuacion')
                        .in('id_medico', idsMedicos);

                    medicosSucursal.forEach(usuario => {
                        const idMedico = Array.isArray(usuario.medicos) ? usuario.medicos[0]?.id_medico : usuario.medicos?.id_medico;
                        const califsMedico = (calificaciones || []).filter(c => c.id_medico === idMedico);
                        
                        let promedio = 0;
                        if (califsMedico.length > 0) {
                            const suma = califsMedico.reduce((acc, curr) => acc + curr.puntuacion, 0);
                            promedio = (suma / califsMedico.length).toFixed(1);
                            
                            ranking.push({
                                nombre: usuario.nombre_completo.replace('Dr. ', '').replace('Dra. ', ''),
                                calificacion: parseFloat(promedio)
                            });
                        }
                    });
                }
            }

            ranking.sort((a, b) => b.calificacion - a.calificacion);

            return res.status(200).json({ 
                rol, 
                usuario: infoUsuario,
                metricas: {
                    citas_hoy: (citasHoy || []).length,
                    pacientes_activos: totalPacientesSede || 0, // <-- Ahora React recibirá el número real
                    inasistencias: perdidas,
                    mejor_calificacion: ranking.length > 0 ? ranking[0].calificacion : 0 
                },
                graficas: {
                    ocupacion: Object.values(flujoHoras).sort((a, b) => a.hora.localeCompare(b.hora)),
                    ranking_medicos: ranking 
                }
            });
        }
    } catch (err) {
        console.error('Error dashboard:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

module.exports = { getDashboardMetrics };