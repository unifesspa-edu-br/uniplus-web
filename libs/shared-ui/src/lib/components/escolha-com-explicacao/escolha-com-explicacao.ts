import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';

import { type RecusaDoCampo, RecusaDoCampoComponent } from '../recusa-do-campo/recusa-do-campo';
import { idsDasRecusasDoCampo, recusasNaTela } from './recusas-da-escolha';

export interface OpcaoDeEscolhaComExplicacao {
  readonly codigo: string;
  readonly rotulo: string;
  /** A explicação da opção. Sem ela, a opção aparece só com o rótulo. */
  readonly descricao?: string;
}

/** Em que ponto está a leitura das opções: ainda chegando, falhou ou já entregou a lista. */
export type SituacaoDasOpcoes = 'carregando' | 'falhou' | 'pronta';

interface OpcaoNaTela {
  readonly codigo: string;
  readonly rotulo: string;
  readonly descricao: string | undefined;
  readonly idDoCampo: string;
  readonly idDaExplicacao: string;
  readonly descritaPor: string | null;
}

const TEXTO_CARREGANDO = 'Carregando as opções…';
const TEXTO_FALHOU = 'As opções não carregaram. Use "Tentar de novo" no aviso do topo do passo.';

/** O que o parágrafo de situação diz enquanto não há opção para escolher. */
export function textoDaSituacaoDasOpcoes(
  situacao: SituacaoDasOpcoes,
  textoSemOpcoes = 'Nenhuma opção disponível.',
): string {
  if (situacao === 'carregando') return TEXTO_CARREGANDO;
  return situacao === 'falhou' ? TEXTO_FALHOU : textoSemOpcoes;
}

function idsJuntos(ids: readonly (string | null)[]): string | null {
  const presentes = ids.filter((id) => id !== null);
  return presentes.length > 0 ? presentes.join(' ') : null;
}

/**
 * Uma escolha entre opções, cada uma com rótulo e uma explicação própria (por exemplo, as opções de
 * um vocabulário que a API entrega com `descricao`). É um grupo de opções exclusivas: a legenda
 * nomeia o grupo, e cada opção é descrita pela instrução e pela própria explicação, cada uma só
 * quando existe.
 *
 * A recusa da API que ainda vale (`recusas`) marca o grupo e cada opção como inválidos. As recusas
 * pertencem ao campo inteiro: ficam depois das opções, dentro do grupo, e descrevem o grupo.
 *
 * Enquanto não há opção para escolher, um parágrafo de situação ocupa o lugar delas, diz por quê
 * (carregando, falhou ou lista vazia) e é o destino de foco do campo. Quando as opções chegam e o
 * foco estava nele, o foco passa para a opção marcada ou, sem nenhuma marcada, para a primeira.
 *
 * O componente é controlado: `valor` diz qual opção está marcada e `escolhido` devolve o código da
 * que a pessoa escolheu. Quem usa responde atualizando `valor`; se não atualizar, a marca volta à
 * opção de `valor`.
 */
