import { ModalidadeConcorrencia } from '@uniplus/shared-data/selecao';
import {
  AtendimentoCondicao,
  AtendimentoRecurso,
  CriterioDesempate,
  Curso,
  DocumentoGrupo,
  TipoProcessoOption,
} from './processo-seletivo.models';

export const STEP_LABELS = [
  'Tipo do processo',
  'Identificação',
  'Modalidades',
  'Vagas',
  'Etapas',
  'Fórmula e precisão',
  'Bônus',
  'Desempate',
  'Eliminação',
  'Docs por modalidade',
  'Locais de prova',
  'Atend. especial',
  'Revisão e publicação',
] as const;

export const REVIEW_NAMES = [
  'Tipo do processo seletivo',
  'Identificação',
  'Modalidades',
  'Vagas',
  'Etapas',
  'Fórmula de classificação',
  'Bônus',
  'Critérios de desempate',
  'Notas mínimas e cláusulas',
  'Documentos por modalidade',
  'Locais de prova',
  'Atendimento especializado',
] as const;

export const TIPO_PROCESSO_OPTIONS: TipoProcessoOption[] = [
  {
    value: 'sisu',
    name: 'SiSU',
    description:
      'Sistema de Seleção Unificada — utiliza notas do ENEM para classificação. Notas obtidas via integração com INEP, sem prova local.',
    tags: ['2 opções'],
    legal: 'Portaria MEC 21/2012; Lei 12.711/2012 atualizada pela Lei 14.723/2023',
  },
  {
    value: 'psiq',
    name: 'PSIQ — Indígena e Quilombola',
    description:
      'Processo Seletivo Especial para candidatos indígenas e quilombolas, com vagas suplementares e prova presencial em 3 polos.',
    tags: ['2 opções', 'Presencial', 'Suplementares'],
    legal: 'Resolução Unifesspa 532/2021',
  },
  {
    value: 'pse',
    name: 'PSE — Educação do Campo',
    description:
      'Processo Seletivo Especial para Licenciatura em Educação do Campo. Exige declaração de pertencimento territorial e entrevista.',
    tags: ['Presencial'],
    legal: 'Resolução Unifesspa 805/2024',
  },
  {
    value: 'psvr',
    name: 'PSVR — Vestibular Remanescente',
    description:
      'Processo Seletivo para vagas remanescentes após SiSU. Utiliza prova presencial objetiva + redação.',
    tags: ['Presencial'],
    legal: 'Portaria MEC 18/2012; Resolução CONSEPE Unifesspa',
  },
  {
    value: 'ps-convenios',
    name: 'PS Convênios',
    description:
      'Processo Seletivo de cursos por convênio com municípios. Aplica bônus regional configurável (padrão 20% sobre AC).',
    tags: ['Presencial'],
    legal: 'PN MEC 2.027/2023; Resolução Unifesspa do convênio específico',
  },
  {
    value: 'mobin',
    name: 'Transferência Interna (MOBIN)',
    description:
      'Mobilidade interna entre cursos da Unifesspa. Análise de histórico e carta de intenção.',
    tags: [],
    legal: 'Resolução Unifesspa 414/2020',
  },
  {
    value: 'mobex',
    name: 'Transferência Externa (MOBEX)',
    description:
      'Mobilidade externa de outras IFES para a Unifesspa. Análise de histórico e carta de intenção.',
    tags: [],
    legal: 'Resolução Unifesspa 414/2020',
  },
  {
    value: 'portador-diploma',
    name: 'Portador de Diploma',
    description:
      'Ingresso para portadores de diploma de curso superior. Análise de histórico de graduação anterior.',
    tags: [],
    legal: 'Resolução Unifesspa 414/2020',
  },
];

/**
 * Modalidades de concorrência do processo seletivo, no vocabulário canônico
 * de `ModalidadeConcorrencia` (shared-data). O código é a chave gravada no
 * rascunho — não usar rótulo nem identificador próprio.
 */
