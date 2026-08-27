import {
  AtendimentoCondicao,
  AtendimentoRecurso,
  CriterioDesempate,
  Curso,
  DocumentoGrupo,
} from './processo-seletivo.models';

/**
 * Um passo do wizard. `titulo` e `revisao` só são declarados quando diferem do
 * rótulo: o stepper tem largura apertada, o cabeçalho não, e o painel de
 * revisão usa o nome que o operador reconhece na lista de pendências.
 */
interface DefinicaoDePasso {
  readonly rotulo: string;
  readonly titulo?: string;
  readonly revisao?: string;
}

/**
 * Os passos na ordem em que são apresentados. Única fonte da ordem: o número
 * exibido é a posição aqui, e nenhum componente de passo declara a própria.
 */
const DEFINICOES: readonly DefinicaoDePasso[] = [
  { rotulo: 'Tipo do processo', revisao: 'Tipo do processo seletivo' },
  { rotulo: 'Identificação' },
  { rotulo: 'Modalidades' },
  { rotulo: 'Vagas' },
  { rotulo: 'Etapas' },
  { rotulo: 'Fórmula e precisão', revisao: 'Fórmula de classificação' },
  { rotulo: 'Bônus', titulo: 'Bônus (opcional)' },
  { rotulo: 'Desempate', revisao: 'Critérios de desempate' },
  { rotulo: 'Eliminação', revisao: 'Notas mínimas e cláusulas' },
  { rotulo: 'Docs por modalidade', titulo: 'Documentos por modalidade' },
  { rotulo: 'Locais de prova' },
  { rotulo: 'Atend. especial', titulo: 'Atendimento especializado' },
  { rotulo: 'Revisão e publicação' },
];

export const PASSOS = DEFINICOES.map((passo) => ({
  rotulo: passo.rotulo,
  titulo: passo.titulo ?? passo.rotulo,
  revisao: passo.revisao ?? passo.titulo ?? passo.rotulo,
}));

/** Rótulos curtos do stepper lateral. */
export const STEP_LABELS = PASSOS.map((passo) => passo.rotulo);

/** O painel de revisão lista os passos anteriores, não a si mesmo. */
export const REVIEW_NAMES = PASSOS.slice(0, -1).map((passo) => passo.revisao);

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
