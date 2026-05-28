const supabase = require('../../config/supabase');

// =======================================================
// 1. BUSCADOR EN TIEMPO REAL (SIN CURP)
// =======================================================
const buscarPacientes = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(200).json([]);

        console.log(`\n========================================`);
        console.log(`🔍 [BUSCAR] Buscando paciente: "${q}"`);

        // 👇 AQUÍ ESTABA EL ERROR. YA QUITÉ EL 'curp'
        const { data, error } = await supabase
            .from('pacientes')
            .select(`
                id_paciente,
                usuarios!inner ( nombre_completo, telefono )
            `)
            .ilike('usuarios.nombre_completo', `%${q}%`)
            .limit(10);

        if (error) {
            console.error(`⚠️ [BUSCAR ERROR SUPABASE]:`, error.message || error);
            return res.status(500).json({ error: error.message }); 
        }

        console.log(`✅ [BUSCAR] Resultados encontrados: ${data.length}`);
        console.log(`========================================\n`);

        res.status(200).json(data);
    } catch (error) {
        console.error('[❌ ERROR API BUSCAR]:', error);
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
};

// =======================================================
// 2. ALTA RÁPIDA (SIN CURP EN LA TABLA PACIENTES)
// =======================================================
const altaRapida = async (req, res) => {
    try {
        const { nombre_completo, telefono } = req.body; 
        
        console.log(`\n========================================`);
        console.log(`📝 [ALTA] Intentando registrar: ${nombre_completo}`);

        const { data: usuario, error: errUser } = await supabase
            .from('usuarios')
            .insert([{ 
                nombre_completo, 
                telefono, 
                estatus: true 
            }])
            .select('id_usuario')
            .single();

        if (errUser) {
            console.error(`⚠️ [ALTA ERROR USUARIO]:`, errUser.message || errUser);
            return res.status(500).json({ error: errUser.message });
        }

        console.log(`✅ [ALTA] Usuario creado con ID: ${usuario.id_usuario}`);

        // 👇 AQUÍ TAMBIÉN QUITÉ EL 'curp' PARA QUE NO EXPLOTE AL GUARDAR
        const { data: paciente, error: errPac } = await supabase
            .from('pacientes')
            .insert([{ 
                id_usuario: usuario.id_usuario
            }])
            .select(`
                id_paciente,
                usuarios ( nombre_completo )
            `)
            .single();

        if (errPac) {
            console.error(`⚠️ [ALTA ERROR PACIENTE]:`, errPac.message || errPac);
            return res.status(500).json({ error: errPac.message });
        }

        console.log(`✅ [ALTA] Paciente vinculado con éxito. ID: ${paciente.id_paciente}`);
        console.log(`========================================\n`);

        res.status(201).json(paciente);
    } catch (error) {
        console.error('[❌ ERROR API ALTA]:', error);
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
};

module.exports = { buscarPacientes, altaRapida };