export const MODALIDADES: readonly { code: ModalidadeConcorrencia; label: string }[] = [
  { code: 'AC', label: 'Ampla Concorrência' },
  { code: 'V', label: 'Pessoa com Deficiência (Ampla Concorrência)' },
  { code: 'LB_PPI', label: 'Baixa Renda + PPI (Pretos, Pardos ou Indígenas)' },
  { code: 'LB_Q', label: 'Baixa Renda + Quilombola' },
  { code: 'LB_PcD', label: 'Baixa Renda + Pessoa com Deficiência' },
  { code: 'LB_EP', label: 'Baixa Renda — Demais (Escola Pública)' },
  { code: 'LI_PPI', label: 'Independente de Renda + PPI (Pretos, Pardos ou Indígenas)' },
  { code: 'LI_Q', label: 'Independente de Renda + Quilombola' },
  { code: 'LI_PcD', label: 'Independente de Renda + Pessoa com Deficiência' },
  { code: 'LI_EP', label: 'Independente de Renda — Demais (Escola Pública)' },
];

/** Derivada de `MODALIDADES` para não haver duas listas a manter em sincronia. */
export const MODALIDADES_CANONICAS: readonly ModalidadeConcorrencia[] = MODALIDADES.map(
  (modalidade) => modalidade.code,
);

export const CURSOS: Curso[] = [
  {
    id: 1,
    nome: 'Ciências Sociais',
    grau: 'Bach.',
    campus: 'Campus de Marabá',
    unidade: 'Unidade I',
  },
  { id: 2, nome: 'Física', grau: 'Lic.', campus: 'Campus de Marabá', unidade: 'Unidade I' },
  {
    id: 3,
    nome: 'Licenciatura em Educação do Campo',
    grau: 'Lic.',
    campus: 'Campus de Marabá',
    unidade: 'Unidade I',
  },
  { id: 4, nome: 'Matemática', grau: 'Lic.', campus: 'Campus de Marabá', unidade: 'Unidade II' },
  { id: 5, nome: 'História', grau: 'Bach.', campus: 'Campus de Marabá', unidade: 'Unidade I' },
  {
    id: 6,
    nome: 'Sistemas de Informação',
    grau: 'Bach.',
    campus: 'Campus de Marabá',
    unidade: 'Unidade II',
  },
  {
    id: 7,
    nome: 'Engenharia de Produção',
    grau: 'Bach.',
    campus: 'Campus de Marabá',
    unidade: 'Unidade III',
  },
  { id: 8, nome: 'Medicina', grau: 'Bach.', campus: 'Campus de Marabá', unidade: 'Unidade I' },
];

export const CRITERIOS_DESEMPATE: CriterioDesempate[] = [
  { id: 1, nome: 'Candidato idoso (60+ anos)', fonte: 'Lei 10.741/2003 art. 27' },
  { id: 2, nome: 'Maior nota na Redação', fonte: 'Definido por cada edital' },
  { id: 3, nome: 'Maior idade cronológica', fonte: 'Costume administrativo' },
  { id: 4, nome: 'Menor número de inscrição', fonte: 'Definido por cada edital' },
  { id: 5, nome: 'Maior nota total no ENEM', fonte: 'Definido por cada edital' },
  { id: 6, nome: 'Maior nota em Ciências da Natureza', fonte: 'Definido por cada edital' },
  { id: 7, nome: 'Maior nota em Ciências Humanas', fonte: 'Definido por cada edital' },
];

