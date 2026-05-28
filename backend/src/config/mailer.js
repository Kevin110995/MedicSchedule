const nodemailer = require('nodemailer');

// Configurar el transportador SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true para el puerto 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Función específica para enviar el correo de verificación (Fase 0.4)
const enviarCorreoVerificacion = async (correoDestino, token) => {
    const linkVerificacion = `http://${process.env.DEEP_LINK_HOST || 'localhost:3000'}/api/instituciones/verificar/${token}`;
    
    const mailOptions = {
        from: `"MedicSchedule" <${process.env.SMTP_USER}>`,
        to: correoDestino,
        subject: 'Verifica tu cuenta - Sistema de Gestión Médica',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981;">¡Bienvenido a MedicSchedule!</h2>
                <p>Gracias por registrar tu institución con nosotros. Para activar tu cuenta de Super Administrador, por favor verifica tu correo electrónico haciendo clic en el siguiente botón:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkVerificacion}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verificar mi cuenta</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="color: #64748b; font-size: 14px; word-break: break-all;">${linkVerificacion}</p>
            </div>
        `
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);
};

module.exports = {
    enviarCorreoVerificacion
};