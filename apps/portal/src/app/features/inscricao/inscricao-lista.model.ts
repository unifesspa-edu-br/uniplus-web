import { SituacaoInscricao } from '@uniplus/shared-data/selecao';

import type { InscricaoDaLista } from './minhas-inscricoes.service';

/** Uma inscrição como a lista a mostra. */
export interface ItemDaLista {
  readonly id: string;
  readonly editalLabel: string;
  readonly situacao: SituacaoInscricao;
  readonly nome: string;
  readonly mensagem: string;
  /** Com o nome que o candidato prefere e o CPF mascarado — nenhum outro número de documento. */
  readonly candidato: string;
  readonly mensagemPrazo: string;
}

export function itemDaLista(inscricao: InscricaoDaLista): ItemDaLista {
  const processo = inscricao.processo;
  return {
    id: inscricao.processoSeletivoId,
    editalLabel: processo?.identificadorLegivel ?? '',
    situacao: inscricao.situacao,
    nome: processo?.nome ?? 'Processo seletivo',
    mensagem:
      inscricao.situacao === SituacaoInscricao.submetida && inscricao.numeroInscricao
        ? `Inscrição nº ${inscricao.numeroInscricao}, enviada.`
        : 'Sua inscrição está em rascunho. Conclua e envie dentro do prazo.',
    candidato: `${inscricao.nomePreferido} · CPF ${inscricao.cpfMascarado}`,
    mensagemPrazo: processo ? `Inscrições até ${dataBr(processo.periodo.fim)}` : '',
  };
}

/** A data do fim do período no fuso de quem lê. */
function dataBr(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