export const DOCUMENTO_GRUPOS: DocumentoGrupo[] = [
  {
    label: 'IDENTIFICACAO',
    docs: [
      {
        id: 'rg-cnh',
        nome: 'Documento de identidade (RG, CNH, CTPS)',
        desc: 'Documento oficial com foto.',
      },
      { id: 'cpf', nome: 'CPF', desc: 'Cadastro de Pessoa Física.' },
      {
        id: 'foto-3x4',
        nome: 'Foto 3x4 (digital)',
        desc: 'Foto recente de identificação, fundo claro.',
      },
    ],
  },
  {
    label: 'ESCOLARIDADE',
    docs: [
      {
        id: 'hist-em',
        nome: 'Histórico do Ensino Médio',
        desc: 'Histórico escolar completo do ensino médio, com todas as disciplinas e notas.',
      },
      {
        id: 'cert-em',
        nome: 'Certificado de Conclusão do Ensino Médio',
        desc: 'Certificado oficial de conclusão.',
      },
      {
        id: 'hist-grad',
        nome: 'Histórico de Graduação',
        desc: 'Histórico de curso superior anterior (transferência, portador de diploma).',
      },
      { id: 'diplo-grad', nome: 'Diploma de Graduação', desc: 'Diploma de curso superior.' },
    ],
  },
  {
    label: 'RENDA',
    docs: [
      {
        id: 'comp-renda',
        nome: 'Comprovantes de renda familiar',
        desc: 'Comprovantes dos últimos 3 meses de todos os membros da família.',
      },
      {
        id: 'decl-informal',
        nome: 'Declaração de renda informal',
        desc: 'Declaração de renda para trabalhadores informais ou autônomos.',
      },
    ],
  },
  {
    label: 'RACA_ETNIA',
    docs: [
      {
        id: 'decl-etnico',
        nome: 'Declaração de autorreconhecimento étnico-racial',
        desc: 'Autodeclaração assinada de identidade étnico-racial (preto, pardo, indígena).',
      },
      {
        id: 'decl-indigena',
        nome: 'Declaração de Pertencimento Indígena',
        desc: 'Declaração de pertencimento a comunidade indígena, assinada por 3 lideranças.',
      },
      {
        id: 'decl-quilombola',
        nome: 'Declaração de Pertencimento Quilombola',
        desc: 'Declaração de pertencimento a comunidade quilombola, assinada por 3 lideranças.',
      },
      {
        id: 'decl-territorial',
        nome: 'Declaração de Pertencimento Territorial (PSE Ed. Campo)',
        desc: 'Declaração de pertencimento a povo do campo, comunidade tradicional ou movimento social.',
      },
    ],
  },
  {
    label: 'SAUDE',
    docs: [
      {
        id: 'laudo-pcd',
        nome: 'Laudo médico para PcD',
        desc: 'Laudo médico com CID, conforme critério Grupo de Washington (Portaria MEC 2.027/2023).',
      },
      {
        id: 'auto-pcd',
        nome: 'Termo de autodeclaração PcD',
        desc: 'Termo onde o candidato se declara pessoa com deficiência, complementar ao laudo.',
      },
    ],
  },
  {
    label: 'RESIDENCIA',
    docs: [
      {
        id: 'comp-res',
        nome: 'Comprovante de residência',
        desc: 'Conta de luz, água, telefone ou contrato de aluguel dos últimos 3 meses.',
      },
    ],
  },
  {
    label: 'OUTROS',
    docs: [
      {
        id: 'carta-int',
        nome: 'Carta de Intenção (documento de inscrição)',
        desc: 'Texto argumentativo onde o candidato apresenta motivação para o curso. Avaliada como etapa, mas anexada na inscrição.',
      },
      {
        id: 'comp-prof',
        nome: 'Comprovante de atuação como professor rural',
        desc: 'Declaração de exercício da docência em escola pública rural (PSE Ed. Campo).',
      },
    ],
  },
];

export const DOC_ETAPAS = [
  { num: 'Etapa 1', cod: 'INSCRICAO_CANDIDATOS' },
  { num: 'Etapa 2', cod: 'HOMOLOGACAO_INSCRICOES' },
  { num: 'Etapa 3', cod: 'IMPORTACAO_NOTAS_ENEM' },
  { num: 'Etapa 4', cod: 'DIVULGACAO_RESULTADO_PARCIAL' },
  { num: 'Etapa 5', cod: 'DIVULGACAO_RESULTADO_FINAL' },
] as const;

export const POLOS = [
  'Marabá (PA)',
  'Canaã dos Carajás (PA)',
  'Rondon do Pará (PA)',
  'Santana do Araguaia (PA)',
  'São Félix do Xingu (PA)',
  'Xinguara (PA)',
  'Abel Figueiredo (PA)',
  'Água Azul do Norte (PA)',
  'Almeirim (PA)',
  'Anapu (PA)',
  'Bannach (PA)',
  'Bom Jesus do Tocantins (PA)',
  'Brejo Grande do Araguaia (PA)',
  'Conceição do Araguaia (PA)',
  'Cumaru do Norte (PA)',
  'Curionópolis (PA)',
  'Dom Eliseu (PA)',
  'Eldorado dos Carajás (PA)',
  'Floresta do Araguaia (PA)',
  'Goianésia do Pará (PA)',
  'Itupiranga (PA)',
  'Jacundá (PA)',
  'Novo Repartimento (PA)',
  'Ourilândia do Norte (PA)',
  'Palestina do Pará (PA)',
  'Parauapebas (PA)',
  'Piçarra (PA)',
  'Redenção (PA)',
  'Rio Maria (PA)',
  'São Domingos do Araguaia (PA)',
  'São Geraldo do Araguaia (PA)',
  'São João do Araguaia (PA)',
  'Sapucaia (PA)',
  'Tucumã (PA)',
  'Tucuruí (PA)',
] as const;

