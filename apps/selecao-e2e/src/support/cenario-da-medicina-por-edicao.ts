import type { RegraDeHomologacaoDto } from '@uniplus/shared-data/selecao';
import { comTiposDeDecisaoNaFase } from '../fixtures/cronograma-do-servidor';
import {
  IGUAL,
  novoServidorDaRegraDeHomologacao,
  type ServidorDaRegraDeHomologacao,
} from './api-da-regra-de-homologacao';

export const EDICOES_DA_MEDICINA = ['2024', '2025', '2026'] as const;
export const CODIGO_DO_MOTIVO = 'SEM_RESULTADO_INEP';
export const DESCRICAO_DO_MOTIVO = 'Sem resultado no retorno do INEP.';

const TIPO = { codigo: 'HOMOLOGACAO_DAS_INSCRICOES', rotulo: 'Homologação das inscrições' };
const SENTIDO = { codigo: 'DESFAVORAVEL', rotulo: 'Desfavorável' };
const ID_DO_MOTIVO = '01a0d640-0000-7000-8000-0000000000b1';

/** O motivo no cadastro, como a API o lista. */
const MOTIVO_NO_CADASTRO = {
  id: ID_DO_MOTIVO,
  tipo: TIPO,
  codigo: CODIGO_DO_MOTIVO,
  descricao: DESCRICAO_DO_MOTIVO,
  subclassificacao: null,
  sentido: SENTIDO,
  ativo: true,
};

/** O motivo que a fase escolheu, como a leitura dos motivos do processo o devolve. */
function motivoEscolhidoPelaFase(faseCanonicaOrigemId: string) {
  return {
    motivoDeDecisaoId: ID_DO_MOTIVO,
    lugar: { faseCanonicaOrigemId, etapaId: null },
    tipo: TIPO,
    codigo: CODIGO_DO_MOTIVO,
    descricao: DESCRICAO_DO_MOTIVO,
    subclassificacao: null,
    sentido: SENTIDO,
    vigencia: { versaoDoEditalDeEntrada: 1, versaoDoEditalDeSaida: null },
    justificativaDaInclusao: null,
  };
}

/**
 * A regra da Medicina como a API a devolve: uma alternativa por edição, cada uma com a condição do
 * retorno do INEP daquela edição e o enquadramento da edição do exame na inscrição.
 */
export const REGRA_DA_MEDICINA: RegraDeHomologacaoDto = {
  resultadoAtoCodigo: 'RESULTADO_FINAL',
  alternativas: EDICOES_DA_MEDICINA.map((ano) => ({
    condicoes: [
      {
        tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
        edicaoDoExame: Number(ano),
        motivoDesfavoravelCodigo: CODIGO_DO_MOTIVO,
        enquadramento: [
          [
            {
              fato: 'EDICAO_ENEM',
              operador: IGUAL,
              valor: ano,
            },
          ],
        ],
      },
    ],
  })),
};

/**
 * O processo em rascunho cuja fase declara a decisão de homologar, com as três edições da Medicina
 * declaradas na Fórmula e o motivo que a fase escolheu, com ou sem a regra já gravada.
 */
export function novoServidorDaMedicina(
  regra: RegraDeHomologacaoDto | null,
): ServidorDaRegraDeHomologacao {
  const servidor = novoServidorDaRegraDeHomologacao();
  const { fase } = servidor;
  const comTipo = comTiposDeDecisaoNaFase(fase, ['HOMOLOGACAO_DAS_INSCRICOES']);
  servidor.fase = {
    ...comTipo,
    publicacoes: { ...comTipo.publicacoes, regraDeHomologacao: regra },
  };
  servidor.edicoesDoEnem = EDICOES_DA_MEDICINA;
  servidor.motivos.cadastro = [MOTIVO_NO_CADASTRO];
  servidor.motivos.escolhidos = [motivoEscolhidoPelaFase(fase.faseCanonica.origemId)];
  return servidor;
}
