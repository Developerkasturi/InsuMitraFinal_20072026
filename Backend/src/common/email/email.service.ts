// ─────────────────────────────────────────────────────────────────────────────
// Email Service — Brevo (formerly Sendinblue) Transactional Email API
// Configure via env: BREVO_API_KEY, SENDER_EMAIL, SENDER_NAME
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { BrevoClient }        from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: BrevoClient;
  private readonly sender: { name: string; email: string };

  constructor(private readonly config: ConfigService) {
    this.client = new BrevoClient({
      apiKey: config.get<string>('brevo.apiKey', ''),
    });

    this.sender = {
      name:  config.get<string>('brevo.senderName',  'InsuMitra'),
      email: config.get<string>('brevo.senderEmail', 'noreply@insumitra.com'),
    };
  }

  // ── Send password reset email ──────────────────────────────────────────────
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.send(to, 'Reset your InsuMitra password', `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="background:#3B82F6;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Reset Password</a></p>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <hr/>
        <p style="color:#888;font-size:12px;">InsuMitra — Insurance Agency Management</p>
      </div>
    `);
  }

  // ── Send welcome email ─────────────────────────────────────────────────────
  async sendWelcomeEmail(to: string, name: string, tempPassword?: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const body = tempPassword
      ? `<p>Your temporary password is: <strong>${tempPassword}</strong></p>
         <p>Please <a href="${frontendUrl}/login">login</a> and change your password immediately.</p>`
      : `<p>Click <a href="${frontendUrl}/login">here</a> to login to your account.</p>`;

    await this.send(to, `Welcome to InsuMitra, ${name}!`, `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h2>Welcome, ${name}!</h2>
        <p>Your InsuMitra account has been created.</p>
        ${body}
        <hr/>
        <p style="color:#888;font-size:12px;">InsuMitra — Insurance Agency Management</p>
      </div>
    `);
  }

  // ── Send contact portal invite email ──────────────────────────────────────
  async sendContactInviteEmail(
    to: string,
    name: string,
    tempPassword: string,
    agencyName: string,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    await this.send(to, `Your InsuMitra client portal access — ${agencyName}`, `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h2>Hello, ${name}!</h2>
        <p><strong>${agencyName}</strong> has invited you to view your insurance policies and claims online.</p>
        <p>Use the details below to log in:</p>
        <ul>
          <li><strong>Login URL:</strong> <a href="${frontendUrl}/client/login">${frontendUrl}/client/login</a></li>
          <li><strong>Email:</strong> ${to}</li>
          <li><strong>Temporary Password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${tempPassword}</code></li>
        </ul>
        <p>Please change your password after your first login.</p>
        <hr/>
        <p style="color:#888;font-size:12px;">InsuMitra — Insurance Agency Management</p>
      </div>
    `);
  }

  // ── Generic send ──────────────────────────────────────────────────────────
  private async send(to: string, subject: string, htmlContent: string): Promise<void> {
    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender:      this.sender,
        to:          [{ email: to }],
        subject,
        htmlContent,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      // Log but don't throw — email failures shouldn't crash the request
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }
}