export const ATENDIMENTO_CONDICOES: AtendimentoCondicao[] = [
  { id: 'pcd', nome: 'Pessoa com deficiência', laudo: true, isPcd: true },
  { id: 'disl', nome: 'Dislexia', laudo: true },
  { id: 'tdah', nome: 'Déficit de atenção (TDAH)', laudo: true },
  { id: 'discalc', nome: 'Discalculia', laudo: true },
  { id: 'diab', nome: 'Diabetes', laudo: true },
  { id: 'hosp', nome: 'Estudante em classe hospitalar', laudo: true },
  { id: 'gest', nome: 'Gestante' },
  { id: 'lact', nome: 'Lactante' },
  { id: 'idoso', nome: 'Idoso (60+ anos)' },
  { id: 'outra', nome: 'Outra condição específica', laudo: true },
];

export const ATENDIMENTO_RECURSOS: AtendimentoRecurso[] = [
  {
    id: 'libras-int',
    nome: 'Tradutor-intérprete de Libras',
    desc: 'Profissional para tradução simultânea em Língua Brasileira de Sinais.',
  },
  {
    id: 'letra-amp',
    nome: 'Prova com letra ampliada',
    desc: 'Prova impressa com fonte tamanho 18 e figuras ampliadas.',
  },
  {
    id: 'letra-samp',
    nome: 'Prova com letra superampliada',
    desc: 'Prova impressa com fonte tamanho 24 e figuras ampliadas.',
  },
  { id: 'braile', nome: 'Prova em braile', desc: 'Prova impressa em sistema braile.' },
  {
    id: 'videoprova',
    nome: 'Videoprova em Libras',
    desc: 'Versão videogravada da prova em Língua Brasileira de Sinais.',
  },
  {
    id: 'leitor-tel',
    nome: 'Uso de leitor de tela',
    desc: 'Software leitor de tela em prova digital.',
  },
  {
    id: 'guia-int',
    nome: 'Guia-intérprete',
    desc: 'Profissional para candidatos com surdocegueira.',
  },
  {
    id: 'ledor',
    nome: 'Auxílio para leitura (ledor)',
    desc: 'Profissional para leitura da prova.',
  },
  {
    id: 'transcritor',
    nome: 'Auxílio para transcrição (transcritor)',
    desc: 'Profissional para transcrição das respostas.',
  },
  { id: 'leit-lab', nome: 'Leitura labial', desc: 'Aplicador treinado para leitura labial.' },
  {
    id: 'tempo-adic',
    nome: 'Tempo adicional',
    desc: 'Tempo adicional para realização da prova (até 1h conforme regulamento do edital).',
  },
  {
    id: 'sala-ac',
    nome: 'Sala de fácil acesso',
    desc: 'Sala térrea ou com acesso por elevador, sem barreiras arquitetônicas.',
  },
  {
    id: 'calc',
    nome: 'Calculadora',
    desc: 'Uso de calculadora como auxílio para candidato com discalculia.',
  },
  {
    id: 'mesa-br',
    nome: 'Mesa sem braço',
    desc: 'Mobiliário específico: mesa/cadeira sem braço (mobilidade reduzida, deficiência física, lactantes).',
  },
  {
    id: 'apoio-pes',
    nome: 'Apoio para pernas e pés',
    desc: 'Mobiliário específico: apoio para pernas e pés, geralmente combinado com mesa sem braço.',
  },
  {
    id: 'acomp-lac',
    nome: 'Acompanhante para o lactente',
    desc: 'Adulto acompanhante para cuidar da criança durante a prova da lactante.',
    ext: true,
  },
  {
    id: 'sala-ind',
    nome: 'Sala individual ou reduzida',
    desc: 'Sala com poucos candidatos para redução de estímulos (TEA, TDAH).',
    ext: true,
  },
];

export const PCD_TIPOS = [
  'Deficiência física',
  'Deficiência visual — Cegueira',
  'Deficiência visual — Baixa visão',
  'Deficiência auditiva — Surdez severa/profunda',
  'Deficiência auditiva — Surdez parcial',
  'Deficiência intelectual',
  'Deficiência psicossocial',
  'Deficiência múltipla',
  'Transtorno do espectro autista (TEA)',
  'Altas habilidades / Superdotação',
] as const;
