import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ComboboxComponent,
  type UiComboboxGroup,
  ValorEmConsultaComponent,
} from '@uniplus/shared-ui/components';
import { isApiOk } from '@uniplus/shared-core/http';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';

import {
  alcanceDaCondicao,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  comparaComLista,
  fatosParaGatilho,
  operadoresDoFato,
  problemaDaCondicao,
  RESPOSTAS_BOOLEANAS,
  valorEscalarDe,
  valoresDeListaDe,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';

import { CriterioDesempateConfigurado, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import {
  ReleituraDoSnapshot,
  relerProcessoAPedido,
} from '../../shared/releitura-do-snapshot.service';
import { MOTIVO_DA_RELEITURA } from '../../shared/motivo-da-releitura';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import {
  comoComandoDeCriteriosDesempate,
  desempateUsaAreas,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateTemShapeConhecido,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';
import {
  areasCitadasPor,
  areasForaDoQuadro,
  dicaDaSituacao,
  outroCriterioQueCita,
  RECUSA_DA_AREA,
  recusaAoGravarODesempate,
  recusaSemAreas,
  rotulosDasAreas,
  DEPENDEM_DA_RELEITURA,
  situacaoDoQuadro,
} from './quadro-do-desempate';

const CRITERIO_VAZIO: CriterioDesempateConfigurado = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
  areas: [],
};

/**
 * Critérios de desempate (`PUT …/criterios-desempate`), na ordem em que serão
 * avaliados. A ordem é a posição na lista — reescrita a cada mover/remover —
 * e não um vocabulário institucional fixo: `CRITERIOS_DESEMPATE` com ids de 1
 * a 7 saiu inteiro, porque nenhum campo dele coincide com o contrato.
 */
@Component({
  selector: 'sel-step-desempate',
  standalone: true,
  templateUrl: './desempate.component.html',
  imports: [ComboboxComponent, ValorEmConsultaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(DesempateStepComponent)],
})
export class DesempateStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly problemI18n = inject(ProblemI18nService);

  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * O vocabulário de fatos do candidato, como o critério de desempate pode citá-lo.
   *
   * Não inclui fato de domínio dinâmico — modalidade, condição de atendimento —, e isso não é
   * omissão da tela: o comando de desempate resolve o vocabulário sem eles, de modo que citar
   * um aqui seria recusado como fato desconhecido. Oferecê-los daria ao operador uma escolha
   * que a gravação desfaz.
   */
  private readonly catalogoDeFatos = signal<readonly FatoCandidatoView[]>([]);

  /**
   * Só um catálogo lido permite dizer que um fato saiu dele: enquanto a busca não responde,
   * ou quando falha, o vazio é falta de dado, não ausência do fato.
   */
  private readonly catalogoDeFatosLido = signal(false);

  readonly fatosEscolhiveis = computed(() => fatosParaGatilho(this.catalogoDeFatos()));

  private readonly fatoPorCodigo = computed(
    () => new Map(this.fatosEscolhiveis().map((fato) => [fato.codigo, fato])),
  );

  /**
   * A falha ao buscar o vocabulário de fatos, dita na tela em vez de engolida.
   *
   * Sem isto, um 500 passageiro deixava o catálogo vazio para sempre: todo critério por
   * predicado já configurado aparecia como fato fora do cadastro, `validate()` o recusava, e
   * não havia na tela nem a explicação nem um caminho de volta que não fosse recarregar a
   * página. É a mesma política dos catálogos de regra, que já tinham erro e nova tentativa.
   */
  readonly falhaDoCatalogoDeFatos = signal<string | null>(null);

  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);

  constructor() {
    this.cadastroDePesos.acompanhar();
    this.catalogos.carregar();
    this.carregarFatos();
    this.acompanharListaCanonicaDasAreas();
    this.descartarEscolhasQueSairamDoSeletor();
    this.esquecerEscolhasQuandoAListaForSubstituida();
  }

  /**
   * As escolhas pendentes são das posições da lista que esta tela montou. Uma lista que chega de
   * fora — hidratação, releitura, troca de processo — põe outros critérios nessas posições, e as
   * escolhas caem.
   */
  private esquecerEscolhasQuandoAListaForSubstituida(): void {
    effect(() => {
      const criterios = this.criterios();
      if (criterios !== this.listaMontadaAqui) {
        untracked(() => this.escolhasPendentes.set(new Map()));
      }
    });
  }

  /** A última lista que esta tela gravou no rascunho. */
  private listaMontadaAqui: readonly CriterioDesempateConfigurado[] | null = null;

  private gravarNoRascunho(criterios: readonly CriterioDesempateConfigurado[]): void {
    this.listaMontadaAqui = criterios;
    this.store.patchSection('desempate', criterios);
  }

  /**
   * A escolha cuja área deixou de ser oferecida — citada por outro critério, ou fora do quadro —
   * cai: o seletor já mostra "— escolher —", e a área não pode voltar escolhida sem o operador ver.
   * Só com o quadro lido: enquanto ele carrega, nenhuma área é oferecida, e nada saiu do seletor.
   */
  private descartarEscolhasQueSairamDoSeletor(): void {
    effect(() => {
      if (this.situacaoDoQuadro().tipo !== 'lido') return;
      const oferecidas = new Set(this.areasOferecidas().map((area) => area.codigo));
      const escolhas = untracked(() => this.escolhasPendentes());
      const validas = [...escolhas].filter(([, codigo]) => oferecidas.has(codigo));
      if (validas.length < escolhas.size) this.escolhasPendentes.set(new Map(validas));
    });
  }

  /**
   * A lista canônica dá a ordem das áreas oferecidas e o rótulo das citadas, qualquer que seja a
   * origem do quadro — inclusive sem quadro ou com o cadastro em falha. O serviço não a pede de
   * novo enquanto a leitura do cadastro, que também a traz, está em curso; a que falhou é pedida de
   * novo a cada leitura da classificação que muda o que se sabia dela, e a cada leitura do
   * cadastro.
   */
  private acompanharListaCanonicaDasAreas(): void {
    effect(() => {
      this.store.versaoDaClassificacaoLida();
      this.catalogos.pesosLidosNaLeitura();
      if (this.temCriterioPorArea()) untracked(() => this.catalogos.garantirAreasEnem());
    });
  }

  private readonly temCriterioPorArea = computed(() =>
    this.criterios().some((criterio) => this.usaAreas(criterio)),
  );

  /** Busca o vocabulário de fatos. Exposto porque a tela oferece nova tentativa. */
  carregarFatos(): void {
    this.falhaDoCatalogoDeFatos.set(null);
    this.fatosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (isApiOk(resultado)) {
            this.catalogoDeFatos.set(resultado.data);
            this.catalogoDeFatosLido.set(true);
            return;
          }

          this.falhaDoCatalogoDeFatos.set(this.problemI18n.resolve(resultado.problem).title);
        },
        error: () =>
          this.falhaDoCatalogoDeFatos.set(
            'Não foi possível carregar os dados do candidato que um critério pode citar. Tente novamente.',
          ),
      });
  }

  /** O fato citado por um critério, ou `undefined` quando ele saiu do catálogo. */
  fatoDoCriterio(codigo: string): FatoEscolhivel | undefined {
    return this.fatoPorCodigo().get(codigo);
  }

  /** As comparações que o domínio daquele fato admite. */
  operadoresDoCriterio(
    codigo: string,
  ): readonly { readonly valor: string; readonly rotulo: string }[] {
    const fato = this.fatoDoCriterio(codigo);
    return fato === undefined ? [] : operadoresDoFato(fato);
  }

  criterioComparaComLista(operador: string): boolean {
    return comparaComLista(operador);
  }

  ehBooleano(codigo: string): boolean {
    return this.fatoDoCriterio(codigo)?.tipoDominio === 'BOOLEANO';
  }

  valoresEscolhiveis(codigo: string): readonly string[] {
    return this.fatoDoCriterio(codigo)?.valores ?? [];
  }

  valoresDoFato(codigo: string): readonly UiComboboxGroup[] {
    const fato = this.fatoDoCriterio(codigo);
    if (fato === undefined || fato.valores.length === 0) return [];
    return [
      { label: fato.nome, options: fato.valores.map((valor) => ({ value: valor, label: valor })) },
    ];
  }

  valorDoCriterio(criterio: CriterioDesempateConfigurado): string {
    return valorEscalarDe(criterio);
  }

  valoresDoCriterio(criterio: CriterioDesempateConfigurado): readonly string[] {
    return valoresDeListaDe(criterio);
  }

  /** O que o predicado alcança — a mesma leitura que a exigência documental oferece. */
  alcanceDoCriterio(criterio: CriterioDesempateConfigurado): string {
    const fato = this.fatoDoCriterio(criterio.fato);
    return fato === undefined ? '' : alcanceDaCondicao(criterio, fato);
  }

  protected readonly respostasBooleanas = RESPOSTAS_BOOLEANAS;

  /** Só a classificação: uma tecla em outro passo não chega ao quadro. */
  private readonly classificacao = computed(() => this.store.draft().classificacao);

  readonly situacaoDoQuadro = computed(() =>
    situacaoDoQuadro(
      this.classificacao(),
      this.store.classificacaoGravada(),
      this.cadastroDePesos.leitura(),
    ),
  );

  private readonly gruposDoQuadro = computed(() => {
    const situacao = this.situacaoDoQuadro();
    return 'grupos' in situacao ? situacao.grupos : [];
  });

  private readonly areasAceitas = computed(() => {
    const situacao = this.situacaoDoQuadro();
    return situacao.tipo === 'lido' ? situacao.aceitas : [];
  });

  private readonly rotuloDaAreaPorCodigo = computed(() =>
    rotulosDasAreas(this.catalogos.areasEnem(), this.gruposDoQuadro()),
  );

  rotuloDaArea(codigo: string): string {
    return this.rotuloDaAreaPorCodigo().get(codigo) ?? codigo;
  }

  private readonly areasCitadas = computed(() => new Set(areasCitadasPor(this.criterios())));

  /**
   * As áreas que ainda podem entrar num critério: cada área é citada uma vez só, no critério e
   * entre os critérios por área — a segunda citação nunca desempataria ninguém.
   */
  readonly areasOferecidas = computed(() =>
    this.areasAceitas().filter((area) => !this.areasCitadas().has(area.codigo)),
  );

  /** De onde vêm as áreas, ou por que não há nenhuma: a mesma dica para todo critério por área. */
  readonly dicaDaOrigem = computed(() => dicaDaSituacao(this.situacaoDoQuadro()));

  /**
   * A falha de leitura do cadastro, dita uma vez no passo, e só quando algum critério depende dele.
   * Vem da falha, e não da situação: a nova tentativa em curso deixa a situação "carregando", e o
   * alerta, com o botão focado, fica na tela até a leitura dar certo.
   */
  readonly falhaDoCadastroDePesos = computed(() => {
    const tipo = this.situacaoDoQuadro().tipo;
    const falha = this.cadastroDePesos.leitura().falha;
    return (tipo === 'falha' || tipo === 'carregando') && this.temCriterioPorArea() ? falha : null;
  });

  /** O aviso no início do passo, com o botão que relê o processo, quando algum critério depende dele. */
  readonly avisoDaReleitura = computed(() => {
    const situacao = this.situacaoDoQuadro();
    return situacao.tipo === 'por-reler' && this.temCriterioPorArea()
      ? `${MOTIVO_DA_RELEITURA[situacao.motivo]}, e ${DEPENDEM_DA_RELEITURA}. Releia o processo para saber o que ele tem.`
      : null;
  });

  /**
   * Os critérios por área só são gravados depois da classificação com o quadro: o servidor os
   * recusa enquanto o processo não tem o quadro congelado.
   */
  private readonly adiaAGravacao = computed(
    () => this.temCriterioPorArea() && this.store.copiaCongeladaEmVigor() === null,
  );

  /** A nota de que os critérios serão gravados junto com a classificação. */
  readonly gravaComAClassificacao = computed(
    () => this.store.aceitaEdicao() && this.adiaAGravacao(),
  );

  readonly relendoProcesso = signal(false);

  /**
   * "Reler o processo" do aviso de releitura. O aviso fica, com o botão focado,
   * enquanto a leitura corre. Quando ela decide, o aviso sai e o foco vai ao primeiro critério por
   * área; se ela falha, o aviso fica e a falha é anunciada.
   */
  async relerProcesso(): Promise<void> {
    // Uma leitura superada por outra, ou por uma troca de processo, não falhou: quem decide é a
    // mais nova.
    if (!(await relerProcessoAPedido(this.releitura, this.relendoProcesso))) return;
    if (this.situacaoDoQuadro().tipo === 'por-reler') {
      this.anunciar('Não foi possível reler o processo. Tente novamente.');
      return;
    }
    this.focarNoPrimeiroCriterioPorArea();
  }

  /**
   * O alerta, com o botão focado, fica na tela enquanto a nova tentativa corre. Quando a leitura dá
   * certo e ele sai, o foco vai ao primeiro critério por área.
   */
  tentarLerOCadastroDeNovo(): void {
    this.cadastroDePesos.relerCadastroAPedido(() => this.focarNoPrimeiroCriterioPorArea());
  }

  private focarNoPrimeiroCriterioPorArea(): void {
    const indice = this.criterios().findIndex((criterio) => this.usaAreas(criterio));
    // Sem critério por área — a regra pode ter sido trocada enquanto a leitura corria —, o destino
    // é o botão de acrescentar critério, que está sempre na tela.
    this.focar(
      ...(indice < 0 ? [] : [`desemp-area-nova-${indice}`, `desemp-regra-${indice}`]),
      'desempate-acrescentar',
    );
  }

  readonly criterios = computed(() => this.store.draft().desempate);

  readonly etapasReferenciaveis = computed(() =>
    this.store.draft().cronograma.etapas.filter((etapa) => etapa.id !== null),
  );

  /**
   * As regras que o seletor oferece: as do catálogo cujos argumentos esta tela sabe montar,
   * mais a que já está escolhida — mesmo desconhecida, ela precisa continuar visível, senão o
   * critério gravado aparece sem regra nenhuma.
   */
  regraEscolhivel(criterio: CriterioDesempateConfigurado) {
    return regrasEscolhiveis(
      this.catalogos
        .criteriosDesempate()
        .filter(
          (regra) =>
            desempateTemShapeConhecido(regra.codigo) || regra.codigo === criterio.regraCodigo,
        ),
      criterio.regraCodigo,
      criterio.regraVersao,
    );
  }

  /** Quantas regras do catálogo esta tela ainda não sabe configurar. */
  readonly regrasSemSuporte = computed(
    () =>
      this.catalogos
        .criteriosDesempate()
        .filter((regra) => !desempateTemShapeConhecido(regra.codigo)).length,
  );

  usaEtapa(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaEtapa(criterio.regraCodigo);
  }

  usaIdadeMinima(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaIdadeMinima(criterio.regraCodigo);
  }

  usaPredicadoFato(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaPredicadoFato(criterio.regraCodigo);
  }

  usaAreas(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaAreas(criterio.regraCodigo);
  }

  /** O critério como se lê em consulta, com o rótulo de cada escolha e os campos que a edição usa. */
  leituraDoCriterio(criterio: CriterioDesempateConfigurado) {
    const etapa = this.etapasReferenciaveis().find((item) => item.id === criterio.etapaRef);
    const fato = this.fatoDoCriterio(criterio.fato);
    const comparacao = this.operadoresDoCriterio(criterio.fato).find(
      (opcao) => opcao.valor === criterio.operador,
    );
    const porLista = this.criterioComparaComLista(criterio.operador);
    const booleano = this.ehBooleano(criterio.fato);
    const escalar = this.valorDoCriterio(criterio);
    return {
      regra: rotuloDaRegraEscolhida(this.regraEscolhivel(criterio)),
      etapa: etapa === undefined ? null : etapa.nome || 'Etapa sem nome',
      idadeMinima: leituraDoCampoDecimal(criterio.idadeMinima),
      fato:
        fato?.nome ??
        (criterio.fato === ''
          ? null
          : this.catalogoDeFatosLido()
            ? `${criterio.fato} — fora do catálogo`
            : criterio.fato),
      comparacao: comparacao?.rotulo ?? (criterio.operador || null),
      rotuloDoValor: porLista ? 'Valores' : booleano ? 'Resposta' : 'Valor',
      valor: porLista
        ? this.valoresDoCriterio(criterio)
        : booleano
          ? (RESPOSTAS_BOOLEANAS.find((resposta) => resposta.valor === escalar)?.rotulo ?? escalar)
          : escalar,
      areas: criterio.areas.map((codigo) => this.rotuloDaArea(codigo)),
    };
  }

  acrescentar(): void {
    this.gravarNoRascunho([...this.criterios(), CRITERIO_VAZIO]);
    this.anunciar(`Critério ${this.criterios().length} acrescentado ao fim da lista.`);
  }

  remover(indice: number): void {
    this.gravarNoRascunho(this.criterios().filter((_, item) => item !== indice));
    this.remapearEscolhas((anterior) =>
      anterior === indice ? null : anterior > indice ? anterior - 1 : anterior,
    );
    this.anunciar(`Critério ${indice + 1} removido.`);
    // O botão clicado sai do DOM junto com a linha e o foco cairia no corpo da página. Quem
    // navega por teclado perderia o lugar a cada remoção.
    this.focar(`desemp-remover-${Math.max(0, indice - 1)}`, 'desempate-acrescentar');
  }

  /**
   * Troca de posição dois critérios. A ordem É a regra — o primeiro da lista desempata
   * primeiro —, então mover não é enfeite, é configuração.
   *
   * O foco acompanha o critério movido, e não a posição: as linhas são reusadas por posição, e
   * sem isto o botão que continuava focado passava a operar OUTRO critério, sem nada anunciar.
   * No topo e no fim o botão correspondente fica indisponível, e o foco vai para o par dele.
   */
  mover(indice: number, delta: number): void {
    const ordem = [...this.criterios()];
    const destino = indice + delta;
    if (destino < 0 || destino >= ordem.length) return;

    [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
    this.gravarNoRascunho(ordem);
    this.remapearEscolhas((anterior) =>
      anterior === indice ? destino : anterior === destino ? indice : anterior,
    );

    this.anunciar(`Critério movido para a posição ${destino + 1} de ${ordem.length}.`);
    this.focar(
      delta < 0 ? `desemp-subir-${destino}` : `desemp-descer-${destino}`,
      delta < 0 ? `desemp-descer-${destino}` : `desemp-subir-${destino}`,
    );
  }

  /**
   * O que mudou na lista, para quem não vê a tela. Reordenar, acrescentar e remover eram
   * mudanças silenciosas para leitor de tela.
   */
  readonly anuncio = signal('');

  private ultimoAnuncio = '';
  private repeticoesDoAnuncio = 0;

  /**
   * Um anúncio idêntico ao anterior não muda a região viva, e o leitor de tela não o repete: a
   * partir da segunda vez seguida, o texto diz qual vez é.
   */
  private anunciar(mensagem: string): void {
    this.repeticoesDoAnuncio = mensagem === this.ultimoAnuncio ? this.repeticoesDoAnuncio + 1 : 1;
    this.ultimoAnuncio = mensagem;
    this.anuncio.set(
      this.repeticoesDoAnuncio > 1 ? `${mensagem} (${this.repeticoesDoAnuncio}ª vez)` : mensagem,
    );
  }

  /**
   * Põe o foco no primeiro dos alvos que estiver disponível, DEPOIS de a lista ser
   * reprojetada.
   *
   * A espera é por renderização, não por microtask: o ciclo de detecção do Angular roda depois
   * que a fila de microtasks drena, então um `queueMicrotask` consultaria o DOM antigo — acha
   * o botão que está prestes a sair, põe o foco nele, e o re-render o arranca em seguida,
   * deixando o foco no corpo da página. É o caso de remover o último item, justamente aquele
   * em que a queda para "Acrescentar" existe.
   */
  private focar(...alvos: string[]): void {
    afterNextRender(
      () => {
        const disponivel = alvos
          .map((id) => document.getElementById(id))
          .find(
            (elemento): elemento is HTMLElement =>
              elemento !== null && !(elemento as HTMLButtonElement).disabled,
          );
        disponivel?.focus();
      },
      { injector: this.injector },
    );
  }

  escolherRegra(indice: number, valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.remapearEscolhas((anterior) => (anterior === indice ? null : anterior));
    // Trocar de regra some com o que a variante anterior usava — CA-05: só os
    // argumentos aplicáveis à regra atual permanecem.
    this.atualizar(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      areas: [],
    });
  }

  /**
   * A área escolhida no seletor de cada critério, ainda não incluída, pela posição do critério. A
   * posição é a chave que a tela mantém: mover e remover critérios a acompanham, e mexer nas áreas
   * do próprio critério não a troca.
   */
  private readonly escolhasPendentes = signal<ReadonlyMap<number, string>>(new Map());

  /** Por que o seletor do critério está vazio: as áreas que faltam nele estão em outros critérios. */
  semAreaAOferecer(criterio: CriterioDesempateConfigurado): string {
    return this.areasAceitas().every((area) => criterio.areas.includes(area.codigo))
      ? 'Todas as áreas do quadro já estão na ordem'
      : 'As demais áreas do quadro já estão em outros critérios';
  }

  escolhaPendente(indice: number): string {
    return this.escolhasPendentes().get(indice) ?? '';
  }

  /**
   * Só guarda a escolha. Incluir é outro gesto, pelo botão: no seletor fechado, cada seta dispara
   * `change`, e incluir ali acrescentaria uma área a cada tecla.
   */
  escolherArea(indice: number, seletor: HTMLSelectElement): void {
    this.escolhasPendentes.set(new Map([...this.escolhasPendentes(), [indice, seletor.value]]));
  }

  /** Leva as escolhas pendentes para as posições novas dos critérios; a de um removido cai. */
  private remapearEscolhas(posicaoNova: (anterior: number) => number | null): void {
    this.escolhasPendentes.set(
      new Map(
        [...this.escolhasPendentes()].flatMap(([anterior, codigo]) => {
          const nova = posicaoNova(anterior);
          return nova === null ? [] : [[nova, codigo] as const];
        }),
      ),
    );
  }

  acrescentarAreaEscolhida(indice: number): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;
    const codigo = this.escolhaPendente(indice);
    if (!this.areasOferecidas().some((area) => area.codigo === codigo)) {
      this.anunciar('Escolha no seletor a área a acrescentar.');
      this.focar(`desemp-area-nova-${indice}`);
      return;
    }

    const areas = [...criterio.areas, codigo];
    this.atualizar(indice, { areas });
    this.anunciar(
      `Área ${this.rotuloDaArea(codigo)} acrescentada ao critério ${indice + 1}, na posição ${areas.length}.`,
    );
    // Acrescentada a última área oferecida, o botão fica indisponível e perderia o foco.
    this.focar(
      `desemp-area-acrescentar-${indice}`,
      `desemp-area-remover-${indice}-${areas.length - 1}`,
    );
  }

  removerArea(indice: number, posicao: number): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;

    const codigo = criterio.areas[posicao];
    this.atualizar(indice, { areas: criterio.areas.filter((_, item) => item !== posicao) });
    this.anunciar(`Área ${this.rotuloDaArea(codigo)} retirada do critério ${indice + 1}.`);
    // O botão clicado sai do DOM com a linha: o foco vai para a área anterior; da primeira, para a
    // que passou a ocupar a posição dela; sem nenhuma, para o seletor de acrescentar e, quando ele
    // não está na tela, para a regra do critério.
    const vizinha = posicao > 0 ? posicao - 1 : 0;
    this.focar(
      `desemp-area-remover-${indice}-${vizinha}`,
      `desemp-area-nova-${indice}`,
      `desemp-regra-${indice}`,
    );
  }

  /** Troca de posição duas áreas do critério. A ordem é a regra: a primeira desempata primeiro. */
  moverArea(indice: number, posicao: number, delta: number): void {
    const criterio = this.criterios()[indice];
    const destino = posicao + delta;
    if (criterio === undefined || destino < 0 || destino >= criterio.areas.length) return;

    const areas = [...criterio.areas];
    [areas[posicao], areas[destino]] = [areas[destino], areas[posicao]];
    this.atualizar(indice, { areas });
    this.anunciar(
      `Área ${this.rotuloDaArea(areas[destino])} movida para a posição ${destino + 1} de ${areas.length} no critério ${indice + 1}.`,
    );
    this.focar(
      delta < 0
        ? `desemp-area-subir-${indice}-${destino}`
        : `desemp-area-descer-${indice}-${destino}`,
      delta < 0
        ? `desemp-area-descer-${indice}-${destino}`
        : `desemp-area-subir-${indice}-${destino}`,
    );
  }

  alterarEtapaRef(indice: number, etapaRef: string): void {
    this.atualizar(indice, { etapaRef });
  }

  alterarIdadeMinima(indice: number, idadeMinima: string): void {
    this.atualizar(indice, { idadeMinima });
  }

  /**
   * Troca o fato do predicado. Operador e valor recomeçam: eles pertenciam ao domínio do fato
   * anterior, e carregá-los para outro domínio grava uma comparação que o servidor recusa.
   */
  alterarFato(indice: number, codigo: string): void {
    // Voltar o seletor para "escolha o fato" LIMPA o critério. Ignorar a escolha em branco
    // deixava a tela dizendo que não havia fato enquanto o rascunho continuava com o anterior
    // — e a gravação saía com um critério que o operador acreditava ter apagado.
    if (codigo === '') {
      this.atualizar(indice, { fato: '', operador: '', valor: '' });
      return;
    }

    const fato = this.fatoDoCriterio(codigo);
    if (fato === undefined) return;

    this.atualizar(indice, { fato: codigo, operador: operadoresDoFato(fato)[0].valor, valor: '' });
  }

  alterarOperador(indice: number, operador: string): void {
    const criterio = this.criterios()[indice];
    const fato = criterio === undefined ? undefined : this.fatoDoCriterio(criterio.fato);
    if (criterio === undefined || fato === undefined) return;

    this.atualizar(indice, comOperador(criterio, fato, operador));
  }

  alterarValor(indice: number, valor: string): void {
    const criterio = this.criterios()[indice];
    const fato = criterio === undefined ? undefined : this.fatoDoCriterio(criterio.fato);
    if (criterio === undefined || fato === undefined) return;

    this.atualizar(indice, comValorEscalar(criterio, fato, valor));
  }

  alterarValores(indice: number, valores: readonly string[]): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;

    this.atualizar(indice, comValoresDeLista(criterio, valores));
  }

  private atualizar(indice: number, patch: Partial<CriterioDesempateConfigurado>): void {
    this.gravarNoRascunho(
      this.criterios().map((criterio, item) =>
        item === indice ? { ...criterio, ...patch } : criterio,
      ),
    );
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const criterios = this.criterios();
    if (criterios.length === 0) {
      return {
        titulo: 'Confirmar a ausência de critérios de desempate',
        aviso: 'Nenhum critério de desempate será declarado para este processo.',
        rotuloDeConfirmar: 'Confirmar sem critérios',
        itens: [{ rotulo: 'Critérios de desempate', valor: 'Nenhum' }],
      };
    }

    const adia = this.adiaAGravacao();
    return {
      titulo: 'Confirmar os critérios de desempate',
      aviso: adia
        ? 'A ordem exibida é a ordem em que os critérios serão avaliados. Eles serão gravados junto com a classificação, no passo Eliminação.'
        : 'A ordem exibida é a ordem em que os critérios serão avaliados.',
      rotuloDeConfirmar: adia ? 'Confirmar critérios' : 'Gravar critérios',
      itens: criterios.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério`,
        valor: this.usaAreas(criterio)
          ? `${criterio.regraCodigo}: ${criterio.areas.map((codigo) => this.rotuloDaArea(codigo)).join(', ')}`
          : criterio.regraCodigo,
      })),
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const idsDeEtapa = new Set(this.etapasReferenciaveis().map((etapa) => etapa.id));
    const messages: string[] = [];

    this.criterios().forEach((criterio, indice) => {
      const posicao = indice + 1;
      if (!criterio.regraCodigo) {
        messages.push(`Critério de desempate ${posicao}: selecione uma regra.`);
        return;
      }

      if (this.usaEtapa(criterio)) {
        if (criterio.etapaRef === '') {
          messages.push(`Critério de desempate ${posicao}: selecione a etapa referenciada.`);
        } else if (!idsDeEtapa.has(criterio.etapaRef)) {
          messages.push(
            `Critério de desempate ${posicao}: a etapa referenciada não existe mais no cronograma.`,
          );
        }
      } else if (this.usaIdadeMinima(criterio)) {
        const idade = inteiro(criterio.idadeMinima);
        if (idade === null || idade <= 0) {
          messages.push(
            `Critério de desempate ${posicao}: informe a idade mínima, maior que zero.`,
          );
        }
      } else if (this.usaPredicadoFato(criterio)) {
        // Espelha o validador do domínio — fato do vocabulário, operador que o domínio admite,
        // valor dentro do domínio declarado. Conferir só "os três campos estão preenchidos"
        // aprovava texto que o servidor recusava sem dizer qual das três coisas estava errada.
        const problema = problemaDaCondicao(criterio, this.fatoPorCodigo());
        if (problema !== null) {
          messages.push(`Critério de desempate ${posicao}: ${problema}.`);
        }
      } else if (this.usaAreas(criterio)) {
        const problema = this.problemaDasAreas(criterio, indice);
        if (problema !== null) {
          messages.push(`Critério de desempate ${posicao}: ${problema}.`);
        }
      }
    });

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * Espelha o que o servidor recusa no critério por área. A conferência contra o quadro só vale
   * com o quadro lido: sem ele, "não achei" é "ainda não sei", e a recusa fica com o servidor.
   */
  private problemaDasAreas(criterio: CriterioDesempateConfigurado, indice: number): string | null {
    const situacao = this.situacaoDoQuadro();
    const semAreas = recusaSemAreas(situacao);
    if (semAreas !== null) return semAreas;
    if (criterio.areas.length === 0) return RECUSA_DA_AREA.obrigatorias();

    if (situacao.tipo === 'lido') {
      const [foraDoQuadro] = areasForaDoQuadro(criterio.areas, situacao.aceitas);
      if (foraDoQuadro !== undefined) {
        return RECUSA_DA_AREA.foraDoQuadro(this.rotuloDaArea(foraDoQuadro));
      }
    }

    const repetida = criterio.areas.find(
      (codigo, posicao) => criterio.areas.indexOf(codigo) !== posicao,
    );
    if (repetida !== undefined) return RECUSA_DA_AREA.repetida(this.rotuloDaArea(repetida));

    const anteriores = new Set(areasCitadasPor(this.criterios().slice(0, indice)));
    const citada = criterio.areas.find((codigo) => anteriores.has(codigo));
    return citada === undefined
      ? null
      : RECUSA_DA_AREA.citadaPorOutro(
          this.rotuloDaArea(citada),
          outroCriterioQueCita(this.criterios(), citada, indice),
        );
  }

  /**
   * O resumo da recusa: cada recusa ao critério por área com o texto da tela, o critério e a área
   * que o campo aponta; e o título da raiz quando há erro de outro tipo ou nenhum erro de campo.
   */
  private mensagensDaRecusa(
    problema: ProblemDetails,
    criterios: readonly CriterioDesempateConfigurado[],
  ): string[] {
    return resumoDaRecusa(
      problema,
      (erro) => recusaAoGravarODesempate(erro, criterios, (codigo) => this.rotuloDaArea(codigo)),
      () => this.problemI18n.resolve(problema).title,
    );
  }

  /**
   * Grava a coleção inteira, na ordem em que está na tela (CA-05). Com critério por área e sem o
   * quadro gravado, só marca a gravação como pendente: quem grava a classificação grava os
   * critérios em seguida (`gravarPendente`).
   */
  async persistir(): Promise<StepValidation> {
    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;
    if (this.store.processoSeletivoId() !== null && this.adiaAGravacao()) {
      this.store.desempatePendenteDeGravacao.set(true);
      return { valid: true };
    }
    return this.gravar();
  }

  /** Grava os critérios que ficaram para depois da classificação, se ficaram. */
  async gravarPendente(): Promise<StepValidation> {
    if (!this.store.desempatePendenteDeGravacao()) return { valid: true };
    const conferencia = this.validate();
    return conferencia.valid ? this.gravar() : conferencia;
  }

  private async gravar(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar o desempate.',
        ],
      };
    }

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const criterios = this.criterios();
      const resultado = await this.releitura.gravando(async () => {
        const resposta = await this.cadastro.definirCriteriosDesempate(
          processoId,
          comoComandoDeCriteriosDesempate(criterios),
        );
        if (geracao !== this.store.geracao()) return resposta;
        if (resposta.ok) {
          this.store.criteriosDesempateGravados.set(criterios);
          this.store.desempatePendenteDeGravacao.set(false);
        } else if (resposta.inconclusiva) {
          // O servidor pode ter gravado: o que ele tem deixa de ser sabido até a releitura.
          this.store.criteriosDesempateGravados.set(null);
        }
        return resposta;
      });

      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!resultado.ok) {
        return { valid: false, messages: this.mensagensDaRecusa(resultado.problem, criterios) };
      }
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}
