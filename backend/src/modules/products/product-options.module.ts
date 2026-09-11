import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProductOptionsController } from './product-options.controller';
import { ProductOptionsService } from './product-options.service';
@Module({ imports: [AuditModule], controllers: [ProductOptionsController], providers: [ProductOptionsService], exports: [ProductOptionsService] })
export class ProductOptionsModule {}
