const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const supabase = require('../config/supabase');

let client;
let botEncendido = false; 
let botListo = false;
let procesandoMensajes = false;

const limpiarTexto = (texto) => {
    return texto.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
};

const inicializarWhatsApp = () => {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { headless: true, args: ['--no-sandbox'] }
    });

    client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

    client.on('ready', () => {
        botListo = true;
        console.log('✅ BOT DE WHATSAPP CONECTADO Y ESCUCHANDO.');
        setInterval(procesarBandejaDeSalida, 15000);
    });

    client.on('message', async (msg) => {
        if (!botEncendido || !botListo) return;

        const textoLimpio = limpiarTexto(msg.body);
        
        // 🛡️ Extracción de número a prueba de balas (Toma solo los últimos 10 dígitos)
        const numCrudo = msg.from.split('@')[0];
        const numeroRemitente = numCrudo.length > 10 ? numCrudo.slice(-10) : numCrudo;

        const intencionAceptar = ['aceptar', 'si', 'confirmar', 'confirmo', 'ok', 'listo', 'vale', 'acepto', '1'];
        const intencionRechazar = ['no', 'cancelar', 'rechazar', 'recepcion', '2'];

        const esAceptacion = intencionAceptar.includes(textoLimpio);
        const esRechazo = intencionRechazar.includes(textoLimpio);

        if (!esAceptacion && !esRechazo) return;

        console.log(`\n==============================================`);
        console.log(`📩 Analizando respuesta de: ${numeroRemitente} | Intención: ${textoLimpio}`);

        try {
            // PASO 1: Buscar al usuario (limitando a 1 para evitar crasheos si hay duplicados)
            const { data: usuarios, error: errUsu } = await supabase
                .from('usuarios')
                .select('id_usuario, nombre_completo, whatsapp_verificado, pacientes (id_paciente)')
                .or(`telefono.eq.${numeroRemitente},whatsapp_numero.eq.${numeroRemitente}`)
                .limit(1);

            if (errUsu || !usuarios || usuarios.length === 0) {
                console.log(`[❌ ERROR] Número ${numeroRemitente} no registrado en BD.`);
                return;
            }

            const usuario = usuarios[0];
            
            // 🛡️ Ajuste a prueba de balas: Ya sea que Supabase devuelva un Array o un Objeto
            const idPaciente = Array.isArray(usuario.pacientes) ? usuario.pacientes[0]?.id_paciente : usuario.pacientes?.id_paciente;
            const primerNombre = usuario.nombre_completo.split(' ')[0] || 'Paciente';

            console.log(`[👤 OK] Paciente detectado: ${primerNombre} (ID Paciente: ${idPaciente || 'Ninguno'})`);

            if (!idPaciente) {
                console.log(`[⚠️ ADVERTENCIA] El usuario existe pero no tiene un ID de paciente vinculado.`);
                return;
            }

            // PASO 2: Buscar si tiene una cita esperando reprogramación
            const { data: citasPendientes, error: errCita } = await supabase
                .from('citas')
                .select('id_cita, propuesta_reprogramacion, id_medico')
                .eq('id_paciente', idPaciente)
                .eq('estado', 'Reprogramada')
                .not('propuesta_reprogramacion', 'is', null) // Aseguramos que sea una con propuesta activa
                .order('fecha_actualizacion', { ascending: false })
                .limit(1); // En vez de .single(), usamos .limit(1) para que NUNCA explote

            if (errCita) console.error(`[❌ ERROR] Falló la búsqueda de citas pendientes:`, errCita);

            const citaPendiente = citasPendientes && citasPendientes.length > 0 ? citasPendientes[0] : null;

            if (citaPendiente) {
                console.log(`[📅 OK] Cita pendiente encontrada: ID ${citaPendiente.id_cita}`);
                const propuesta = citaPendiente.propuesta_reprogramacion;

                // 🧹 DESTRUIR LA CITA SEÑUELO (Dentro de whatsapp.service.js)
                if (propuesta && propuesta.id_cita_fantasma) {
                    console.log(`[🧹 LIMP] Intentando borrar cita fantasma ID: ${propuesta.id_cita_fantasma}`);
                    await supabase
                        .from('citas')
                        .delete()
                        .eq('id_cita', propuesta.id_cita_fantasma);
                    console.log(`[✅ OK] Espacio liberado/limpiado.`);
                }

                if (esAceptacion) {
                    if (propuesta && propuesta.nueva_fecha) {
                        console.log(`[⏳ DEBUG] Verificando caducidad... (Expira: ${propuesta.expira_at})`);
                        
                        // EL RELOJ IMPLACABLE
                        const expiraDate = new Date(propuesta.expira_at);
                        if (new Date() > expiraDate) {
                            console.log(`[❌ RECHAZO] La propuesta ya expiró.`);
                            await client.sendMessage(msg.from, `Lo siento ${primerNombre}, el tiempo de espera para confirmar esta cita terminó y el sistema liberó el espacio para otros pacientes. 😔\n\nPor favor comunícate a recepción para agendar de nuevo.`);
                            // Borramos la propuesta para limpiar la BD
                            await supabase.from('citas').update({ propuesta_reprogramacion: null }).eq('id_cita', citaPendiente.id_cita);
                            return;
                        }

                        console.log(`[🛡️ DEBUG] Verificando escudo anti-choques (Race Conditions)...`);
                        
                        // ESCUDO ANTI-CHOQUES
                        const { data: colisionesRaw } = await supabase
                            .from('citas')
                            .select('id_cita, notas_adicionales') // 👈 Traemos las notas para identificar al fantasma
                            .eq('id_medico', citaPendiente.id_medico)
                            .in('estado', ['Programada', 'Confirmada'])
                            .lt('fecha_hora', propuesta.nueva_fecha_fin)
                            .gt('fecha_hora_fin', propuesta.nueva_fecha);

                        // 🎯 EL FILTRO INTELIGENTE: Ignoramos nuestra propia cita señuelo
                        const colision = (colisionesRaw || []).filter(c => 
                            c.notas_adicionales !== 'RESERVA_FANTASMA_NO_TOCAR' && 
                            c.id_cita !== propuesta.id_cita_fantasma
                        );

                        if (colision && colision.length > 0) {
                            console.log(`[⚠️ ALERTA] ¡Colisión! El espacio fue tomado por otra persona.`);
                            await client.sendMessage(msg.from, `¡Uy! 😅 Lo siento mucho ${primerNombre}, alguien más acaba de reservar ese horario. \n\n👩‍💻 Nuestra recepción te llamará enseguida para buscarte otro espacio.`);
                            await supabase.from('citas').update({ propuesta_reprogramacion: null }).eq('id_cita', citaPendiente.id_cita);
                            return;
                        }

                        console.log(`[✅ ÉXITO] Todo libre. Confirmando cita en BD y actualizando fechas oficiales...`);
                        
                        // 🎯 MAGIA: Sobreescribimos las fechas para que el Móvil no tenga problemas
                        await supabase.from('citas').update({ 
                            fecha_hora: propuesta.nueva_fecha, 
                            fecha_hora_fin: propuesta.nueva_fecha_fin,
                            estado: 'Confirmada', 
                            es_reprogramada: true, 
                            propuesta_reprogramacion: null // Vaciamos evidencia
                        }).eq('id_cita', citaPendiente.id_cita);

                        const fechaLegible = new Date(propuesta.nueva_fecha).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                        await client.sendMessage(msg.from, `¡Perfecto ${primerNombre}! ✅ Tu cita ha sido re-agendada y confirmada para el *${fechaLegible}*. ¡Te esperamos!`);
                        
                    } else {
                        console.log(`[❌ ERROR] Propuesta mal formada en BD.`);
                        await client.sendMessage(msg.from, `Lo siento ${primerNombre}, ocurrió un problema leyendo tu fecha. Por favor contacta a recepción.`);
                    }
                } 
                else if (esRechazo) {
                    console.log(`[🛑 CANCELACIÓN] Paciente rechazó. Liberando el espacio.`);
                    await supabase.from('citas').update({ 
                        estado: 'Cancelada', 
                        motivo_cancelacion: 'Paciente rechazó la propuesta de reprogramación.',
                        propuesta_reprogramacion: null
                    }).eq('id_cita', citaPendiente.id_cita);

                    await client.sendMessage(msg.from, `Entendido ${primerNombre}. Hemos liberado el espacio. 👩‍💻 Nuestra recepción se pondrá en contacto contigo pronto para buscar un horario diferente, o puedes llamarnos directamente.`);
                }
                return; // Cortamos ejecución aquí si procesamos una cita
            } else {
                console.log(`[🤷‍♂️ INFO] El paciente ${primerNombre} respondió, pero no tiene citas pendientes de reprogramar.`);
            }

            // =========================================================
            // ESCENARIO B: NO TIENE CITAS PENDIENTES, SOLO ESTÁ VERIFICANDO SU CUENTA
            // =========================================================
            if (esAceptacion && !usuario.whatsapp_verificado) {
                await supabase.from('usuarios').update({ whatsapp_verificado: true }).eq('id_usuario', usuario.id_usuario);
                await client.sendMessage(msg.from, `¡Excelente ${primerNombre}! ✅ Tu cuenta ha sido verificada. Ahora recibirás recordatorios de tus citas por aquí.`);
                console.log(`🎉 Usuario verificado: ${usuario.nombre_completo}`);
            }

        } catch (error) {
            console.error("🚨 Error procesando mensaje de WhatsApp:", error);
        }
        console.log(`==============================================\n`);
    });
    
    client.initialize();
};

