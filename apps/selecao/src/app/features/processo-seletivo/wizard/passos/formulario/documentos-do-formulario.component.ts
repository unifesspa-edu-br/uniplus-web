import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { PASSO_CRONOGRAMA, type DocumentoExigidoLido } from '../../shared/documentos-exigidos';

/**
 * Os documentos que o bloco de comprovação do formulário pede ao candidato: o que a fase e a
 * finalidade do formulário exigem. A lista é lida do passo Cronograma, onde é editada.
 */
@Component({
  selector: 'sel-documentos-do-formulario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (semFase()) {
      <p class="field__hint">
        Escolha a fase em que o formulário é respondido para ver os documentos que ele pede.
      </p>
    } @else if (documentos().length === 0 && semFormulario() === 0) {
      <p class="field__hint">
        Nenhum documento exigido nesta fase.
        @if (!store.emConsulta()) {
          <button type="button" class="btn btn--tertiary btn--sm" (click)="irParaCronograma()">
            Ir para Cronograma
          </button>
        }
      </p>
    } @else if (documentos().length > 0) {
      <ul class="doc-list">
        @for (documento of documentos(); track documento.chave) {
          <li class="doc-item">
            <div class="doc-item__head doc-item__head--consulta">
              <span class="doc-item__name">{{ documento.nome }}</span>
              &ngsp;
              <span class="field__hint"
                ><span aria-hidden="true">·</span> {{ documento.obrigatoriedade }}</span
              >
            </div>
            <dl class="confirmacao-lista">
              <div class="confirmacao-lista__linha">
                <dt class="confirmacao-lista__rotulo">Quando é pedido</dt>
                <dd class="confirmacao-lista__valor">
                  {{ documento.aplicaA }}
                  @if (documento.composicao !== '') {
                    <span class="field__hint">{{ documento.composicao }}</span>
                  }
                  @if (documento.repeticao !== '') {
                    <span class="field__hint">{{ documento.repeticao }}</span>
                  }
                </dd>
              </div>
              <div class="confirmacao-lista__linha">
                <dt class="confirmacao-lista__rotulo">Se não for entregue</dt>
                <dd class="confirmacao-lista__valor">{{ documento.consequencia }}</dd>
              </div>
              <div class="confirmacao-lista__linha">
                <dt class="confirmacao-lista__rotulo">Arquivo aceito</dt>
                <dd class="confirmacao-lista__valor">{{ documento.arquivo }}</dd>
              </div>
            </dl>
          </li>
        }
      </ul>
    }
    @if (!semFase() && semFormulario() > 0) {
      <p class="field__hint">
        {{
          semFormulario() === 1
            ? '1 documento desta fase depende da escolha do formulário em que é apresentado'
            : semFormulario() + ' documentos desta fase dependem da escolha do formulário em que são apresentados'
        }}
        e não aparece{{ semFormulario() === 1 ? '' : 'm' }} aqui. Faça a escolha no passo
        Cronograma.
        @if (!store.emConsulta()) {
          <button type="button" class="btn btn--tertiary btn--sm" (click)="irParaCronograma()">
            Ir para Cronograma
          </button>
        }
      </p>
    }
  `,
})
export class DocumentosDoFormularioComponent {
  protected readonly store = inject(ProcessoSeletivoStore);

  readonly documentos = input.required<readonly DocumentoExigidoLido[]>();
  /** Quantos documentos da fase ainda não têm formulário definido. */
  readonly semFormulario = input(0);
  /** O formulário ainda não tem fase: sem ela não há documentos a listar. */
  readonly semFase = input(false);

  irParaCronograma(): void {
    this.store.goTo(PASSO_CRONOGRAMA);
  }
}
