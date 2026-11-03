import type { FormGroup } from '@angular/forms';

import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import { escalaVale } from '../../shared/itens-de-avaliacao';
import type { EtapaForm } from './cronograma-form';
import {
  declaraNotaDoEnem,
  declaraNotaMaxima,
  type TipoDeEtapaDoCatalogo,
} from './regras-da-etapa';

/** Os tipos de etapa do cadastro, pelo id: é por eles que a tela sabe o que a etapa declara. */
export type TiposDeEtapa = ReadonlyMap<string, TipoDeEtapaDoCatalogo>;

/** A nota da etapa vem do ENEM do candidato — é calculada, não lançada por banca. */
export function etapaDeNotaDoEnem(grupo: FormGroup<EtapaForm>, tipos: TiposDeEtapa): boolean {
  const etapa = grupo.getRawValue();
  return declaraNotaDoEnem(etapa, tipos.get(etapa.tipoEtapaOrigemId));
}

/**
 * A etapa tem nota lançada por banca: compõe a média ou corta por nota mínima. A etapa sem
 * nota (apto/inapto) e a do ENEM, cuja escala vem do INEP, não declaram nota máxima.
 */
export function etapaDeclaraNotaMaxima(grupo: FormGroup<EtapaForm>, tipos: TiposDeEtapa): boolean {
  const etapa = grupo.getRawValue();
  return declaraNotaMaxima(etapa, tipos.get(etapa.tipoEtapaOrigemId));
}

/** A etapa é avaliada por banca: só nela cabem a regra de consolidação e o passo do lançamento. */
export function etapaEhDeAvaliacaoHumana(
  grupo: FormGroup<EtapaForm>,
  tipos: TiposDeEtapa,
): boolean {
  return (
    etapaDeclaraNotaMaxima(grupo, tipos) && grupo.controls.formaDeAvaliacao.value === FORMA_HUMANA
  );
}

/** Com escala a banca escolhe o nível em vez de digitar a nota, então a etapa não tem passo. */
export function etapaUsaEscalaDeAtendimento(
  grupo: FormGroup<EtapaForm>,
  tipos: TiposDeEtapa,
): boolean {
  return etapaEhDeAvaliacaoHumana(grupo, tipos) && escalaVale(grupo.getRawValue());
}
