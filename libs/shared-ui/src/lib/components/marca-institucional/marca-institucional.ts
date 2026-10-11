import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A marca da Unifesspa: a horizontal colorida, com a linha por extenso, do arquivo oficial. É imagem
 * com dimensões declaradas, e não fundo de CSS, para sair no papel sem a opção de imprimir fundos e
 * ter texto alternativo. A área de proteção do manual fica por conta do próprio componente.
 */
@Component({
  selector: 'ui-marca-institucional',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'marca-institucional' },
  template: `
    <img
      class="marca-institucional__imagem"
      src="assets/shared-ui/marca/unifesspa-horizontal-extenso.png"
      width="512"
      height="180"
      [attr.alt]="rotulada() ? 'Unifesspa — Universidade Federal do Sul e Sudeste do Pará' : ''"
    />
  `,
})
export class MarcaInstitucionalComponent {
  /** Sem rótulo, a marca é decorativa: o texto ao lado já identifica a instituição. */
  readonly rotulada = input(true, { transform: booleanAttribute });
}
