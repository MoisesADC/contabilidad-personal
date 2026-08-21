import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
// Valida el token que Supabase le dio al usuario al iniciar sesión.
// Las claves públicas se descargan del proyecto Supabase (JWKS) y se cachean.
// Nota: jose v6 es solo ESM; se carga con import() dinámico real (el
// Function evita que TypeScript lo convierta en require al compilar a CJS).
type Jose = typeof import('jose');
let josePromise: Promise<Jose> | null = null;
const cargarJose = () =>
  (josePromise ??= new Function('return import("jose")')() as Promise<Jose>);

let jwks: unknown = null;
async function getJwks() {
  const jose = await cargarJose();
  if (!jwks) {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('Falta SUPABASE_URL en el .env');
    jwks = jose.createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return { jose, jwks: jwks as Parameters<Jose['jwtVerify']>[1] };
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Falta el token de sesión');
    try {
      const { jose, jwks } = await getJwks();
      const { payload } = await jose.jwtVerify(token, jwks);
      req.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o vencida');
    }
  }
}

// Decorador para leer el id del usuario ya validado: método(@UserId() userId: string)
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().userId,
);
