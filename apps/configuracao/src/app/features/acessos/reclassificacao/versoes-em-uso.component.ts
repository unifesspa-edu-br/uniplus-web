import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { VersaoEmUsoDto } from '@uniplus/shared-data/autorizacao';
import { sensibilidade } from '../rotulos-de-acesso';
import { focarQuandoPedir } from './foco-por-pedido';
import { escopoDaPermissao } from './rotulos-da-reclassificacao';

/** As versões do perfil em uso pelas concessões suspensas, com as permissões e a leitura do documento. */
@Component({
  selector: 'cfg-versoes-em-uso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="cfg-versoes-em-uso">
      <div class="panel-head">
        <h2 #titulo id="cfg-versoes-em-uso" class="panel-head__title" tabindex="-1">
          Versões em uso
        </h2>
      </div>
      <p class="panel-body">
        A decisão exige a leitura do documento instituidor de cada versão em uso pelas concessões
        decididas.
      </p>
      <ul role="list" class="panel-body" style="list-style: none; margin: 0; padding: 0">
        @for (versao of versoes(); track versao.id) {
          <li>
            <h3>Versão {{ versao.numero }}</h3>
            @if (versao.linkDoDocumento !== null) {
              <button
                type="button"
                class="btn btn--tertiary btn--sm"
                (click)="abrirDocumento.emit(versao.id)"
              >
                Abrir o documento da versão {{ versao.numero }}
              </button>
            }
            <ul role="list" [attr.aria-label]="'Permissões da versão ' + versao.numero">
              @for (permissao of versao.permissoes; track permissao.codigo) {
                <li>
                  {{ permissao.codigo }} · {{ classe(permissao.classificacao) }} ·
                  {{ escopo(permissao.deUnidade) }}
                </li>
              }
            </ul>
          </li>
        }
      </ul>
    </section>
  `,
})
export class VersoesEmUsoComponent {
  readonly versoes = input.required<readonly VersaoEmUsoDto[]>();
  /** Cresce quando a decisão exige a leitura: o foco vai ao título desta seção. */
  readonly pedidoDeFoco = input(0);
  readonly abrirDocumento = output<string>();

  protected readonly classe = sensibilidade;
  protected readonly escopo = escopoDaPermissao;
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  constructor() {
    focarQuandoPedir(this.pedidoDeFoco, this.titulo);
  }
}
