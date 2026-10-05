import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { useApiResource } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  certamePublicoRequest,
  type CertamePublicadoDto,
  type ExigenciaDocumentalCertameDto,
} from '@uniplus/shared-data/selecao';
import { AlertComponent, EmptyStateComponent, SpinnerComponent, TagComponent } from '@uniplus/shared-ui/components';

/** A exigência condicional vale só para quem está na situação que o edital descreve. */
const APLICABILIDADE_CONDICIONAL = 'CONDICIONAL';

/**
 * Accordion "Documentos exigidos" de um item de Editais: o que o edital publicado pede ao
 * candidato, e o modelo para baixar quando a exigência oferece um — a declaração que ele
 * preenche, assina e devolve na inscrição.
 *
 * O certame publicado só é lido quando o painel abre pela primeira vez: a lista mostra uma página
 * de certames, e ler o edital de cada um sem que ninguém peça seria uma consulta por item.
 */
@Component({
  selector: 'ptl-certame-documentos',
  standalone: true,
  imports: [AlertComponent, EmptyStateComponent, SpinnerComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './certame-documentos.css',
  templateUrl: './certame-documentos.html',
})
export class CertameDocumentosComponent {
  /** Identifica o certame — vira o sufixo dos ids do botão e do painel, únicos por item da lista. */
  readonly certameId = input.required<string>();
  /** Nome do certame, no nome acessível do botão e dos links, para distinguir um item do outro (WCAG 2.4.9). */
  readonly certameNome = input('');

  private readonly basePath = inject(SELECAO_BASE_PATH);

  protected readonly aberto = signal(false);
  /** Fica ligado depois da primeira abertura: fechar e reabrir não relê o certame. */
  private readonly pedido = signal(false);

  private readonly certame = useApiResource<CertamePublicadoDto>(() =>
    this.pedido() ? certamePublicoRequest(this.basePath, this.certameId()) : undefined,
  );

  protected readonly botaoId = computed(() => `documentos-botao-${this.certameId()}`);
  protected readonly painelId = computed(() => `documentos-painel-${this.certameId()}`);

  protected readonly documentos = computed<readonly ExigenciaDocumentalCertameDto[]>(
    () => this.certame.data()?.documentosExigidos ?? [],
  );
  protected readonly carregando = computed(() => this.certame.isLoading());
  protected readonly falhou = computed(
    () => this.certame.error() !== undefined || this.certame.problem() !== null,
  );

  protected alternar(): void {
    this.pedido.set(true);
    this.aberto.update((aberto) => !aberto);
  }

  protected aQuemSeAplica(exigencia: ExigenciaDocumentalCertameDto): string {
    return exigencia.aplicabilidade === APLICABILIDADE_CONDICIONAL
      ? 'Só para quem está na situação descrita no edital'
      : 'Todo candidato';
  }

  protected formatos(exigencia: ExigenciaDocumentalCertameDto): string {
    const lista = exigencia.formatos.lista ?? [];
    return exigencia.formatos.qualquer || lista.length === 0 ? 'Qualquer formato' : lista.join(', ');
  }
}
