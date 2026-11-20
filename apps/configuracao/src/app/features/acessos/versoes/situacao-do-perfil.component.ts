import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagComponent, TagDoCodigoComponent } from '@uniplus/shared-ui/components';
import type { SituacaoDoAcessoDoPerfilDto } from '@uniplus/shared-data/autorizacao';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { VARIANTES_DO_ACESSO, type EtiquetaDoPerfil } from './estado-do-perfil';

/**
 * A situação do perfil, na lista e no detalhe: a situação do acesso que a API calcula, as
 * etiquetas que o web monta e a versão pendente como texto auxiliar. Cada etiqueta e o "desde"
 * dela ficam separados por espaço explícito: sem ele o leitor de tela leria os dois grudados.
 */
@Component({
  selector: 'cfg-situacao-do-perfil',
  standalone: true,
  imports: [TagComponent, TagDoCodigoComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span>
      <ui-tag-do-codigo [valor]="situacaoDoAcesso()" [variantes]="variantesDoAcesso" />
      @if (suspensoDesde(); as desde) {
        &ngsp;<span class="cfg-muted">desde {{ desde | dateBr: 'datetime' }}</span>
      }
    </span>
    &ngsp;
    @for (etiqueta of etiquetas(); track etiqueta.texto) {
      <span>
        <ui-tag [variant]="etiqueta.variante">{{ etiqueta.texto }}</ui-tag>
        @if (etiqueta.desde; as desde) {
          &ngsp;<span class="cfg-muted">desde {{ desde | dateBr: 'datetime' }}</span>
        }
      </span>
      &ngsp;
    }
    @if (versaoPendente()) {
      <span class="cfg-muted">Versão pendente</span>
    }
  `,
})
export class SituacaoDoPerfilComponent {
  readonly situacaoDoAcesso = input.required<SituacaoDoAcessoDoPerfilDto>();
  readonly suspensoDesde = input.required<string | null>();
  readonly etiquetas = input.required<readonly EtiquetaDoPerfil[]>();
  readonly versaoPendente = input.required<boolean>();
  protected readonly variantesDoAcesso = VARIANTES_DO_ACESSO;
}
