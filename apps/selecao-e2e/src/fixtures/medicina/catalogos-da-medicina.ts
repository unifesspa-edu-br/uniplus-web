import { REGRAS_DE_APLICABILIDADE } from './regras-das-modalidades';
/** A oferta do quadro. */
export const OFERTAS_DA_MEDICINA = [
  {
    id: '01a0d635-226e-76d9-b01f-30e5d2da7ada',
    cursoId: '01a0d635-136c-7eda-ba66-dd84f5dad3eb',
    localOfertaId: '01a07d6a-a1f4-76d0-953c-3934c062492c',
    unidadeOfertante: {
      origemId: '01a0d634-fde4-7371-8339-e00c7a2c6be2',
      sigla: 'IESB',
      nome: 'Instituto de Estudos em Saúde e Biológicas',
      tipo: 'Instituto',
    },
    programaDeOferta: 'REGULAR',
    formatoPedagogico: 'PRESENCIAL',
    regimeDeFuncionamento: 'EXTENSIVO',
    regimeDeTurno: 'REGULAR',
    turnos: ['MATUTINO'],
    codigoEmec: null,
    codigoNoSistemaAcademico: null,
    vagasAnuaisAutorizadas: 30,
    baseLegal: null,
    atoAutorizacaoMec: null,
    criadoEm: '2026-09-25T01:36:41.608106+00:00',
  },
] as const;

/** O curso da oferta. */
export const CURSOS_DA_MEDICINA = [
  {
    id: '01a0d635-136c-7eda-ba66-dd84f5dad3eb',
    codigo: 'MEDICINA-MARABA',
    nome: 'Medicina',
    grau: 'Bacharelado',
    nivelEnsino: 'Graduação',
    grupoAreaEnem: {
      codigo: 'SAUDE_E_BIOLOGICAS',
      rotulo: 'Saúde e Biológicas',
    },
    criadoEm: '2026-09-25T01:36:37.755652+00:00',
  },
] as const;