const procesarBandejaDeSalida = async () => {
    if (!botEncendido || !botListo || procesandoMensajes) return;
    procesandoMensajes = true; 

    try {
        const { data: pendientes, error } = await supabase
            .from('notificaciones')
            .select(`*, usuarios(telefono, whatsapp_numero, whatsapp_verificado)`)
            .eq('whatsapp_enviado', false)
            .limit(5);

        if (error || !pendientes || pendientes.length === 0) {
            procesandoMensajes = false; 
            return;
        }

        for (const notif of pendientes) {
            if (notif.tipo === 'ALERTA_URGENTE' && !notif.usuarios?.whatsapp_verificado) {
                await supabase.from('notificaciones').update({ whatsapp_enviado: true, whatsapp_error: 'Usuario no verificado' }).eq('id_notificacion', notif.id_notificacion);
                continue;
            }

            const numeroBruto = notif.usuarios?.whatsapp_numero || notif.usuarios?.telefono;
            if (numeroBruto) {
                const numeroLimpio = numeroBruto.replace(/\D/g, ''); 
                const numeroConPrefijo = numeroLimpio.length === 10 ? `521${numeroLimpio}` : numeroLimpio;

                try {
                    const numberDetails = await client.getNumberId(numeroConPrefijo);
                    if (numberDetails) {
                        await client.sendMessage(numberDetails._serialized, notif.mensaje);
                        await supabase.from('notificaciones').update({ whatsapp_enviado: true, enviada_en: new Date() }).eq('id_notificacion', notif.id_notificacion);
                        console.log(`📤 Mensaje enviado a: ${numeroBruto}`);
                    } else {
                        await supabase.from('notificaciones').update({ whatsapp_enviado: true, whatsapp_error: 'Número no registrado en WhatsApp' }).eq('id_notificacion', notif.id_notificacion);
                    }
                } catch (sendError) {
                    console.error(`⚠️ Error al enviar a ${numeroBruto}:`, sendError.message);
                }
            }
            await new Promise(r => setTimeout(r, 3000)); 
        }
    } catch (e) {
        console.error("Error en ciclo:", e);
    } finally {
        procesandoMensajes = false; 
    }
};

const apagarBotSeguro = async () => {
    if (client) {
        try {
            await client.destroy();
        } catch (error) {}
    }
    process.exit(0);
};

process.on('SIGINT', apagarBotSeguro);
process.on('SIGTERM', apagarBotSeguro);
process.on('SIGUSR2', apagarBotSeguro);

module.exports = { inicializarWhatsApp };