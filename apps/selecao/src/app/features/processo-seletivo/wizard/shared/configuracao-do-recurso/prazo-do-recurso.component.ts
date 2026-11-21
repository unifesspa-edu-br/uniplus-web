import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { haRecusaAtiva, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import { opcoesParaEscolha, type OpcaoDoVocabulario } from './parametros-do-recurso';

/**
 * Os `id` das partes do prazo. Cada tela os dá na grafia dela, porque os blocos de recusa são
 * também o destino de foco da gravação recusada.
 */
export interface IdsDoPrazo {
  readonly valor: string;
  readonly unidade: string;
  readonly recusasDoValor: string;
  readonly recusasDaUnidade: string;
  /** O parágrafo do problema do prazo, quando a tela mostra um. */
  readonly problema?: string;
  /** O parágrafo de ajuda, que a tela desenha fora do componente e que descreve os dois campos. */
  readonly ajuda?: string;
}

const SUFIXO_DA_OPCAO_FORA_DO_VOCABULARIO = 'não é mais oferecida';

function idsPresentes(ids: readonly (string | undefined)[]): string | null {
  const presentes = ids.filter((id): id is string => !!id);
  return presentes.length > 0 ? presentes.join(' ') : null;
}

/**
 * Um prazo do recurso: o valor e a unidade, sob a legenda que diz de qual prazo se trata. Serve ao
 * prazo de interposição e ao de 2ª instância, na regra de recurso da fase e em cada recurso da
 * etapa.
 *
 * O componente é controlado: mostra `valor` e `unidade` e avisa o que a pessoa digitou ou
 * escolheu, sem conferir nada; quem recusa o prazo é a API. A unidade já gravada que o vocabulário
 * não oferece mais continua à vista e marcada. Cada controle é marcado como inválido só pela
 * recusa que a ele se refere, e descrito pela ajuda, pelo problema do prazo e por essa recusa.
 */
@Component({
  selector: 'sel-prazo-do-recurso',
  imports: [RecusasDoCampoComponent],
  templateUrl: './prazo-do-recurso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class PrazoDoRecursoComponent {
  readonly legenda = input.required<string>();
  /** Texto ao fim da legenda, como "(obrigatório)"; com ele os dois controles são obrigatórios. */
  readonly textoDeObrigatoriedade = input<string | null>(null);
  readonly valor = input.required<string>();
  readonly unidade = input.required<string>();
  /** As unidades que a tela oferece. */
  readonly unidades = input.required<readonly OpcaoDoVocabulario[]>();
  /** O que a opção em branco da unidade diz. */
  readonly opcaoEmBranco = input('Escolha a unidade');
  readonly desabilitado = input(false);
  readonly ids = input.required<IdsDoPrazo>();
  /** O que impede o prazo, em texto; marca valor e unidade como inválidos. */
  readonly problema = input<string | null>(null);
  readonly recusasDoValor = input<readonly RecusaOrdenada[]>([]);
  readonly recusasDaUnidade = input<readonly RecusaOrdenada[]>([]);

  readonly valorAlterado = output<string>();
  readonly unidadeAlterada = output<string>();

  protected readonly legendaCompleta = computed(() =>
    [this.legenda(), this.textoDeObrigatoriedade()].filter((texto) => texto).join(' '),
  );
  protected readonly obrigatorio = computed(() => !!this.textoDeObrigatoriedade());
  protected readonly opcoes = computed(() =>
    opcoesParaEscolha(this.unidades(), this.unidade()).map((opcao) => ({
      ...opcao,
      texto: opcao.foraDoVocabulario
        ? `${opcao.rotulo} — ${SUFIXO_DA_OPCAO_FORA_DO_VOCABULARIO}`
        : opcao.rotulo,
    })),
  );
  protected readonly valorInvalido = computed(() => this.invalido(this.recusasDoValor()));
  protected readonly unidadeInvalida = computed(() => this.invalido(this.recusasDaUnidade()));
  protected readonly descritoPeloValor = computed(() =>
    this.descritoPor(this.recusasDoValor(), this.ids().recusasDoValor),
  );
  protected readonly descritaPelaUnidade = computed(() =>
    this.descritoPor(this.recusasDaUnidade(), this.ids().recusasDaUnidade),
  );

  protected digitado(evento: Event): void {
    this.valorAlterado.emit((evento.target as HTMLInputElement).value);
  }

  protected escolhida(evento: Event): void {
    this.unidadeAlterada.emit((evento.target as HTMLSelectElement).value);
  }

  private invalido(recusas: readonly RecusaOrdenada[]): 'true' | null {
    return this.problema() !== null || haRecusaAtiva(recusas) ? 'true' : null;
  }

  private descritoPor(recusas: readonly RecusaOrdenada[], idDasRecusas: string): string | null {
    const { ajuda, problema } = this.ids();
    return idsPresentes([
      ajuda,
      this.problema() === null ? undefined : problema,
      recusas.length > 0 ? idDasRecusas : undefined,
    ]);
  }
}
