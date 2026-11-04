import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';

import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { WizardDraft } from '../../processo-seletivo.models';
import { itensDoAto, rotuloDoTipoDeAto } from './itens-do-ato';
import { janelaDaInscricao, temFaseDeColetaInscricao } from './periodo-de-inscricao';

function periodoDeInscricao(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): string {
  if (temFaseDeColetaInscricao(draft, fasePorId)) {
    return `janela da fase ${janelaDaInscricao(draft, fasePorId)?.nome ?? ''} do cronograma`;
  }
  const { periodoInscricaoInicio, periodoInscricaoFim } = draft.publicacao;
  return `${periodoInscricaoInicio} até ${periodoInscricaoFim}`;
}

/** O resumo que o operador confirma antes de publicar, que não se desfaz nesta jornada. */
export function confirmacaoDaPublicacao(
  draft: WizardDraft,
  tiposDeAto: readonly Pick<TipoAtoPublicadoDto, 'codigo' | 'nome'>[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): ConfirmacaoDeGravacao {
  const { numero, ato } = draft.publicacao;
  return {
    titulo: 'Confirmar a publicação do processo seletivo',
    aviso:
      'Depois de publicado, este processo vira somente leitura nesta jornada — não é possível desfazer aqui.',
    rotuloDeConfirmar: 'Publicar processo',
    itens: [
      ...itensDoAto({ numero, ...ato, tipo: rotuloDoTipoDeAto(tiposDeAto, ato.tipoAtoCodigo) }),
      { rotulo: 'Período de inscrição', valor: periodoDeInscricao(draft, fasePorId) },
    ],
  };
}
