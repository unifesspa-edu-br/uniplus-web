import type { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { PERMISSOES_DAS_TELAS } from '../../../acesso/permissoes-das-telas';

export interface DestinoDeVolta {
  readonly rota: string;
  readonly rotulo: string;
}


/** Para onde voltar de uma janela sem perfil ou sem acesso: a lista de perfis, se a pessoa a abre. */
export function destinoDeVolta(permissoes: PermissoesService): DestinoDeVolta {
  return permissoes.temAlguma(...PERMISSOES_DAS_TELAS['acessos/perfis'])
    ? { rota: '/acessos/perfis', rotulo: 'Ir para os perfis' }
    : { rota: '/', rotulo: 'Ir para o início' };
}
