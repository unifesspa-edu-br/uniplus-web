import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Fundo sobre o qual a marca é aplicada: define a versão oficial que aparece. */
export type FundoDaMarca = 'claro' | 'escuro' | 'tema';

/**
 * A marca da Unifesspa: a horizontal com a linha por extenso, dos arquivos oficiais. É imagem com
 * dimensões declaradas, e não fundo de CSS, para sair no papel sem a opção de imprimir fundos e ter
 * texto alternativo. A área de proteção do manual fica por conta do próprio componente.
 *
 * Sobre fundo claro, a versão colorida; sobre fundo escuro, a branca; sobre fundo que muda com o
 * tema, as duas, e o CSS mostra a que cabe ao tema ativo.
 */
@Component({
  selector: 'ui-marca-institucional',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'marca-institucional' },
  template: `
    @if (fundo() !== 'escuro') {
      <img
        class="marca-institucional__imagem marca-institucional__imagem--colorida"
        src="assets/shared-ui/marca/unifesspa-horizontal-extenso.png"
        width="512"
        height="180"
        [attr.alt]="textoAlternativo()"
      />
    }
    @if (fundo() !== 'claro') {
      <img
        class="marca-institucional__imagem marca-institucional__imagem--branca"
        [class.marca-institucional__imagem--conforme-tema]="fundo() === 'tema'"
        src="assets/shared-ui/marca/unifesspa-horizontal-branca.png"
        width="513"
        height="180"
        [attr.alt]="textoAlternativo()"
      />
    }
  `,
})
export class MarcaInstitucionalComponent {
  /** Sem rótulo, a marca é decorativa: o texto ao lado já identifica a instituição. */
  readonly rotulada = input(true, { transform: booleanAttribute });
  readonly fundo = input<FundoDaMarca>('claro');

  protected readonly textoAlternativo = computed(() =>
    this.rotulada() ? 'Unifesspa — Universidade Federal do Sul e Sudeste do Pará' : '',
  );
}
