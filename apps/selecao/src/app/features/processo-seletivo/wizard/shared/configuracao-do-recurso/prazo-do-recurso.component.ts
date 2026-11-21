import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { textoDaSituacaoDasOpcoes, type SituacaoDasOpcoes } from '@uniplus/shared-ui/components';

import { migrarFocoAposRenderizar } from '../foco-apos-renderizar';
import { haRecusaAtiva, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import { opcoesParaEscolha, type OpcaoDoVocabulario } from './parametros-do-recurso';

/**
 * Os `id` das partes do prazo. Cada tela os dá na grafia dela, porque os blocos de recusa e o
 * parágrafo de situação são também o destino de foco da gravação recusada.
 */
export interface IdsDoPrazo {
  readonly valor: string;
  readonly unidade: string;
  readonly recusasDoValor: string;
  readonly recusasDaUnidade: string;
  /** O parágrafo que ocupa o lugar da unidade enquanto não há unidade para escolher. */
  readonly situacao: string;
  /** O parágrafo de ajuda, que a tela desenha fora do componente e que descreve os dois campos. */
  readonly ajuda?: string;
  /** O botão que retira o prazo, quando o prazo é retirável. */
  readonly retirar?: string;
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
 * recusa que a ele se refere, e descrito pela ajuda e por essa recusa.
 *
 * Sem unidade para escolher (carregando, falha ou lista vazia) e sem unidade gravada, o seletor
 * fica desabilitado e um parágrafo de situação diz por quê; ele aceita foco por código e, quando
 * as opções chegam com o foco nele, o foco passa ao seletor.
 */
@Component({
  selector: 'sel-prazo-do-recurso',
  imports: [RecusasDoCampoComponent],
  templateUrl: './prazo-do-recurso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class PrazoDoRecursoComponent {
  private readonly injetor = inject(Injector);

  readonly legenda = input.required<string>();
  /** Texto ao fim da legenda, como "(obrigatório)"; com ele os dois controles são obrigatórios. */
  readonly textoDeObrigatoriedade = input<string | null>(null);
  readonly valor = input.required<string>();
  readonly unidade = input.required<string>();
  /** O nome que a leitura deu à unidade gravada, para a que o vocabulário não oferece mais. */
  readonly rotuloLido = input<string | undefined>(undefined);
  /** As unidades que a API oferece. */
  readonly unidades = input.required<readonly OpcaoDoVocabulario[]>();
  readonly situacao = input<SituacaoDasOpcoes>('pronta');
  /** O que a opção em branco da unidade diz. */
  readonly opcaoEmBranco = input('Escolha a unidade');
  readonly desabilitado = input(false);
  /** O prazo pode ser retirado por um botão, como o da 2ª instância lido sem instância superior. */
  readonly retiravel = input(false);
  readonly textoDoBotaoDeRetirar = input('Retirar o prazo');
  readonly ids = input.required<IdsDoPrazo>();
  readonly recusasDoValor = input<readonly RecusaOrdenada[]>([]);
  readonly recusasDaUnidade = input<readonly RecusaOrdenada[]>([]);

  readonly valorAlterado = output<string>();
  readonly unidadeAlterada = output<string>();
  readonly retirar = output<void>();

  protected readonly legendaCompleta = computed(() =>
    [this.legenda(), this.textoDeObrigatoriedade()].filter((texto) => texto).join(' '),
  );
  protected readonly obrigatorio = computed(() => !!this.textoDeObrigatoriedade());
  protected readonly opcoes = computed(() =>
    opcoesParaEscolha(this.unidades(), this.unidade(), this.rotuloLido()).map((opcao) => ({
      ...opcao,
      texto: opcao.foraDoVocabulario
        ? `${opcao.rotulo} — ${SUFIXO_DA_OPCAO_FORA_DO_VOCABULARIO}`
        : opcao.rotulo,
    })),
  );
  protected readonly semUnidadeParaEscolher = computed(() => this.opcoes().length === 0);
  protected readonly textoDaSituacao = computed(() => textoDaSituacaoDasOpcoes(this.situacao()));
  protected readonly unidadeDesabilitada = computed(
    () => this.desabilitado() || this.semUnidadeParaEscolher(),
  );
  protected readonly valorInvalido = computed(() => this.invalido(this.recusasDoValor()));
  protected readonly unidadeInvalida = computed(() => this.invalido(this.recusasDaUnidade()));
  protected readonly descritoPeloValor = computed(() =>
    this.descritoPor(this.recusasDoValor(), this.ids().recusasDoValor, undefined),
  );
  protected readonly descritaPelaUnidade = computed(() =>
    this.descritoPor(
      this.recusasDaUnidade(),
      this.ids().recusasDaUnidade,
      this.semUnidadeParaEscolher() ? this.ids().situacao : undefined,
    ),
  );
  protected readonly descritaPelaSituacao = computed(() =>
    idsPresentes([this.recusasDaUnidade().length > 0 ? this.ids().recusasDaUnidade : undefined]),
  );

  constructor() {
    effect(() => {
      if (!this.semUnidadeParaEscolher()) untracked(() => this.passarFocoDaSituacaoAoSeletor());
    });
  }

  protected digitado(evento: Event): void {
    this.valorAlterado.emit((evento.target as HTMLInputElement).value);
  }

  protected escolhida(evento: Event): void {
    this.unidadeAlterada.emit((evento.target as HTMLSelectElement).value);
  }

  private passarFocoDaSituacaoAoSeletor(): void {
    const { situacao, unidade } = this.ids();
    migrarFocoAposRenderizar(this.injetor, situacao, unidade);
  }

  private invalido(recusas: readonly RecusaOrdenada[]): 'true' | null {
    return haRecusaAtiva(recusas) ? 'true' : null;
  }

  private descritoPor(
    recusas: readonly RecusaOrdenada[],
    idDasRecusas: string,
    idDaSituacao: string | undefined,
  ): string | null {
    return idsPresentes([
      this.ids().ajuda,
      idDaSituacao,
      recusas.length > 0 ? idDasRecusas : undefined,
    ]);
  }
}
