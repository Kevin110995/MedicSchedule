// Cargar variables de entorno (Debe ser la primera línea)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

const institucionRoutes = require('./routes/institucion.routes');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const sucursalesRoutes = require('./routes/sucursales.routes');
const administradoresRoutes = require('./routes/administradores.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const institucionesRoutes = require('./routes/instituciones.routes');
const perfilRoutes = require('./routes/perfil.routes');
const anunciosRoutes = require('./routes/anuncios.routes');
//const whatsappService = require('./services/whatsapp.service');
const adminMedicosRoutes = require('./routes/admin/medicos.routes');
const especialidadesRoutes = require('./routes/especialidades.routes');
const administrativoRoutes = require('./routes/admin/administrativo.routes');
const agendasRoutes = require('./routes/admin/agendas.routes');
const horariosRoutes = require('./routes/admin/horarios.routes');
const medicoDashboardRoutes = require('./routes/medico/dashboard.routes')
const medicoConsultaRoutes = require('./routes/medico/consulta.routes');
const medicoMedicoRoutes = require('./routes/medico/medico.routes');
const medicoPacientesRoutes = require('./routes/medico/pacientes.routes');
const medicoAgendaRoutes = require('./routes/medico/agenda.routes');
const recepcionRoutes = require('./routes/recepcion/recepcion.routes');

app.use('/api/institucion', institucionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/administradores', administradoresRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/instituciones', institucionesRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/admin/medicos', adminMedicosRoutes);
app.use('/api/especialidades', especialidadesRoutes);
// Rutas del Administrador
app.use('/api/admin/administrativo', administrativoRoutes);
app.use('/api/admin/agendas', agendasRoutes);
app.use('/api/admin/horarios', horariosRoutes);
// Rutas del Médico
app.use('/api/medico/dashboard', medicoDashboardRoutes);
app.use('/api/medico/consulta', medicoConsultaRoutes);
app.use('/api/medico/perfil', medicoMedicoRoutes);
app.use('/api/medico/pacientes', medicoPacientesRoutes);
app.use('/api/medico/agenda', medicoAgendaRoutes);
//Rutas del Administrador
app.use('/api/recepcion', recepcionRoutes);

//whatsappService.inicializarWhatsApp();

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`Prueba de BD en: http://localhost:${PORT}/api/test-db`);
});