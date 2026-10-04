import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import { Subject, of, switchMap, timer, type Observable } from 'rxjs';

import { ComboboxComponent, type UiComboboxGroup, type UiComboboxOption } from '../combobox/combobox';

/** Um município achado pela busca. É estrutural: o resumo de cidade do Geo satisfaz esta forma. */
export interface MunicipioEncontrado {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

/** Busca os municípios cujo nome casa com o termo. */
export type BuscaDeMunicipios = (termo: string) => Observable<ApiResult<readonly MunicipioEncontrado[]>>;

/**
 * A busca de municípios que o editor de condições usa para declarar condição sobre fato de
 * município. A biblioteca de componentes não fala com a API: quem hospeda o editor provê a busca.
 * Sem ela, o editor não oferece fato de município, porque não teria como escolher o valor.
 */
export const BUSCA_DE_MUNICIPIOS = new InjectionToken<BuscaDeMunicipios>('BUSCA_DE_MUNICIPIOS');

/** O termo mais curto que vale buscar: com menos, a busca alcançaria centenas de nomes. */
const TERMO_MINIMO = 3;
/** A espera depois da última tecla, para não buscar a cada letra. */
const ESPERA_DA_DIGITACAO_MS = 300;

/**
 * O nome de cada município já escolhido nesta sessão, pelo código IBGE. A condição grava só o
 * código; o nome vem da busca que o achou, e é guardado fora do controle porque a linha da
 * condição é recriada quando outra condição sai da lista.
 */
@Injectable({ providedIn: 'root' })
export class NomesDeMunicipios {
  private readonly nomes = signal<ReadonlyMap<string, string>>(new Map());

  lembrar(municipios: readonly MunicipioEncontrado[]): void {
    this.nomes.update((atual) => new Map([...atual, ...municipios.map((m) => [m.codigoIbge, rotuloDe(m)] as const)]));
  }

  /**
   * O nome do município, ou o código quando ele não passou pela busca nesta sessão — é o caso da
   * condição gravada antes: o Geo não tem leitura por código, e o código é o que a regra compara.
   */
  rotulo(codigoIbge: string): string {
    return this.nomes().get(codigoIbge) ?? `Município de código IBGE ${codigoIbge}`;
  }
}

function rotuloDe(municipio: MunicipioEncontrado): string {
  return `${municipio.nome} (${municipio.uf})`;
}

/**
 * O valor de uma condição sobre fato de município: um município, ou vários na comparação com
 * lista, escolhidos pela busca no Geo e gravados pelo código IBGE, que é o que a API confere.
 *
 * A lista de municípios do país é grande demais para vir inteira, então a busca é do servidor, a
 * partir de três letras. O que já está escolhido fica no topo da lista, para ser conferido e
 * desmarcado sem buscar de novo.
 *
 * Acessibilidade: é o combobox do WAI-ARIA, rotulado pelo hospedeiro, que aponta o rótulo para `campoId`; o andamento da
 * busca e a falha são ditos na região de status dele.
 */
@Component({
  selector: 'ui-valor-de-municipio',
  standalone: true,
  imports: [ComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (multiplo()) {
      <ui-combobox
        multiplo
        buscaExterna
        [rotulo]="rotulo()"
        placeholder="Digite o nome do município"
        [textoSemResultado]="textoSemResultado()"
        [grupos]="grupos()"
        [values]="values()"
        [disabled]="disabled()"
        (buscaChange)="buscar($event)"
        (valuesChange)="valuesChange.emit($event)"
      />
    } @else {
      <ui-combobox
        buscaExterna
        [rotulo]="rotulo()"
        placeholder="Digite o nome do município"
        [textoSemResultado]="textoSemResultado()"
        [grupos]="grupos()"
        [value]="values()[0] ?? ''"
        [disabled]="disabled()"
        (buscaChange)="buscar($event)"
        (valueChange)="valuesChange.emit([$event])"
      />
    }
  `,
})
export class ValorDeMunicipioComponent {
  private readonly busca = inject(BUSCA_DE_MUNICIPIOS);
  private readonly nomes = inject(NomesDeMunicipios);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Como a lista se chama para quem usa leitor de tela. */
  readonly rotulo = input.required<string>();
  /** Os códigos IBGE escolhidos — um só quando a comparação não é com lista. */
  readonly values = input.required<readonly string[]>();
  readonly multiplo = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly valuesChange = output<readonly string[]>();

  private readonly campo = viewChild(ComboboxComponent);
  /** O id do campo de busca, para o rótulo do hospedeiro apontar para ele. */
  readonly campoId = computed(() => this.campo()?.campoId ?? null);

  private readonly termos = new Subject<string>();
  private readonly termo = signal('');
  private readonly buscando = signal(false);
  private readonly falha = signal<string | null>(null);
  private readonly encontrados = signal<readonly MunicipioEncontrado[]>([]);

  constructor() {
    // switchMap direto sobre o termo: o termo novo cancela a busca em voo, e a resposta de um termo
    // já trocado nunca chega a substituir a do atual.
    this.termos
      .pipe(
        switchMap((termo) => {
          if (termo.length < TERMO_MINIMO) return of(null);
          return timer(ESPERA_DA_DIGITACAO_MS).pipe(switchMap(() => this.busca(termo)));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((resultado) => {
        this.buscando.set(false);
        if (resultado === null) {
          this.encontrados.set([]);
          return;
        }
        if (!resultado.ok) {
          this.encontrados.set([]);
          this.falha.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.nomes.lembrar(resultado.data);
        this.encontrados.set(resultado.data);
      });
  }

  protected readonly textoSemResultado = computed(() => {
    const falha = this.falha();
    if (falha !== null) return `Não foi possível buscar os municípios: ${falha}`;
    if (this.termo().length < TERMO_MINIMO) return 'Digite ao menos três letras do nome do município.';
    if (this.buscando()) return 'Buscando municípios…';
    return 'Nenhum município com esse nome.';
  });

  protected readonly grupos = computed<readonly UiComboboxGroup[]>(() => {
    const escolhidos = this.values();
    const opcao = (codigo: string): UiComboboxOption => ({ value: codigo, label: this.nomes.rotulo(codigo) });
    const achados = this.encontrados()
      .filter((municipio) => !escolhidos.includes(municipio.codigoIbge))
      .map((municipio) => opcao(municipio.codigoIbge));
    return [
      ...(escolhidos.length > 0 ? [{ label: escolhidos.length > 1 ? 'Escolhidos' : 'Escolhido', options: escolhidos.map(opcao) }] : []),
      ...(achados.length > 0 ? [{ label: 'Encontrados', options: achados }] : []),
    ];
  });

  protected buscar(termo: string): void {
    const limpo = termo.trim();
    this.termo.set(limpo);
    this.falha.set(null);
    this.buscando.set(limpo.length >= TERMO_MINIMO);
    // O resultado do termo anterior sai ao começar a busca nova: numa conexão lenta, ele seguiria
    // escolhível enquanto o operador já procura outro município.
    this.encontrados.set([]);
    this.termos.next(limpo);
  }
}
