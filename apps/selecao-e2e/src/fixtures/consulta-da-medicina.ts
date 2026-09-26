import { PROCESSO_DA_MEDICINA } from './vagas-da-medicina';

/**
 * O processo da Medicina 2027 publicado, com o que os passos lidos como texto mostram: a taxa
 * com fundamentos de isenção, a oferta de atendimento especializado e o formulário de
 * inscrição. Os valores têm a forma do detalhe que a api devolve; o resto do agregado é o da
 * fixture de Vagas.
 *
 * Só dado de catálogo e de configuração do certame: nenhum dado de candidato.
 */
export const PROCESSO_PUBLICADO_DA_MEDICINA = {
  ...PROCESSO_DA_MEDICINA,
  status: 'publicado',
  identificadorLegivel: 'medicina-2027',
  configuracaoTaxaInscricao: {
    cobra: true,
    valor: 120.5,
    fundamentos: ['CADASTRO_UNICO', 'DOACAO_MEDULA_OSSEA'],
  },
  ofertaAtendimento: {
    condicoes: [
      {
        condicaoOrigemId: '01a0d640-0000-7000-8000-000000000001',
        condicaoCodigo: 'PCD',
        condicaoNome: 'Pessoa com deficiência',
      },
      {
        condicaoOrigemId: '01a0d640-0000-7000-8000-000000000002',
        condicaoCodigo: 'LACTANTE',
        condicaoNome: 'Lactante',
      },
    ],
    recursos: [
      { recursoOrigemId: '01a0d640-0000-7000-8000-000000000011', recursoNome: 'Prova ampliada' },
      { recursoOrigemId: '01a0d640-0000-7000-8000-000000000012', recursoNome: 'Ledor' },
    ],
    tiposDeficiencia: [
      {
        tipoDeficienciaOrigemId: '01a0d640-0000-7000-8000-000000000021',
        tipoDeficienciaNome: 'Deficiência visual',
      },
    ],
  },
  formularioTitulo: 'Inscrição — Processo Seletivo de Medicina 2027',
  formularioTermoAceiteTexto:
    'Declaro que li o edital e aceito as condições do processo seletivo.\n' +
    'Declaro que as informações prestadas são verdadeiras.',
  fatosColetados: [
    {
      fatoCodigo: 'COR_RACA',
      ordem: 1,
      rotulo: 'Cor ou raça',
      tipoRenderizacao: 'SELECAO',
      obrigatorio: true,
      precondicao: null,
    },
    {
      fatoCodigo: 'RENDA_FAMILIAR_PER_CAPITA_ATE_UM_SALARIO_MINIMO',
      ordem: 2,
      rotulo: 'Renda familiar per capita igual ou inferior a um salário mínimo',
      tipoRenderizacao: 'BOOLEANO',
      obrigatorio: false,
      precondicao: null,
    },
  ],
  referenciaTemporalFatos: { tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseId: null },
} as const;

/** Os fundamentos de isenção do catálogo, pelos quais o passo nomeia os códigos gravados. */
export const FUNDAMENTOS_DE_ISENCAO = [
  {
    codigo: 'CADASTRO_UNICO',
    nome: 'Inscrição no CadÚnico',
    descricao: 'Candidato inscrito no Cadastro Único para Programas Sociais.',
  },
  {
    codigo: 'DOACAO_MEDULA_OSSEA',
    nome: 'Doação de medula óssea',
    descricao: 'Candidato doador de medula óssea.',
  },
] as const;

/** O tipo do processo como o catálogo de Configuração o devolve. */
export const TIPOS_DE_PROCESSO = [
  {
    id: PROCESSO_DA_MEDICINA.tipoProcesso.origemId,
    codigo: PROCESSO_DA_MEDICINA.tipoProcesso.codigo,
    nome: PROCESSO_DA_MEDICINA.tipoProcesso.nome,
    descricao: 'Processo seletivo próprio para o curso de Medicina.',
    ativo: true,
    criadoEm: '2026-09-01T00:00:00Z',
  },
] as const;
