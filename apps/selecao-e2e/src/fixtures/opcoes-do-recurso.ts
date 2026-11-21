import type { CatalogoMockado } from '../support/responder';

/** As unidades do prazo de recurso que a API oferece, como ela as devolve. */
export const UNIDADES_DO_PRAZO_DE_RECURSO = [
  { codigo: 'horas', rotulo: 'Horas' },
  { codigo: 'diasUteis', rotulo: 'Dias úteis' },
] as const;

/** Os efeitos suspensivos que a API oferece, cada um com a explicação do que faz. */
export const EFEITOS_SUSPENSIVOS = [
  {
    codigo: 'semEfeitoSuspensivo',
    rotulo: 'Sem efeito suspensivo',
    descricao: 'O recurso não suspende o processo: as fases seguintes começam nas datas previstas.',
  },
] as const;

/** As guardas da vaga que a API oferece, cada uma com a explicação do que faz. */
export const GUARDAS_DA_VAGA = [
  {
    codigo: 'ateOResultadoDefinitivo',
    rotulo: 'Guarda a vaga até o resultado definitivo',
    descricao: 'A vaga fica guardada até a publicação do resultado definitivo.',
  },
  {
    codigo: 'naoGuarda',
    rotulo: 'Não guarda a vaga',
    descricao: 'A vaga segue para o próximo candidato enquanto o recurso é julgado.',
  },
] as const;

/** Os três vocabulários da configuração do recurso, para os cenários que a editam. */
export const OPCOES_DO_RECURSO: readonly CatalogoMockado[] = [
  ['selecao/unidades-do-prazo-de-recurso', UNIDADES_DO_PRAZO_DE_RECURSO],
  ['selecao/efeitos-suspensivos', EFEITOS_SUSPENSIVOS],
  ['selecao/guardas-da-vaga', GUARDAS_DA_VAGA],
];
