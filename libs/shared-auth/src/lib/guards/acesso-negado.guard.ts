import { CanActivateFn } from '@angular/router';
import { exigeSessao } from './auth.guard';

/**
 * Guarda da página de acesso negado: ela só faz sentido para quem está autenticado. Sem sessão,
 * leva ao login e volta à raiz do app, e não à própria página, que mostraria "acesso negado" a
 * quem talvez tenha permissão.
 */
export const acessoNegadoGuard: CanActivateFn = exigeSessao(() => '/');
