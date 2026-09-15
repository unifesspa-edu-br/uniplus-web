import { Directive, DestroyRef, ElementRef, inject } from '@angular/core';
import { BackToTopScrollService } from './back-to-top.service';

/**
 * Contrato explícito para páginas cujo conteúdo principal rola num contêiner
 * interno em vez de `main.page` (CA-08). Enquanto a diretiva está montada, o
 * botão global "Voltar ao topo" do shell observa o elemento hospedeiro e volta
 * a esse elemento ao ser acionado; quando a rota é trocada e a diretiva é
 * destruída, o botão retoma `main.page` (CA-10) e o listener é liberado (CA-17).
 *
 * O contêiner deve ser focável (`tabindex="-1"`), como `main.page`: acionar o
 * botão leva o foco ao topo dele para dar ao leitor de tela um ponto de chegada
 * (CA-12). Sem `tabindex` o botão apenas rola.
 *
 * Uso: `<div class="wiz-content" uiBackToTopContainer tabindex="-1">`.
 */
@Directive({
  selector: '[uiBackToTopContainer]',
  standalone: true,
})
export class BackToTopContainerDirective {
  private readonly scrollService = inject(BackToTopScrollService);

  constructor() {
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    this.scrollService.registrar(elemento);
    inject(DestroyRef).onDestroy(() => this.scrollService.remover(elemento));
  }
}
