import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { focarDepois } from '../foco';
import { idDaEtapa } from '../ids';
import { blocosAdmitidos } from '../modelo/constantes';
import { type ContextoDoEditor } from '../modelo/contexto-do-editor';
import { etapasEmOrdem } from '../modelo/ordem-das-entradas';
import { acrescentarBloco, acrescentarSecao } from '../modelo/secoes';
import { type ConteudoDoFormulario } from '../modelo/tipos';

/** O acréscimo de uma seção nova ou de um bloco do sistema, sempre antes da revisão e aceite. */
@Component({
  selector: 'ui-acrescentar-no-fim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <div class="editor-formulario__acrescentar">
      <button
        class="btn btn--secondary btn--sm"
        type="button"
        [disabled]="contexto().disabled"
        (click)="acrescentarASecao()"
      >
        <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar seção
      </button>
      @for (bloco of blocos(); track bloco.valor) {
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [disabled]="contexto().disabled"
          (click)="acrescentarOBloco(bloco.valor)"
        >
          <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar bloco “{{ bloco.rotulo }}”
        </button>
      }
    </div>
  `,
})
export class AcrescentarNoFimComponent {
  private readonly injector = inject(Injector);

  readonly contexto = input.required<ContextoDoEditor>();

  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly anuncio = output<string>();

  /** Os blocos que a finalidade admite e o formulário ainda não tem. */
  protected readonly blocos = computed(() => {
    const { finalidade, conteudo } = this.contexto();
    const etapas = etapasEmOrdem(conteudo);
    return blocosAdmitidos(finalidade).filter(
      (bloco) => !etapas.some((etapa) => etapa.bloco === bloco.valor),
    );
  });

  protected acrescentarASecao(): void {
    const { conteudo, idBase } = this.contexto();
    const editado = acrescentarSecao(conteudo, 'Nova seção');
    const nova = (editado.etapas ?? []).find(
      (etapa) => !(conteudo.etapas ?? []).some((e) => e.codigo === etapa.codigo),
    );
    this.conteudoChange.emit(editado);
    this.anuncio.emit('Seção nova acrescentada antes da revisão e aceite.');
    if (nova !== undefined) focarDepois(this.injector, `${idDaEtapa(idBase, nova.codigo)}-titulo`);
  }

  protected acrescentarOBloco(valor: string): void {
    const bloco = this.blocos().find((b) => b.valor === valor);
    if (bloco === undefined) return;
    this.conteudoChange.emit(acrescentarBloco(this.contexto().conteudo, bloco));
    this.anuncio.emit(`Bloco “${bloco.rotulo}” acrescentado antes da revisão e aceite.`);
  }
}
