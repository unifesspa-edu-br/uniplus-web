import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ItemDaJanelaDto, JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { DecisaoDaRetida } from './decisao-da-retida';
import { ExclusaoDialogComponent } from './exclusao-dialog.component';
import { TabelaDaJanelaComponent } from './tabela-da-janela.component';

/** As concessões que o lote reteve para quem não é a pessoa beneficiada decidir. */
@Component({
  selector: 'cfg-retidas-da-janela',
  standalone: true,
  imports: [AlertComponent, ExclusaoDialogComponent, TabelaDaJanelaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './retidas-da-janela.component.html',
})
export class RetidasDaJanelaComponent {
  readonly janela = input.required<JanelaDeMigracaoDto>();
  readonly retidas = input.required<readonly ItemDaJanelaDto[]>();
  readonly nomeDoEscopo = input.required<(item: ItemDaJanelaDto) => string>();
  /** A pessoa tem a permissão da gestão de acessos. */
  readonly podeDecidir = input.required<boolean>();

  protected readonly decisao = inject(DecisaoDaRetida);
  protected readonly gravando = inject(EscritaDoPerfil).gravando;
  protected readonly erroDoDialogo = computed(() => {
    const alvo = this.decisao.recusando();
    return alvo === null ? null : (this.decisao.erros().get(alvo.concessaoId) ?? null);
  });

  protected migrar(item: ItemDaJanelaDto): void {
    void this.decisao.migrar(this.janela().perfilId, item);
  }

  protected confirmarRecusa(): void {
    void this.decisao.confirmarRecusa(this.janela().perfilId);
  }

  protected erroDe(item: ItemDaJanelaDto): string | null {
    return this.decisao.confirmando() ? null : (this.decisao.erros().get(item.concessaoId) ?? null);
  }
}
