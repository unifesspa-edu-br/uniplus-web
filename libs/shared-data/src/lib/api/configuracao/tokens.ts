import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta da `uniplus-api` para chamadas do app Configuração. O app
 * consome módulos administrativos; cada feature deve preferir o entrypoint
 * de dados do bounded context dono do recurso quando existir.
 */
export const CONFIGURACAO_BASE_PATH = new InjectionToken<string>('CONFIGURACAO_BASE_PATH');
