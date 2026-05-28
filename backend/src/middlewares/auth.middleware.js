const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase'); // Asegúrate de importar tu conexión a BD

const verifyToken = async (req, res, next) => {
    try {
        // 1. Obtener el token del encabezado
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json({ error: 'Acceso denegado. No hay token.' });

        // 2. Desencriptar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 👇 LA MAGIA: Consultar a la base de datos el estatus en tiempo real 👇
        const { data: usuarioDB, error } = await supabase
            .from('usuarios')
            .select('estatus')
            .eq('id_usuario', decoded.id_usuario)
            .single();

        // Si hay error, no existe, o su estatus es false, le cortamos el acceso de tajo
        if (error || !usuarioDB || usuarioDB.estatus === false) {
            return res.status(401).json({ error: 'Sesión terminada. Tu cuenta ha sido suspendida.' });
        }

        // 3. Todo en orden, lo dejamos pasar
        req.user = decoded;
        next();

    } catch (error) {
        console.error("Error en verifyToken:", error);
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

module.exports = verifyToken;