import type { CampoDaRegra } from './regra-de-deliberacao';

/** Onde a recusa aparece na regra de uma banca: um campo dela, ou a regra inteira. */
export type CampoDaBanca = CampoDaRegra | 'regra';

/** Todo lugar sob o qual a recusa à regra de uma banca pode aparecer. */
export const CAMPOS_DA_BANCA: readonly CampoDaBanca[] = [
  'regra',
  'modo',
  'integrantes',
  'suplentes',
  'quorum',
  'criterio',
  'desempate',
  'encerramento',
  'semUnanimidade',
];

export interface RecusaDaRegra {
  readonly campo: CampoDaBanca;
  readonly mensagem: string;
}

const PREFIXO = 'uniplus.selecao.banca.';

const RECUSA_POR_CODIGO: ReadonlyMap<string, RecusaDaRegra> = new Map([
  [
    'integrantes_invalidos',
    { campo: 'integrantes', mensagem: 'O número de integrantes é um inteiro de 1 até 2.147.483.647.' },
  ],
  [
    'suplentes_invalidos',
    { campo: 'suplentes', mensagem: 'O número de suplentes é um inteiro de 0 em diante.' },
  ],
  [
    'modo_de_deliberacao_invalido',
    {
      campo: 'modo',
      mensagem: 'Escolha como a banca delibera: colegiada, com votação, ou ato individual.',
    },
  ],
  [
    'quorum_fora_do_intervalo',
    { campo: 'quorum', mensagem: 'O quórum precisa ficar entre 1 e o número de integrantes.' },
  ],
  [
    'quorum_incoerente',
    {
      campo: 'quorum',
      mensagem: 'Com todos os titulares votando, o quórum é o número de integrantes.',
    },
  ],
  ['criterio_obrigatorio', { campo: 'criterio', mensagem: 'Escolha o critério da votação.' }],
  [
    'encerramento_obrigatorio',
    { campo: 'encerramento', mensagem: 'Diga como a votação se encerra.' },
  ],
  [
    'desempate_obrigatorio',
    { campo: 'desempate', mensagem: 'Escolha o desempate da votação por maioria.' },
  ],
  [
    'desempate_nao_se_aplica',
    {
      campo: 'desempate',
      mensagem: 'O desempate só vale na votação por maioria, com mais de um integrante.',
    },
  ],
  [
    'sem_unanimidade_obrigatoria',
    { campo: 'semUnanimidade', mensagem: 'Diga o que vale quando não há unanimidade.' },
  ],
  [
    'sem_unanimidade_nao_se_aplica',
    {
      campo: 'semUnanimidade',
      mensagem:
        'O resultado sem unanimidade só vale no critério de unanimidade, com mais de um integrante.',
    },
  ],
  [
    'ato_individual_sem_votacao',
    {
      campo: 'modo',
      mensagem:
        'O ato individual não tem votação: tire o quórum, o critério, o desempate e o encerramento.',
    },
  ],
  [
    'regra_de_deliberacao_obrigatoria',
    { campo: 'regra', mensagem: 'Declare a regra de deliberação da banca para publicar.' },
  ],
  [
    'integrantes_abaixo_do_minimo',
    {
      campo: 'integrantes',
      mensagem: 'A banca tem menos integrantes do que o mínimo exigido para as etapas que julga.',
    },
  ],
]);

/**
 * A recusa do servidor à regra de uma banca, ou `null` quando o código é outro. O mínimo de
 * integrantes só aparece na mensagem do servidor, e ela vale mais que o texto genérico.
 */
export function recusaDaRegra(codigo: string, mensagemDoServidor?: string): RecusaDaRegra | null {
  if (!codigo.startsWith(PREFIXO)) return null;
  const recusa = RECUSA_POR_CODIGO.get(codigo.slice(PREFIXO.length));
  if (recusa === undefined) return null;
  const doServidor = mensagemDoServidor?.trim();
  return codigo.endsWith('integrantes_abaixo_do_minimo') && doServidor
    ? { ...recusa, mensagem: doServidor }
    : recusa;
}

const CAMPOS_DA_REGRA: ReadonlyMap<string, CampoDaRegra> = new Map(
  (
    [
      'modo',
      'integrantes',
      'suplentes',
      'quorum',
      'criterio',
      'desempate',
      'encerramento',
      'semUnanimidade',
    ] as const
  ).map((campo) => [campo.toLowerCase(), campo]),
);

/** O campo da regra que o caminho do erro aponta (`...regraDeDeliberacao.quorum`), ou `null`. */
export function campoDaRegraNoCaminho(caminho: string): CampoDaRegra | null {
  const [, campo] = /regraDeDeliberacao\.(\w+)$/i.exec(caminho) ?? [];
  return campo === undefined ? null : (CAMPOS_DA_REGRA.get(campo.toLowerCase()) ?? null);
}

/** As recusas de uma banca reunidas por campo: só os campos para os quais `erroDe` devolve texto. */
export function errosDaBancaPorCampo(
  erroDe: (campo: CampoDaBanca) => string | null | undefined,
): Partial<Record<CampoDaBanca, string>> {
  return Object.fromEntries(
    CAMPOS_DA_BANCA.flatMap((campo) => {
      const erro = erroDe(campo);
      return erro ? [[campo, erro]] : [];
    }),
  );
}
