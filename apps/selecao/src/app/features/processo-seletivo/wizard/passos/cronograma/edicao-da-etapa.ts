import type { FormGroup } from '@angular/forms';

import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import {
  etapaDeclaraNotaMaxima,
  etapaDeNotaDoEnem,
  type TiposDeEtapa,
} from './declaracoes-da-etapa';
import type { CaraterEscolhido, EtapaForm } from './cronograma-form';
import { eliminaPorCarater, pontuaPorCarater } from './regras-da-etapa';

/**
 * Banca, publicação, janela própria e recurso contado de publicação somem da tela da
 * etapa de nota do ENEM. Ficar com o que já estava declarado seria mandar ao servidor, a
 * cada gravação, o que ninguém vê e ele recusa.
 */
function descartarOQueANotaDoEnemNaoTem(grupo: FormGroup<EtapaForm>): void {
  grupo.controls.bancas.setValue([]);
  descartarEscalaEAvaliacao(grupo);
  grupo.controls.produtos.setValue([]);
  grupo.controls.inicio.setValue('');
  grupo.controls.fim.setValue('');
  grupo.controls.recursos.setValue(
    grupo.controls.recursos.value.filter((recurso) => recurso.ancora === 'cienciaIndividual'),
  );
}

function descartarEscalaEAvaliacao(grupo: FormGroup<EtapaForm>): void {
  grupo.controls.notaMaxima.setValue('');
  grupo.controls.formaDeAvaliacao.setValue('');
  grupo.controls.itensDeAvaliacao.setValue([]);
  grupo.controls.escalaDeAtendimento.setValue([]);
  descartarRegraEPasso(grupo);
}

/** A regra de consolidação e o passo só existem onde mais de um avaliador lança a nota. */
function descartarRegraEPasso(grupo: FormGroup<EtapaForm>): void {
  grupo.controls.regraConsolidacaoCodigo.setValue('');
  grupo.controls.regraConsolidacaoVersao.setValue('');
  grupo.controls.passoDoLancamento.setValue('');
}

/**
 * Troca o tipo da etapa. Não mexe no caráter de propósito: se o tipo novo não o admitir, ele
 * permanece visível e marcado pelos caracteres admitidos, e a recusa vem na gravação com o
 * motivo. O que some da tela com o tipo novo, esse sim é descartado, porque não fica visível
 * para ser corrigido.
 */
export function trocarTipoDaEtapa(
  grupo: FormGroup<EtapaForm>,
  tipoEtapaOrigemId: string,
  tipos: TiposDeEtapa,
): void {
  grupo.controls.tipoEtapaOrigemId.setValue(tipoEtapaOrigemId);
  if (etapaDeNotaDoEnem(grupo, tipos)) descartarOQueANotaDoEnemNaoTem(grupo);
}

/**
 * Trocar a forma apaga a regra e o passo que ela não admite: o servidor os recusa fora da
 * forma humana, e o que a tela esconde não pode seguir no rascunho.
 */
export function trocarFormaDeAvaliacao(grupo: FormGroup<EtapaForm>, forma: string): void {
  grupo.controls.formaDeAvaliacao.setValue(forma);
  grupo.controls.formaDeAvaliacao.markAsDirty();
  if (forma !== FORMA_HUMANA) {
    descartarRegraEPasso(grupo);
    grupo.controls.escalaDeAtendimento.setValue([]);
  }
}

/** A regra vai e volta como par código e versão: gravar um com a versão do outro é recusado. */
export function trocarRegraDeConsolidacao(
  grupo: FormGroup<EtapaForm>,
  codigo: string,
  versao: string,
): void {
  grupo.controls.regraConsolidacaoCodigo.setValue(codigo);
  grupo.controls.regraConsolidacaoVersao.setValue(versao);
  grupo.controls.regraConsolidacaoCodigo.markAsDirty();
}

/**
 * Troca o caráter e apaga o que deixou de valer.
 *
 * Sem isto, quem declara peso 3 e depois muda para eliminatória fica com o 3 gravado e
 * invisível: o campo some da tela, o valor continua no rascunho e vai para o servidor a
 * cada gravação, sem que nada o use.
 */
export function trocarCaraterDaEtapa(
  grupo: FormGroup<EtapaForm>,
  carater: string,
  tipos: TiposDeEtapa,
): void {
  grupo.controls.carater.setValue(carater as CaraterEscolhido);
  if (!pontuaPorCarater(carater)) grupo.controls.peso.setValue('');
  if (!eliminaPorCarater(carater)) grupo.controls.notaMinima.setValue('');
  if (!etapaDeclaraNotaMaxima(grupo, tipos)) descartarEscalaEAvaliacao(grupo);
}
