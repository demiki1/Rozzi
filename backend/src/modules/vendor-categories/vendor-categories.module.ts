import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VendorCategoriesController } from './vendor-categories.controller';
import { VendorCategoriesService } from './vendor-categories.service';

@Module({ imports: [AuditModule], controllers: [VendorCategoriesController], providers: [VendorCategoriesService], exports: [VendorCategoriesService] })
export class VendorCategoriesModule {}
