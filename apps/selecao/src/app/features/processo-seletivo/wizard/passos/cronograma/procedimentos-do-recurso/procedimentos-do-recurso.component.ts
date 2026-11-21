import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';

import { areaDoEnem } from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import { membroDoEnum } from '../../../documento/membro-do-enum';
import type { RegraEscolhida } from '../../../documento/regra-escolhida';
import { VOCABULARIO_DE_TIPOS_DE_DECISAO } from '@uniplus/shared-data/configuracao';
import {
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
  type DocumentoDaConfiguracaoItemDeAvaliacao,
} from '@uniplus/shared-data/selecao';
import type {
  ItemDeAvaliacaoDaEtapa,
  ProcedimentoDeRecurso,
} from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { focarAposRenderizarSeSemFoco } from '../../../shared/foco-apos-renderizar';
import { rotuloDoTipoDeDecisaoLido } from '../../../shared/hidratacao/rotulo-do-tipo-de-decisao-lido';
import { tiposSemProcedimento } from '../../../shared/procedimentos-do-recurso/cobertura-dos-procedimentos';
import type { ModoDaSecao } from '../../../shared/modo-da-secao';
import type { IdentidadeDoProcedimento } from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import type { EscolhaDaRegra, TrocaDeModo } from './eventos-do-procedimento';
import { ProcedimentoDoTipoComponent } from './procedimento-do-tipo.component';
import { alvosOferecidos, tiposNaTela } from './procedimentos-na-tela';
import { procedimentoParaDocumento, procedimentosParaLeitura } from './procedimentos-para-leitura';
import type { RecusaDoProcedimento } from './recusas-do-procedimento';

/**
 * Apresenta os procedimentos do formulário e do documento. A edição usa as identidades do
 * documento e emite escolhas; quem monta a seção aplica a alteração e fornece o modo permitido.
 * A sugestão orienta a declaração inicial, sem preencher nem substituir a escolha.
 */
@Component({
  selector: 'sel-procedimentos-do-recurso',
  imports: [ProcedimentoDoTipoComponent, RecusaDoCampoComponent],
  templateUrl: './procedimentos-do-recurso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': 'semNadaParaLer()' },
})
export class ProcedimentosDoRecursoComponent {
  private readonly catalogoDeRegras = inject(CatalogoDeRegras);
  private readonly injector = inject(Injector);
  private readonly vocabulario = inject(VOCABULARIO_DE_TIPOS_DE_DECISAO);
  private readonly store = inject(ProcessoSeletivoStore);

  readonly procedimentos =
    input.required<
      readonly (ProcedimentoDeRecurso | DocumentoDaConfiguracaoProcedimentoDeRecurso)[]
    >();
  /** Os itens da etapa, que dão nome ao item contestado; vazio no recurso da fase. */
  readonly itensDaEtapa = input<
    readonly (ItemDeAvaliacaoDaEtapa | DocumentoDaConfiguracaoItemDeAvaliacao)[]
  >([]);
  /** O `id` do título, único na tela: a lista o referencia como rótulo, e os ids da edição partem dele. */
  readonly idDoTitulo = input.required<string>();
  readonly modo = input<ModoDaSecao>('consulta');
  /** Os tipos de decisão que a fase ou a etapa declara: só eles recebem procedimento novo. */
  readonly tiposDeclarados = input<readonly string[]>([]);
  /** As áreas do ENEM em que o recurso pode incidir, quando o lugar as tem. */
  readonly areasDoEnem = input<readonly string[]>([]);
  readonly temJanela = input(true);
  readonly sugestao = input<RegraEscolhida | null>(null);
  readonly recusas = input<readonly RecusaDoProcedimento[]>([]);
  /** O nível do título na hierarquia de quem mostra a seção: 3 numa seção da fase, 4 dentro de uma etapa. */
  readonly nivelDoTitulo = input<3 | 4>(4);

