import {
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
  CondicaoDeFatoComponent,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';
import { isApiOk } from '@uniplus/shared-core/http';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';

import {
  alcanceDaCondicao,
  comparaComLista,
  fatosParaGatilho,
  operadoresDoFato,
  RESPOSTAS_BOOLEANAS,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';

import { CriterioDesempateConfigurado, StepValidation } from '../../processo-seletivo.models';
import { fatosColetadosPelaInscricao } from '../formulario/formulario-de-inscricao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import { AreasDoDesempateService } from './areas-do-desempate.service';
import { textoDoCriterio } from '../classificacao/confirmacao-da-classificacao';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import {
  desempateIdosoSemApuracao,
  desempateSemDataDeNascimento,
  PASSO_FORMULARIO,
} from './desempate-por-idade';
import {
  comoComandoDeCriteriosDesempate,
  desempateUsaAreas,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateTemShapeConhecido,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';
import { comAreaAcrescentada, comAreasTrocadas, semAreaNaPosicao } from './areas-do-criterio';
import { mensagensDoDesempate } from './validacao-do-desempate';
import { recusaAoGravarODesempate } from './recusas-do-desempate';

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
  imports: [ValorLegivelDirective, CondicaoDeFatoComponent, ValorEmConsultaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AreasDoDesempateService, provePassoDoWizard(DesempateStepComponent)],
})
export class DesempateStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  protected readonly areas = inject(AreasDoDesempateService);
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

  constructor() {
    this.catalogos.carregar();
    this.carregarFatos();
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
      if (this.areas.situacaoDoQuadro().tipo !== 'lido') return;
      const oferecidas = new Set(this.areas.areasOferecidas().map((area) => area.codigo));
      const escolhas = untracked(() => this.escolhasPendentes());
      const validas = [...escolhas].filter(([, codigo]) => oferecidas.has(codigo));
      if (validas.length < escolhas.size) this.escolhasPendentes.set(new Map(validas));
    });
  }

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

  valorDoCriterio(criterio: CriterioDesempateConfigurado): string {
    return valorEscalarDe(criterio);
  }

  valoresDoCriterio(criterio: CriterioDesempateConfigurado): readonly string[] {
    return valoresDeListaDe(criterio);
  }

  readonly criterios = computed(() => this.store.draft().desempate);

  /**
   * "Reler o processo" do aviso de releitura. Quando ela decide e o aviso sai, o foco vai ao
   * primeiro critério por área; se ela falha, o aviso fica e a falha é anunciada.
   */
  async relerProcesso(): Promise<void> {
    const resultado = await this.areas.relerProcesso();
    if (resultado === 'ainda-por-reler') {
      this.anunciar('Não foi possível reler o processo. Tente novamente.');
    } else if (resultado === 'lida') {
      this.focarNoPrimeiroCriterioPorArea();
    }
  }

  /**
   * O alerta, com o botão focado, fica na tela enquanto a nova tentativa corre. Quando a leitura dá
   * certo e ele sai, o foco vai ao primeiro critério por área.
   */
  tentarLerOCadastroDeNovo(): void {
    this.areas.relerCadastro(() => this.focarNoPrimeiroCriterioPorArea());
  }

  private focarNoPrimeiroCriterioPorArea(): void {
    const indice = this.criterios().findIndex((criterio) => this.usaAreas(criterio));
    // Sem critério por área — a regra pode ter sido trocada enquanto a leitura corria —, o destino
    // é o botão de acrescentar critério, que está sempre na tela.
    focarAposRenderizar(
      this.injector,
      ...(indice < 0 ? [] : [`desemp-area-nova-${indice}`, `desemp-regra-${indice}`]),
      'desempate-acrescentar',
    );
  }

  /**
   * Com inscrição feita no sistema o desempate é obrigatório; com resultado importado a lista já
   * vem classificada e o passo não o exige (a API aceita critérios, mas não os cobra).
   */
  readonly desempateObrigatorio = computed(
    () => this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.inscricaoPropria,
  );

  /** Só diz que o desempate não é obrigatório quando a origem já foi escolhida como importação. */
  readonly desempateDispensado = computed(
    () => this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.importacaoExterna,
  );

  /**
   * O desempate por maior idade sem a data de nascimento no formulário. Em consulta não há o que
   * corrigir, e o aviso só ofereceria uma ação a um processo que não aceita edição.
   */
  readonly semDataDeNascimento = computed(
    () =>
      !this.store.emConsulta() &&
      desempateSemDataDeNascimento(
        this.criterios(),
        fatosColetadosPelaInscricao(this.store.draft().formulario.conteudo),
      ),
  );

  /** O desempate por idoso sem a apuração da idade no formulário. */
  readonly idosoSemApuracao = computed(
    () =>
      !this.store.emConsulta() &&
      desempateIdosoSemApuracao(this.criterios(), this.store.draft().formulario.referenciaTemporal),
  );

  irParaFormulario(): void {
    this.store.goTo(PASSO_FORMULARIO);
  }

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
      areas: criterio.areas.map((codigo) => this.areas.rotuloDaArea(codigo)),
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
    focarAposRenderizar(
      this.injector,
      `desemp-remover-${Math.max(0, indice - 1)}`,
      'desempate-acrescentar',
    );
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
    focarAposRenderizar(
      this.injector,
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
    if (!this.areas.areasOferecidas().some((area) => area.codigo === codigo)) {
      this.anunciar('Escolha no seletor a área a acrescentar.');
      focarAposRenderizar(this.injector, `desemp-area-nova-${indice}`);
      return;
    }

    const areas = comAreaAcrescentada(criterio.areas, codigo);
    this.atualizar(indice, { areas });
    this.anunciar(
      `Área ${this.areas.rotuloDaArea(codigo)} acrescentada ao critério ${indice + 1}, na posição ${areas.length}.`,
    );
    // Acrescentada a última área oferecida, o botão fica indisponível e perderia o foco.
    focarAposRenderizar(
      this.injector,
      `desemp-area-acrescentar-${indice}`,
      `desemp-area-remover-${indice}-${areas.length - 1}`,
    );
  }

  removerArea(indice: number, posicao: number): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;

    const codigo = criterio.areas[posicao];
    this.atualizar(indice, { areas: semAreaNaPosicao(criterio.areas, posicao) });
    this.anunciar(`Área ${this.areas.rotuloDaArea(codigo)} retirada do critério ${indice + 1}.`);
    // O botão clicado sai do DOM com a linha: o foco vai para a área anterior; da primeira, para a
    // que passou a ocupar a posição dela; sem nenhuma, para o seletor de acrescentar e, quando ele
    // não está na tela, para a regra do critério.
    const vizinha = posicao > 0 ? posicao - 1 : 0;
    focarAposRenderizar(
      this.injector,
      `desemp-area-remover-${indice}-${vizinha}`,
      `desemp-area-nova-${indice}`,
      `desemp-regra-${indice}`,
    );
  }

  /** Troca de posição duas áreas do critério. A ordem é a regra: a primeira desempata primeiro. */
  moverArea(indice: number, posicao: number, delta: number): void {
    const criterio = this.criterios()[indice];
    const destino = posicao + delta;
    const areas =
      criterio === undefined ? null : comAreasTrocadas(criterio.areas, posicao, destino);
    if (areas === null) return;

    this.atualizar(indice, { areas });
    this.anunciar(
      `Área ${this.areas.rotuloDaArea(areas[destino])} movida para a posição ${destino + 1} de ${areas.length} no critério ${indice + 1}.`,
    );
    focarAposRenderizar(
      this.injector,
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

  /** O que o predicado alcança — a mesma leitura que a exigência documental oferece. */
  alcanceDoCriterio(criterio: CriterioDesempateConfigurado): string {
    const fato = this.fatoDoCriterio(criterio.fato);
    return fato === undefined ? '' : alcanceDaCondicao(criterio, fato);
  }

  /** A condição que o componente devolve: só os três campos do predicado entram no critério. */
  alterarCondicao(indice: number, condicao: CondicaoDeFato): void {
    this.atualizar(indice, {
      fato: condicao.fato,
      operador: condicao.operador,
      valor: condicao.valor,
    });
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

    const adia = this.areas.adiaAGravacao();
    return {
      titulo: 'Confirmar os critérios de desempate',
      aviso: adia
        ? 'A ordem exibida é a ordem em que os critérios serão avaliados. Eles serão gravados junto com a classificação, no passo Eliminação.'
        : 'A ordem exibida é a ordem em que os critérios serão avaliados.',
      rotuloDeConfirmar: adia ? 'Confirmar critérios' : 'Gravar critérios',
      itens: criterios.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério`,
        valor: textoDoCriterio(criterio, (codigo) => this.areas.rotuloDaArea(codigo)),
      })),
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const messages = mensagensDoDesempate({
      criterios: this.criterios(),
      obrigatorio: this.desempateObrigatorio(),
      etapas: this.etapasReferenciaveis(),
      fatos: this.fatoPorCodigo(),
      situacaoDoQuadro: this.areas.situacaoDoQuadro(),
      rotuloDaArea: (codigo) => this.areas.rotuloDaArea(codigo),
    });
    return messages.length ? { valid: false, messages } : { valid: true };
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
      (erro) =>
        recusaAoGravarODesempate(erro, criterios, (codigo) => this.areas.rotuloDaArea(codigo)),
      () => this.problemI18n.resolve(problema).title,
    );
  }

  /**
   * Grava a coleção inteira, na ordem em que está na tela (CA-05). Com critério por área e sem o
   * quadro gravado, só marca a gravação como pendente: quem grava a classificação grava os
   * critérios em seguida (`gravarAposAClassificacao`).
   */
  async persistir(): Promise<StepValidation> {
    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;
    if (this.store.processoSeletivoId() !== null && this.areas.adiaAGravacao()) {
      this.store.classificacao.desempatePendenteDeGravacao.set(true);
      return { valid: true };
    }
    return this.gravar();
  }

  /** Grava os critérios que ficaram para depois da classificação, se ficaram. */
  async gravarAposAClassificacao(): Promise<StepValidation> {
    if (!this.store.classificacao.desempatePendenteDeGravacao()) return { valid: true };
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
          this.store.classificacao.criteriosDesempateGravados.set(criterios);
          this.store.classificacao.desempatePendenteDeGravacao.set(false);
        } else if (resposta.inconclusiva) {
          // O servidor pode ter gravado: o que ele tem deixa de ser sabido até a releitura.
          this.store.classificacao.criteriosDesempateGravados.set(null);
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
