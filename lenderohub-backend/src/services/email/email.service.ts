import nodemailer from 'nodemailer';

// ============================================
// Email Service
// ============================================

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface MoneyOutNotificationParams {
  to: string;
  role: 'ordenante' | 'beneficiario';
  trackingId: string;
  amount: string;
  description: string;
}

interface MoneyInNotificationParams {
  to: string;
  role: 'ordenante' | 'beneficiario';
  trackingKey: string;
  amount: string;
  payerName: string;
  beneficiaryAccount: string;
}

interface CommissionRequestCreatedParams {
  to: string;
  agentName: string;
  amount: number;
  folio: string;
}

interface CommissionRequestApprovedParams {
  to: string;
  agentName: string;
  amount: number;
  amountTransfer: number;
  folio: string;
}

interface CommissionRequestRejectedParams {
  to: string;
  agentName: string;
  amount: number;
  folio: string;
  rejectionMessage: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Configuración del transportador
    // En producción usar SMTP real (SendGrid, AWS SES, etc.)
    // En desarrollo/staging usar ethereal o mailtrap
    
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      console.log('📧 Email service configurado con SMTP');
    } else {
      console.log('⚠️ Email service en modo simulación (SMTP no configurado)');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const from = process.env.SMTP_FROM || 'LenderoHUB <noreply@lenderocapital.com>';

    if (!this.transporter) {
      // Modo simulación - solo logear
      console.log('📧 [SIMULACIÓN] Email enviado:');
      console.log(`   To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Content: ${options.text || options.html.substring(0, 100)}...`);
      return true;
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`📧 Email enviado a ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      Lendero<span style="font-weight: 400;">HUB</span>
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: #18181b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">
                      Restablecer Contraseña
                    </h2>
                    
                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                      Hola <strong>${userName}</strong>,
                    </p>
                    
                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      Recibimos una solicitud para restablecer la contraseña de tu cuenta. 
                      Si no realizaste esta solicitud, puedes ignorar este correo.
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${resetUrl}" 
                             style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                            Restablecer Contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 30px 0 0;">
                      Este enlace expirará en <strong>1 hora</strong> por seguridad.
                    </p>
                    
                    <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="color: #2563eb; font-size: 12px; word-break: break-all; margin: 10px 0 0;">
                      ${resetUrl}
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f4f4f5; padding: 30px 40px; text-align: center;">
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 10px;">
                      © ${new Date().getFullYear()} Lendero Capital. Todos los derechos reservados.
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
                      Este correo fue enviado automáticamente. Por favor no responder.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Hola ${userName},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en LenderoHUB.

Para restablecer tu contraseña, visita el siguiente enlace:
${resetUrl}

Este enlace expirará en 1 hora por seguridad.

Si no solicitaste este cambio, puedes ignorar este correo.

© ${new Date().getFullYear()} Lendero Capital
    `;

    return this.sendEmail({
      to: email,
      subject: 'Restablecer Contraseña - LenderoHUB',
      html,
      text,
    });
  }

  /**
   * Envía correo para establecer contraseña de usuario nuevo
   */
  async sendPasswordSetupEmail(email: string, setupToken: string, userName: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const setupUrl = `${frontendUrl}/setup-password?token=${setupToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configura tu Contraseña</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      Lendero<span style="font-weight: 400;">HUB</span>
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: #18181b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">
                      Bienvenido a LenderoHUB
                    </h2>
                    
                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                      Hola <strong>${userName}</strong>,
                    </p>
                    
                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">
                      Se ha creado tu cuenta en LenderoHUB. Para ingresar a la plataforma, 
                      accede al enlace presentado a continuación y establece tu contraseña:
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                      <tr>
                        <td style="background-color: #f8fafc; border-radius: 8px; padding: 20px;">
                          <p style="color: #64748b; font-size: 14px; margin: 0 0 8px;">Usuario</p>
                          <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0;">${email}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 10px 0 30px;">
                          <a href="${setupUrl}" 
                             style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                            Da click aquí para establecer tu contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 10px;">
                      <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0;">
                        <strong>⏰ El enlace expira en 24 horas.</strong> Solo podrás usarlo una vez.
                      </p>
                    </div>
                    
                    <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 30px 0 0;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="color: #2563eb; font-size: 12px; word-break: break-all; margin: 10px 0 0;">
                      ${setupUrl}
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f4f4f5; padding: 30px 40px; text-align: center;">
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 10px;">
                      © ${new Date().getFullYear()} Lendero Capital. Todos los derechos reservados.
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
                      Este es un correo automatizado. No respondas directamente a este mensaje.<br>
                      Si tienes problemas para ingresar, contacta a soporte.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Bienvenido a LenderoHUB

Hola ${userName},

Se ha creado tu cuenta en LenderoHUB. Para ingresar a la plataforma, accede al enlace presentado a continuación y establece tu contraseña:

Usuario: ${email}

Contraseña: Da click aquí
${setupUrl}

El enlace expira en 24 horas. Solo podrás usarlo una vez.

Este es un correo automatizado. No respondas directamente a este mensaje. Si tienes problemas para ingresar contacta a soporte.

© ${new Date().getFullYear()} Lendero Capital
    `;

    return this.sendEmail({
      to: email,
      subject: 'Configura tu contraseña - LenderoHUB',
      html,
      text,
    });
  }

  async sendMoneyOutNotification(params: MoneyOutNotificationParams): Promise<boolean> {
    const subject = `Notificacion de transferencia SPEI - ${params.trackingId}`;
    const title = params.role === 'ordenante' ? 'Transferencia enviada' : 'Transferencia recibida';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
        <h2 style="margin: 0 0 16px;">${title}</h2>
        <p>Se registro una transferencia SPEI con la siguiente informacion:</p>
        <ul>
          <li><strong>Tracking:</strong> ${params.trackingId}</li>
          <li><strong>Monto:</strong> ${params.amount}</li>
          <li><strong>Descripcion:</strong> ${params.description}</li>
        </ul>
        <p style="font-size: 12px; color: #71717a;">Mensaje enviado automaticamente por LenderoHUB.</p>
      </div>
    `;
    const text = `Transferencia SPEI (${params.trackingId}) - ${params.amount}. Descripcion: ${params.description}.`;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  async sendMoneyInNotification(params: MoneyInNotificationParams): Promise<boolean> {
    const subject = `Notificacion de deposito SPEI - ${params.trackingKey}`;
    const title = params.role === 'ordenante' ? 'Transferencia enviada' : 'Deposito recibido';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
        <h2 style="margin: 0 0 16px;">${title}</h2>
        <p>Se registro una transferencia SPEI entrante con la siguiente informacion:</p>
        <ul>
          <li><strong>Tracking:</strong> ${params.trackingKey}</li>
          <li><strong>Monto:</strong> ${params.amount}</li>
          <li><strong>Ordenante:</strong> ${params.payerName}</li>
          <li><strong>Cuenta beneficiaria:</strong> ${params.beneficiaryAccount}</li>
        </ul>
        <p style="font-size: 12px; color: #71717a;">Mensaje enviado automaticamente por LenderoHUB.</p>
      </div>
    `;
    const text = `Deposito SPEI (${params.trackingKey}) - ${params.amount}. Ordenante: ${params.payerName}. Cuenta: ${params.beneficiaryAccount}.`;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  async sendCommissionRequestCreated(params: CommissionRequestCreatedParams): Promise<boolean> {
    const subject = `Nueva solicitud de comisiones - ${params.folio}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nueva Solicitud de Comisiones</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      Lendero<span style="font-weight: 400;">HUB</span>
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: #18181b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">
                      Nueva Solicitud de Comisiones
                    </h2>

                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      Se ha recibido una nueva solicitud de comisiones que requiere revisión y aprobación.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px;">
                      <tr>
                        <td style="background-color: #f8fafc; border-radius: 8px; padding: 20px;">
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Folio:</td>
                              <td style="color: #18181b; font-size: 16px; font-weight: 600; padding: 8px 0; text-align: right;">${params.folio}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Comisionista:</td>
                              <td style="color: #18181b; font-size: 16px; font-weight: 600; padding: 8px 0; text-align: right;">${params.agentName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Monto solicitado:</td>
                              <td style="color: #059669; font-size: 20px; font-weight: 700; padding: 8px 0; text-align: right;">$${params.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/commissions"
                             style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                            Revisar Solicitud
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f4f4f5; padding: 30px 40px; text-align: center;">
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 10px;">
                      © ${new Date().getFullYear()} Lendero Capital. Todos los derechos reservados.
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
                      Este correo fue enviado automáticamente. Por favor no responder.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Nueva solicitud de comisiones en LenderoHUB

Folio: ${params.folio}
Comisionista: ${params.agentName}
Monto solicitado: $${params.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Ingresa a LenderoHUB para revisar y aprobar/rechazar la solicitud.

© ${new Date().getFullYear()} Lendero Capital
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  async sendCommissionRequestApproved(params: CommissionRequestApprovedParams): Promise<boolean> {
    const subject = `Solicitud de comisiones aprobada - ${params.folio}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solicitud Aprobada</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      Lendero<span style="font-weight: 400;">HUB</span>
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <div style="display: inline-block; background-color: #dcfce7; border-radius: 50%; width: 64px; height: 64px; line-height: 64px;">
                        <span style="color: #059669; font-size: 32px;">✓</span>
                      </div>
                    </div>

                    <h2 style="color: #18181b; margin: 0 0 20px; font-size: 24px; font-weight: 600; text-align: center;">
                      Solicitud Aprobada
                    </h2>

                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 30px; text-align: center;">
                      Hola <strong>${params.agentName}</strong>, tu solicitud de comisiones ha sido aprobada exitosamente.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px;">
                      <tr>
                        <td style="background-color: #f8fafc; border-radius: 8px; padding: 20px;">
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Folio:</td>
                              <td style="color: #18181b; font-size: 16px; font-weight: 600; padding: 8px 0; text-align: right;">${params.folio}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Monto bruto:</td>
                              <td style="color: #18181b; font-size: 16px; font-weight: 600; padding: 8px 0; text-align: right;">$${params.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-top: 1px solid #e2e8f0; padding-top: 12px;">Monto neto a transferir:</td>
                              <td style="color: #059669; font-size: 20px; font-weight: 700; padding: 8px 0; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: right;">$${params.amountTransfer.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <div style="background-color: #dbeafe; border-radius: 8px; padding: 16px; margin-top: 20px;">
                      <p style="color: #1e40af; font-size: 14px; line-height: 1.5; margin: 0;">
                        <strong>ℹ️ Información:</strong> El monto será transferido a la cuenta del beneficiario registrado. El tiempo de procesamiento puede variar según la institución bancaria.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f4f4f5; padding: 30px 40px; text-align: center;">
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 10px;">
                      © ${new Date().getFullYear()} Lendero Capital. Todos los derechos reservados.
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
                      Este correo fue enviado automáticamente. Por favor no responder.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Solicitud de comisiones aprobada - LenderoHUB

Hola ${params.agentName},

Tu solicitud de comisiones ha sido aprobada exitosamente.

Folio: ${params.folio}
Monto bruto: $${params.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Monto neto a transferir: $${params.amountTransfer.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

El monto será transferido a la cuenta del beneficiario registrado. El tiempo de procesamiento puede variar según la institución bancaria.

© ${new Date().getFullYear()} Lendero Capital
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  async sendCommissionRequestRejected(params: CommissionRequestRejectedParams): Promise<boolean> {
    const subject = `Solicitud de comisiones rechazada - ${params.folio}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solicitud Rechazada</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      Lendero<span style="font-weight: 400;">HUB</span>
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <div style="display: inline-block; background-color: #fee2e2; border-radius: 50%; width: 64px; height: 64px; line-height: 64px;">
                        <span style="color: #dc2626; font-size: 32px;">✕</span>
                      </div>
                    </div>

                    <h2 style="color: #18181b; margin: 0 0 20px; font-size: 24px; font-weight: 600; text-align: center;">
                      Solicitud Rechazada
                    </h2>

                    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 30px; text-align: center;">
                      Hola <strong>${params.agentName}</strong>, lamentamos informarte que tu solicitud de comisiones no pudo ser aprobada.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px;">
                      <tr>
                        <td style="background-color: #f8fafc; border-radius: 8px; padding: 20px;">
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Folio:</td>
                              <td style="color: #18181b; font-size: 16px; font-weight: 600; padding: 8px 0; text-align: right;">${params.folio}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;">Monto solicitado:</td>
                              <td style="color: #18181b; font-size: 16px; font-weight: 600; padding: 8px 0; text-align: right;">$${params.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 30px;">
                      <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0 0 8px;">
                        <strong>Motivo de rechazo:</strong>
                      </p>
                      <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0;">
                        ${params.rejectionMessage}
                      </p>
                    </div>

                    <div style="background-color: #dbeafe; border-radius: 8px; padding: 16px;">
                      <p style="color: #1e40af; font-size: 14px; line-height: 1.5; margin: 0;">
                        <strong>¿Necesitas ayuda?</strong> Por favor contacta al administrador para más detalles sobre esta decisión o para aclarar cualquier duda.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f4f4f5; padding: 30px 40px; text-align: center;">
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 10px;">
                      © ${new Date().getFullYear()} Lendero Capital. Todos los derechos reservados.
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
                      Este correo fue enviado automáticamente. Por favor no responder.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Solicitud de comisiones rechazada - LenderoHUB

Hola ${params.agentName},

Lamentamos informarte que tu solicitud de comisiones no pudo ser aprobada.

Folio: ${params.folio}
Monto solicitado: $${params.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Motivo de rechazo:
${params.rejectionMessage}

Por favor contacta al administrador para más detalles sobre esta decisión o para aclarar cualquier duda.

© ${new Date().getFullYear()} Lendero Capital
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
