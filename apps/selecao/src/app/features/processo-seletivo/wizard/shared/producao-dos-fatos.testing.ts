import type {
  FatoComFase,
  FormularioQueColeta,
  GrupoDaProducao,
  LugarDaExigencia,
  ProducaoDosFatos,
} from './producao-dos-fatos';

export const fato = (codigo: string, extra: Partial<FatoComFase> = {}): FatoComFase => ({
  codigo,
  nome: codigo,
  dominio: 'BOOLEANO',
  cardinalidade: 'ESCALAR',
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
  dominio: 'CATEGORICO',
  fonteValores: 'MODALIDADE',
  binding: 'CLASSIFICACAO:MODALIDADE_CONVOCACAO',
  pontoResolucao: 'RESULTADO_FINAL',
});
export const DO_SIGAA = fato('DO_SIGAA', { binding: 'INTEGRACAO:SIGAA' });
export const FAIXA_ETARIA = fato('FAIXA_ETARIA', {
  dominio: 'NUMERICO',
  binding: 'ATRIBUTO_CANDIDATO:FAIXA_ETARIA',
});

export const FASES = [
  { codigo: 'INSCRICAO', ordem: 1, finalidades: ['INSCRICAO'] },
  { codigo: 'SOLICITACAO_ISENCAO', ordem: 2, finalidades: ['ISENCAO_TAXA'] },
  { codigo: 'RESULTADO_FINAL', ordem: 3, finalidades: [] },
  { codigo: 'HABILITACAO', ordem: 4, finalidades: ['HABILITACAO'] },
];

/** A exigência cobrada na fase, no formulário declarado; sem declaração, no único que a fase responde. */
export const na = (faseCodigo: string, finalidade: string | null = null): LugarDaExigencia => ({
  faseCodigo,
  finalidade,
});

export const formulario = (
  finalidade: string,
  faseCodigo: string,
  ...fatos: string[]
): FormularioQueColeta => ({
  finalidade,
  faseCodigo,
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
    { codigo: 'INSCRICAO', ordem: 1, finalidades: ['INSCRICAO', 'ISENCAO_TAXA'] },
    { codigo: 'RESULTADO_FINAL', ordem: 2, finalidades: [] },
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
  finalidade: string,
  faseCodigo: string,
  base: Partial<ProducaoDosFatos> = {},
): ProducaoDosFatos =>
  producao({
    ...base,
    formularios: [
      ...(base.formularios ?? [formulario('INSCRICAO', 'INSCRICAO', 'PCD')]),
      formulario(finalidade, faseCodigo, 'SEM_RENDA'),
    ],
    grupos: new Map([['FAMILIA', FAMILIA]]),
  });