/** As dez modalidades que a regra de distribuição determina. */
export const MODALIDADES_DA_MEDICINA = [
  {
    id: '70da1000-0000-7000-8000-000000000001',
    codigo: 'AC',
    descricao: 'Ampla concorrência',
    naturezaLegal: { codigo: 'AMPLA', rotulo: 'Ampla concorrência' },
    composicaoVagas: {
      codigo: 'RESTANTE_DAS_VAGAS_OFERTADAS',
      rotulo: 'Restante das vagas ofertadas',
    },
    composicaoOrigem: null,
    remanejamento: null,
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.AC,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000002',
    codigo: 'LB_PPI',
    descricao: 'Cota — baixa renda, preto/pardo/indígena',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LB_PPI,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000003',
    codigo: 'LB_Q',
    descricao: 'Cota — baixa renda, quilombola',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LB_Q,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000004',
    codigo: 'LB_PCD',
    descricao: 'Cota — baixa renda, pessoa com deficiência',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LB_PCD,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000005',
    codigo: 'LB_EP',
    descricao: 'Cota — baixa renda, egresso de escola pública',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LB_EP,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000006',
    codigo: 'LI_PPI',
    descricao: 'Cota — independente de renda, preto/pardo/indígena',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LI_PPI,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000007',
    codigo: 'LI_Q',
    descricao: 'Cota — independente de renda, quilombola',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LI_Q,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000008',
    codigo: 'LI_PCD',
    descricao: 'Cota — independente de renda, pessoa com deficiência',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LI_PCD,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000009',
    codigo: 'LI_EP',
    descricao: 'Cota — independente de renda, egresso de escola pública',
    naturezaLegal: { codigo: 'COTA_RESERVADA', rotulo: 'Cota reservada' },
    composicaoVagas: { codigo: 'DENTRO_DA_RESERVA_LEGAL', rotulo: 'Dentro da reserva legal' },
    composicaoOrigem: null,
    remanejamento: {
      regra: { codigo: 'SEGUE_ORDEM_DE_REMANEJAMENTO', rotulo: 'Segue a ordem de remanejamento' },
      destino: null,
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.LI_EP,
    acaoQuandoIndeferido: null,
    baseLegal: 'Lei 12.711/2012 (red. Lei 14.723/2023)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
  {
    id: '70da1000-0000-7000-8000-000000000010',
    codigo: 'AC_PCD',
    descricao: 'Ampla Concorrência – Pessoa com Deficiência (V)',
    naturezaLegal: { codigo: 'ACAO_AFIRMATIVA', rotulo: 'Ação afirmativa' },
    composicaoVagas: {
      codigo: 'RETIRADA_DE_OUTRA_MODALIDADE',
      rotulo: 'Retirada de outra modalidade',
    },
    composicaoOrigem: 'AC',
    remanejamento: {
      regra: { codigo: 'DESTINO_UNICO', rotulo: 'Destino único' },
      destino: 'AC',
      par: null,
      fallback: null,
    },
    regraDeAplicabilidade: REGRAS_DE_APLICABILIDADE.AC_PCD,
    acaoQuandoIndeferido: null,
    baseLegal: 'Res. Unifesspa 532/2021, art. 1º (reserva de vaga para pessoa com deficiência)',
    criadoEm: '2026-01-01T00:00:00+00:00',
  },
] as const;

/** A referência de reserva demográfica do quadro. */
export const REFERENCIAS_DEMOGRAFICAS_DA_MEDICINA = [
  {
    id: '01a0d636-4a64-7022-9dc8-2ea861816919',
    censoReferencia: 'Censo 2022/2010 PA',
    ppiPercentual: 80.49,
    quilombolaPercentual: 1.55,
    pcdPercentual: 6.65,
    baseLegal:
      'Lei 12.711/2012 (redação da Lei 14.723/2023) e Lei 13.409/2016; IBGE SIDRA tabela 9605 (Censo 2022, Pará: pretos 9,77%, pardos 69,87%, indígenas 0,85%) e tabela 3425 (Censo 2010, Pará: 6,65%), conforme notas do Anexo II do edital.',
    criadoEm: '2026-09-25T01:37:57.360512+00:00',
  },
] as const;

/** A regra de distribuição do quadro. */
export const REGRAS_DE_DISTRIBUICAO_DA_MEDICINA = [
  {
    codigo: 'DISTRIB-VAGAS-LEI-12711-COM-AC-PCD',
    versao: 'v1',
    tipo: 'REGRA_DISTRIBUICAO_VAGAS',
    declaracaoDaRegra: {
      pr_minimo: 'numeric (piso 0,5 — art. 10 II; teto 1,0)',
      sub_reservas: ['PPI', 'Q', 'PCD', 'EP'],
      entradas_por_edital: ['VO_base', 'PR', 'ReferenciaReservaDemografica'],
      modo_arredondamento: 'teto (ceil) em todas as sub-reservas EXCETO LI_Q (floor) — art. 11',
      modalidades_admitidas: [
        'AC',
        'LB_PPI',
        'LB_Q',
        'LB_PCD',
        'LB_EP',
        'LI_PPI',
        'LI_Q',
        'LI_PCD',
        'LI_EP',
        'AC_PCD',
      ],
      ordem_garantia_minima: ['LB_PPI', 'LB_Q', 'LB_PCD', 'LB_EP', 'LI_PPI', 'LI_PCD', 'LI_EP'],
    },
    invariantes: [
      'VR=ceil(VO×PR)',
      'VRRI=ceil(VR×0,5)',
      'VRSI=VR−VRRI',
      'sub-reservas ceil EXCETO LI_Q=floor (art. 11)',
      'garantia mín-1 ordenada I-VII condicional à disponibilidade (art. 10 §2º), LI_Q fora',
      'INV-3a: LB_EP≥0 e LI_EP≥0',
      'INV-3b: AC≥0',
      'INV-3c: VR_final+RETIRADAS+AC=VO_base',
      'AC_PCD retira de AC, como qualquer outra retirada federal',
      'modalidade fora de modalidades_admitidas é recusada',
    ],
    baseLegal:
      'Portaria Normativa MEC nº 18/2012 art. 10 e 11 (red. PN 2.027/2023) — distribuição e arredondamento das vagas reservadas; Lei 12.711/2012 (red. Lei 14.723/2023)',
    hash: 'a0097d270c2fcd478ff8fb41a419275b328d0e13b6124dc179b6d224b83c8d08',
    modalidadesAdmitidas: [
      'AC',
      'LB_PPI',
      'LB_Q',
      'LB_PCD',
      'LB_EP',
      'LI_PPI',
      'LI_Q',
      'LI_PCD',
      'LI_EP',
      'AC_PCD',
    ],
    ramoDaDistribuicao: 'LEI_DE_COTAS',
  },
] as const;

/** A regra de ajuste do quadro. */
export const REGRAS_DE_AJUSTE_DA_MEDICINA = [
  {
    codigo: 'RECONCILIACAO-VAGAS-ART11-PU',
    versao: 'v1',
    tipo: 'REGRA_AJUSTE_DISTRIBUICAO_VAGAS',
    declaracaoDaRegra: {
      motores_nao_art10:
        'REDUZIR_DE | REDUZIR_PROPORCIONAL_EM (apenas distribuições institucionais; clamp >=0; VEDADOS à Lei 12.711)',
      reconciliacao_federal:
        'CAP_VO + PRIORIDADE_LB (art. 11 §único, embutida em DISTRIB-VAGAS-LEI-12711)',
    },
    invariantes: [
      'cap em VO: a reserva nunca excede as vagas da oferta (art. 11 §único I)',
      'prioridade LB>LI: na escassez a LI cede primeiro (art. 11 §único II)',
      'estouro sobre o nominal 50% (VR) e LEGAL — piso (art. 10 II), absorvido pela AC',
      'curso pequeno e determinístico por lei (capa, não bloqueia)',
    ],
    baseLegal:
      'Portaria MEC 18/2012 art. 11, parágrafo único (red. PN 2.027/2023) — cap nas vagas da oferta + prioridade do inciso III (LB) sobre o inciso IV (LI); art. 10 II (mínimo 50%, piso)',
    hash: 'ad2d8012ddc1f2ea4d763034899d07590c4a49901744b852dca2e70cede8b1e9',
    modalidadesAdmitidas: null,
    ramoDaDistribuicao: null,
  },
] as const;

/** A regra de remanejamento, com a matriz de oito origens. */
export const REGRAS_DE_CASCATA_DA_MEDICINA = [
  {
    codigo: 'REMANEJ-CASCATA-LEI-12711',
    versao: 'v1',
    tipo: 'CRITERIO_REMANEJAMENTO',
    declaracaoDaRegra: {
      ordens: [
        {
          origem: 'LB_PPI',
          destinos: ['LB_Q', 'LB_PCD', 'LB_EP', 'LI_PPI', 'LI_Q', 'LI_PCD', 'LI_EP'],
        },
        {
          origem: 'LB_Q',
          destinos: ['LB_PPI', 'LB_PCD', 'LB_EP', 'LI_PPI', 'LI_Q', 'LI_PCD', 'LI_EP'],
        },
        {
          origem: 'LB_PCD',
          destinos: ['LB_PPI', 'LB_Q', 'LB_EP', 'LI_PPI', 'LI_Q', 'LI_PCD', 'LI_EP'],
        },
        {
          origem: 'LB_EP',
          destinos: ['LB_PPI', 'LB_Q', 'LB_PCD', 'LI_PPI', 'LI_Q', 'LI_PCD', 'LI_EP'],
        },
        {
          origem: 'LI_PPI',
          destinos: ['LB_PPI', 'LB_Q', 'LB_PCD', 'LB_EP', 'LI_Q', 'LI_PCD', 'LI_EP'],
        },
        {
          origem: 'LI_Q',
          destinos: ['LB_PPI', 'LB_Q', 'LB_PCD', 'LB_EP', 'LI_PPI', 'LI_PCD', 'LI_EP'],
        },
        {
          origem: 'LI_PCD',
          destinos: ['LB_PPI', 'LB_Q', 'LB_PCD', 'LB_EP', 'LI_PPI', 'LI_Q', 'LI_EP'],
        },
        {
          origem: 'LI_EP',
          destinos: ['LB_PPI', 'LB_Q', 'LB_PCD', 'LB_EP', 'LI_PPI', 'LI_Q', 'LI_PCD'],
        },
      ],
      fallbackCodigo: 'AC',
    },
    invariantes: [
      'oito origens federais, ordem fixa por origem, terminal sempre AC — matriz não recalculada, só aplicada',
    ],
    baseLegal:
      'Portaria MEC nº 704/2025 (DOU 20/10/2025, Seção 1, p. 36-37), art. 2º e Anexo — insere o art. 20-A na Portaria Normativa MEC nº 21/2012; Lei 12.711/2012 art. 3º §1º (red. Lei 14.723/2023)',
    hash: '70f96f9fa5b2c5282adba8028070fdf0a82bef99408693d17d913c51d0c5078a',
    modalidadesAdmitidas: null,
    ramoDaDistribuicao: null,
  },
] as const;
