import { campoColetado } from '../campo-coletado';
import type { FormularioDto } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

/**
 * As perguntas que as regras das modalidades ofertadas citam, no formulário de inscrição, com as
 * que a derivação do egresso e a opção pelas cotas da lei pedem: sem elas a publicação recusa a
 * regra. Todas aparecem sempre; o processo real as exibe conforme as respostas anteriores.
 */
export const CAMPOS_DAS_MODALIDADES_DA_MEDICINA = [
  campoColetado({
    fatoCodigo: 'FORMA_CONCLUSAO_EM',
    ordem: 0,
    rotulo: 'Como você concluiu o ensino médio?',
    tipoDeCampo: 'ESCOLHA_UNICA',
  }),
  campoColetado({
    fatoCodigo: 'ONDE_CURSOU_EM',
    ordem: 1,
    rotulo: 'Onde você cursou o ensino médio?',
    tipoDeCampo: 'ESCOLHA_UNICA',
    ajuda:
      'A resposta define se você pode concorrer às vagas para quem cursou o ensino médio em escola pública.',
    restricoes: [
      {
        tipo: 'OPCOES_PERMITIDAS',
        minimo: null,
        maximo: null,
        entradas: [
          {
            quando: null,
            valores: [
              'COMUNITARIA_CAMPO',
              'EXTERIOR',
              'MAIS_DE_UM_FORA_DA_REDE',
              'PRIVADA',
              'PRIVADA_BOLSA_INTEGRAL',
              'PRIVADA_BOLSA_PARCIAL',
              'PUBLICA_E_COMUNITARIA',
              'PUBLICA_E_FORA_DA_REDE',
              'PUBLICA_E_PRIVADA_BOLSA_INTEGRAL',
              'SISTEMA_S',
              'SOMENTE_PUBLICA',
            ],
          },
          {
            quando: [
              [
                {
                  fato: 'FORMA_CONCLUSAO_EM',
                  operador: 'ALGUM_DE',
                  valor: ['ENCCEJA', 'PROFICIENCIA', 'ENEM'],
                },
              ],
            ],
            valores: ['CERTIFICACAO'],
          },
        ],
        fatos: null,
        dataMinima: null,
        dataMaxima: null,
      },
    ],
  }),
  campoColetado({
    fatoCodigo: 'CONCORRER_PCD',
    ordem: 2,
    rotulo: 'Deseja concorrer às vagas para pessoas com deficiência?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'CONCORRER_EP',
    ordem: 3,
    rotulo: 'Deseja concorrer às vagas para quem cursou o ensino médio em escola pública?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'CONCORRER_PPI',
    ordem: 4,
    rotulo: 'Deseja concorrer às vagas para pretos, pardos e indígenas?',
    tipoDeCampo: 'SIM_OU_NAO',
    ajuda: 'Para quem se autodeclara preto, pardo ou indígena.',
  }),
  campoColetado({
    fatoCodigo: 'CONCORRER_Q',
    ordem: 5,
    rotulo: 'Deseja concorrer às vagas para quilombolas?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'CONCORRER_RENDA',
    ordem: 6,
    rotulo: 'Deseja concorrer às vagas com critério de renda?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'PCD',
    ordem: 7,
    rotulo: 'Você é pessoa com deficiência?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'INDIGENA',
    ordem: 8,
    rotulo: 'Você pertence a um povo indígena?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'QUILOMBOLA',
    ordem: 9,
    rotulo: 'Você se autodeclara quilombola?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
  campoColetado({
    fatoCodigo: 'BAIXA_RENDA',
    ordem: 10,
    rotulo: 'Sua renda familiar bruta mensal por pessoa é de até um salário mínimo?',
    tipoDeCampo: 'SIM_OU_NAO',
  }),
];

/** O formulário de inscrição com as perguntas que as regras das modalidades fazem. */
export const FORMULARIO_DAS_MODALIDADES_DA_MEDICINA = {
  codigo: 'INSCRICAO',
  faseId: null,
  obrigatorio: true,
  consequenciaDaFaltaDeEnvio: null,
  titulo: null,
  modeloOrigem: null,
  paginas: [
    {
      codigo: 'SECAO_1',
      ordem: 0,
      tipo: 'SECAO',
      bloco: null,
      apresentacao: { titulo: 'Reserva de vagas', descricao: null, aviso: null },
      exibicao: null,
    },
    {
      codigo: 'REVISAO_E_ACEITE',
      ordem: 1,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
      exibicao: null,
    },
  ],
  coleta: { itens: CAMPOS_DAS_MODALIDADES_DA_MEDICINA, grupos: [] },
  termos: [],
} as const satisfies JsonDaApi<FormularioDto>;