  readonly declarar = output<EscolhaDaRegra>();
  readonly trocarRegra = output<EscolhaDaRegra>();
  readonly remover = output<IdentidadeDoProcedimento>();
  readonly trocarModo = output<TrocaDeModo>();

  protected readonly recusasDaJanela = computed(() =>
    this.recusas()
      .filter(
        (recusa) =>
          recusa.tipoDeDecisao === null ||
          !this.tipos().some((tipo) => tipo.tipoDeDecisao === recusa.tipoDeDecisao),
      )
      .map((recusa) => recusa.recusa),
  );
  protected readonly idDaRecusaDaJanela = computed(() =>
    this.recusasDaJanela().length > 0 ? `${this.idDoTitulo()}-recusas-da-janela` : null,
  );
  protected readonly emConsulta = computed(() => this.modo() === 'consulta');
  protected readonly leituraEmLista = computed(
    () =>
      this.emConsulta() &&
      this.tiposDeclarados().length === 0 &&
      !this.procedimentos().some((procedimento) => 'regra' in procedimento) &&
      this.recusas().length === 0,
  );
  protected readonly regrasDoCatalogo = this.catalogoDeRegras.regrasProcedimento;
  protected readonly catalogoSemRegra = computed(
    () =>
      !this.catalogoDeRegras.carregando() &&
      this.catalogoDeRegras.erro() === null &&
      this.regrasDoCatalogo().length === 0,
  );

  /** Na consulta o nome é o que o processo lido traz; na edição, o do vocabulário da API. */
  private readonly rotuloDoTipo = computed(() =>
    this.emConsulta()
      ? rotuloDoTipoDeDecisaoLido(this.store.remoteSnapshot())
      : this.vocabulario.rotulo(),
  );
  protected readonly linhas = computed(() =>
    procedimentosParaLeitura(
      this.procedimentos(),
      this.regrasDoCatalogo(),
      this.itensDaEtapa(),
      this.rotuloDoTipo(),
    ),
  );
  protected readonly tiposSemConversao = computed(
    () =>
      new Set(
        this.procedimentos()
          .filter((atual) => procedimentoParaDocumento(atual, this.itensDaEtapa()) === undefined)
          .map((atual) => atual.tipoDeDecisao),
      ),
  );
  protected readonly linhasAntigas = computed(() =>
    procedimentosParaLeitura(
      this.procedimentos().filter(
        (atual) => procedimentoParaDocumento(atual, this.itensDaEtapa()) === undefined,
      ),
      this.regrasDoCatalogo(),
      this.itensDaEtapa(),
      this.rotuloDoTipo(),
    ),
  );
  protected readonly semNadaParaLer = computed(
    () =>
      this.emConsulta() &&
      this.linhas().length === 0 &&
      this.recusas().length === 0 &&
      this.tipos().length === 0,
  );
  private readonly tiposDoDocumento = computed(() =>
    this.tiposDeclarados().flatMap(
      (codigo) => membroDoEnum(TipoDeDecisaoDoDocumento, codigo) ?? [],
    ),
  );
  protected readonly tiposSemProcedimento = computed(() =>
    tiposSemProcedimento(this.temJanela(), this.tiposDoDocumento(), this.procedimentos()),
  );
  private readonly procedimentosDoDocumento = computed(() =>
    this.procedimentos().flatMap(
      (atual) => procedimentoParaDocumento(atual, this.itensDaEtapa()) ?? [],
    ),
  );
  protected readonly tipos = computed(() =>
    tiposNaTela(this.procedimentosDoDocumento(), this.tiposDoDocumento(), this.rotuloDoTipo()),
  );
  protected readonly oferecidos = computed(() =>
    alvosOferecidos(
      this.itensDaEtapa(),
      this.areasDoEnem().flatMap((codigo) => areaDoEnem(codigo) ?? []),
    ),
  );

  protected aoRemover(identidade: IdentidadeDoProcedimento): void {
    this.remover.emit(identidade);
    focarAposRenderizarSeSemFoco(this.injector, this.idDoTitulo());
  }
}
