import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminProductsController } from './admin-products.controller';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StorageModule, AuditModule],
  providers: [ProductsService, AdminProductsService],
  controllers: [ProductsController, AdminProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
