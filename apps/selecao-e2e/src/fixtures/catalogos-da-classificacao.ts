import type { Page } from '@playwright/test';
import type { BaseLegalBonusRegionalDto } from '@uniplus/shared-data/configuracao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { CORS_DE_LEITURA } from '../support/processo-mockado';
import {
  responderCatalogos,
  responderRegrasDoCatalogo,
  type CatalogoMockado,
} from '../support/responder';

/** Uma regra mínima do `rol_de_regras`, com o par código+base legal que o seletor exibe. */
function regra(codigo: string, tipo: string, baseLegal: string) {
  return {
    codigo,
    versao: '1.0',
    tipo,
    declaracaoDaRegra: {},
    invariantes: {},
    baseLegal,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

const REGRAS_CALCULO = [
  regra('FORMULA-MEDIA-PONDERADA', 'regra_calculo', 'Resolução CEPS 12/2026'),
  regra('CLASSIFICACAO-IMPORTADA', 'regra_calculo', 'Portaria MEC 468/2023'),
];
const REGRAS_ARREDONDAMENTO = [
  regra('ARRED-TRUNCAR', 'regra_arredondamento', 'Edital padrão PSIQ'),
];
const REGRAS_ORDEM_ALOCACAO = [
  regra(
    'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
    'regra_ordem_alocacao',
    'UNI-REQ-0045 — processamento da 1ª opção antes da 2ª',
  ),
];
const REGRAS_ELIMINACAO = [
  regra('ELIMINACAO-ZERO-EM-AREA', 'regra_eliminacao', 'Resolução 805/2020, art. 5º'),
  regra('ELIMINACAO-CORTE-EM-AREA', 'regra_eliminacao', 'Resolução 805/2024, art. 6º'),
  regra('ELIMINACAO-AUSENCIA-NA-ETAPA', 'regra_eliminacao', 'Edital do processo'),
];
const REGRAS_BONUS = [
  regra(
    'BONUS-MULTIPLICATIVO',
    'regra_bonus',
    'Bônus multiplicativo aplicado à nota final após os pesos das áreas do ENEM, sem teto por padrão',
  ),
];
export const BASE_LEGAL_BONUS_REGIONAL_ID = 'ba5e0000-0000-7000-8000-000000000001';
const BASES_LEGAIS_BONUS_REGIONAL: readonly JsonDaApi<BaseLegalBonusRegionalDto>[] = [
  {
    id: BASE_LEGAL_BONUS_REGIONAL_ID,
    codigo: 'PORTARIA_UNIFESSPA_2514_2023',
    tipoInstrumento: { codigo: 'PORTARIA', rotulo: 'Rótulo do tipo portaria' },
    identificacao: 'Portaria Unifesspa nº 2514/2023',
    descricao: 'Institui inclusão regional.',
    municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
    criadoEm: '2026-01-01T00:00:00Z',
  },
];
export const RESOLUCAO_PESO_AREA = 'Resolução nº 805/2024/Consepe';

/** A lista canônica que o cadastro de Peso por Área publica, na ordem das colunas. */
export const AREAS_ENEM = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'CIENCIAS_NATUREZA', rotulo: 'Ciências da Natureza e suas Tecnologias' },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas e suas Tecnologias' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens, Códigos e suas Tecnologias' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];

/**
 * O quadro da resolução escolhida no tamanho do de uma resolução real — quatro grupos, as cinco
 * áreas e a mesma base legal em todos —, que é o que põe a largura da tabela à prova.
 */
