import type { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { PERMISSOES_DAS_TELAS, type CaminhoDeTela } from '../../../acesso/permissoes-das-telas';

export interface DestinoDeVolta {
  readonly rota: string;
  readonly rotulo: string;
}

const DESTINOS: readonly (readonly [CaminhoDeTela, string])[] = [
  ['acessos/perfis', 'Ir para os perfis'],
  ['acessos/janelas-de-migracao/gestao-de-acessos', 'Ir para as janelas de migração'],
  ['acessos/janelas-de-migracao/protecao-de-dados', 'Ir para as janelas de migração'],
];

/** Para onde voltar de uma janela sem perfil ou sem acesso: a primeira tela que a pessoa abre. */
export function destinoDeVolta(permissoes: PermissoesService): DestinoDeVolta {
  const achado = DESTINOS.find(([caminho]) =>
    permissoes.temAlguma(...PERMISSOES_DAS_TELAS[caminho]),
  );
  return achado
    ? { rota: `/${achado[0]}`, rotulo: achado[1] }
    : { rota: '/', rotulo: 'Ir para o início' };
}
