-- =====================================================
-- SISTEMA DE GESTIÓN MÉDICA - PARA SUPABASE (PostgreSQL)
-- VERSIÓN COMPLETA CON ZONA HORARIA MÉXICO
-- =====================================================

-- Configurar zona horaria para la sesión (México)
SET TIMEZONE TO 'America/Mexico_City';

-- =====================================================
-- FUNCIÓN PARA OBTENER FECHA/HORA DE MÉXICO
-- =====================================================

-- Función para obtener timestamp actual en zona de México
CREATE OR REPLACE FUNCTION now_mexico()
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City');
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Función para obtener fecha actual en México
CREATE OR REPLACE FUNCTION today_mexico()
RETURNS DATE AS $$
BEGIN
    RETURN (CURRENT_DATE AT TIME ZONE 'America/Mexico_City')::DATE;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Eliminar tablas existentes (orden inverso por dependencias)
DROP VIEW IF EXISTS vista_agenda_diaria CASCADE;
DROP VIEW IF EXISTS vista_dashboard_sucursal CASCADE;
DROP VIEW IF EXISTS vista_dashboard_ejecutivo_general CASCADE;
DROP VIEW IF EXISTS vista_catalogo_imss_queretaro CASCADE;
DROP VIEW IF EXISTS vista_medicos_por_especialidad CASCADE;
DROP VIEW IF EXISTS vista_instituciones_completo CASCADE;
DROP VIEW IF EXISTS vista_reportes_nacionales CASCADE;
DROP VIEW IF EXISTS vista_sucursales_por_estado CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_kpis_diarios CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_estadisticas_mensuales CASCADE;

DROP TABLE IF EXISTS notificaciones CASCADE;
DROP TABLE IF EXISTS preferencias_notificacion CASCADE;
DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS lista_espera CASCADE;
DROP TABLE IF EXISTS recetas CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS citas CASCADE;
DROP TABLE IF EXISTS bloqueos_agenda CASCADE;
DROP TABLE IF EXISTS horarios_medico CASCADE;
DROP TABLE IF EXISTS horarios_sucursal CASCADE;
DROP TABLE IF EXISTS medicos CASCADE;
DROP TABLE IF EXISTS especialidades CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS anuncios CASCADE;
DROP TABLE IF EXISTS invitaciones_admin CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS sucursales CASCADE;
DROP TABLE IF EXISTS instituciones CASCADE;
DROP TABLE IF EXISTS configuracion_global CASCADE;
DROP TABLE IF EXISTS estados_mexico CASCADE;

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLAS DE CATÁLOGO
-- =====================================================

-- Catálogo de Estados de México
CREATE TABLE estados_mexico (
    id_estado SERIAL PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL UNIQUE,
    abreviatura VARCHAR(5) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico()
);

-- =====================================================
-- TABLAS PRINCIPALES
-- =====================================================

