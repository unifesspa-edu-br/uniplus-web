import {
  DADO_NUMERICO,
  DADO_OPCAO,
  DADO_SIM_OU_NAO,
  VALORES_MODALIDADE,
  VALOR_UNICO,
} from './valores-do-catalogo.testing';
import type {
  FaseNoCronograma,
  FatoComFase,
  FormularioQueColeta,
  GrupoDaProducao,
  LugarDaExigencia,
  ProducaoDosFatos,
} from './producao-dos-fatos';

export const fato = (codigo: string, extra: Partial<FatoComFase> = {}): FatoComFase => ({
  codigo,
  nome: codigo,
  dominio: DADO_SIM_OU_NAO,
  cardinalidade: VALOR_UNICO,
  valoresDominio: null,
  fonteValores: null,
  binding: `CAMPO_FORMULARIO:${codigo}`,
  escopo: 'CANDIDATO',
  ativo: true,
  operadoresAdmitidos: [{ codigo: 'IGUAL', rotulo: 'é' }],
  pontoResolucao: 'INSCRICAO',
  ...extra,
});

export const PCD = fato('PCD');
export const LAUDO_RECENTE = fato('LAUDO_RECENTE');
export const BAIXA_RENDA = fato('BAIXA_RENDA');
export const SEM_RENDA = fato('SEM_RENDA', { escopo: 'MEMBRO_GRUPO' });
export const ALGUM_SEM_RENDA = fato('ALGUM_SEM_RENDA', { binding: 'AGREGACAO_GRUPO:SEM_RENDA' });
export const PERFIL = fato('PERFIL', { binding: 'REGRA_DERIVACAO:PERFIL' });
export const CONVOCACAO = fato('MODALIDADE_CONVOCACAO', {
  dominio: DADO_OPCAO,
  fonteValores: VALORES_MODALIDADE,
  binding: 'CLASSIFICACAO:MODALIDADE_CONVOCACAO',
  pontoResolucao: 'RESULTADO_FINAL',
});
export const DO_SIGAA = fato('DO_SIGAA', { binding: 'INTEGRACAO:SIGAA' });
export const FAIXA_ETARIA = fato('FAIXA_ETARIA', {
  dominio: DADO_NUMERICO,
  binding: 'ATRIBUTO_CANDIDATO:FAIXA_ETARIA',
});

/** A fase do cronograma, com as marcas que dizem o que ela é. */
export const fase = (
  codigo: string,
  ordem: number,
  marcas: Partial<Pick<FaseNoCronograma, 'coletaInscricao' | 'coletaSolicitacaoIsencao'>> = {},
): FaseNoCronograma => ({
  codigo,
  ordem,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  ...marcas,
});

export const FASES = [
  fase('INSCRICAO', 1, { coletaInscricao: true }),
  fase('SOLICITACAO_ISENCAO', 2, { coletaSolicitacaoIsencao: true }),
  fase('RESULTADO_FINAL', 3),
  fase('HABILITACAO', 4),
];

/** A exigência cobrada na fase, no formulário declarado; sem declaração, no único que a fase responde. */
export const na = (
  faseCodigo: string,
  formularioCodigo: string | null = null,
): LugarDaExigencia => ({
  faseCodigo,
  formularioCodigo,
});

/** O formulário de código INSCRICAO é o da inscrição, e o de código ISENCAO_TAXA, o pedido de isenção. */
export const formulario = (
  codigo: string,
  faseCodigo: string,
  ...fatos: string[]
): FormularioQueColeta => ({
  codigo,
  faseCodigo,
  daInscricao: codigo === 'INSCRICAO',
  daIsencao: codigo.endsWith('ISENCAO_TAXA'),
  fatos: new Set(fatos),
});

const CATALOGO = new Map(
  [
    PCD,
    LAUDO_RECENTE,
    BAIXA_RENDA,
    SEM_RENDA,
    ALGUM_SEM_RENDA,
    PERFIL,
    CONVOCACAO,
    DO_SIGAA,
    FAIXA_ETARIA,
  ].map((f) => [f.codigo, f] as const),
);

export function producao(parcial: Partial<ProducaoDosFatos> = {}): ProducaoDosFatos {
  return {
    fases: FASES,
    formularios: [formulario('INSCRICAO', 'INSCRICAO', 'PCD')],
    derivacoes: new Map(),
    catalogo: CATALOGO,
    grupos: new Map(),
    ...parcial,
  };
}

export const NOMES = {
  fato: (codigo: string) => codigo.toLocaleLowerCase('pt-BR'),
  fase: (codigo: string) => codigo.toLocaleLowerCase('pt-BR'),
};

/** Inscrição e isenção na mesma fase, com o fato que só o formulário de isenção coleta. */
export const FASE_DIVIDIDA = producao({
  fases: [
    fase('INSCRICAO', 1, { coletaInscricao: true, coletaSolicitacaoIsencao: true }),
    fase('RESULTADO_FINAL', 2),
  ],
  formularios: [
    formulario('INSCRICAO', 'INSCRICAO', 'PCD'),
    formulario('ISENCAO_TAXA', 'INSCRICAO', 'BAIXA_RENDA'),
  ],
});

export const COM_HABILITACAO = producao({
  formularios: [
    formulario('INSCRICAO', 'INSCRICAO', 'PCD'),
    formulario('HABILITACAO', 'HABILITACAO', 'LAUDO_RECENTE'),
  ],
});

export const FAMILIA: GrupoDaProducao = {
  codigo: 'FAMILIA',
  rotulo: 'Composição familiar',
  campos: ['SEM_RENDA'],
};
export const familiaNa = (
  formularioCodigo: string,
  faseCodigo: string,
  base: Partial<ProducaoDosFatos> = {},
): ProducaoDosFatos =>
  producao({
    ...base,
    formularios: [
      ...(base.formularios ?? [formulario('INSCRICAO', 'INSCRICAO', 'PCD')]),
      formulario(formularioCodigo, faseCodigo, 'SEM_RENDA'),
    ],
    grupos: new Map([['FAMILIA', FAMILIA]]),
  });
