import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';

/**
 * Mostra o conteúdo só a quem tem a permissão (ou qualquer uma da lista); sem ela, o elemento não
 * existe na tela, em vez de ficar desabilitado sem explicação.
 *
 * ```html
 * <button *authTemPermissao="'selecao:processos:configurar'">Novo processo</button>
 * ```
 */
@Directive({ selector: '[authTemPermissao]', standalone: true })
export class TemPermissaoDirective {
  private readonly permissoes = inject(PermissoesService);
  private readonly modelo = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly authTemPermissao = input.required<CodigoDePermissao | readonly CodigoDePermissao[]>();

  private readonly permitido = computed(() => {
    const exigidas = this.authTemPermissao();
    return typeof exigidas === 'string'
      ? this.permissoes.tem(exigidas)
      : this.permissoes.temAlguma(...exigidas);
  });

  constructor() {
    effect(() => {
      const permitido = this.permitido();
      this.container.clear();
      if (permitido) this.container.createEmbeddedView(this.modelo);
    });
  }
}