@Component({
  selector: 'ui-escolha-com-explicacao',
  standalone: true,
  imports: [RecusaDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './escolha-com-explicacao.html',
})
export class EscolhaComExplicacaoComponent {
  private readonly injector = inject(Injector);

  /** Base dos identificadores das partes e do `name` do grupo; precisa ser única na página. */
  readonly prefixoDoId = input.required<string>();
  readonly legenda = input.required<string>();
  /** O que a pessoa precisa saber antes de escolher; descreve todas as opções. */
  readonly instrucao = input('');
  readonly opcoes = input<readonly OpcaoDeEscolhaComExplicacao[]>([]);
  /** O código da opção marcada; vazio quando nenhuma está. */
  readonly valor = input('');
  /** Recusas que ainda valem: marcam o campo como inválido. */
  readonly recusas = input<readonly RecusaDoCampo[]>([]);
  /** Recusas que a pessoa já tocou por baixo: seguem à vista, sem marcar o campo como inválido. */
  readonly recusasAConferir = input<readonly RecusaDoCampo[]>([]);
  /** Nota que explica as recusas a conferir; aparece junto delas. */
  readonly notaDasRecusasAConferir = input<string | null>(null);
  /** Texto ao fim da legenda, como "(obrigatório)"; com ele o grupo é anunciado como obrigatório. */
  readonly textoDeObrigatoriedade = input<string | null>(null);
  /** A pessoa não pode escolher agora, como num processo que não aceita edição. */
  readonly desabilitado = input(false);
  readonly situacao = input<SituacaoDasOpcoes>('pronta');
  /** O que o parágrafo de situação diz quando a lista chega vazia. */
  readonly textoSemOpcoes = input('Nenhuma opção disponível.');

  readonly escolhido = output<string>();

  private readonly campos = viewChildren<ElementRef<HTMLInputElement>>('campoDaOpcao');
  private readonly paragrafoDaSituacao = viewChild<ElementRef<HTMLElement>>('paragrafoDaSituacao');

  protected readonly idDoGrupo = this.idDa('grupo');
  protected readonly idDaInstrucao = this.idDa('instrucao');
  protected readonly idDaNota = this.idDa('nota-das-recusas-a-conferir');
  protected readonly idDaSituacao = this.idDa('situacao');

  protected readonly legendaCompleta = computed(() =>
    [this.legenda(), this.textoDeObrigatoriedade()].filter((texto) => texto).join(' '),
  );
  protected readonly obrigatorio = computed(() => !!this.textoDeObrigatoriedade());
  protected readonly comErroVisivel = computed(() => this.recusas().length > 0);
  protected readonly recusasDesenhadas = computed(() =>
    recusasNaTela(this.recusas(), `${this.prefixoDoId()}-recusa`),
  );
  protected readonly recusasAConferirDesenhadas = computed(() =>
    recusasNaTela(this.recusasAConferir(), `${this.prefixoDoId()}-a-conferir`),
  );
  /** A nota só existe junto de recusas a conferir. */
  protected readonly notaVisivel = computed(() =>
    this.recusasAConferir().length > 0 ? this.notaDasRecusasAConferir() : null,
  );
  protected readonly semOpcao = computed(() => this.opcoes().length === 0);
  protected readonly textoDaSituacao = computed(() =>
    textoDaSituacaoDasOpcoes(this.situacao(), this.textoSemOpcoes()),
  );
  protected readonly descritaPeloCampo = computed(() =>
    idsJuntos(
      idsDasRecusasDoCampo(
        this.recusasDesenhadas(),
        this.recusasAConferirDesenhadas(),
        this.notaVisivel() ? this.idDaNota() : null,
      ),
    ),
  );
  protected readonly opcoesNaTela = computed(() => this.opcoes().map((o) => this.naTela(o)));

  constructor() {
    effect(() => {
      const haOpcao = !this.semOpcao();
      untracked(() => this.levarFocoDaSituacaoParaAsOpcoes(haOpcao));
    });
  }

  /**
   * Leva o foco ao alvo do campo: a opção marcada, a primeira opção ou, sem opção nenhuma, o
   * parágrafo de situação.
   */
  focar(): void {
    const campos = this.campos().map((campo) => campo.nativeElement);
    const alvo = campos.find((campo) => campo.checked) ?? campos[0];
    (alvo ?? this.paragrafoDaSituacao()?.nativeElement)?.focus();
  }

  /**
   * O navegador marca a opção antes de o componente avisar. Quem usa pode não aceitar a escolha e
   * manter `valor`; depois do desenho, a marca nativa volta a refletir `valor`.
   */
  protected escolher(codigo: string): void {
    this.escolhido.emit(codigo);
    afterNextRender(() => this.alinharMarcaComOValor(), { injector: this.injector });
  }

  private alinharMarcaComOValor(): void {
    for (const { nativeElement: campo } of this.campos()) {
      campo.checked = campo.value === this.valor();
    }
  }

  private idDa(parte: string): () => string {
    return () => `${this.prefixoDoId()}-${parte}`;
  }

  private naTela(opcao: OpcaoDeEscolhaComExplicacao): OpcaoNaTela {
    const idDaExplicacao = `${this.prefixoDoId()}-explicacao-${opcao.codigo}`;
    return {
      ...opcao,
      descricao: opcao.descricao || undefined,
      idDoCampo: `${this.prefixoDoId()}-opcao-${opcao.codigo}`,
      idDaExplicacao,
      descritaPor: idsJuntos([
        this.instrucao() ? this.idDaInstrucao() : null,
        opcao.descricao ? idDaExplicacao : null,
      ]),
    };
  }

  private levarFocoDaSituacaoParaAsOpcoes(haOpcao: boolean): void {
    const paragrafo = this.paragrafoDaSituacao()?.nativeElement;
    if (haOpcao && paragrafo && document.activeElement === paragrafo) {
      afterNextRender(() => this.focar(), { injector: this.injector });
    }
  }
}
