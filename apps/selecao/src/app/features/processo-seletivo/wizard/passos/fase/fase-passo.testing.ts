import { runInInjectionContext } from '@angular/core';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach } from 'vitest';

import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { EditorDaExigenciaComponent } from './documentos/editor-da-exigencia.component';
import { EixoEtapaComponent } from './documentos/eixos/eixo-etapa.component';
import { EixoFormularioComponent } from './documentos/eixos/eixo-formulario.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './documentos/gatilho-das-exigencias.store';
import { ID_CPF, montarFase, type FaseMontada } from './fase.testing';
import { BancasDaFaseComponent } from './secoes/bancas-da-fase.component';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';

export const ID_RG = '01960000-0000-7000-0000-0000000000f2';

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
  readonly raiz: FaseMontada['raiz'];
  readonly atenderCatalogos: FaseMontada['atenderCatalogos'];
  readonly comCronograma: FaseMontada['comCronograma'];
  readonly selecionado: FaseMontada['selecionado'];

  constructor(montada: FaseMontada) {
    ({
      componente: this.componente,
      store: this.store,
      controller: this.controller,
      detectar: this.detectar,
      nativo: this.nativo,
      raiz: this.raiz,
      atenderCatalogos: this.atenderCatalogos,
      comCronograma: this.comCronograma,
      selecionado: this.selecionado,
    } = montada);
  }

  readonly exigencias = () => this.raiz.injector.get(ExigenciasDaFaseStore);
  readonly gatilho = () => this.raiz.injector.get(GatilhoDasExigenciasStore);
  /** As escritas do editor e dos eixos não dependem de a linha estar aberta na tela. */
  readonly noPasso = <T>(classe: new () => T): T =>
    runInInjectionContext(this.raiz.injector, () => new classe());
  readonly editor = () => this.noPasso(EditorDaExigenciaComponent);
  readonly eixoEtapa = () => this.noPasso(EixoEtapaComponent);
  readonly eixoFormulario = () => this.noPasso(EixoFormularioComponent);
  readonly documentos = () =>
    this.raiz.query(By.directive(DocumentosDaFaseComponent))
      .componentInstance as DocumentosDaFaseComponent;
  readonly bancas = () =>
    this.raiz.query(By.directive(BancasDaFaseComponent)).componentInstance as BancasDaFaseComponent;
  readonly publicacoes = () =>
    this.raiz.query(By.directive(PublicacoesDaFaseComponent))
      .componentInstance as PublicacoesDaFaseComponent;

  readonly linhas = () => Array.from(this.nativo.querySelectorAll('.doc-conferencia__linha'));
  readonly celula = (linha: Element, rotulo: string) =>
    linha.querySelector(`td[data-label="${rotulo}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  readonly botaoDeEdicao = () =>
    this.nativo.querySelector<HTMLButtonElement>('.doc-conferencia__alternar');
  readonly campoDeEntrega = () =>
    this.nativo.querySelector(`#fase-AVALIACAO-doc-obrigatorio-${ID_CPF}`);
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
  afterEach(() => atual.controller.verify());
}
