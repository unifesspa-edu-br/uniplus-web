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
  readonly mensagem: string;
  /** Com o nome que o candidato prefere e o CPF mascarado — nenhum outro número de documento. */
  readonly candidato: string;
  /** O que a API permite fazer agora; a lista não recalcula. */
  readonly acoes: AcoesDaInscricaoDto;
  /** Só a inscrição que já foi enviada tem comprovante. */
  readonly temComprovante: boolean;
}

function mensagemDa(inscricao: MinhaInscricaoDto): string {
  const numero = inscricao.numeroInscricao
    ? `Inscrição nº ${inscricao.numeroInscricao}`
    : 'Inscrição';
  switch (inscricao.situacao) {
    case SituacaoInscricao.submetida:
      return `${numero}, enviada.`;
    case SituacaoInscricao.cancelada: {
      const quando = formatarDataBr(inscricao.canceladaEm);
      const cancelada = quando ? `${numero}, cancelada em ${quando}.` : `${numero}, cancelada.`;
      return inscricao.motivoDoCancelamento
        ? `${cancelada} Motivo: ${inscricao.motivoDoCancelamento}`
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
    mensagem: mensagemDa(inscricao),
    candidato: `${inscricao.nomePreferido} · CPF ${inscricao.cpfMascarado}`,
    acoes: inscricao.acoes,
    temComprovante: inscricao.situacao !== SituacaoInscricao.rascunho,
  };
}
