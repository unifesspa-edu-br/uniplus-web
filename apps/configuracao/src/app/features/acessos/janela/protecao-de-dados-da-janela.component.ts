import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ItemDaJanelaDto, JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EscolhaDaDecisaoComponent } from './escolha-da-decisao.component';
import { EtapaDaProtecaoDeDados } from './etapa-da-protecao-de-dados';
import { ExclusaoDialogComponent } from './exclusao-dialog.component';
import { focarQuandoAparecer } from './foco-do-erro';
import { decisoesDaEtapa } from './itens-da-janela';
import { TabelaDaJanelaComponent } from './tabela-da-janela.component';

const ID_DO_ERRO = 'cfg-protecao-erro';

/** A etapa da proteção de dados: decide uma concessão, várias ou todas, migrando umas e recusando outras. */
@Component({
  selector: 'cfg-protecao-de-dados-da-janela',
  standalone: true,
  imports: [
    AlertComponent,
    EscolhaDaDecisaoComponent,
    ExclusaoDialogComponent,
    SpinnerComponent,
    TabelaDaJanelaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './protecao-de-dados-da-janela.component.html',
})
export class ProtecaoDeDadosDaJanelaComponent {
  readonly janela = input.required<JanelaDeMigracaoDto>();
  readonly itens = input.required<readonly ItemDaJanelaDto[]>();
  readonly nomeDoEscopo = input.required<(item: ItemDaJanelaDto) => string>();
  /** A pessoa tem a permissão da proteção de dados. */
  readonly podeDecidir = input.required<boolean>();

  protected readonly etapa = inject(EtapaDaProtecaoDeDados);
  protected readonly gravando = inject(EscritaDoPerfil).gravando;
  protected readonly idDoErro = ID_DO_ERRO;
  protected readonly escolhidas = computed(
    () => decisoesDaEtapa(this.itens(), this.etapa.decisoes()).length,
  );

  constructor() {
    focarQuandoAparecer(this.etapa.erro, ID_DO_ERRO);
  }

  protected enviar(): void {
    this.etapa.pedirEnvio(this.janela().perfilId, this.itens());
  }

  protected confirmarExclusao(): void {
    void this.etapa.confirmarExclusao(this.janela().perfilId, this.itens());
  }
}
