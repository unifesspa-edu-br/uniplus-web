import { DocumentoGrupo } from './processo-seletivo.models';

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
  { rotulo: 'Pagamento', titulo: 'Taxa de inscrição e isenção', revisao: 'Taxa de inscrição' },
  { rotulo: 'Vagas' },
  { rotulo: 'Cronograma', titulo: 'Cronograma do certame', revisao: 'Cronograma e etapas' },
  {
    rotulo: 'Config. por fase',
    titulo: 'Configuração por fase',
    revisao: 'Configuração das fases',
  },
  { rotulo: 'Fórmula e precisão', revisao: 'Fórmula de classificação' },
  { rotulo: 'Bônus', titulo: 'Bônus (opcional)' },
  { rotulo: 'Desempate', revisao: 'Critérios de desempate' },
  { rotulo: 'Eliminação', revisao: 'Regras de eliminação' },
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

/**
 * Exceção nomeada e temporária ao banimento de catálogo local (`#511`): os
 * grupos e a lista de documentos abaixo pertencem à `#483` — a fonte correta
 * é `TiposDocumentoApi`, e os grupos visuais podem ser derivados dela, não
 * outro catálogo. Enquanto a `#483` não migra os consumidores, este export
 * fica de fora do gate de vocabulário institucional (ver `__fitness__`).
 */
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

