import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ItemDaJanelaDto, JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EscolhaDaDecisaoComponent } from './escolha-da-decisao.component';
import { ExclusaoDialogComponent } from './exclusao-dialog.component';
import { focarQuandoAparecer } from './foco-do-erro';
import { semDecisao, type ItensDaJanela } from './itens-da-janela';
import { LoteDaMigracao } from './lote-da-migracao';
import { TabelaDaJanelaComponent } from './tabela-da-janela.component';

const ID_DO_ERRO = 'cfg-lote-erro';

/** O lote da gestão de acessos: migrar ou recusar cada concessão da versão anterior e enviar a lista inteira. */
@Component({
  selector: 'cfg-lote-da-migracao',
  standalone: true,
  imports: [
    AlertComponent,
    EscolhaDaDecisaoComponent,
    ExclusaoDialogComponent,
    SpinnerComponent,
    TabelaDaJanelaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lote-da-migracao.component.html',
})
export class LoteDaMigracaoComponent {
  readonly janela = input.required<JanelaDeMigracaoDto>();
  readonly itens = input.required<ItensDaJanela>();
  readonly nomeDoEscopo = input.required<(item: ItemDaJanelaDto) => string>();
  /** A pessoa tem a permissão da gestão de acessos. */
  readonly podeDecidir = input.required<boolean>();

  protected readonly lote = inject(LoteDaMigracao);
  protected readonly gravando = inject(EscritaDoPerfil).gravando;
  protected readonly idDoErro = ID_DO_ERRO;
  protected readonly faltam = computed(() => semDecisao(this.itens().doLote, this.lote.decisoes()));
  /** O lote tem o que enviar: decisões de outras pessoas ou, só, concessões suas a reter. */
  protected readonly enviavel = computed(
    () => this.itens().doLote.length > 0 || this.itens().proprias.length > 0,
  );
  protected readonly decidiveis = computed(
    () => this.podeDecidir() && !this.janela().loteEnviado && this.enviavel(),
  );

  constructor() {
    focarQuandoAparecer(this.lote.erro, ID_DO_ERRO);
  }

  protected enviar(): void {
    this.lote.pedirEnvio(this.janela().perfilId, this.itens().doLote);
  }

  protected confirmarExclusao(): void {
    void this.lote.confirmarExclusao(this.janela().perfilId, this.itens().doLote);
  }
}
