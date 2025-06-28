import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { HttpExceptionFilter } from './exceptions/filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PaymentRecurrenceService } from './payment/payment.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });


  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Documentação de Rotas do PortalWEPGCOMP')
    .setDescription(
      'Especificação e descrição das rotas da API do projeto PortalWEPGCOMP.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory, {
    customSiteTitle: 'Api Docs',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
    ],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  await checkPendingPayments(app);

  await app.listen(process.env.PORT ?? 3000);
}

async function checkPendingPayments(app: INestApplication) {
  try {
    console.log('🔍 Verificando pagamentos pendentes...');
    
    const paymentService = app.get(PaymentRecurrenceService);
    
    await paymentService.processPaymentsManually();
    
    console.log('✅ Verificação de pagamentos concluída');
  } catch (error) {
    console.error('⚠️ Erro na verificação de pagamentos (continuando inicialização):', error);
  }
}


bootstrap();
