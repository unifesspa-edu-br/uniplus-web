import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';

let proximoId = 0;

interface LinhaDaReferencia {
  readonly rotulo: string;
  readonly valor: string;
  readonly ehCodigo: boolean;
}

function primeiraLetraMinuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

function linhasDaReferencia(
  referencia: Extract<ReferenciaAoSuporte, { origem: 'servidor' }>,
  passo: string | null,
): LinhaDaReferencia[] {
  const candidatas: readonly (Omit<LinhaDaReferencia, 'valor'> & { valor: string | null })[] = [
    { rotulo: 'Passo', valor: passo, ehCodigo: false },
    { rotulo: 'Código do erro', valor: referencia.codigoDoErro, ehCodigo: true },
    { rotulo: 'Identificador do pedido', valor: referencia.identificadorDoPedido, ehCodigo: true },
  ];
  return candidatas.filter((linha): linha is LinhaDaReferencia => linha.valor !== null);
}

function fraseDaTela(codigo: string, passo: string | null): string {
  const doPasso = passo === null ? '' : `${primeiraLetraMinuscula(passo)}, `;
  return `Informe ao suporte: ${doPasso}código ${codigo}.`;
}

/**
 * O que a pessoa passa ao suporte para ele achar o erro: o passo, o código do erro e o identificador
 * do pedido, em texto que se lê, se dita e se copia. Cada linha só aparece quando tem valor. O erro
 * que a própria tela detecta, sem pedido à API, sai numa frase só, com o código da tela. "Copiar"
 * só aparece onde o navegador permite escrever na área de transferência, e não sai no papel.
 */
@Component({
  selector: 'ui-referencia-ao-suporte',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'referencia-ao-suporte' },
  template: `
    <div [id]="idDoTexto">
      @if (frase(); as frase) {
        <p class="referencia-ao-suporte__texto">{{ frase }}</p>
      } @else {
        <p class="referencia-ao-suporte__titulo">Informe ao suporte:</p>
        <dl class="referencia-ao-suporte__linhas">
          @for (linha of linhas(); track linha.rotulo) {
            <div class="referencia-ao-suporte__linha">
              <dt>{{ linha.rotulo }}</dt>
              <dd>
                @if (linha.ehCodigo) {
                  <code translate="no">{{ linha.valor }}</code>
                } @else {
                  {{ linha.valor }}
                }
              </dd>
            </div>
          }
        </dl>
      }
    </div>
    @if (areaDeTransferencia) {
      <div class="referencia-ao-suporte__acoes u-no-print">
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          [attr.aria-describedby]="idDoTexto"
          (click)="copiar()"
        >
          Copiar
        </button>
        <span class="referencia-ao-suporte__aviso" role="status">{{ aviso() }}</span>
      </div>
    }
  `,
})
export class ReferenciaAoSuporteComponent {
  readonly referencia = input.required<ReferenciaAoSuporte>();
  /** Como a tela nomeia o passo, por exemplo "Passo 4 — Vagas". */
  readonly passo = input<string | null>(null);

  protected readonly idDoTexto = `ui-referencia-ao-suporte-${proximoId++}`;
  protected readonly areaDeTransferencia =
    inject(DOCUMENT).defaultView?.navigator.clipboard ?? null;

  protected readonly frase = computed(() => {
    const referencia = this.referencia();
    return referencia.origem === 'tela' ? fraseDaTela(referencia.codigo, this.passo()) : null;
  });

  protected readonly linhas = computed(() => {
    const referencia = this.referencia();
    return referencia.origem === 'servidor' ? linhasDaReferencia(referencia, this.passo()) : [];
  });

  private readonly textoParaCopiar = computed(
    () =>
      this.frase() ??
      `${this.linhas()
        .map((linha) => (linha.ehCodigo ? `${linha.rotulo}: ${linha.valor}` : linha.valor))
        .join('. ')}.`,
  );

  protected readonly aviso = linkedSignal<string, string>({
    source: this.textoParaCopiar,
    computation: () => '',
  });

  protected async copiar(): Promise<void> {
    if (!this.areaDeTransferencia) return;
    const texto = this.textoParaCopiar();
    this.aviso.set('');
    const aviso = await this.copiarTexto(this.areaDeTransferencia, texto);
    if (texto === this.textoParaCopiar()) this.aviso.set(aviso);
  }

  private async copiarTexto(area: Clipboard, texto: string): Promise<string> {
    try {
      await area.writeText(texto);
      return 'Copiado.';
    } catch {
      return 'Não foi possível copiar. Selecione o texto e copie.';
    }
  }
}
