import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterEveryRender,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { mediaQuerySignal } from '@uniplus/shared-core/dom';
import { NotificationService, type AnuncioDeAviso } from '@uniplus/shared-core/notifications';
import { AvisoComponent } from '../aviso/aviso';
import {
  CONSULTA_COMPACTA,
  LIMITE_COMPACTO,
  LIMITE_NORMAL,
  destinoDoFoco,
  dividirAvisos,
  type DestinoDoFoco,
} from './avisos-visiveis';
import { FRACAO_DA_TELA, ajustarLimite, medirRegiao, registrarAlturas } from './altura-dos-avisos';
import { destinoDoControle, devolverFoco, focarDestino, listaTemOFoco } from './foco-dos-avisos';

let proximoId = 0;

/**
 * Apresentacional (ADR-0017): renderiza a fila de avisos mantida pelo
 * `NotificationService` (`shared-core`).
 *
 * Coloque uma única instância no shell de cada app:
 * ```html
 * <ui-notification-host />
 * ```
 *
 * **Acessibilidade (WCAG 2.1 AA + e-MAG 3.1):**
 * - Container com `role="region"` + `aria-label` descritivo.
 * - O host tem duas regiões de anúncio, escondidas da vista e presentes desde o início (uma
 *   educada, outra assertiva); os cartões não têm papel de anúncio, então mover, agrupar ou
 *   recolher um aviso não o anuncia de novo.
 * - Ficam à vista os avisos mais novos (1 em tela compacta, 3 nas demais); o resto fica no botão
 *   "Mais N avisos", que abre a lista inteira (a única parte que rola).
 * - Ao fechar um aviso o foco vai ao "Fechar" do próximo aviso à vista, senão ao "Mais N", senão
 *   ao conteúdo principal.
 */
@Component({
  selector: 'ui-notification-host',
  standalone: true,
  imports: [AvisoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-host.html',
  host: { '(window:resize)': 'reavaliarAltura()', '(document:pointerdown)': 'esquecerFoco()' },
})
export class NotificationHostComponent {
  private readonly service = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);
  private readonly compacta = mediaQuerySignal(CONSULTA_COMPACTA);

  protected readonly idDaLista = `ui-notification-host-recolhidos-${proximoId++}`;
  private readonly destroyRef = inject(DestroyRef);
  private readonly alturas = new Map<number, number>();
  private focoNaPilha: DestinoDoFoco | null = null;
  private readonly limiteDaTela = computed(() =>
    this.compacta() ? LIMITE_COMPACTO : LIMITE_NORMAL,
  );
  /** Quantos avisos ficam à vista: o limite da tela, reduzido enquanto a altura não couber. */
  protected readonly limite = linkedSignal<number>(() => this.limiteDaTela());
  protected readonly divisao = computed(() =>
    dividirAvisos(this.service.notifications(), this.limite()),
  );
  protected readonly listaAberta = linkedSignal<number, boolean>({
    source: () => this.divisao().recolhidos.length,
    computation: (quantidade, anterior) => quantidade > 0 && (anterior?.value ?? false),
  });
  protected readonly rotuloDeMais = computed(() => {
    const quantidade = this.divisao().recolhidos.length;
    return quantidade === 1 ? 'Mais 1 aviso' : `Mais ${quantidade} avisos`;
  });
  protected readonly anunciosPolidos = computed(() => this.anunciosDo(false));
  protected readonly anunciosAssertivos = computed(() => this.anunciosDo(true));

  constructor() {
    afterNextRender(() => this.observarAltura());
    afterEveryRender(() => devolverFoco(this.raiz, this.doc, this.focoNaPilha));
  }

  protected lembrarFoco(evento: FocusEvent): void {
    this.focoNaPilha = destinoDoControle(this.raiz, evento.target as Element | null);
  }

  protected esquecerFoco(): void {
    this.focoNaPilha = null;
  }

  /** Reduz ou devolve avisos à vista conforme a altura medida; sem `ResizeObserver` (servidor) não mede. */
  protected reavaliarAltura(): void {
    const regiao = this.raiz.querySelector<HTMLElement>('.toast-region');
    const janela = this.doc.defaultView;
    if (regiao === null || janela === null) return;
    registrarAlturas(regiao, this.alturas, this.service.notifications());
    const proximo = this.divisao().recolhidos.at(-1)?.id;
    const medida = medirRegiao(regiao, this.alturas, proximo, janela.innerHeight * FRACAO_DA_TELA);
    this.limite.update((atual) => ajustarLimite(atual, this.limiteDaTela(), medida));
  }

  protected dispensar(id: number): void {
    const fila = this.service.notifications();
    const destino = destinoDoFoco(fila, id, this.limite(), this.listaAberta());
    this.service.dismiss(id);
    this.focarAposRenderizar(destino);
  }

  protected alternarLista(): void {
    if (this.listaAberta() && listaTemOFoco(this.raiz, this.doc)) {
      focarDestino(this.raiz, this.doc, { tipo: 'mais-avisos' });
    }
    this.listaAberta.update((aberta) => !aberta);
  }

  private anunciosDo(assertivo: boolean): readonly AnuncioDeAviso[] {
    return this.service.anuncios().filter((anuncio) => anuncio.assertivo === assertivo);
  }

  private observarAltura(): void {
    const regiao = this.raiz.querySelector('.toast-region');
    if (regiao === null || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => this.reavaliarAltura());
    observador.observe(regiao);
    this.destroyRef.onDestroy(() => observador.disconnect());
  }

  private focarAposRenderizar(destino: DestinoDoFoco): void {
    afterNextRender(() => focarDestino(this.raiz, this.doc, destino), { injector: this.injector });
  }
}
