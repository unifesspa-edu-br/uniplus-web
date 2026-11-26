import {
  type AcoesDaInscricaoDto,
  type MinhaInscricaoDto,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';
import { formatarDataBr } from '@uniplus/shared-utils';

/** Uma inscrição como a lista a mostra. */
export interface ItemDaLista {
  /** A chave da lista: o mesmo processo pode ter uma inscrição cancelada e outra nova. */
  readonly id: string;
  readonly processoId: string;
  readonly situacao: MinhaInscricaoDto['situacao'];
  /** O rótulo que o cartão mostra: o da API, ou "Não enviada" para o rascunho que a API não deixa mais continuar. */
  readonly rotuloDaSituacao: string;
  /** O rascunho que a API não permite mais continuar; ela não informa o motivo. */
  readonly naoEnviada: boolean;
  readonly nome: string;
  /** Só a inscrição enviada ou cancelada tem número. */
  readonly numero: string | null;
  /** O que a situação não diz sozinha: o prazo do rascunho, a data e o motivo do cancelamento. */
  readonly mensagem: string | null;
  /** Os cursos escolhidos, em ordem; vazio enquanto o rascunho não escolheu nenhum. */
  readonly cursos: readonly CursoDaInscricao[];
  /** O que a API permite fazer agora; a lista não recalcula. */
  readonly acoes: AcoesDaInscricaoDto;
  /** O número do comprovante que vale, para abri-lo; a API o deixa nulo quando não há comprovante a emitir. */
  readonly numeroDoComprovante: number | null;
}

/** Um curso escolhido: a ordem da opção e o nome com o grau. */
export interface CursoDaInscricao {
  readonly ordem: number;
  readonly nome: string;
}

export const ROTULO_NAO_ENVIADA = 'Não enviada';

export const MENSAGEM_NAO_ENVIADA = 'Este rascunho não pode mais ser continuado.';

/** A API não informa por que o rascunho não pode ser continuado; a tela só reflete a permissão negada. */
function ficouSemEnvio(inscricao: MinhaInscricaoDto): boolean {
  return (
    inscricao.situacao.codigo === SituacaoInscricaoCodigo.RASCUNHO && !inscricao.acoes.podeContinuar
  );
}

function mensagemDoCancelamento(inscricao: MinhaInscricaoDto): string | null {
  const quando = formatarDataBr(inscricao.canceladaEm);
  const cancelada = quando ? `Cancelada em ${quando}.` : null;
  return inscricao.motivoDoCancelamento
    ? [cancelada, `Motivo: ${inscricao.motivoDoCancelamento}`].filter(Boolean).join(' ')
    : cancelada;
}

function mensagemDa(inscricao: MinhaInscricaoDto): string | null {
  if (ficouSemEnvio(inscricao)) return MENSAGEM_NAO_ENVIADA;
  switch (inscricao.situacao.codigo) {
    case SituacaoInscricaoCodigo.ENVIADA:
      return null;
    case SituacaoInscricaoCodigo.CANCELADA:
      return mensagemDoCancelamento(inscricao);
    default:
      return 'Sua inscrição está em rascunho. Conclua e envie dentro do prazo.';
  }
}

function cursoDaInscricao(opcao: MinhaInscricaoDto['opcoesDeCurso'][number]): CursoDaInscricao {
  return { ordem: opcao.ordem, nome: `${opcao.cursoNome} (${opcao.cursoGrau})` };
}

function situacaoDoItem(
  inscricao: MinhaInscricaoDto,
): Pick<ItemDaLista, 'situacao' | 'rotuloDaSituacao' | 'naoEnviada'> {
  const naoEnviada = ficouSemEnvio(inscricao);
  const rotuloDaSituacao = naoEnviada ? ROTULO_NAO_ENVIADA : inscricao.situacao.rotulo;
  return { situacao: inscricao.situacao, rotuloDaSituacao, naoEnviada };
}

export function itemDaLista(inscricao: MinhaInscricaoDto): ItemDaLista {
  return {
    id: inscricao.inscricaoId,
    processoId: inscricao.processoSeletivoId,
    ...situacaoDoItem(inscricao),
    nome: inscricao.nomeDoProcesso ?? 'Processo seletivo',
    numero: inscricao.numeroInscricao,
    mensagem: mensagemDa(inscricao),
    cursos: inscricao.opcoesDeCurso.map(cursoDaInscricao),
    acoes: inscricao.acoes,
    numeroDoComprovante: inscricao.numeroDoUltimoComprovante,
  };
}
