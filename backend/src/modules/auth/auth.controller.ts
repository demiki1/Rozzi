import { Body, Controller, Headers, Post, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto'; import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto'; import { ResetPasswordDto } from './dto/reset-password.dto'; import { ResendVerificationDto, VerifyDto } from './dto/verify.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
@Controller('api/auth')
export class AuthController {
 constructor(private readonly auth: AuthService) {}
 @Public() @Post('register') register(@Body() dto:RegisterDto){return this.auth.register(dto)}
 @Public() @Throttle({default:{limit:5,ttl:60000}}) @Post('login') async login(@Body() dto:LoginDto,@Headers('x-use-httponly-refresh-cookie') cookieMode:string|undefined,@Res({passthrough:true}) res:Response){const tokens=await this.auth.login(dto); if(cookieMode==='true'){this.auth.setRefreshCookie(res,tokens.refreshToken); return {accessToken:tokens.accessToken};} return tokens}
 @Public() @Throttle({default:{limit:3,ttl:60000}}) @Post('forgot-password') forgot(@Body() dto:ForgotPasswordDto){return this.auth.forgotPassword(dto)}
 @Public() @Throttle({default:{limit:5,ttl:60000}}) @Post('reset-password') reset(@Body() dto:ResetPasswordDto){return this.auth.resetPassword(dto)}
 @Public() @Post('verify-email') verifyEmail(@Body() dto:VerifyDto){return this.auth.verifyEmail(dto)}
 @Public() @Post('verify-phone') verifyPhone(@Body() dto:VerifyDto){return this.auth.verifyPhone(dto)}
 @Public() @Post('resend-verification') resend(@Body() dto:ResendVerificationDto){return this.auth.resendVerification(dto)}
 @Public() @Post('refresh') async refresh(@Body('refreshToken') token:string|undefined,@Headers('cookie') cookieHeader:string|undefined,@Res({passthrough:true}) res:Response){const refreshToken=token||this.auth.readRefreshCookie(cookieHeader); if(!refreshToken) throw new UnauthorizedException('Refresh token required.'); const tokens=await this.auth.refresh(refreshToken); if(!token) { this.auth.setRefreshCookie(res,tokens.refreshToken); return {accessToken:tokens.accessToken}; } return tokens;}
 @Post('logout') logout(@CurrentUser() u:{userId:string},@Res({passthrough:true}) res:Response){res.clearCookie(this.auth.refreshCookieName()); return this.auth.logout(u.userId)}
}