-- 1. Configuración Global
CREATE TABLE configuracion_global (
    id_config SERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    tipo_dato VARCHAR(50) DEFAULT 'texto',
    editable BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 2. Instituciones
CREATE TABLE instituciones (
    id_institucion SERIAL PRIMARY KEY,
    nombre_institucion VARCHAR(200) NOT NULL,
    nombre_corto VARCHAR(50),
    rfc_institucion VARCHAR(13) UNIQUE,
    tipo_institucion VARCHAR(50) NOT NULL CHECK (tipo_institucion IN (
        'IMSS', 'ISSSTE', 'SEDENA', 'SEMAR', 'PEMEX', 
        'Secretaria_Salud', 'IMSS_Bienestar', 'Privada', 'Otra'
    )),
    zona_horaria VARCHAR(50) DEFAULT 'America/Mexico_City',
    sector VARCHAR(30) CHECK (sector IN ('Publico', 'Privado', 'Social')),
    nivel_atencion VARCHAR(20) CHECK (nivel_atencion IN ('Primer', 'Segundo', 'Tercer', 'Mixto')),
    logo_url TEXT,
    direccion TEXT,
    coordenadas_lat DECIMAL(10, 8),
    coordenadas_lng DECIMAL(11, 8),
    id_estado INT REFERENCES estados_mexico(id_estado),
    contacto_nombre VARCHAR(200),
    contacto_email VARCHAR(100),
    contacto_telefono VARCHAR(20),
    activa BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 3. Sucursales
CREATE TABLE sucursales (
    id_sucursal SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
    nombre_sede VARCHAR(200) NOT NULL,
    nombre_corto VARCHAR(50),
    direccion TEXT NOT NULL,
    coordenadas_lat DECIMAL(10, 8),
    coordenadas_lng DECIMAL(11, 8),
    id_estado INT REFERENCES estados_mexico(id_estado),
    telefono_contacto VARCHAR(20),
    email_contacto VARCHAR(100),
    horario_apertura TIME,
    horario_cierre TIME,
    tipo_unidad VARCHAR(50),
    nivel_atencion VARCHAR(20) CHECK (nivel_atencion IN ('Primer', 'Segundo', 'Tercer')),
    clave_centro_trabajo VARCHAR(20),
    servicios_disponibles JSONB,
    duracion_consulta_minutos INT DEFAULT 30,
    radio_geocerca_metros INT DEFAULT 50,
    activa BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico(),
    CONSTRAINT unique_sucursal_por_institucion UNIQUE (id_institucion, nombre_sede)
);

-- 4. Especialidades Médicas
CREATE TABLE especialidades (
    id_especialidad SERIAL PRIMARY KEY,
    nombre_especialidad VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    icono_url TEXT,
    color_hex VARCHAR(7) DEFAULT '#10b981',
    activa BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 5. Usuarios
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_institucion INT REFERENCES instituciones(id_institucion) ON DELETE SET NULL,
    id_sucursal INT REFERENCES sucursales(id_sucursal) ON DELETE SET NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('Super_Admin', 'Administrador', 'Medico', 'Recepcionista', 'Paciente')),
    nombre_completo VARCHAR(200) NOT NULL,
    curp VARCHAR(20) UNIQUE,
    correo_electronico VARCHAR(100) UNIQUE NOT NULL,
    contrasena_hash VARCHAR(255),
    telefono VARCHAR(20) NOT NULL,
    telefono_verificado BOOLEAN DEFAULT false,
    whatsapp_numero VARCHAR(20),
    whatsapp_verificado BOOLEAN DEFAULT false,
    email_verificado BOOLEAN DEFAULT false,
    avatar_url TEXT,
    estatus BOOLEAN DEFAULT true,
    token_recuperacion VARCHAR(255),
    token_expiracion TIMESTAMP,
    ultimo_acceso TIMESTAMP,
    ip_ultimo_acceso VARCHAR(45),
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico(),
    CONSTRAINT check_superadmin_institucion CHECK (
        NOT (rol = 'Super_Admin' AND (id_institucion IS NOT NULL OR id_sucursal IS NOT NULL))
    )
);

-- 6. Invitaciones
CREATE TABLE invitaciones_admin (
    id_invitacion SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
    id_sucursal INT REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
    email_destino VARCHAR(100) NOT NULL,
    token UUID DEFAULT uuid_generate_v4(),
    expiracion TIMESTAMP DEFAULT (now_mexico() + INTERVAL '7 days'),
    utilizada BOOLEAN DEFAULT false,
    fecha_envio TIMESTAMP DEFAULT now_mexico(),
    fecha_aceptacion TIMESTAMP,
    creado_por INT REFERENCES usuarios(id_usuario)
);

-- 7. Pacientes
CREATE TABLE pacientes (
    id_paciente SERIAL PRIMARY KEY,
    id_usuario INT UNIQUE NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nss VARCHAR(11) UNIQUE,
    fecha_nacimiento DATE NOT NULL,
    sexo VARCHAR(10) CHECK (sexo IN ('Masculino', 'Femenino', 'Otro')),
    direccion_completa TEXT,
    coordenadas_lat DECIMAL(10, 8),
    coordenadas_lng DECIMAL(11, 8),
    id_estado INT REFERENCES estados_mexico(id_estado),
    contacto_emergencia_nombre VARCHAR(200),
    contacto_emergencia_telefono VARCHAR(20),
    token_push VARCHAR(255),
    dispositivo_info JSONB,
    alergias TEXT,
    grupo_sanguineo VARCHAR(5),
    tipo_sangre_factor VARCHAR(3),
    id_institucion_preferida INT REFERENCES instituciones(id_institucion),
    id_sucursal_preferida INT REFERENCES sucursales(id_sucursal),
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 8. Médicos
CREATE TABLE medicos (
    id_medico SERIAL PRIMARY KEY,
    id_usuario INT UNIQUE NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_especialidad INT NOT NULL REFERENCES especialidades(id_especialidad),
    cedula_profesional VARCHAR(50) UNIQUE NOT NULL,
    firma_digital_url TEXT,
    ranking_acumulado DECIMAL(3,2) DEFAULT 0,
    costo_consulta DECIMAL(10,2) NOT NULL,
    titulo VARCHAR(50),
    universidad VARCHAR(200),
    anios_experiencia INT,
    biografia TEXT,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 9. Horarios de Sucursal
CREATE TABLE horarios_sucursal (
    id_horario_sucursal SERIAL PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT true,
    UNIQUE(id_sucursal, dia_semana)
);

-- 10. Horarios de Médico
CREATE TABLE horarios_medico (
    id_horario_medico SERIAL PRIMARY KEY,
    id_medico INT NOT NULL REFERENCES medicos(id_medico) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico(),
    UNIQUE(id_medico, dia_semana, hora_inicio)
);

-- 11. Horarios de Recepcionista (NUEVA TABLA)
CREATE TABLE horarios_recepcionista (
    id_horario_recep SERIAL PRIMARY KEY,
    id_recepcionista INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT true,
    UNIQUE(id_recepcionista, dia_semana, hora_inicio)
);

-- 12. Bloqueos de Agenda
CREATE TABLE bloqueos_agenda (
    id_bloqueo SERIAL PRIMARY KEY,
    id_medico INT REFERENCES medicos(id_medico) ON DELETE CASCADE,
    id_sucursal INT REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    tipo VARCHAR(50) CHECK (tipo IN ('Vacaciones', 'Personal', 'Festivo', 'Capacitacion')),
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    CHECK (
        (id_medico IS NOT NULL AND id_sucursal IS NULL) OR
        (id_medico IS NULL AND id_sucursal IS NOT NULL)
    )
);

-- 13. Citas
CREATE TABLE citas (
    id_cita SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL REFERENCES instituciones(id_institucion),
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal),
    id_paciente INT NOT NULL REFERENCES pacientes(id_paciente),
    id_medico INT NOT NULL REFERENCES medicos(id_medico),
    fecha_hora TIMESTAMP NOT NULL,
    fecha_hora_fin TIMESTAMP NOT NULL,
    estado VARCHAR(30) NOT NULL CHECK (estado IN (
        'En proceso', 'Programada', 'Confirmada', 
        'En sala de espera', 'En curso', 'Completada', 
        'No asistio', 'Cancelada', 'Reprogramada'
    )),
    bloqueado_hasta TIMESTAMP,
    confirmada_at TIMESTAMP,
    es_reprogramada BOOLEAN DEFAULT false,
    motivo_cancelacion TEXT,
    reprogramada_desde INT REFERENCES citas(id_cita),
    notas_adicionales TEXT,
    triage_prioridad BOOLEAN DEFAULT false,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 14. Recetas
CREATE TABLE recetas (
    id_receta SERIAL PRIMARY KEY,
    id_cita INT UNIQUE NOT NULL REFERENCES citas(id_cita) ON DELETE CASCADE,
    folio_unico UUID DEFAULT uuid_generate_v4(),
    diagnostico TEXT NOT NULL,
    medicamentos_json JSONB NOT NULL,
    indicaciones_adicionales TEXT,
    vigencia_hasta TIMESTAMP NOT NULL,
    codigo_qr_token VARCHAR(255) UNIQUE,
    signos_vitales JSONB,
    notas_internas TEXT,
    fecha_emision TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico(),
    CONSTRAINT medicamentos_json_check CHECK (jsonb_typeof(medicamentos_json) = 'array')
);

-- 15. Lista de Espera
CREATE TABLE lista_espera (
    id_espera SERIAL PRIMARY KEY,
    id_paciente INT NOT NULL REFERENCES pacientes(id_paciente) ON DELETE CASCADE,
    id_medico INT NOT NULL REFERENCES medicos(id_medico) ON DELETE CASCADE,
    fecha_solicitud TIMESTAMP DEFAULT now_mexico(),
    fecha_expiracion TIMESTAMP DEFAULT (now_mexico() + INTERVAL '1 hour'),
    estado VARCHAR(20) CHECK (estado IN ('Pendiente', 'Notificado', 'Asignado', 'Expirado')) DEFAULT 'Pendiente',
    notificaciones_enviadas INT DEFAULT 0,
    fecha_asignacion TIMESTAMP,
    fecha_registro TIMESTAMP DEFAULT now_mexico()
);

-- 16. Anuncios
CREATE TABLE anuncios (
    id_anuncio SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
    id_sucursal INT REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    creado_por INT REFERENCES usuarios(id_usuario),
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico(),
    CONSTRAINT fecha_valida CHECK (fecha_fin >= fecha_inicio)
);

-- 17. Calificaciones (NUEVA TABLA)
CREATE TABLE calificaciones (
    id_calificacion SERIAL PRIMARY KEY,
    id_cita INT NOT NULL REFERENCES citas(id_cita) ON DELETE CASCADE,
    id_medico INT NOT NULL REFERENCES medicos(id_medico) ON DELETE CASCADE,
    puntuacion INT CHECK (puntuacion BETWEEN 1 AND 5),
    comentario TEXT,
    fecha_calificacion TIMESTAMP DEFAULT now_mexico(),
    UNIQUE(id_cita)
);

-- 18. Auditoría
CREATE TABLE auditoria (
    id_auditoria SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario),
    id_institucion INT REFERENCES instituciones(id_institucion),
    id_sucursal INT REFERENCES sucursales(id_sucursal),
    accion VARCHAR(100) NOT NULL,
    entidad_afectada VARCHAR(50),
    id_entidad_afectada INT,
    detalle JSONB,
    ip_origen VARCHAR(45),
    user_agent TEXT,
    fecha_hora TIMESTAMP DEFAULT now_mexico()
);

-- 19. Notificaciones
CREATE TABLE notificaciones (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_cita INT REFERENCES citas(id_cita) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT false,
    leida_en TIMESTAMP,
    whatsapp_enviado BOOLEAN DEFAULT false,
    whatsapp_entregado BOOLEAN DEFAULT false,
    whatsapp_leido BOOLEAN DEFAULT false,
    whatsapp_error TEXT,
    sms_enviado BOOLEAN DEFAULT false,
    programada_para TIMESTAMP NOT NULL,
    enviada_en TIMESTAMP,
    datos JSONB,
    fecha_creacion TIMESTAMP DEFAULT now_mexico(),
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- 20. Preferencias de Notificación
CREATE TABLE preferencias_notificacion (
    id_preferencia SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    whatsapp_habilitado BOOLEAN DEFAULT false,
    sms_habilitado BOOLEAN DEFAULT true,
    app_habilitado BOOLEAN DEFAULT true,
    whatsapp_numero VARCHAR(20),
    sms_numero VARCHAR(20),
    no_molestar_inicio TIME,
    no_molestar_fin TIME,
    preferencias JSONB,
    fecha_actualizacion TIMESTAMP DEFAULT now_mexico()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

-- Estados
CREATE INDEX idx_estados_activos ON estados_mexico(activo);

-- Instituciones
CREATE INDEX idx_instituciones_activas ON instituciones(activa);
CREATE INDEX idx_instituciones_tipo ON instituciones(tipo_institucion);
CREATE INDEX idx_instituciones_estado ON instituciones(id_estado);

-- Sucursales
CREATE INDEX idx_sucursales_institucion ON sucursales(id_institucion);
CREATE INDEX idx_sucursales_activas ON sucursales(activa);
CREATE INDEX idx_sucursales_tipo ON sucursales(tipo_unidad);
CREATE INDEX idx_sucursales_clues ON sucursales(clave_centro_trabajo);
CREATE INDEX idx_sucursales_estado ON sucursales(id_estado);
CREATE INDEX idx_sucursales_ubicacion ON sucursales (id_institucion, id_estado, coordenadas_lat, coordenadas_lng);

-- Especialidades
CREATE INDEX idx_especialidades_activas ON especialidades(activa);
CREATE INDEX idx_especialidades_nombre ON especialidades(nombre_especialidad);

-- Usuarios
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_institucion ON usuarios(id_institucion);
CREATE INDEX idx_usuarios_sucursal ON usuarios(id_sucursal);
CREATE INDEX idx_usuarios_curp ON usuarios(curp);
CREATE INDEX idx_usuarios_email ON usuarios(correo_electronico);
CREATE INDEX idx_usuarios_estatus ON usuarios(estatus);

-- Médicos
CREATE INDEX idx_medicos_especialidad ON medicos(id_especialidad);
CREATE INDEX idx_medicos_ranking ON medicos(ranking_acumulado);

-- Horarios Recepcionista
CREATE INDEX idx_horarios_recepcionista ON horarios_recepcionista(id_recepcionista, activo);

-- Citas
CREATE INDEX idx_citas_fecha_hora ON citas(fecha_hora);
CREATE INDEX idx_citas_institucion_fecha ON citas(id_institucion, fecha_hora);
CREATE INDEX idx_citas_sucursal_fecha ON citas(id_sucursal, fecha_hora);
CREATE INDEX idx_citas_medico_fecha ON citas(id_medico, fecha_hora);
CREATE INDEX idx_citas_paciente_fecha ON citas(id_paciente, fecha_hora);
CREATE INDEX idx_citas_estado ON citas(estado);

-- Recetas
CREATE INDEX idx_recetas_folio ON recetas(folio_unico);
CREATE INDEX idx_recetas_vigencia ON recetas(vigencia_hasta);
CREATE INDEX idx_recetas_qr ON recetas(codigo_qr_token);
CREATE INDEX idx_recetas_medicamentos ON recetas USING gin(medicamentos_json);

-- Calificaciones
CREATE INDEX idx_calificaciones_medico ON calificaciones(id_medico);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = now_mexico();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Función: Validar límite de citas futuras
CREATE OR REPLACE FUNCTION validar_limite_citas_paciente()
RETURNS TRIGGER AS $$
DECLARE
    citas_futuras INT;
BEGIN
    SELECT COUNT(*) INTO citas_futuras
    FROM citas
    WHERE id_paciente = NEW.id_paciente
    AND fecha_hora > now_mexico()
    AND estado IN ('Programada', 'Confirmada', 'En sala de espera');
    
    IF citas_futuras >= 2 THEN
        RAISE EXCEPTION 'El paciente ya tiene 2 citas futuras programadas';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Función: Bloqueo de concurrencia
CREATE OR REPLACE FUNCTION aplicar_bloqueo_cita()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'En proceso' THEN
        NEW.bloqueado_hasta = now_mexico() + INTERVAL '5 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Función: Actualizar ranking de médico
CREATE OR REPLACE FUNCTION actualizar_ranking_medico()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE medicos 
    SET ranking_acumulado = (
        SELECT AVG(puntuacion)::DECIMAL(3,2)
        FROM calificaciones
        WHERE id_medico = NEW.id_medico
    )
    WHERE id_medico = NEW.id_medico;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Triggers
CREATE TRIGGER trigger_actualizar_usuarios BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_actualizar_pacientes BEFORE UPDATE ON pacientes FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_actualizar_medicos BEFORE UPDATE ON medicos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_actualizar_especialidades BEFORE UPDATE ON especialidades FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_actualizar_citas BEFORE UPDATE ON citas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_actualizar_instituciones BEFORE UPDATE ON instituciones FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_actualizar_sucursales BEFORE UPDATE ON sucursales FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_validar_limite_citas BEFORE INSERT ON citas FOR EACH ROW WHEN (NEW.estado IN ('Programada', 'Confirmada')) EXECUTE FUNCTION validar_limite_citas_paciente();
CREATE TRIGGER trigger_bloqueo_cita BEFORE INSERT ON citas FOR EACH ROW EXECUTE FUNCTION aplicar_bloqueo_cita();
CREATE TRIGGER trigger_actualizar_ranking AFTER INSERT OR UPDATE ON calificaciones FOR EACH ROW EXECUTE FUNCTION actualizar_ranking_medico();

-- =====================================================
-- FUNCIONES PARA PROCESOS AUTOMÁTICOS
-- =====================================================

-- Función: Cancelar citas no confirmadas
CREATE OR REPLACE FUNCTION cancelar_citas_no_confirmadas()
RETURNS INTEGER AS $$
DECLARE
    citas_canceladas INTEGER;
BEGIN
    UPDATE citas 
    SET estado = 'Cancelada',
        motivo_cancelacion = 'No confirmada dentro del plazo'
    WHERE estado = 'Programada'
    AND confirmada_at IS NULL
    AND fecha_hora > now_mexico()
    AND fecha_hora < (now_mexico() + INTERVAL '12 hours')
    RETURNING COUNT(*) INTO citas_canceladas;
    
    RETURN citas_canceladas;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Función: Marcar inasistencias
CREATE OR REPLACE FUNCTION marcar_inasistencias()
RETURNS INTEGER AS $$
DECLARE
    inasistencias INTEGER;
BEGIN
    UPDATE citas 
    SET estado = 'No asistio'
    WHERE estado IN ('Programada', 'Confirmada')
    AND fecha_hora < (now_mexico() - INTERVAL '5 minutes')
    RETURNING COUNT(*) INTO inasistencias;
    
    RETURN inasistencias;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Función: Liberar bloqueos expirados
CREATE OR REPLACE FUNCTION liberar_bloqueos_citas()
RETURNS INTEGER AS $$
DECLARE
    bloqueos_liberados INTEGER;
BEGIN
    UPDATE citas 
    SET estado = 'Cancelada',
        motivo_cancelacion = 'Bloqueo expirado'
    WHERE estado = 'En proceso'
    AND bloqueado_hasta < now_mexico()
    RETURNING COUNT(*) INTO bloqueos_liberados;
    
    RETURN bloqueos_liberados;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- =====================================================
-- VISTAS MATERIALIZADAS
-- =====================================================

-- Vista materializada para KPIs diarios
CREATE MATERIALIZED VIEW mv_kpis_diarios AS
SELECT 
    today_mexico() as fecha_reporte,
    COUNT(DISTINCT i.id_institucion) as instituciones_activas,
    COUNT(DISTINCT s.id_sucursal) as sucursales_activas,
    COUNT(DISTINCT m.id_medico) as medicos_activos,
    COUNT(DISTINCT e.id_especialidad) as especialidades_activas,
    COUNT(DISTINCT p.id_paciente) as pacientes_activos,
    COUNT(DISTINCT c.id_cita) as total_citas,
    COUNT(DISTINCT CASE WHEN c.estado = 'Completada' THEN c.id_cita END) as citas_completadas,
    COUNT(DISTINCT CASE WHEN c.estado = 'Cancelada' THEN c.id_cita END) as citas_canceladas,
    COUNT(DISTINCT CASE WHEN c.estado = 'No asistio' THEN c.id_cita END) as inasistencias
FROM instituciones i
LEFT JOIN sucursales s ON s.id_institucion = i.id_institucion AND s.activa = true
LEFT JOIN usuarios u_med ON u_med.id_sucursal = s.id_sucursal AND u_med.rol = 'Medico' AND u_med.estatus = true
LEFT JOIN medicos m ON m.id_usuario = u_med.id_usuario
LEFT JOIN especialidades e ON m.id_especialidad = e.id_especialidad
LEFT JOIN usuarios u_pac ON u_pac.id_sucursal = s.id_sucursal AND u_pac.rol = 'Paciente' AND u_pac.estatus = true
LEFT JOIN pacientes p ON p.id_usuario = u_pac.id_usuario
LEFT JOIN citas c ON c.id_sucursal = s.id_sucursal AND DATE(c.fecha_hora) = today_mexico()
WHERE i.activa = true;

CREATE UNIQUE INDEX idx_mv_kpis_diarios ON mv_kpis_diarios(fecha_reporte);

-- Vista materializada para estadísticas mensuales
CREATE MATERIALIZED VIEW mv_estadisticas_mensuales AS
SELECT 
    DATE_TRUNC('month', c.fecha_hora) as mes,
    i.id_institucion,
    i.nombre_institucion,
    COUNT(c.id_cita) as total_citas,
    COUNT(DISTINCT c.id_paciente) as pacientes_unicos,
    AVG(EXTRACT(EPOCH FROM (c.fecha_hora_fin - c.fecha_hora))/60)::INT as duracion_promedio_minutos,
    COUNT(CASE WHEN c.estado = 'Completada' THEN 1 END) as citas_completadas,
    COUNT(CASE WHEN c.estado = 'No asistio' THEN 1 END) as inasistencias,
    COUNT(CASE WHEN c.es_reprogramada THEN 1 END) as reprogramaciones
FROM citas c
JOIN instituciones i ON c.id_institucion = i.id_institucion
GROUP BY mes, i.id_institucion, i.nombre_institucion;

CREATE INDEX idx_mv_estadisticas_mensuales ON mv_estadisticas_mensuales(mes, id_institucion);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Instituciones completo
CREATE VIEW vista_instituciones_completo AS
SELECT 
    i.id_institucion,
    i.nombre_institucion,
    i.nombre_corto,
    i.tipo_institucion,
    i.sector,
    i.nivel_atencion,
    i.direccion,
    e.nombre_estado,
    e.abreviatura as estado_abreviatura,
    i.coordenadas_lat,
    i.coordenadas_lng,
    COUNT(DISTINCT s.id_sucursal) as total_sucursales,
    i.activa
FROM instituciones i
LEFT JOIN estados_mexico e ON i.id_estado = e.id_estado
LEFT JOIN sucursales s ON s.id_institucion = i.id_institucion
WHERE i.activa = true
GROUP BY i.id_institucion, i.nombre_institucion, i.nombre_corto, i.tipo_institucion, 
         i.sector, i.nivel_atencion, i.direccion, e.nombre_estado, e.abreviatura, 
         i.coordenadas_lat, i.coordenadas_lng, i.activa;

-- Vista: Sucursales por estado (para app mobile)
CREATE VIEW vista_sucursales_por_estado AS
SELECT 
    e.nombre_estado,
    e.abreviatura,
    i.nombre_institucion,
    i.tipo_institucion,
    s.id_sucursal,
    s.nombre_sede,
    s.nombre_corto,
    s.direccion,
    s.telefono_contacto,
    s.horario_apertura,
    s.horario_cierre,
    s.tipo_unidad,
    s.nivel_atencion,
    s.clave_centro_trabajo,
    s.servicios_disponibles,
    s.coordenadas_lat,
    s.coordenadas_lng,
    s.activa,
    CASE 
        WHEN s.tipo_unidad IN ('HGZ', 'HGR') THEN 'Hospital General'
        WHEN s.tipo_unidad = 'UMF' THEN 'Unidad de Medicina Familiar'
        WHEN s.tipo_unidad = 'Especialidades' THEN 'Centro de Especialidades'
        ELSE 'Otra'
    END as descripcion_tipo
FROM sucursales s
JOIN instituciones i ON s.id_institucion = i.id_institucion
JOIN estados_mexico e ON s.id_estado = e.id_estado
WHERE s.activa = true AND i.activa = true
ORDER BY e.nombre_estado, i.nombre_institucion, s.nombre_sede;

-- Vista: Agenda del día
CREATE VIEW vista_agenda_diaria AS
SELECT 
    c.id_cita,
    m.id_medico,
    u_medico.nombre_completo as nombre_medico,
    e.nombre_especialidad as especialidad,
    p.id_paciente,
    u_paciente.nombre_completo as nombre_paciente,
    c.fecha_hora,
    c.fecha_hora_fin,
    c.estado,
    c.triage_prioridad,
    s.nombre_sede,
    i.nombre_institucion
FROM citas c
JOIN medicos m ON c.id_medico = m.id_medico
JOIN especialidades e ON m.id_especialidad = e.id_especialidad
JOIN usuarios u_medico ON m.id_usuario = u_medico.id_usuario
JOIN pacientes p ON c.id_paciente = p.id_paciente
JOIN usuarios u_paciente ON p.id_usuario = u_paciente.id_usuario
JOIN sucursales s ON c.id_sucursal = s.id_sucursal
JOIN instituciones i ON c.id_institucion = i.id_institucion
WHERE DATE(c.fecha_hora) = today_mexico()
ORDER BY c.fecha_hora;

-- Vista: Catálogo IMSS Querétaro
CREATE VIEW vista_catalogo_imss_queretaro AS
SELECT 
    s.tipo_unidad,
    s.nombre_sede,
    s.nombre_corto,
    s.direccion,
    s.telefono_contacto,
    s.horario_apertura,
    s.horario_cierre,
    s.nivel_atencion,
    s.clave_centro_trabajo,
    s.servicios_disponibles,
    CASE 
        WHEN s.tipo_unidad IN ('HGZ', 'HGR') THEN 'Hospital General'
        WHEN s.tipo_unidad = 'UMF' THEN 'Unidad de Medicina Familiar'
        WHEN s.tipo_unidad = 'Especialidades' THEN 'Centro de Especialidades'
    END as descripcion_tipo,
    s.activa
FROM sucursales s
JOIN instituciones i ON s.id_institucion = i.id_institucion
JOIN estados_mexico e ON s.id_estado = e.id_estado
WHERE i.nombre_institucion = 'IMSS Delegación Querétaro'
AND e.nombre_estado = 'Querétaro'
ORDER BY s.tipo_unidad, s.nombre_sede;

-- Vista: Médicos por especialidad
CREATE VIEW vista_medicos_por_especialidad AS
SELECT 
    e.nombre_especialidad,
    e.color_hex,
    COUNT(m.id_medico) as total_medicos,
    AVG(m.ranking_acumulado)::DECIMAL(3,2) as ranking_promedio
FROM especialidades e
LEFT JOIN medicos m ON m.id_especialidad = e.id_especialidad
LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario AND u.estatus = true
WHERE e.activa = true
GROUP BY e.nombre_especialidad, e.color_hex
ORDER BY e.nombre_especialidad;

-- Vista: Reportes nacionales por estado
CREATE VIEW vista_reportes_nacionales AS
SELECT 
    e.nombre_estado,
    e.abreviatura,
    COUNT(DISTINCT i.id_institucion) as num_instituciones,
    COUNT(DISTINCT s.id_sucursal) as num_sucursales,
    COUNT(DISTINCT CASE WHEN s.nivel_atencion = 'Primer' THEN s.id_sucursal END) as primer_nivel,
    COUNT(DISTINCT CASE WHEN s.nivel_atencion = 'Segundo' THEN s.id_sucursal END) as segundo_nivel,
    COUNT(DISTINCT CASE WHEN s.nivel_atencion = 'Tercer' THEN s.id_sucursal END) as tercer_nivel,
    COUNT(DISTINCT m.id_medico) as medicos_totales
FROM estados_mexico e
LEFT JOIN sucursales s ON s.id_estado = e.id_estado AND s.activa = true
LEFT JOIN instituciones i ON s.id_institucion = i.id_institucion AND i.activa = true
LEFT JOIN usuarios u_med ON u_med.id_sucursal = s.id_sucursal AND u_med.rol = 'Medico'
LEFT JOIN medicos m ON m.id_usuario = u_med.id_usuario
WHERE e.activo = true
GROUP BY e.nombre_estado, e.abreviatura
ORDER BY e.nombre_estado;

-- Vista: Administradores por sucursal
CREATE VIEW vista_administradores_sucursal AS
SELECT 
    s.id_sucursal,
    s.nombre_sede as sucursal,
    u.id_usuario,
    u.nombre_completo as administrador,
    u.correo_electronico as email,
    u.estatus,
    u.ultimo_acceso,
    CASE 
        WHEN u.id_usuario IS NULL THEN 'Pendiente'
        WHEN u.estatus = false THEN 'Inactivo'
        ELSE 'Activo'
    END as estado_cuenta,
    i.fecha_envio,
    i.expiracion
FROM sucursales s
LEFT JOIN usuarios u ON u.id_sucursal = s.id_sucursal AND u.rol = 'Administrador'
LEFT JOIN invitaciones_admin i ON i.id_sucursal = s.id_sucursal AND i.utilizada = false
WHERE s.activa = true
ORDER BY s.nombre_sede;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar Estados de México
INSERT INTO estados_mexico (nombre_estado, abreviatura) VALUES
('Aguascalientes', 'AGS'),
('Baja California', 'BC'),
('Baja California Sur', 'BCS'),
('Campeche', 'CAMP'),
('Chiapas', 'CHIS'),
('Chihuahua', 'CHIH'),
('Ciudad de México', 'CDMX'),
('Coahuila', 'COAH'),
('Colima', 'COL'),
('Durango', 'DGO'),
('Guanajuato', 'GTO'),
('Guerrero', 'GRO'),
('Hidalgo', 'HGO'),
('Jalisco', 'JAL'),
('México', 'MEX'),
('Michoacán', 'MICH'),
('Morelos', 'MOR'),
('Nayarit', 'NAY'),
('Nuevo León', 'NL'),
('Oaxaca', 'OAX'),
('Puebla', 'PUE'),
('Querétaro', 'QRO'),
('Quintana Roo', 'QROO'),
('San Luis Potosí', 'SLP'),
('Sinaloa', 'SIN'),
('Sonora', 'SON'),
('Tabasco', 'TAB'),
('Tamaulipas', 'TAMPS'),
('Tlaxcala', 'TLAX'),
('Veracruz', 'VER'),
('Yucatán', 'YUC'),
('Zacatecas', 'ZAC')
ON CONFLICT (nombre_estado) DO NOTHING;

-- Configuración Global
INSERT INTO configuracion_global (clave, valor, descripcion, tipo_dato) VALUES
('tiempo_bloqueo_minutos', '5', 'Tiempo de bloqueo para reserva de citas', 'numero'),
('limite_citas_futuras', '2', 'Máximo de citas futuras por paciente', 'numero'),
('radio_geocerca_defecto', '50', 'Radio en metros para check-in por GPS', 'numero'),
('tiempo_confirmacion_horas', '12', 'Horas antes para confirmación obligatoria', 'numero'),
('tolerancia_retraso_minutos', '5', 'Minutos de tolerancia antes de marcar no-show', 'numero'),
('empresa_nombre', 'Sistema de Gestión Médica', 'Nombre de la empresa', 'texto'),
('zona_horaria_sistema', 'America/Mexico_City', 'Zona horaria del sistema', 'texto'),
('colores_ui_principal', '#10b981', 'Color principal Emerald para UI', 'texto'),
('colores_ui_secundario', '#64748b', 'Color secundario Slate para UI', 'texto');

-- Especialidades Médicas
INSERT INTO especialidades (nombre_especialidad, descripcion, color_hex) VALUES
('Medicina Familiar', 'Atención primaria y preventiva para toda la familia', '#10b981'),
('Pediatría', 'Atención médica para niños y adolescentes', '#3b82f6'),
('Ginecología', 'Salud reproductiva y atención a la mujer', '#ec4899'),
('Cardiología', 'Diagnóstico y tratamiento de enfermedades del corazón', '#ef4444'),
('Urgencias', 'Atención médica de emergencia', '#f97316'),
('Medicina Interna', 'Atención integral de adultos', '#8b5cf6'),
('Traumatología', 'Lesiones del sistema musculoesquelético', '#6366f1'),
('Nutrición', 'Asesoría nutricional y planes de alimentación', '#14b8a6')
ON CONFLICT (nombre_especialidad) DO NOTHING;

-- =====================================================
-- FUNCIÓN PARA REFRESCAR VISTAS MATERIALIZADAS
-- =====================================================

CREATE OR REPLACE FUNCTION refrescar_vistas_materializadas()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_diarios;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_estadisticas_mensuales;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- =====================================================
-- CONSULTAS DE VERIFICACIÓN
-- =====================================================

-- Verificar zona horaria
SELECT 
    current_setting('TIMEZONE') as zona_horaria_bd,
    now() as hora_utc,
    now_mexico() as hora_mexico,
    today_mexico() as fecha_mexico;

-- Ver estados de México
SELECT * FROM estados_mexico ORDER BY nombre_estado;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
