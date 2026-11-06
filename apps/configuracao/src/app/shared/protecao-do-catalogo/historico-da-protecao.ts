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
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { Subscription } from 'rxjs';
import { anunciarLeitura, focarAposNovaTentativa } from '../foco';
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
  imports: [AlertComponent, AtosDaProtecaoComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cfg-detalhe-secao" [attr.aria-busy]="carregando()">
      <span class="sr-only" role="status">{{ anuncio() }}</span>
      <h3 class="cfg-detalhe-secao__titulo" [attr.id]="idDoTitulo" tabindex="-1">Histórico da proteção</h3>
      @if (carregando()) {
        <span class="list-state__loading"><ui-spinner spinnerSize="sm" /> Carregando o histórico</span>
      }
      @if (erro(); as mensagem) {
        <ui-alert variant="danger" heading="Não foi possível carregar o histórico">
          {{ mensagem }}
          <div class="list-state__retry">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              [attr.aria-disabled]="carregando() ? 'true' : null"
              [attr.aria-busy]="carregando() ? 'true' : null"
              (click)="tentarNovamente()"
            >
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      } @else if (atos(); as lidos) {
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
  private leitura: Subscription | undefined;

  protected readonly atos = signal<readonly AtoDaProtecaoDto[] | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly idDoTitulo = `cfg-historico-da-protecao-${nextId++}`;
  /** A falha mantida na tela durante a tentativa não muda de texto; esta região anuncia cada tentativa. */
  protected readonly anuncio = signal('');
  private readonly falhou = computed(() => this.erro() !== null);
  private readonly novaTentativa = focarAposNovaTentativa(this.carregando, this.falhou, () =>
    document.getElementById(this.idDoTitulo),
  );
  private readonly anunciada = anunciarLeitura(
    'histórico da proteção',
    this.carregando,
    this.falhou,
    this.anuncio,
  );

  constructor() {
    effect(() => {
      this.cadastro();
      this.itemId();
      this.erro.set(null);
      this.ler();
    });
    this.destroyRef.onDestroy(() => this.leitura?.unsubscribe());
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => {
      this.anunciada.iniciar();
      this.ler();
    });
  }

  /** A falha fica na tela durante a nova tentativa, para o botão que a pediu não sumir. */
  private ler(): void {
    this.leitura?.unsubscribe();
    this.carregando.set(true);
    this.atos.set(null);
    const id = this.itemId();
    const leitura = this.cadastro() === 'FATO' ? this.fatos.atosDaProtecao(id) : this.tipos.atosDaProtecao(id);
    this.leitura = leitura.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.carregando.set(false);
      if (resultado.ok) {
        this.erro.set(null);
        this.atos.set(resultado.data);
      } else this.erro.set(this.problemI18n.resolve(resultado.problem).title);
    });
  }
}
