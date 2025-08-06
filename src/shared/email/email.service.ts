import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPassword = this.configService.get('EMAIL_PASS');

    // Check if email credentials are configured
    if (!emailUser || !emailPassword) {
      this.logger.warn('Email credentials not configured. Email service will be disabled.');
      this.transporter = null;
      return;
    }

    // For development, use Gmail or configure your SMTP
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get('EMAIL_PORT', 587),
      secure: this.configService.get('EMAIL_SECURE', false),
      requireTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
      this.logger.log('Email service initialized successfully');
    } catch (error) {
      this.logger.error('Email service initialization failed:', error);
      this.transporter = null;
    }
  }

  private getEmailTemplate(htmlContent: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Management System</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
          }
          
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 10px;
          }
          
          .header p {
            font-size: 16px;
            opacity: 0.9;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .welcome-section {
            margin-bottom: 30px;
          }
          
          .welcome-section h2 {
            color: #2c3e50;
            font-size: 24px;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .welcome-section p {
            color: #555;
            font-size: 16px;
            margin-bottom: 10px;
          }
          
          .credentials-section {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
            border-left: 4px solid #667eea;
          }
          
          .credentials-section h3 {
            color: #2c3e50;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .credential-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e9ecef;
          }
          
          .credential-item:last-child {
            border-bottom: none;
          }
          
          .credential-label {
            font-weight: 600;
            color: #495057;
            min-width: 100px;
          }
          
          .credential-value {
            color: #667eea;
            font-weight: 500;
            text-align: right;
          }
          
          .password-box {
            background-color: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 4px;
            padding: 8px 12px;
            color: #1976d2;
            font-weight: 600;
            font-family: 'Courier New', monospace;
          }
          
          .info-section {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
          }
          
          .info-section h4 {
            color: #856404;
            font-size: 16px;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .info-section p {
            color: #856404;
            font-size: 14px;
            margin-bottom: 8px;
          }
          
          .footer {
            background-color: #f8f9fa;
            padding: 25px 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          
          .footer p {
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 5px;
          }
          
          .footer .company-name {
            color: #667eea;
            font-weight: 600;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-weight: 600;
            margin: 20px 0;
            transition: all 0.3s ease;
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }
          
          @media (max-width: 600px) {
            .email-container {
              margin: 10px;
              border-radius: 0;
            }
            
            .header {
              padding: 20px 15px;
            }
            
            .header h1 {
              font-size: 24px;
            }
            
            .content {
              padding: 25px 20px;
            }
            
            .credentials-section {
              padding: 20px;
            }
            
            .credential-item {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
            
            .credential-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🚀 Task Management System</h1>
            <p>Your productivity partner</p>
          </div>
          
          <div class="content">
            ${htmlContent}
          </div>
          
          <div class="footer">
            <p>Thank you for choosing <span class="company-name">Task Management System</span></p>
            <p>© 2024 Task Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendUserInvitation(
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    role: string,
    invitedBy: string,
  ) {
    const htmlContent = `
      <div class="welcome-section">
        <h2>🎉 Welcome to the Team!</h2>
        <p>Hello <strong>${firstName} ${lastName}</strong>,</p>
        <p>You have been invited by <strong>${invitedBy}</strong> to join our Task Management System.</p>
        <p>We're excited to have you on board and can't wait to see what we'll accomplish together!</p>
      </div>
      
      <div class="credentials-section">
        <h3>🔐 Your Login Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Password:</span>
          <span class="credential-value">
            <span class="password-box">${password}</span>
          </span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Role:</span>
          <span class="credential-value">${role}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h4>⚠️ Important Security Notice</h4>
        <p>• Please change your password after your first login</p>
        <p>• Keep your credentials secure and don't share them</p>
        <p>• Contact your administrator if you have any issues</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${this.configService.get('FRONTEND_URL')}" class="cta-button">
          🚀 Get Started Now
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        If you have any questions, feel free to reach out to your team administrator.
      </p>
    `;

    const mailOptions = {
      from: `"Task Management System" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '🎉 Welcome to Task Management System - Your Account is Ready!',
      html: this.getEmailTemplate(htmlContent),
    };

    if (!this.transporter) {
      this.logger.warn(`Email service disabled. Would have sent invitation to ${email}`);
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Invitation email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordReset(email: string, resetToken: string) {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    
    const htmlContent = `
      <div class="welcome-section">
        <h2>🔒 Password Reset Request</h2>
        <p>Hello there,</p>
        <p>We received a request to reset your password for your Task Management System account.</p>
      </div>
      
      <div class="info-section">
        <h4>🔐 Reset Your Password</h4>
        <p>Click the button below to securely reset your password. This link will expire in 1 hour for security reasons.</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="cta-button">
          🔑 Reset Password
        </a>
      </div>
      
      <div class="info-section">
        <h4>⚠️ Security Notice</h4>
        <p>• If you didn't request this password reset, please ignore this email</p>
        <p>• The reset link will expire in 1 hour</p>
        <p>• Never share your password or reset links with anyone</p>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        If you're having trouble with the button above, copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
      </p>
    `;

    const mailOptions = {
      from: `"Task Management System" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '🔒 Password Reset Request - Task Management System',
      html: this.getEmailTemplate(htmlContent),
    };

    if (!this.transporter) {
      this.logger.warn(`Email service disabled. Would have sent password reset to ${email}`);
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  async sendAdminPasswordResetNotification(email: string) {
    const htmlContent = `
      <div class="welcome-section">
        <h2>🔒 Password Reset by Administrator</h2>
        <p>Hello there,</p>
        <p>Your password has been reset by an administrator for your Task Management System account.</p>
      </div>
      
      <div class="info-section">
        <h4>⚠️ Important Notice</h4>
        <p>• Your password has been changed by an administrator</p>
        <p>• Please contact your administrator for your new password</p>
        <p>• For security reasons, please change your password after logging in</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${this.configService.get('FRONTEND_URL')}" class="cta-button">
          🚀 Login to System
        </a>
      </div>
      
      <div class="info-section">
        <h4>🔐 Security Reminder</h4>
        <p>• Always use strong, unique passwords</p>
        <p>• Never share your login credentials</p>
        <p>• Contact your administrator if you have any concerns</p>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        If you have any questions about this password reset, please contact your administrator.
      </p>
    `;

    const mailOptions = {
      from: `"Task Management System" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '🔒 Password Reset by Administrator - Task Management System',
      html: this.getEmailTemplate(htmlContent),
    };

    if (!this.transporter) {
      this.logger.warn(`Email service disabled. Would have sent admin reset notification to ${email}`);
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Admin password reset notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send admin reset notification to ${email}:`, error);
      throw error;
    }
  }

  async sendAdminPasswordGenerated(
    email: string,
    firstName: string,
    lastName: string,
    password: string,
  ) {
    const htmlContent = `
      <div class="welcome-section">
        <h2>👑 System Administrator Account Created</h2>
        <p>Hello <strong>${firstName} ${lastName}</strong>,</p>
        <p>Your system administrator account has been successfully created for the Task Management System.</p>
        <p>You have full administrative privileges to manage users, teams, and system settings.</p>
      </div>
      
      <div class="credentials-section">
        <h3>🔐 Your Administrator Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Password:</span>
          <span class="credential-value">
            <span class="password-box">${password}</span>
          </span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Role:</span>
          <span class="credential-value">System Administrator</span>
        </div>
      </div>
      
      <div class="info-section">
        <h4>⚠️ Security Notice</h4>
        <p>• This is your initial password - please change it immediately after login</p>
        <p>• Keep your credentials secure and don't share them</p>
        <p>• You have full access to all system features and user management</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${this.configService.get('FRONTEND_URL')}" class="cta-button">
          🚀 Access Admin Panel
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        If you have any questions about your administrator account, please contact the system administrator.
      </p>
    `;

    const mailOptions = {
      from: `"Task Management System" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '👑 System Administrator Account Created - Task Management System',
      html: this.getEmailTemplate(htmlContent),
    };

    if (!this.transporter) {
      this.logger.warn(`Email service disabled. Would have sent admin credentials to ${email}`);
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Admin credentials email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send admin credentials email to ${email}:`, error);
      throw error;
    }
  }

  async testEmail(email: string) {
    const htmlContent = `
      <div class="welcome-section">
        <h2>🧪 Email Service Test</h2>
        <p>Hello there,</p>
        <p>This is a test email to verify that the email service is working correctly.</p>
      </div>
      
      <div class="info-section">
        <h4>✅ Email Service Status</h4>
        <p>• Email service is configured and working</p>
        <p>• SMTP connection is established</p>
        <p>• Emails can be sent successfully</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${this.configService.get('FRONTEND_URL')}" class="cta-button">
          🚀 Visit Application
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        This test email was sent at ${new Date().toLocaleString()}
      </p>
    `;

    const mailOptions = {
      from: `"Task Management System" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '🧪 Email Service Test - Task Management System',
      html: this.getEmailTemplate(htmlContent),
    };

    if (!this.transporter) {
      this.logger.warn(`Email service disabled. Cannot send test email to ${email}`);
      return {
        success: false,
        message: 'Email service is not configured',
        error: 'EMAIL_SERVICE_DISABLED'
      };
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Test email sent to ${email}`);
      return {
        success: true,
        message: 'Test email sent successfully',
        email
      };
    } catch (error) {
      this.logger.error(`Failed to send test email to ${email}:`, error);
      return {
        success: false,
        message: 'Failed to send test email',
        error: error.message
      };
    }
  }
} 