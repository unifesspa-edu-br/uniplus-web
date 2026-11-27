import { DefinirFadaRequest } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../../processo-seletivo.models';
import { decimalNaForma } from '../../shared/numero-do-campo';

/** Texto vazio vira `null` — a forma de "não informado" no comando. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

function baseLegalDe(id: string): DefinirFadaRequest['baseLegal'] {
  const limpo = naoVazio(id);
  return limpo === null ? null : { id: limpo };
}

/**
 * Converte o rascunho de FADA no `DefinirFadaRequest`. A declaração é obrigatória: só
 * se grava depois de o operador responder se o processo aplica o Fator de Atenuação. `aplica === false` grava
 * a declaração com os campos `null` — o servidor recusa qualquer campo do FADA nesse caso.
 * Nenhum default é inventado quando aplica.
 */
export function comoComandoDoFada(fada: WizardDraft['fada']): DefinirFadaRequest {
  if (fada.aplica === null) {
    throw new Error('A declaração do Fator de Atenuação precisa ser respondida antes de gravar.');
  }
  return fada.aplica ? fadaAplicado(fada) : FADA_NAO_APLICADO;
}

const FADA_NAO_APLICADO: DefinirFadaRequest = {
  aplica: false,
  regra: null,
  fator: null,
  teto: null,
  baseLegal: null,
  fatoElegibilidadeCodigo: null,
};

function fadaAplicado(fada: WizardDraft['fada']): DefinirFadaRequest {
  return {
    aplica: true,
    regra: { codigo: naoVazio(fada.regraCodigo), versao: naoVazio(fada.regraVersao) },
    fator: decimalNaForma(fada.fator),
    teto: naoVazio(fada.teto) === null ? null : decimalNaForma(fada.teto),
    baseLegal: baseLegalDe(fada.baseLegalDoFadaId),
    fatoElegibilidadeCodigo: naoVazio(fada.fatoElegibilidadeCodigo),
  };
}
