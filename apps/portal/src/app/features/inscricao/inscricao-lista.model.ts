import {
  type AcoesDaInscricaoDto,
  type MinhaInscricaoDto,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import { formatarDataBr } from '@uniplus/shared-utils';

/** Uma inscrição como a lista a mostra. */
export interface ItemDaLista {
  /** A chave da lista: o mesmo processo pode ter uma inscrição cancelada e outra nova. */
  readonly id: string;
  readonly processoId: string;
  readonly situacao: SituacaoInscricao;
  readonly nome: string;
  /** Só a inscrição enviada ou cancelada tem número. */
  readonly numero: string | null;
  /** O que a situação não diz sozinha: o prazo do rascunho, a data e o motivo do cancelamento. */
  readonly mensagem: string | null;
  /** Os cursos escolhidos, em ordem; vazio enquanto o rascunho não escolheu nenhum. */
  readonly cursos: readonly CursoDaInscricao[];
  /** O que a API permite fazer agora; a lista não recalcula. */
  readonly acoes: AcoesDaInscricaoDto;
  /** Só a inscrição que já foi enviada tem comprovante. */
  readonly temComprovante: boolean;
}

/** Um curso escolhido: a ordem da opção e o nome com o grau. */
export interface CursoDaInscricao {
  readonly ordem: number;
  readonly nome: string;
}

function mensagemDa(inscricao: MinhaInscricaoDto): string | null {
  switch (inscricao.situacao) {
    case SituacaoInscricao.submetida:
      return null;
    case SituacaoInscricao.cancelada: {
      const quando = formatarDataBr(inscricao.canceladaEm);
      const cancelada = quando ? `Cancelada em ${quando}.` : null;
      return inscricao.motivoDoCancelamento
        ? [cancelada, `Motivo: ${inscricao.motivoDoCancelamento}`].filter(Boolean).join(' ')
        : cancelada;
    }
    default:
      return 'Sua inscrição está em rascunho. Conclua e envie dentro do prazo.';
  }
}

export function itemDaLista(inscricao: MinhaInscricaoDto): ItemDaLista {
  return {
    id: inscricao.inscricaoId,
    processoId: inscricao.processoSeletivoId,
    situacao: inscricao.situacao,
    nome: inscricao.nomeDoProcesso ?? 'Processo seletivo',
    numero: inscricao.numeroInscricao,
    mensagem: mensagemDa(inscricao),
    cursos: inscricao.opcoesDeCurso.map((o) => ({
      ordem: Number(o.ordem),
      nome: `${o.cursoNome} (${o.cursoGrau})`,
    })),
    acoes: inscricao.acoes,
    temComprovante: inscricao.situacao !== SituacaoInscricao.rascunho,
  };
}
