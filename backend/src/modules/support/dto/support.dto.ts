import { IsInt, IsOptional, IsString, Min } from 'class-validator';
export class CreateTicketDto { @IsString() subject:string; @IsString() description:string; @IsOptional() @IsString() orderId?:string; }
export class MessageDto { @IsString() message:string; }
export class StatusDto { @IsString() status:string; }

export class CreateRefundRequestDto { @IsString() orderId!: string; @IsOptional() @IsInt() @Min(1) amount?: number; @IsString() reason!: string; }
