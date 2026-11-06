import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

/** Tempo para a região existir na tela antes de o texto entrar nela; só assim o leitor anuncia. */
const ESPERA_DA_REGIAO_MS = 100;
/** Quanto o texto fica na região; depois ela esvazia e o mesmo texto volta a ser anunciado. */
const PERMANENCIA_DO_TEXTO_MS = 5000;

/**
 * Anuncia ao leitor de tela que uma leitura pedida deu certo, quando o foco não foi levado a lugar
 * nenhum: o alerta que avisava a falha já saiu, e quem enxerga vê a lista aparecer.
 *
 * A região mora dentro do `<dialog>` aberto, se houver, ou no `body`: um drawer modal deixa o
 * resto da página inerte, e uma região fora dele não seria lida.
 */
@Injectable({ providedIn: 'root' })
export class AnuncioDaConclusao implements OnDestroy {
  private readonly documento = inject(DOCUMENT);
  private regiao: HTMLElement | null = null;
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  /** Um aviso novo cancela os anteriores e esvazia a região, para o mesmo texto ser lido de novo. */
  anunciar(texto: string): void {
    this.cancelar();
    const regiao = this.regiaoNoContexto();
    regiao.textContent = '';
    this.temporizadores = [
      setTimeout(() => {
        regiao.textContent = texto;
        this.temporizadores.push(
          setTimeout(() => (regiao.textContent = ''), PERMANENCIA_DO_TEXTO_MS),
        );
      }, ESPERA_DA_REGIAO_MS),
    ];
  }

  ngOnDestroy(): void {
    this.cancelar();
    this.regiao?.remove();
    this.regiao = null;
  }

  private cancelar(): void {
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores = [];
  }

  private regiaoNoContexto(): HTMLElement {
    const abertos = this.documento.querySelectorAll('dialog[open]');
    const contexto = abertos.item(abertos.length - 1) ?? this.documento.body;
    if (this.regiao?.parentElement !== contexto) {
      this.regiao?.remove();
      this.regiao = this.documento.createElement('div');
      this.regiao.className = 'sr-only';
      this.regiao.setAttribute('role', 'status');
      this.regiao.setAttribute('aria-live', 'polite');
      this.regiao.setAttribute('aria-atomic', 'true');
      contexto.append(this.regiao);
    }
    return this.regiao;
  }
}
