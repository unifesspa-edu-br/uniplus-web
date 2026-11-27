import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import type { LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';
import { formatarNumeroPtBr } from '@uniplus/shared-utils';

import {
  agruparOcorrencias,
  listaDeLinhas,
  type GrupoDeOcorrencias,
  type TipoDeGrupo,
} from './resultado-do-lote';

/** Quantos itens de uma aba aparecem de início e a cada "Mostrar mais". */
const ITENS_POR_PAGINA = 20;

let proximaInstancia = 0;

function abaDestinadaPelaTecla(tecla: string, indice: number, total: number): number | undefined {
  const destinos: Record<string, number | undefined> = {
    ArrowRight: (indice + 1) % total,
    ArrowLeft: (indice - 1 + total) % total,
    Home: 0,
    End: total - 1,
  };
  return destinos[tecla];
}

/**
 * As ocorrências de um lote de notas em abas, uma por tipo, paginadas: quem é cada inscrito afetado
 * e, na linha sem inscrito, o número da linha com o nome, o sexo e o CPF mascarado que o arquivo
 * traz, para achá-la nele. O CPF já vem mascarado da API.
 */
@Component({
  selector: 'sel-lote-de-notas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lote-de-notas.component.html',
  styleUrls: ['./compartilhado.css', './lote-de-notas.component.css'],
})
export class LoteDeNotasComponent {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly prefixo = `lote-${proximaInstancia++}`;

  readonly lote = input.required<LoteDeNotasDoEnemDto>();

  protected readonly itensPorPagina = ITENS_POR_PAGINA;
  protected readonly quantidade = formatarNumeroPtBr;
  protected readonly linhas = listaDeLinhas;
  protected readonly grupos = computed(() => agruparOcorrencias(this.lote()));

  /** Trocar de lote volta à primeira aba e à primeira página de cada uma. */
  private readonly escolhida = linkedSignal<readonly GrupoDeOcorrencias[], TipoDeGrupo | null>({
    source: this.grupos,
    computation: () => null,
  });
  private readonly paginas = linkedSignal<readonly GrupoDeOcorrencias[], Map<TipoDeGrupo, number>>({
    source: this.grupos,
    computation: () => new Map(),
  });

  protected readonly ativa = computed<GrupoDeOcorrencias | null>(() => {
    const grupos = this.grupos();
    return grupos.find((g) => g.tipo === this.escolhida()) ?? grupos[0] ?? null;
  });

  protected readonly visiveis = computed(() => {
    const ativa = this.ativa();
    if (ativa === null) return [];
    const quantos = this.paginas().get(ativa.tipo) ?? ITENS_POR_PAGINA;
    return ativa.itens.slice(0, quantos);
  });

  protected readonly restantes = computed(() => {
    const ativa = this.ativa();
    return ativa === null ? 0 : ativa.itens.length - this.visiveis().length;
  });

  protected readonly proximaPagina = computed(() => Math.min(this.restantes(), ITENS_POR_PAGINA));

  protected idDaAba(tipo: TipoDeGrupo): string {
    return `${this.prefixo}-aba-${tipo}`;
  }

  protected idDoPainel(tipo: TipoDeGrupo): string {
    return `${this.prefixo}-painel-${tipo}`;
  }

  protected escolher(tipo: TipoDeGrupo): void {
    this.escolhida.set(tipo);
  }

  /** Setas, Home e End movem a seleção entre as abas, que se ativam ao receber o foco. */
  protected aoTeclar(evento: KeyboardEvent, indice: number): void {
    const destino = abaDestinadaPelaTecla(evento.key, indice, this.grupos().length);
    if (destino === undefined) return;
    evento.preventDefault();
    const tipo = this.grupos()[destino].tipo;
    this.escolher(tipo);
    this.elemento.nativeElement.querySelector<HTMLElement>(`#${this.idDaAba(tipo)}`)?.focus();
  }

  protected mostrarMais(): void {
    const ativa = this.ativa();
    if (ativa === null) return;
    const mostrados = this.visiveis().length;
    this.paginas.update((atual) => new Map(atual).set(ativa.tipo, mostrados + ITENS_POR_PAGINA));
    this.focarLinhaDoPainel(ativa.tipo, mostrados);
  }

  /** O botão some com a última página: o foco vai para a primeira linha que acabou de entrar. */
  private focarLinhaDoPainel(tipo: TipoDeGrupo, posicao: number): void {
    afterNextRender(
      () => {
        const linhas = this.elemento.nativeElement.querySelectorAll<HTMLElement>(
          `#${this.idDoPainel(tipo)} tbody th`,
        );
        linhas[posicao]?.focus();
      },
      { injector: this.injector },
    );
  }
}
