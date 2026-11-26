import { runInInjectionContext } from '@angular/core';
import { By } from '@angular/platform-browser';
import { baseLegalNova } from '@uniplus/shared-utils';
import { afterEach, beforeEach } from 'vitest';

import type { BaseLegalConfig } from '../../processo-seletivo.models';

import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { EditorDaExigenciaComponent } from './documentos/editor-da-exigencia.component';
import { EixoEtapaComponent } from './documentos/eixos/eixo-etapa.component';
import { EixoFormularioComponent } from './documentos/eixos/eixo-formulario.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './documentos/gatilho-das-exigencias.store';
import { responderALeituraDosMotivos } from './motivos/motivos-nos-passos.testing';
import { ID_CPF, montarFase, type FaseMontada } from './fase.testing';
import { BancasDaFaseComponent } from './secoes/bancas-da-fase.component';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';

export const ID_RG = '01960000-0000-7000-0000-0000000000f2';

export function identificadorDaRegra(exigencias: ExigenciasDaFaseStore, tipo: string): string {
  const declaracao = exigencias
    .declaracoesDaFase()
    .find((item) => item.documento.tipoDocumentoId === tipo);
  if (!declaracao) throw new Error(`Declaração não encontrada para ${tipo}`);
  return declaracao.identificadorNoRascunho;
}

/** Uma norma como a recém-declarada, com o que o cenário precisa diferente. */
export function umaNorma(parcial: Partial<BaseLegalConfig> = {}): BaseLegalConfig {
  return { ...baseLegalNova(), ...parcial };
}

/**
 * O passo da fase montado, e o que os cenários consultam e conduzem nele. Os campos são funções de
 * seta ou valores prontos para serem desestruturados no `beforeEach` do cenário.
 */
export class ContextoDaFase {
  readonly componente: FaseMontada['componente'];
  readonly store: FaseMontada['store'];
  readonly controller: FaseMontada['controller'];
  readonly detectar: FaseMontada['detectar'];
  readonly nativo: FaseMontada['nativo'];
  readonly elementoDaTela: FaseMontada['elementoDaTela'];
  readonly atenderCatalogos: FaseMontada['atenderCatalogos'];
  readonly comCronograma: FaseMontada['comCronograma'];
  readonly selecionado: FaseMontada['selecionado'];
  readonly abrirFase: FaseMontada['abrirFase'];

  constructor(montada: FaseMontada) {
    ({
      componente: this.componente,
      store: this.store,
      controller: this.controller,
      detectar: this.detectar,
      nativo: this.nativo,
      elementoDaTela: this.elementoDaTela,
      atenderCatalogos: this.atenderCatalogos,
      comCronograma: this.comCronograma,
      selecionado: this.selecionado,
      abrirFase: this.abrirFase,
    } = montada);
  }

  readonly exigencias = () => this.elementoDaTela.injector.get(ExigenciasDaFaseStore);
  readonly gatilho = () => this.elementoDaTela.injector.get(GatilhoDasExigenciasStore);
  /** As escritas do editor e dos eixos não dependem de a linha estar aberta na tela. */
  readonly noPasso = <T>(classe: new () => T): T =>
    runInInjectionContext(this.elementoDaTela.injector, () => new classe());
  readonly editor = () => this.noPasso(EditorDaExigenciaComponent);
  readonly eixoEtapa = () => this.noPasso(EixoEtapaComponent);
  readonly eixoFormulario = () => this.noPasso(EixoFormularioComponent);
  readonly documentos = () =>
    this.elementoDaTela.query(By.directive(DocumentosDaFaseComponent))
      .componentInstance as DocumentosDaFaseComponent;
  readonly bancas = () =>
    this.elementoDaTela.query(By.directive(BancasDaFaseComponent))
      .componentInstance as BancasDaFaseComponent;
  readonly publicacoes = () =>
    this.elementoDaTela.query(By.directive(PublicacoesDaFaseComponent))
      .componentInstance as PublicacoesDaFaseComponent;

  readonly linhas = () => Array.from(this.nativo.querySelectorAll('.doc-conferencia__linha'));
  readonly celula = (linha: Element, rotulo: string) =>
    linha.querySelector(`td[data-label="${rotulo}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  readonly botaoDeEdicao = () =>
    this.nativo.querySelector<HTMLButtonElement>('.doc-conferencia__alternar');
  readonly campoDeEntrega = () =>
    this.nativo.querySelector(
      `#fase-AVALIACAO-doc-obrigatorio-${identificadorDaRegra(this.exigencias(), ID_CPF)}`,
    );
}

/**
 * Registra, no `describe` que a chama, a montagem do passo antes de cada caso e a conferência de
 * que nenhuma requisição ficou sem resposta depois dele. `aoMontar` recebe o passo montado.
 */
export function usarFase(aoMontar: (contexto: ContextoDaFase) => void): void {
  let atual: ContextoDaFase;
  beforeEach(async () => {
    atual = new ContextoDaFase(await montarFase());
    aoMontar(atual);
  });
  afterEach(() => {
    atual.controller
      .match((pedido) => pedido.url.includes('/vocabularios/'))
      .forEach((requisicao) => requisicao.flush([]));
    responderALeituraDosMotivos(atual.controller);
    atual.controller.verify();
  });
}
