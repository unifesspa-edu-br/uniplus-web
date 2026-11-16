import { DebugElement } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmDialogComponent } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { VagasPassoComponent } from './vagas.component';

const DIALOGO_DA_REMOCAO = 0;
const DIALOGO_DA_TROCA_DE_REGRA = 1;
const DIALOGO_DO_REAPLICAR_ROL = 2;

/** O que o operador faz na tela do passo: clica, digita e escolhe, e a tela reage. */
export class TelaDasVagas {
  constructor(private readonly fixture: ComponentFixture<VagasPassoComponent>) {}

  /** Deixa a tela refletir o que mudou no rascunho. */
  atualizar(): void {
    this.fixture.detectChanges();
  }

  pedirRemocao(ofertaCursoId: string): void {
    this.clicar(this.deLista('button[aria-label^="Remover "]', ofertaCursoId));
  }

  confirmarRemocao(): void {
    this.dialogo(DIALOGO_DA_REMOCAO).triggerEventHandler('confirmed', undefined);
    this.fixture.detectChanges();
  }

  cancelarRemocao(): void {
    this.dialogo(DIALOGO_DA_REMOCAO).triggerEventHandler('cancelled', undefined);
    this.fixture.detectChanges();
  }

  avisoDaRemocao(): string {
    return this.dialogo(DIALOGO_DA_REMOCAO).nativeElement.textContent ?? '';
  }

  alterarVoBase(ofertaCursoId: string, valor: string): void {
    const campo = this.deLista('input[aria-label^="Total de vagas de"]', ofertaCursoId);
    this.digitar(campo as HTMLInputElement, valor);
  }

  escolherRegra(valor: string): void {
    const campo = this.raiz.querySelector<HTMLSelectElement>('select#f-regra');
    if (campo === null) throw new Error('O seletor de regra não está na tela.');
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
    this.fixture.detectChanges();
  }

  confirmarTrocaDeRegra(): void {
    this.dialogo(DIALOGO_DA_TROCA_DE_REGRA).triggerEventHandler('confirmed', undefined);
    this.fixture.detectChanges();
  }

  cancelarTrocaDeRegra(): void {
    this.dialogo(DIALOGO_DA_TROCA_DE_REGRA).triggerEventHandler('cancelled', undefined);
    this.fixture.detectChanges();
  }

  /** A ação de recompor só existe na tela quando a recomposição muda alguma coisa. */
  oferecePorRecomporORol(): boolean {
    return this.botaoComTexto('Recompor pelo rol da regra atual') !== undefined;
  }

  reaplicarRolDaRegra(): void {
    this.clicar(this.botaoComTexto('Recompor pelo rol da regra atual'));
  }

  confirmarReaplicarRol(): void {
    this.dialogo(DIALOGO_DO_REAPLICAR_ROL).triggerEventHandler('confirmed', undefined);
    this.fixture.detectChanges();
  }

  cancelarReaplicarRol(): void {
    this.dialogo(DIALOGO_DO_REAPLICAR_ROL).triggerEventHandler('cancelled', undefined);
    this.fixture.detectChanges();
  }

  aplicarPadraoATodas(): void {
    this.clicar(this.botaoComTexto('Aplicar o padrão a todas as ofertas'));
  }

  alternarModalidade(codigo: string): void {
    const marcador = Array.from(this.raiz.querySelectorAll('.checkbox-grid label.check-item'))
      .find((rotulo) => rotulo.textContent?.trim().startsWith(`${codigo} —`))
      ?.querySelector('input');
    this.clicar(marcador ?? undefined);
  }

  private get raiz(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  private dialogo(indice: number): DebugElement {
    return this.fixture.debugElement.queryAll(By.directive(ConfirmDialogComponent))[indice];
  }

  private botaoComTexto(texto: string): HTMLElement | undefined {
    return Array.from(this.raiz.querySelectorAll<HTMLElement>('button')).find(
      (botao) => botao.textContent?.trim() === texto,
    );
  }

  /** O elemento da linha da oferta: a ordem na tela é a do quadro. */
  private deLista(seletor: string, ofertaCursoId: string): HTMLElement | undefined {
    const ofertas = this.fixture.debugElement.injector.get(ProcessoSeletivoStore).draft()
      .vagas.ofertas;
    const indice = ofertas.findIndex((oferta) => oferta.ofertaCursoId === ofertaCursoId);
    return this.raiz.querySelectorAll<HTMLElement>(seletor)[indice];
  }

  private digitar(campo: HTMLInputElement, valor: string): void {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    this.fixture.detectChanges();
  }

  private clicar(elemento: HTMLElement | undefined): void {
    if (elemento === undefined) throw new Error('O controle não está na tela.');
    elemento.click();
    this.fixture.detectChanges();
  }
}
