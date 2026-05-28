const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false 
  }
});

// Esta función original la dejamos intacta por si la usas para otras cosas (ej. registrar la institución)
const sendVerificationEmail = async (emailDestino, token) => {
  // ... tu código original
};

// 👇 ESTA ES LA FUNCIÓN NUEVA Y MULTIUSOS
const sendInvitacionCredenciales = async (emailDestino, nombre, passwordTemporal, rol) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173/login';
    // Ajustamos el texto dependiendo de si es Admin o Médico
    const mensajeRol = rol === 'Administrador' 
      ? 'Has sido asignado como Administrador de sucursal en nuestra plataforma.' 
      : 'Has sido dado de alta como Médico en nuestra plataforma.';

    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to: emailDestino,
      subject: 'Tus credenciales de acceso - Sistema de Gestión Médica',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2>¡Bienvenido al equipo, ${nombre}!</h2>
            <p>${mensajeRol}</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0;">
                <p style="margin-top: 0;"><strong>Tus credenciales de acceso temporal:</strong></p>
                <p style="margin: 5px 0;"><strong>Usuario:</strong> ${emailDestino}</p>
                <p style="margin: 5px 0;"><strong>Contraseña:</strong> <span style="font-family: monospace; font-size: 16px; color: #10b981; font-weight: bold;">${passwordTemporal}</span></p>
            </div>

            <p style="color: #ef4444; font-weight: bold;">⚠️ IMPORTANTE: Activación de Cuenta</p>
            <p>Tu cuenta se verificará automáticamente la primera vez que inicies sesión utilizando el botón de abajo. <strong>Debes usar estas credenciales temporales para ingresar.</strong></p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${frontendUrl}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Iniciar Sesión y Activar Cuenta
                </a>
            </div>

            <p style="font-size: 12px; color: #64748b;">Por tu seguridad, te recomendamos cambiar esta contraseña temporal dentro de tu perfil una vez que ingreses al sistema.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ Invitación enviada a ${emailDestino} (${rol})`);
  } catch (error) {
    console.error('Error al enviar el correo de invitación:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendInvitacionCredenciales
};