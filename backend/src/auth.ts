import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
// Valida el token que Supabase le dio al usuario al iniciar sesión.
// Las claves públicas del proyecto (JWKS) se descargan una vez y se cachean.
// jose es ESM: el empaquetado con esbuild lo incluye en el bundle, y en
// Node 22+ el require también funciona, así que el import estático sirve
// en los dos escenarios (servidor local y función serverless).
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('Falta SUPABASE_URL en la configuración');
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Falta el token de sesión');
    try {
      const { payload } = await jwtVerify(token, getJwks());
      req.userId = payload.sub;
      return true;
    } catch (e) {
      throw new UnauthorizedException(
        'Sesión inválida o vencida' +
          (process.env.DEBUG_AUTH ? ': ' + String((e as Error).message) : ''),
      );
    }
  }
}

// Decorador para leer el id del usuario ya validado: método(@UserId() userId: string)
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().userId,
);
