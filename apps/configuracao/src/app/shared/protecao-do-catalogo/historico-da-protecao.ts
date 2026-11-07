import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  FatosCandidatoApi,
  TiposDocumentoApi,
  type AtoDaProtecaoDto,
  type CadastroDoCatalogo,
} from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { Subscription } from 'rxjs';
import { RecusaDaLeituraComponent, recusaDe, type RecusaDaLeitura } from '../recusa-da-leitura';
import { AtosDaProtecaoComponent } from './atos-da-protecao';

let nextId = 0;

/**
 * A seção "Histórico da proteção" do drawer de um cadastro: lê os atos do item quando é criada, isto
 * é, quando o drawer abre, e os mostra em ordem cronológica. Quem a monta já conferiu a permissão
 * de ler o histórico daquele cadastro.
 */
@Component({
  selector: 'cfg-historico-da-protecao',
  standalone: true,
  imports: [
    AtosDaProtecaoComponent,
    FalhaDeLeituraComponent,
    RecusaDaLeituraComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cfg-detalhe-secao" [attr.aria-busy]="carregando()">
      <h3 class="cfg-detalhe-secao__titulo" [attr.id]="idDoTitulo" tabindex="-1">
        Histórico da proteção
      </h3>
      @if (carregando()) {
        <span class="list-state__loading"
          ><ui-spinner spinnerSize="sm" /> Carregando o histórico</span
        >
      }
      <ui-falha-de-leitura titulo="Não foi possível carregar o histórico" [leitura]="leitura" />
      <cfg-recusa-da-leitura naoEncontrado="Histórico não encontrado" [recusa]="recusa()">
        Feche o painel e confira a lista.
      </cfg-recusa-da-leitura>
      @if (recusa() === null && atos(); as lidos) {
        <cfg-atos-da-protecao [atos]="lidos" />
      }
    </section>
  `,
})
export class HistoricoDaProtecaoComponent {
  readonly cadastro = input.required<CadastroDoCatalogo>();
  readonly itemId = input.required<string>();

  private readonly tipos = inject(TiposDocumentoApi);
  private readonly fatos = inject(FatosCandidatoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private assinatura: Subscription | undefined;

  protected readonly atos = signal<readonly AtoDaProtecaoDto[] | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  /** Sem permissão ou item inexistente: repetir a leitura não muda a resposta. */
  protected readonly recusa = signal<RecusaDaLeitura | null>(null);

  protected readonly idDoTitulo = `cfg-historico-da-protecao-${nextId++}`;
  protected readonly leitura = acompanharLeitura({
    assunto: 'histórico',
    falha: computed(() => (this.recusa() ? null : this.erro())),
    pendente: this.carregando,
    recusada: computed(() => this.recusa() !== null),
    recarregar: () => this.ler(),
    destino: () => document.getElementById(this.idDoTitulo),
  });

  constructor() {
    effect(() => {
      this.cadastro();
      this.itemId();
      this.erro.set(null);
      this.recusa.set(null);
      this.ler();
    });
    this.destroyRef.onDestroy(() => this.assinatura?.unsubscribe());
  }

  private ler(): void {
    this.assinatura?.unsubscribe();
    this.carregando.set(true);
    this.atos.set(null);
    const id = this.itemId();
    const busca =
      this.cadastro() === 'FATO' ? this.fatos.atosDaProtecao(id) : this.tipos.atosDaProtecao(id);
    this.assinatura = busca.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.carregando.set(false);
      if (resultado.ok) {
        this.erro.set(null);
        this.recusa.set(null);
        this.atos.set(resultado.data);
      } else {
        const texto = this.problemI18n.resolve(resultado.problem).title;
        this.recusa.set(recusaDe(resultado.problem, texto));
        this.erro.set(texto);
      }
    });
  }
}
