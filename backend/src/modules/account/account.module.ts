import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AddressesController } from './addresses.controller';
import { AccountService } from './account.service';

@Module({controllers:[AccountController,AddressesController],providers:[AccountService],exports:[AccountService]})
export class AccountModule {}
