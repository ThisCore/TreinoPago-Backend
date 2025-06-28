import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface WelcomeEmailData {
  to: string;
  subject: string;
  clientName: string;
  planName: string;
  planPrice: number;
  recurrence: string;
  pixKey: string;
  billingStartDate: Date;
}

export interface ChargeReminderEmailData {
  to: string;
  subject: string;
  clientName: string;
  planName: string;
  amount: number;
  dueDate: Date;
  pixKey: string;
  chargeId: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Inicializa o transporter do Nodemailer
   */
  private initializeTransporter(): void {
    const emailProvider = this.configService.get<string>('EMAIL_PROVIDER', 'gmail');
    
    if (emailProvider === 'gmail') {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASSWORD'), // Use App Password para Gmail
        },
      });
    } else if (emailProvider === 'smtp') {
      // Configuração SMTP genérica
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASSWORD'),
        },
      });
    } else if (emailProvider === 'sendgrid') {
      // Configuração para SendGrid
      this.transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: this.configService.get<string>('SENDGRID_API_KEY'),
        },
      });
    } else {
      // Configuração para desenvolvimento (Ethereal Email)
      this.setupEtherealForDevelopment();
    }

    // Verifica a conexão
    this.verifyConnection();
  }

  /**
   * Configura Ethereal Email para desenvolvimento
   */
  private async setupEtherealForDevelopment(): Promise<void> {
    try {
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.logger.log('Ethereal Email configurado para desenvolvimento');
      this.logger.log(`Test account: ${testAccount.user}`);
    } catch (error) {
      this.logger.error('Erro ao configurar Ethereal Email:', error);
    }
  }

  /**
   * Verifica se a conexão com o servidor de email está funcionando
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('Conexão com servidor de email verificada com sucesso');
    } catch (error) {
      this.logger.error('Erro na conexão com servidor de email:', error);
    }
  }

  /**
   * Envia email de boas-vindas para novo cliente
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    try {
      const htmlContent = this.generateWelcomeEmailHTML(data);
      const textContent = this.generateWelcomeEmailText(data);
      
      const mailOptions = {
        from: {
          name: this.configService.get<string>('FROM_NAME', 'Sistema de Cobrança'),
          address: this.configService.get<string>('FROM_EMAIL'),
        },
        to: data.to,
        subject: data.subject,
        text: textContent,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email de boas-vindas enviado para: ${data.to}`);
      this.logger.log(`Message ID: ${info.messageId}`);
      
      // Para desenvolvimento com Ethereal
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
      
    } catch (error) {
      this.logger.error(`Erro ao enviar email de boas-vindas para ${data.to}:`, error);
      throw error;
    }
  }

  /**
   * Envia email de lembrete de cobrança
   */
  async sendChargeReminderEmail(data: ChargeReminderEmailData): Promise<void> {
    try {
      const htmlContent = this.generateChargeReminderEmailHTML(data);
      const textContent = this.generateChargeReminderEmailText(data);
      
      const mailOptions = {
        from: {
          name: this.configService.get<string>('FROM_NAME', 'Sistema de Cobrança'),
          address: this.configService.get<string>('FROM_EMAIL'),
        },
        to: data.to,
        subject: data.subject,
        text: textContent,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email de lembrete enviado para: ${data.to}`);
      this.logger.log(`Message ID: ${info.messageId}`);
      
      // Para desenvolvimento com Ethereal
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
      
    } catch (error) {
      this.logger.error(`Erro ao enviar lembrete para ${data.to}:`, error);
      throw error;
    }
  }

  /**
   * Gera conteúdo HTML do email de boas-vindas
   */
  private generateWelcomeEmailHTML(data: WelcomeEmailData): string {
    const formattedPrice = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(data.planPrice);

    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data.billingStartDate);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo!</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
            .plan-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .pix-key { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Bem-vindo(a), ${data.clientName}!</h1>
            </div>
            <div class="content">
                <p>Parabéns! Você foi cadastrado(a) com sucesso no plano <strong>${data.planName}</strong>.</p>
                
                <div class="plan-details">
                    <h3>📋 Detalhes do seu plano:</h3>
                    <ul>
                        <li><strong>Plano:</strong> ${data.planName}</li>
                        <li><strong>Valor:</strong> ${formattedPrice}</li>
                        <li><strong>Recorrência:</strong> ${data.recurrence}</li>
                        <li><strong>Data de início:</strong> ${formattedDate}</li>
                    </ul>
                </div>

                <h3>💳 Informações de Pagamento:</h3>
                <p>Para realizar o pagamento, utilize a chave PIX abaixo:</p>
                
                <div class="pix-key">
                    <strong>🔑 Chave PIX:</strong> ${data.pixKey}
                </div>

                <h3>📅 Próximos Passos:</h3>
                <p>Sua primeira cobrança já foi gerada e você receberá um lembrete próximo ao vencimento. 
                Mantenha seus dados atualizados para receber todas as notificações importantes.</p>

                <p>Se tiver alguma dúvida, entre em contato conosco.</p>

                <p><strong>Obrigado por escolher nossos serviços!</strong></p>
            </div>
            <div class="footer">
                <p>Esta é uma mensagem automática, não responda este email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Gera conteúdo texto do email de boas-vindas
   */
  private generateWelcomeEmailText(data: WelcomeEmailData): string {
    const formattedPrice = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(data.planPrice);

    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data.billingStartDate);

    return `
🎉 Bem-vindo(a), ${data.clientName}!

Parabéns! Você foi cadastrado(a) com sucesso no plano ${data.planName}.

📋 DETALHES DO SEU PLANO:
• Plano: ${data.planName}
• Valor: ${formattedPrice}
• Recorrência: ${data.recurrence}
• Data de início: ${formattedDate}

💳 INFORMAÇÕES DE PAGAMENTO:
Para realizar o pagamento, utilize a chave PIX abaixo:

🔑 Chave PIX: ${data.pixKey}

📅 PRÓXIMOS PASSOS:
Sua primeira cobrança já foi gerada e você receberá um lembrete próximo ao vencimento.
Mantenha seus dados atualizados para receber todas as notificações importantes.

Se tiver alguma dúvida, entre em contato conosco.

Obrigado por escolher nossos serviços!

---
Esta é uma mensagem automática, não responda este email.
    `.trim();
  }

  /**
   * Gera conteúdo HTML do email de lembrete
   */
  private generateChargeReminderEmailHTML(data: ChargeReminderEmailData): string {
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(data.amount);

    const formattedDueDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data.dueDate);

    const isOverdue = new Date() > data.dueDate;
    const statusText = isOverdue ? '⚠️ VENCIDO' : '📅 VENCE EM BREVE';
    const statusColor = isOverdue ? '#dc3545' : '#ffc107';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lembrete de Pagamento</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
            .charge-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .pix-key { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; }
            .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${statusText}</h1>
            </div>
            <div class="content">
                <p>Olá, <strong>${data.clientName}</strong>!</p>
                
                <p>${isOverdue 
                  ? 'Sua cobrança está vencida e precisa ser paga o quanto antes.' 
                  : 'Sua cobrança vence em breve. Não se esqueça de realizar o pagamento!'
                }</p>
                
                <div class="charge-details">
                    <h3>💰 Detalhes da Cobrança:</h3>
                    <ul>
                        <li><strong>Plano:</strong> ${data.planName}</li>
                        <li><strong>Valor:</strong> ${formattedAmount}</li>
                        <li><strong>Data de vencimento:</strong> ${formattedDueDate}</li>
                        <li><strong>ID da cobrança:</strong> ${data.chargeId}</li>
                    </ul>
                </div>

                <h3>💳 Como Pagar:</h3>
                <p>Utilize a chave PIX abaixo para realizar o pagamento:</p>
                
                <div class="pix-key">
                    <strong>🔑 Chave PIX:</strong> ${data.pixKey}
                </div>

                ${isOverdue ? `
                <div class="warning">
                    <strong>⚠️ IMPORTANTE:</strong> Pagamentos em atraso podem resultar na suspensão do serviço.
                </div>
                ` : `
                <div class="warning">
                    <strong>💡 DICA:</strong> Pague com antecedência para evitar qualquer interrupção no serviço.
                </div>
                `}

                <p>Se você já realizou o pagamento, pode ignorar este lembrete.</p>
                <p>Em caso de dúvidas, entre em contato conosco.</p>
            </div>
            <div class="footer">
                <p>Esta é uma mensagem automática, não responda este email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Gera conteúdo texto do email de lembrete
   */
  private generateChargeReminderEmailText(data: ChargeReminderEmailData): string {
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(data.amount);

    const formattedDueDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data.dueDate);

    const isOverdue = new Date() > data.dueDate;
    const statusText = isOverdue ? '⚠️ VENCIDO' : '📅 VENCE EM BREVE';

    return `
${statusText}

Olá, ${data.clientName}!

${isOverdue 
  ? 'Sua cobrança está vencida e precisa ser paga o quanto antes.' 
  : 'Sua cobrança vence em breve. Não se esqueça de realizar o pagamento!'
}

💰 DETALHES DA COBRANÇA:
• Plano: ${data.planName}
• Valor: ${formattedAmount}
• Data de vencimento: ${formattedDueDate}
• ID da cobrança: ${data.chargeId}

💳 COMO PAGAR:
Utilize a chave PIX abaixo para realizar o pagamento:

🔑 Chave PIX: ${data.pixKey}

${isOverdue 
  ? '⚠️ IMPORTANTE: Pagamentos em atraso podem resultar na suspensão do serviço.' 
  : '💡 DICA: Pague com antecedência para evitar qualquer interrupção no serviço.'
}

Se você já realizou o pagamento, pode ignorar este lembrete.
Em caso de dúvidas, entre em contato conosco.

---
Esta é uma mensagem automática, não responda este email.
    `.trim();
  }

  /**
   * Testa o envio de email
   */
  async testEmail(to: string): Promise<void> {
    try {
      const mailOptions = {
        from: {
          name: this.configService.get<string>('FROM_NAME', 'Sistema de Cobrança'),
          address: this.configService.get<string>('FROM_EMAIL'),
        },
        to,
        subject: 'Teste de Email - Sistema de Cobrança',
        text: 'Este é um email de teste do sistema de cobrança.',
        html: '<h1>Teste de Email</h1><p>Este é um email de teste do sistema de cobrança.</p>',
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email de teste enviado para: ${to}`);
      this.logger.log(`Message ID: ${info.messageId}`);
      
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao enviar email de teste para ${to}:`, error);
      throw error;
    }
  }
}