export const PESOS_AREA_ENEM = [
  { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
  { codigo: 'HUMANISTICA_II', rotulo: 'Humanística II' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
].map((grupoCurso, indice) => ({
  id: `0196000${indice}-0000-7000-8000-00000000pa00`,
  resolucao: RESOLUCAO_PESO_AREA,
  grupoCurso,
  areas: AREAS_ENEM.map((area, posicao) => ({
    ...area,
    peso: posicao === indice + 1 ? 2.5 : posicao === 0 ? 2 : 1.5,
    corte: area.codigo === 'REDACAO' ? 400 : null,
  })),
  baseLegal: `${RESOLUCAO_PESO_AREA} – Anexo I`,
  criadoEm: '2026-09-01T00:00:00Z',
}));

const CRITERIOS_DESEMPATE = [
  regra('DESEMPATE-MAIOR-IDADE', 'criterio_desempate', 'Costume administrativo'),
  regra('DESEMPATE-IDOSO', 'criterio_desempate', 'Lei 10.741/2003, art. 27'),
  regra('DESEMPATE-CONDICAO-SOBRE-DADO', 'criterio_desempate', 'Definido por cada edital'),
  regra('DESEMPATE-MAIOR-NOTA-AREA-ENEM', 'criterio_desempate', 'Definido por cada edital'),
];

/**
 * O vocabulário fechado de fatos do candidato, como o catálogo institucional o publica. O
 * critério de desempate por predicado cita um destes — e só estes, porque o comando resolve o
 * vocabulário sem os fatos de domínio dinâmico.
 */
const FATOS_CANDIDATO = [
  {
    fato: {
      id: '01960000-0000-7000-0000-0000000000f1',
      codigo: 'RENDA_PER_CAPITA',
      nome: 'Renda familiar per capita',
      descricao: null,
      dominio: 'NUMERICO',
      origem: 'DERIVADO',
      cardinalidade: 'ESCALAR',
      valoresDominio: null,
      pontoResolucao: 'INSCRICAO',
      binding: 'ATRIBUTO_CANDIDATO:RENDA_PER_CAPITA',
      valoresDominioDeclarados: null,
    },
    operadoresAdmitidos: [
      { codigo: 'MAIOR_IGUAL', rotulo: 'é maior ou igual a' },
      { codigo: 'MENOR_IGUAL', rotulo: 'é menor ou igual a' },
    ],
  },
  {
    fato: {
      id: '01960000-0000-7000-0000-0000000000f2',
      codigo: 'COR_RACA',
      nome: 'Cor ou raça',
      descricao: null,
      dominio: 'CATEGORICO',
      origem: 'DECLARADO',
      cardinalidade: 'ESCALAR',
      valoresDominio: ['BRANCA', 'PRETA', 'PARDA', 'INDIGENA', 'AMARELA'],
      pontoResolucao: 'INSCRICAO',
      binding: 'CAMPO_INSCRICAO:COR_RACA',
      valoresDominioDeclarados: null,
    },
    operadoresAdmitidos: [
      { codigo: 'EM', rotulo: 'é um de' },
      { codigo: 'NAO_EM', rotulo: 'não é nenhum de' },
    ],
  },
];

const REGRAS_POR_TIPO: Record<string, readonly unknown[]> = {
  regra_calculo: REGRAS_CALCULO,
  regra_arredondamento: REGRAS_ARREDONDAMENTO,
  regra_ordem_alocacao: REGRAS_ORDEM_ALOCACAO,
  regra_eliminacao: REGRAS_ELIMINACAO,
  regra_bonus: REGRAS_BONUS,
  criterio_desempate: CRITERIOS_DESEMPATE,
};

/**
 * A lista canônica das áreas ordena as colunas do quadro de pesos, e o cadastro de Peso por Área
 * é de onde o passo da fórmula tira a resolução e o quadro. A rota das áreas é própria: a do
 * cadastro termina no recurso e não casa com `/areas`.
 */
const CATALOGOS: readonly CatalogoMockado[] = [
  ['configuracao/fatos-candidato', FATOS_CANDIDATO],
  ['configuracao/pesos-area-enem/areas', AREAS_ENEM],
  ['configuracao/pesos-area-enem', PESOS_AREA_ENEM],
  ['configuracao/base-legal-bonus-regional', BASES_LEGAIS_BONUS_REGIONAL],
];

/** Os catálogos de regra que as quatro telas consultam, todos do mesmo `rol_de_regras`. */
export async function mockarCatalogos(page: Page): Promise<void> {
  await responderRegrasDoCatalogo(page, REGRAS_POR_TIPO, CORS_DE_LEITURA);
  await responderCatalogos(page, CATALOGOS, CORS_DE_LEITURA);
}
