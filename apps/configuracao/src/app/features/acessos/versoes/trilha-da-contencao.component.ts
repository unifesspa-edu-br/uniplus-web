import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import {
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { TrilhaDeAcessoComponent } from '../trilha-de-acesso.component';
import { TrilhaDaContencaoStore } from './trilha-da-contencao.store';

const ID_DA_TRILHA = 'cfg-trilha-da-contencao';

/** Tudo o que contém o acesso do perfil, na ordem em que aconteceu. */
@Component({
  selector: 'cfg-trilha-da-contencao',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    TrilhaDeAcessoComponent,
  ],
  providers: [TrilhaDaContencaoStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" [attr.aria-labelledby]="idDoTitulo">
      <div class="panel-head">
        <h2 [id]="idDoTitulo" class="panel-head__title">Trilha da contenção</h2>
      </div>
      <div class="panel-body" [id]="idDaTrilha" tabindex="-1">
        @if (store.carregando()) {
          <p [uiIndicadorDaLeitura]="leitura">
            <ui-spinner spinnerSize="sm" /> Carregando a trilha…
          </p>
        }
        <ui-falha-de-leitura titulo="Não foi possível carregar a trilha" [leitura]="leitura" />
        <cfg-recusa-da-leitura naoEncontrado="Trilha não encontrada" [recusa]="store.recusa()" />
        @if (!store.carregando() && !leitura.visivel() && store.recusa() === null) {
          <cfg-trilha-de-acesso
            [eventos]="store.eventos()"
            legenda="Trilha da contenção do perfil"
          />
        }
      </div>
    </section>
  `,
})
export class TrilhaDaContencaoComponent {
  /** O perfil aberto; cada nova leitura dele relê a trilha. */
  readonly perfilId = input.required<string>();
  /** Muda quando o perfil é relido, para a trilha acompanhar o que acabou de acontecer. */
  readonly leituraDoPerfil = input.required<unknown>();

  protected readonly store = inject(TrilhaDaContencaoStore);
  protected readonly idDoTitulo = `${ID_DA_TRILHA}-titulo`;
  protected readonly idDaTrilha = ID_DA_TRILHA;
  protected readonly leitura = acompanharLeitura({
    assunto: 'trilha da contenção',
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DA_TRILHA),
  });

  constructor() {
    effect(() => {
      const id = this.perfilId();
      this.leituraDoPerfil();
      untracked(() => this.store.atualizar(id));
    });
  }
}
