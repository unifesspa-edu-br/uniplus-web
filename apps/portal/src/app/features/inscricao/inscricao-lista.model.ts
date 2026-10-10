import { type MinhaInscricaoDto, SituacaoInscricao } from '@uniplus/shared-data/selecao';

/** Uma inscrição como a lista a mostra. */
export interface ItemDaLista {
  readonly id: string;
  readonly situacao: SituacaoInscricao;
  readonly nome: string;
  readonly mensagem: string;
  /** Com o nome que o candidato prefere e o CPF mascarado — nenhum outro número de documento. */
  readonly candidato: string;
}

export function itemDaLista(inscricao: MinhaInscricaoDto): ItemDaLista {
  return {
    id: inscricao.processoSeletivoId,
    situacao: inscricao.situacao,
    nome: inscricao.nomeDoProcesso ?? 'Processo seletivo',
    mensagem:
      inscricao.situacao === SituacaoInscricao.submetida && inscricao.numeroInscricao
        ? `Inscrição nº ${inscricao.numeroInscricao}, enviada.`
        : 'Sua inscrição está em rascunho. Conclua e envie dentro do prazo.',
    candidato: `${inscricao.nomePreferido} · CPF ${inscricao.cpfMascarado}`,
  };
}
