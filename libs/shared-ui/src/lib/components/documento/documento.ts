import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { formatarDataBr } from '@uniplus/shared-utils';

import { MarcaInstitucionalComponent } from '../marca-institucional/marca-institucional';
import { PageHeaderComponent } from '../page-header/page-header';

/**
 * Um documento que o titular guarda ou imprime, como o comprovante de inscrição. É o dono do título
 * da página, das ações e do papel:
 *
 * - na tela, o título e as ações (`[uiDocumentoAcoes]`) ficam no `ui-page-header`, que não sai no papel;
 * - no papel, o cabeçalho institucional traz a marca, o título e o instante da impressão, atualizado
 *   no `beforeprint` antes de o navegador montar a página;
 * - o corpo é a grade das `ui-secao-de-documento`.
 *
 * As cores e a página A4 do papel são do CSS de impressão, sempre em fundo branco, seja qual for o
 * tema da tela.
 */
@Component({
  selector: 'ui-documento',
  standalone: true,
  imports: [MarcaInstitucionalComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'documento',
    '(window:beforeprint)': 'registrarImpressao()',
  },
  template: `
    <header class="documento__papel u-print-only">
      <ui-marca-institucional />
      <div class="documento__papel-identificacao">
        <p class="documento__papel-titulo">{{ titulo() }}</p>
        @if (impressoEm(); as instante) {
          <p>Impresso em {{ instante }}</p>
        }
        <p class="documento__papel-sistema">Sistema Uni+</p>
      </div>
    </header>
    <ui-page-header class="u-no-print" [heading]="titulo()" [description]="descricao()" [level]="1">
      <div uiPageActions class="documento__acoes">
        <ng-content select="[uiDocumentoAcoes]" />
      </div>
    </ui-page-header>
    <div class="documento__corpo">
      <ng-content />
    </div>
  `,
})
export class DocumentoComponent {
  readonly titulo = input.required<string>();
  readonly descricao = input<string>('');

  private readonly janela = inject(DOCUMENT).defaultView;
  private readonly detector = inject(ChangeDetectorRef);
  private readonly cabecalho = viewChild.required(PageHeaderComponent);
  private readonly instanteDaImpressao = signal<Date | null>(null);

  protected readonly impressoEm = computed(() => {
    const instante = this.instanteDaImpressao();
    return instante ? formatarDataBr(instante, 'datetime') : null;
  });

  /** Atualiza o instante da impressão e imprime. */
  imprimir(): void {
    this.registrarImpressao();
    this.janela?.print();
  }

  /** Leva o foco ao título do documento. */
  focar(): void {
    this.cabecalho().focar();
  }

  /**
   * O navegador monta a página impressa logo depois do `beforeprint`: o instante entra no DOM agora,
   * de forma síncrona, e não no próximo ciclo de detecção de mudanças.
   */
  protected registrarImpressao(): void {
    this.instanteDaImpressao.set(new Date());
    this.detector.detectChanges();
  }
}
