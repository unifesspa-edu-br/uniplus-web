import {
  ABRANGENCIAS_ESCOLHIVEIS,
  CONSEQUENCIAS_ESCOLHIVEIS,
  CONSEQUENCIA_REENVIO,
  FATO_MODALIDADE,
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
  agrupadosPorFormulario,
  baseLegalNova,
  comAlcanceDeTodasAsFases,
  comExigencia,
  comFinalidade,
  comExigenciaNaRaiz,
  comExigidoDeTodos,
  comRecorteEscolhido,
  comRepeticao,
  comRepeticaoEmTodasAsFases,
  exigenciaDecideResultado,
  exigenciaNova,
  exigenciasDaFase,
  exigenciasDaRaiz,
  exigenciasLocalizadasDaFase,
  exigidoDeTodos,
  faltaOFormulario,
  finalidadeDaExigencia,
  formatosDeclarados,
  modalidadesDaExigencia,
  semAExigencia,
  temNormaResolvida,
  todasAsExigencias,
  type ExigenciaLocalizada,
  type GrupoDaExigencia,
  type RepeticaoDaExigencia,
} from '../../shared/exigencias-documentais';
import {
  clausulasDoGatilho,
  dominiosDoGatilho,
  fatosDoGatilhoNaFase,
  fatosParaGatilho,
  recusasDeFaseDoGatilho,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';
import {
  camposDaRepeticao,
  fasesNoCronograma,
  motivoDoGrupoForaDoLugar,
  orientacaoDaRecusaDaRepeticao,
  producaoDoRascunho,
  recusaDaRepeticao,
  type GrupoDaProducao,
  type NomesDaOrientacao,
} from '../../shared/fase-do-fato';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  ComboboxComponent,
  EditorDeCondicoesComponent,
  type UiComboboxGroup,
} from '@uniplus/shared-ui/components';
import { Subscription } from 'rxjs';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type BancaRequeridaDaFase,
  type BaseLegalConfig,
  type CondicaoGatilhoConfig,
  type DocumentoDefinicao,
  type ExigenciasDoRascunho,
  type ExigenciaDeDocumento,
  type EtapaPontuada,
  type ModeloDaExigencia,
  type FaseDoCronograma,
  type ProdutoDaFase,
  type StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import {
  ORIENTACAO_DE_PERMUTACAO,
  PERMUTACAO_DE_ORDEM,
  gravarCronogramaFases,
} from '../../shared/gravacao-do-cronograma';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { descreverFase, finalidadesDaFase } from '../cronograma/cronograma-do-certame';
import { nomeDaFinalidade } from '../formulario/formularios-por-finalidade';
import {
  PAPEIS_ESCOLHIVEIS,
  problemasDaFase,
  produtosPreliminares,
  traduzirRecusa,
  type AtoDoCatalogo,
  type CampoDaFase,
  type ProblemaDaFase,
} from './configuracao-da-fase';
import { faseDaConfiguracao, grupoDaConfiguracaoDaFase, type FaseConfigForm } from './fase-form';
import { ModeloDaExigenciaComponent } from './modelo-da-exigencia/modelo-da-exigencia.component';
import {
  alcancaOPublico,
  composicaoResumida,
  descreverNorma,
  descreverPublico,
  normaComum,
  publicoDaExigencia,
  repeticaoResumida,
  rotuloDaConsequencia,
  type FiltroDePublico,
  type NormaDescrita,
  type PublicoDaExigencia,
} from './resumo-da-exigencia';

/**
 * Unidades de prazo que o domínio aceita, com o rótulo que o operador lê. Dia
 * corrido fica de fora de propósito: o domínio o recusa na interposição, e
 * oferecê-lo seria convidar a uma gravação que volta recusada.
 */
const UNIDADES = [
  { valor: 'diasUteis', rotulo: 'dias úteis' },
  { valor: 'horas', rotulo: 'horas' },
] as const;

/** A opção que deixa o documento fora de formulário, na fase que não responde nenhum. */
const SEM_FORMULARIO = 'SEM_FORMULARIO';

/** O gatilho sem condição recusada pela fase — a mesma referência, para o editor não se redesenhar. */
const SEM_ERROS: Readonly<Record<number, string>> = {};

/**
 * A fase como o seletor a apresenta: posição na linha do tempo e nome resolvido
 * pelo catálogo, ou pelo código quando a fase saiu dele.
 */
interface FaseNoSeletor {
  readonly faseCanonicaId: string;
  readonly codigo: string;
  readonly ordem: number;
  readonly nome: string;
}

/**
 * A superfície de configuração de uma fase: o que só existe dentro dela e não
 * cabe na linha do tempo — as publicações que ela faz e o papel de cada uma, a
 * conclusão do ciclo recursal, a regra de recurso, as bancas requeridas com o
 * recorte que julgam, e as exigências documentais daquela fase.
 *
 * Grava pelo comando do cronograma, porque fase é uma coleção só e o `PUT` a
 * substitui inteira. Por isso envia todas as fases, e não a que está aberta —
 * mandar só ela apagaria as demais.
 */
@Component({
  selector: 'sel-step-fase',
  imports: [
    ComboboxComponent,
    EditorDeCondicoesComponent,
    FormsModule,
    ModeloDaExigenciaComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(FaseStepComponent)],
})
export class FaseStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly destruicao = inject(DestroyRef);

  readonly papeis = PAPEIS_ESCOLHIVEIS;
  readonly unidades = UNIDADES;
  /** Do cadastro vivo de Configuração, não de uma lista escrita nesta tela. */
  readonly gruposDeDocumento = this.catalogos.documentosPorCategoria;

  /**
   * Quando declarada, a configuração pertence a essa fase e o seletor próprio some: é o
   * modo em que o passo Cronograma embute este bloco dentro de cada fase da linha do
   * tempo, em vez de repetir a fase num combo no rodapé.
   */
  readonly faseFixada = input<string | null>(null);

  /** Fase aberta, pelo id da fase canônica — o identificador sempre presente. */
  readonly faseAberta = signal('');

  /** Formulário da fase aberta; `null` enquanto o cronograma está vazio. */
  readonly formulario = signal<FormGroup<FaseConfigForm> | null>(null);

  /** O que a última gravação recusou, por campo desta fase. */
  readonly recusaPorCampo = signal<ReadonlyMap<CampoDaFase, string>>(new Map());

  /** Recusas que não pertencem a nenhum campo da fase aberta. */
  readonly recusasGerais = signal<readonly string[]>([]);

  /**
   * O conteúdo do formulário, como signal, para que os valores derivados reajam
   * à digitação. Não é a fonte do dado, só a forma de o template acompanhar.
   */
  private readonly versaoDoFormulario = signal(0);

  /**
   * Enquanto o rascunho está sendo espelhado no formulário, o caminho de volta
   * fica fechado: sem isso, cada projeção dispararia uma escrita no rascunho,
   * que dispararia outra projeção.
   */
  private espelhando = false;

  /** Assinatura do formulário vivo — trocar de fase descarta a anterior. */
  private assinatura: Subscription | null = null;

  constructor() {
    this.catalogos.carregar();
    this.destruicao.onDestroy(() => this.assinatura?.unsubscribe());

    // A fase aberta acompanha o cronograma: sem escolha, ou com a escolha já
    // removida da linha do tempo, abre a primeira. Deixar a tela apontando para
    // uma fase que saiu mostraria um formulário sem dono.
    effect(() => {
      const fases = this.fasesDoCronograma();
      const fixada = this.faseFixada();
      untracked(() => {
        if (fixada !== null) {
          this.faseAberta.set(fixada);
          return;
        }

        if (fases.some((fase) => fase.faseCanonicaId === this.faseAberta())) return;
        this.faseAberta.set(fases[0]?.faseCanonicaId ?? '');
      });
    });

    // Rascunho → formulário. É a única entrada que não veio da digitação: a
    // hidratação da leitura e a troca de fase chegam por aqui.
    effect(() => {
      const fase = this.faseDoRascunho();
      untracked(() => this.espelhar(fase));
    });

    // Fora de rascunho o servidor recusa qualquer gravação, e deixar a tela
    // aceitar digitação faria a revisão exibir o que o avanço descarta.
    effect(() => {
      const editavel = this.store.aceitaEdicao();
      const formulario = this.formulario();
      untracked(() => {
        if (formulario === null) return;
        if (editavel) formulario.enable({ emitEvent: false });
        else formulario.disable({ emitEvent: false });
      });
    });

    // Com um só resultado preliminar não há escolha a fazer, e pré-selecionar
    // poupa um clique. Com dois — gabarito e resultado, por exemplo — a escolha
    // é do operador: eleger um deles contaria a janela da publicação errada.
    // Só preenche o campo vazio, e por isso nunca sobrescreve o que ele decidiu.
    effect(() => {
      const unica = this.ancoraUnica();
      const formulario = this.formulario();
      // Ligar o interruptor não muda a lista de âncoras nem recria o
      // formulário: sem acompanhar a edição, o campo ficaria vazio esperando
      // uma escolha que não existe.
      this.versaoDoFormulario();
      untracked(() => {
        if (formulario === null || unica === null) return;
        if (!formulario.controls.admiteRecurso.value) return;
        const ancora = formulario.controls.recurso.controls.atoAncoraCodigo;
        if (ancora.value === '') ancora.setValue(unica);
      });
    });

    // Outro processo entra em cena: a recusa que está na tela era do anterior.
    effect(() => {
      this.store.geracao();
      untracked(() => this.limparRecusa());
    });
  }

  /** As fases do certame na ordem em que ocorrem. */
  readonly fasesDoCronograma = computed<readonly FaseDoCronograma[]>(() =>
    [...this.store.draft().cronograma.fases].sort((uma, outra) => uma.ordem - outra.ordem),
  );

  /** As fases como o seletor as nomeia. */
  readonly fasesNoSeletor = computed<readonly FaseNoSeletor[]>(() => {
    const fasePorId = this.catalogos.fasePorId();
    return this.fasesDoCronograma().map((fase) => ({
      faseCanonicaId: fase.faseCanonicaId,
      codigo: fase.codigo,
      ordem: fase.ordem,
      nome: descreverFase(fase, fasePorId).nome,
    }));
  });

  /** A fase aberta como o rascunho a guarda, ou `null` sem cronograma. */
  readonly faseDoRascunho = computed<FaseDoCronograma | null>(() => {
    const aberta = this.faseAberta();
    return this.fasesDoCronograma().find((fase) => fase.faseCanonicaId === aberta) ?? null;
  });

  /** Nome da fase aberta, para o cabeçalho e para as mensagens. */
  readonly nomeDaFaseAberta = computed(() => {
    const aberta = this.faseAberta();
    return this.fasesNoSeletor().find((fase) => fase.faseCanonicaId === aberta)?.nome ?? '';
  });

  /** Atos escolhíveis hoje, com a marca de resultado que decide o papel. */
  readonly atosEscolhiveis = computed(() =>
    this.catalogos
      .atosVigentes()
      .map((ato) => ({ codigo: ato.codigo, nome: ato.nome, ehResultado: ato.ehResultado })),
  );

  /** Regras de prazo de recurso publicadas no catálogo versionado. */
  readonly regrasDeRecurso = computed(() =>
    this.catalogos
      .regrasRecurso()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  /** Categorias de documento do cadastro, na ordem de exibição que ele decide. */
  readonly categorias = computed(() =>
    this.catalogos.categorias().map((categoria) => ({ id: categoria.id, nome: categoria.nome })),
  );

  /**
   * Bancas que o seletor oferece: as do cadastro, mais a que esta fase já exige
   * e saiu dele. A banca congelada continua fazendo parte do edital; fora da
   * lista, ela seguiria sendo enviada a cada gravação sem que o operador a
   * visse — nem pudesse tirá-la.
   */
  readonly bancasEscolhiveis = computed<readonly { id: string; nome: string }[]>(() => {
    this.versaoDoFormulario();
    const doCadastro = this.catalogos.bancas().map((banca) => ({ id: banca.id, nome: banca.nome }));
    const conhecidas = new Set(doCadastro.map((banca) => banca.id));

    const fase = this.faseDoRascunho();
    const codigoCongelado = new Map(
      (fase?.congelados?.bancas ?? []).map((banca) => [banca.id, banca.codigo]),
    );

    const congeladas = (fase?.bancasRequeridas ?? [])
      .map((banca) => banca.tipoBancaId)
      .filter((id) => id !== '' && !conhecidas.has(id))
      .map((id) => ({
        id,
        nome: `${codigoCongelado.get(id) ?? 'Banca'} (fora do cadastro atual)`,
      }));

    return [...doCadastro, ...congeladas];
  });

  /** As publicações preliminares da fase — as únicas que podem ancorar o prazo. */
  readonly ancorasPossiveis = computed<readonly { codigo: string; nome: string }[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    const rotulos = this.catalogos.rotuloDoAto();
    return produtosPreliminares(fase.produtos).map((produto) => ({
      codigo: produto.atoCodigo,
      nome: rotulos.get(produto.atoCodigo) ?? produto.atoCodigo,
    }));
  });

  /** Publicação preliminar única, que dispensa escolha; `null` com zero ou duas. */
  readonly ancoraUnica = computed(() => {
    const possiveis = this.ancorasPossiveis();
    return possiveis.length === 1 ? possiveis[0].codigo : null;
  });

  /** Fases que podem concluir o ciclo desta: publicam definitiva e vêm depois. */
  readonly concluintesPossiveis = computed<readonly FaseNoSeletor[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    const declaradaPorId = new Map(
      this.fasesDoCronograma().map((candidata) => [candidata.faseCanonicaId, candidata]),
    );

    return this.fasesNoSeletor().filter((outra) => {
      if (outra.faseCanonicaId === fase.faseCanonicaId || outra.ordem <= fase.ordem) return false;
      const declarada = declaradaPorId.get(outra.faseCanonicaId);
      return declarada?.produtos.some((produto) => produto.papel === PAPEL_DEFINITIVO) === true;
    });
  });

  /** A fase abre ciclo recursal: publica ao menos um resultado preliminar. */
  readonly publicaPreliminar = computed(() => this.ancorasPossiveis().length > 0);

  private readonly atoPorCodigo = computed<ReadonlyMap<string, AtoDoCatalogo>>(
    () =>
      new Map(
        [...this.catalogos.atoPorCodigo()].map(([codigo, ato]) => [
          codigo,
          { nome: ato.nome, ehResultado: ato.ehResultado },
        ]),
      ),
  );

  /** O que impede gravar a fase aberta, com o campo de cada recusa. */
  readonly problemas = computed<readonly ProblemaDaFase[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];
    return problemasDaFase(fase, this.fasesDoCronograma(), this.atoPorCodigo(), (id) =>
      this.nomeDaBanca(id),
    );
  });

  /**
   * O que a tela mostra sob um campo: a conferência local, e a recusa que o
   * servidor devolveu por aquele mesmo campo. A conferência vem primeiro porque
   * descreve o estado atual — a recusa descreve o que foi enviado.
   */
  erroDoCampo(campo: CampoDaFase): string | null {
    const local = this.problemas().find((problema) => problema.campo === campo);
    return local?.mensagem ?? this.recusaPorCampo().get(campo) ?? null;
  }

  nomeDaBanca(tipoBancaId: string): string {
    return this.bancasEscolhiveis().find((banca) => banca.id === tipoBancaId)?.nome ?? tipoBancaId;
  }

  abrirFase(faseCanonicaId: string): void {
    this.faseAberta.set(faseCanonicaId);
    this.limparRecusa();
  }

  // ─── Publicações declaradas pela fase ───────────────────────────────────

  get produtos(): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return this.formulario()?.controls.produtos.value ?? [];
  }

  acrescentarProduto(): void {
    this.escreverProdutos([...this.produtos, { atoCodigo: '', papel: null }]);
  }

  removerProduto(posicao: number): void {
    this.escreverProdutos(this.produtos.filter((_, indice) => indice !== posicao));
  }

  /**
   * Trocar o ato de uma publicação pode tirar dela o direito ao papel: só ato
   * que o catálogo marca como resultado o recebe. Zerar o papel junto evita
   * declarar uma combinação que a própria tela já sabe que o servidor recusa.
   */
  escolherAto(posicao: number, codigo: string): void {
    this.escreverProdutos(
      this.produtos.map((produto, indice) =>
        indice === posicao
          ? { atoCodigo: codigo, papel: this.aceitaPapel(codigo) ? produto.papel : null }
          : produto,
      ),
    );
  }

  escolherPapel(posicao: number, papel: string): void {
    this.escreverProdutos(
      this.produtos.map((produto, indice) =>
        indice === posicao ? { ...produto, papel: papel === '' ? null : papel } : produto,
      ),
    );
  }

  /**
   * Atos que o seletor desta linha oferece: os vigentes, mais o que ela já
   * declara quando esse saiu de vigência.
   *
   * Sem ele na lista, nenhuma opção casa e o campo aparece em branco — o
   * operador não veria qual publicação está declarada, e gravaria por cima dela
   * sem perceber.
   */
  atosPara(codigo: string): readonly { codigo: string; nome: string }[] {
    const vigentes = this.atosEscolhiveis();
    if (codigo === '' || vigentes.some((ato) => ato.codigo === codigo)) return vigentes;

    const nome = this.catalogos.rotuloDoAto().get(codigo);
    return [
      ...vigentes,
      { codigo, nome: nome === undefined ? codigo : `${nome} (fora de vigência)` },
    ];
  }

  /**
   * O ato desta linha aceita papel. Ato fora do catálogo carregado passa: quem
   * arbitra é o servidor, e travar o campo aqui esconderia o papel que a fase
   * já declara.
   */
  aceitaPapel(codigo: string): boolean {
    if (codigo === '') return false;
    const ato = this.atoPorCodigo().get(codigo);
    return ato === undefined || ato.ehResultado;
  }

  /**
   * Escreve as publicações e reconcilia o que depende delas.
   *
   * A conclusão do ciclo recursal só existe em fase que publica preliminar, e o
   * seletor que a declara desaparece junto com ele. Deixar o código declarado
   * para trás trancaria o passo numa recusa — "só fase que publica resultado
   * preliminar declara quem a conclui" — cujo campo a tela já não mostra, e sem
   * caminho visível para desfazê-la.
   */
  private escreverProdutos(produtos: readonly ProdutoDaFase[]): void {
    const formulario = this.formulario();
    if (formulario === null) return;

    formulario.controls.produtos.setValue(produtos);

    const abreCicloRecursal = produtos.some((produto) => produto.papel === PAPEL_PRELIMINAR);
    if (!abreCicloRecursal && formulario.controls.faseConcluinteCodigo.value !== '') {
      formulario.controls.faseConcluinteCodigo.setValue('');
    }
  }

  // ─── Bancas requeridas e o recorte de competência ───────────────────────

  get bancas(): readonly BancaRequeridaDaFase[] {
    this.versaoDoFormulario();
    return this.formulario()?.controls.bancasRequeridas.value ?? [];
  }

  acrescentarBanca(): void {
    this.escreverBancas([...this.bancas, { tipoBancaId: '', categoriasDocumentoIds: [] }]);
  }

  removerBanca(posicao: number): void {
    this.escreverBancas(this.bancas.filter((_, indice) => indice !== posicao));
  }

  escolherTipoDeBanca(posicao: number, tipoBancaId: string): void {
    this.escreverBancas(
      this.bancas.map((banca, indice) => (indice === posicao ? { ...banca, tipoBancaId } : banca)),
    );
  }

  alternarCategoria(posicao: number, categoriaId: string, marcada: boolean): void {
    this.escreverBancas(
      this.bancas.map((banca, indice) => {
        if (indice !== posicao) return banca;
        const semEla = banca.categoriasDocumentoIds.filter((id) => id !== categoriaId);
        return { ...banca, categoriasDocumentoIds: marcada ? [...semEla, categoriaId] : semEla };
      }),
    );
  }

  categoriaMarcada(posicao: number, categoriaId: string): boolean {
    return this.bancas[posicao]?.categoriasDocumentoIds.includes(categoriaId) === true;
  }

  /**
   * A banca desta linha divide o tipo com outra da mesma fase — é o caso em que
   * o recorte deixa de ser opcional, porque é ele que diz qual julga o quê.
   */
  recorteObrigatorio(posicao: number): boolean {
    const tipo = this.bancas[posicao]?.tipoBancaId;
    if (tipo === undefined || tipo === '') return false;
    return this.bancas.filter((banca) => banca.tipoBancaId === tipo).length > 1;
  }

  /**
   * A regra é identificada por código **e** versão: publicar versão nova do
   * catálogo não pode mudar a regra que um processo já aplicou. Escolher pelo
   * código e deduzir a versão do que está carregado é o que mantém o par
   * coerente — gravar código novo com versão velha é recusado.
   */
  escolherRegra(codigo: string): void {
    const grupo = this.formulario();
    if (grupo === null) return;

    const versao = this.regrasDeRecurso().find((regra) => regra.codigo === codigo)?.versao ?? '';
    grupo.controls.recurso.controls.regraCodigo.setValue(codigo);
    grupo.controls.recurso.controls.regraVersao.setValue(versao);
  }

  private escreverBancas(bancas: readonly BancaRequeridaDaFase[]): void {
    this.formulario()?.controls.bancasRequeridas.setValue(bancas);
  }

  // ─── Exigências documentais desta fase ──────────────────────────────────

  /** Só as modalidades que as ofertas de vagas selecionam podem exigir documento. */
  readonly modalidades = computed(() => this.store.modalidadesDoProcesso());

  /**
   * A configuração de um documento, ou o padrão de quem ainda não foi tocado. O registro
   * do rascunho deixou de nascer semeado por um catálogo fixo — o cadastro cresce sem
   * deploy, e semear a partir dele faria o rascunho guardar documento que ninguém marcou.
   */
  /** O documento escolhido no seletor, ainda não acrescentado. */
  readonly documentoAAcrescentar = signal('');

  /**
   * Como cada documento desta fase está declarado na árvore — solto, ou dentro de um grupo
   * que o combina com outros.
   *
   * Indexado pelo tipo de documento porque é por ele que a tela endereça a exigência. Quando o
   * mesmo tipo é declarado mais de uma vez na fase, guarda todas: a lista mostra uma linha só,
   * e é preciso dizer isso em vez de deixar o operador editar uma das declarações sem saber
   * que há outra.
   */
  private readonly declaracoesPorDocumento = computed(() => {
    this.versaoDoFormulario();
    const fase = this.faseDoRascunho();
    if (fase === null) return new Map<string, readonly ExigenciaLocalizada[]>();

    const porTipo = new Map<string, ExigenciaLocalizada[]>();
    for (const achada of exigenciasLocalizadasDaFase(this.store.draft().documentos, fase.codigo)) {
      const atuais = porTipo.get(achada.documento.tipoDocumentoId) ?? [];
      atuais.push(achada);
      porTipo.set(achada.documento.tipoDocumentoId, atuais);
    }
    return porTipo;
  });

  /**
   * Como o documento é exigido: por si, ou como alternativa dentro de um grupo. Vazio quando
   * está solto, que é o caso comum e não precisa de explicação.
   */
  posicaoNaArvore(id: string): string {
    const grupo = this.grupoDoDocumento(id);
    if (grupo === null) return '';

    if (grupo.tipo === 'E') {
      return `Faz parte de um conjunto de ${grupo.alternativas} documentos que valem juntos.`;
    }

    const minima = grupo.quantidadeMinima ?? 1;
    return minima === 1
      ? `É uma das ${grupo.alternativas} alternativas de um grupo — basta entregar uma delas.`
      : `É uma das ${grupo.alternativas} alternativas de um grupo que pede ${minima} delas.`;
  }

  /** O grupo que o documento compõe, ou `null` quando ele é exigido por si. */
  private grupoDoDocumento(id: string): GrupoDaExigencia | null {
    const grupo = (this.declaracoesPorDocumento().get(id) ?? [])[0]?.grupo ?? null;

    // Grupo de um filho só não oferece alternativa nenhuma: satisfazê-lo é satisfazer aquele
    // filho, e a folha é materialmente igual a uma exigência solta. Anunciá-la como grupo
    // informaria errado antes de informar mal.
    return grupo !== null && grupo.alternativas >= 2 ? grupo : null;
  }

  /**
   * O aviso de que este documento está declarado mais de uma vez nesta fase.
   *
   * A tela mostra uma linha por tipo de documento, e editar essa linha mexe na primeira
   * declaração. Enquanto isso ficava calado, o operador acreditava estar editando a exigência
   * que estava vendo.
   */
  declaradoMaisDeUmaVez(id: string): string {
    const quantas = (this.declaracoesPorDocumento().get(id) ?? []).length;
    if (quantas <= 1) return '';

    return `Este documento está declarado ${quantas} vezes nesta fase, em posições diferentes da árvore. O que se edita aqui é a primeira declaração.`;
  }

  /**
   * Os documentos que esta fase exige, na ordem do catálogo.
   *
   * A tela lista o que foi declarado, não o catálogo inteiro: com setenta e quatro tipos
   * em nove categorias, uma caixa por documento em cada fase punha centenas de controles
   * numa rolagem só, e o que o certame de fato exige — dois, três por fase — ficava
   * perdido no meio deles.
   */
  readonly documentosDaFase = computed<readonly DocumentoDefinicao[]>(() => {
    this.versaoDoFormulario();
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    const exigencias = this.store.draft().documentos;
    // Inclui o que vale em todas as fases: a intenção só se materializa na gravação, e sem
    // isto a fase acrescentada depois não mostraria o documento que o operador já declarou
    // valer nela.
    const declarados = new Set([
      ...exigenciasDaFase(exigencias, fase.codigo).map((e) => e.tipoDocumentoId),
      ...exigencias.emTodasAsFases,
    ]);
    const doCatalogo = this.catalogos
      .documentosPorCategoria()
      .flatMap((grupo) => grupo.docs)
      .filter((doc) => declarados.has(doc.id));

    // O tipo inativado no cadastro sai do catálogo vivo, e a exigência que o cita continua no
    // rascunho — a gravação seguinte a reenvia inteira. Sem sintetizar a linha, ela sumia da
    // tela: o operador não conseguia nem conferir nem remover o que continuava sendo exigido.
    const visiveis = new Set(doCatalogo.map((doc) => doc.id));
    const foraDoCadastro = [...declarados]
      .filter((id) => !visiveis.has(id))
      .map((id) => this.documentoForaDoCadastro(id, exigencias));

    return [...doCatalogo, ...foraDoCadastro];
  });

  /** A linha do tipo que o cadastro não oferece mais, nomeada pelo que o processo guardou. */
  private documentoForaDoCadastro(
    tipoDocumentoId: string,
    exigencias: ExigenciasDoRascunho,
  ): DocumentoDefinicao {
    const declarada = todasAsExigencias(exigencias).find(
      (exigencia) => exigencia.tipoDocumentoId === tipoDocumentoId,
    );

    return {
      id: tipoDocumentoId,
      nome: declarada?.tipoDocumentoNome ?? 'Documento fora do cadastro ativo',
      desc: 'Este tipo saiu do cadastro depois de ser exigido aqui. Continua valendo enquanto estiver na lista — remova-o se não for mais pedido.',
    };
  }

  /**
   * O que o campo ainda oferece: o catálogo menos o que esta fase já exige, agrupado pela
   * categoria do cadastro.
   *
   * A busca é do próprio campo — setenta e quatro tipos em nove categorias não se acham
   * rolando uma lista, e quem monta o edital sabe o nome do documento.
   */
  readonly documentosDisponiveis = computed<readonly UiComboboxGroup[]>(() => {
    const jaExigidos = new Set(this.documentosDaFase().map((doc) => doc.id));

    return this.catalogos
      .documentosPorCategoria()
      .map((grupo) => ({
        label: grupo.label,
        options: grupo.docs
          .filter((doc) => !jaExigidos.has(doc.id))
          .map((doc) => ({ value: doc.id, label: doc.nome })),
      }))
      .filter((grupo) => grupo.options.length > 0);
  });

  /** Quantos documentos o catálogo ainda oferece a esta fase. */
  readonly documentosAlcancados = computed(() =>
    this.documentosDisponiveis().reduce((total, grupo) => total + grupo.options.length, 0),
  );

  /** Acrescenta à fase o documento escolhido, e devolve o seletor ao estado neutro. */
  acrescentarDocumento(): void {
    const id = this.documentoAAcrescentar();
    if (id === '') return;

    this.alternarExigencia(id, true);
    // O aviso de que ele saiu deixou de valer: zerado, a próxima remoção do mesmo documento
    // muda o texto da região de status e volta a ser anunciada.
    this.avisoDaRemocao.set('');
    // O documento recém-exigido ainda não declarou nada: os campos dele abrem já à mostra.
    this.alternarEdicao(id, true);
    // O campo volta ao estado neutro: o próximo documento começa do zero.
    this.documentoAAcrescentar.set('');
  }

  escolherDocumento(id: string): void {
    this.documentoAAcrescentar.set(id);
  }

  /** O aviso de que o documento saiu da fase; vazio até a primeira remoção e ao trocar de fase. */
  readonly avisoDaRemocao = linkedSignal({ source: this.faseAberta, computation: () => '' });

  private readonly hospedeiroDoSeletor = viewChild('seletorDeDocumento', { read: ElementRef });

  /**
   * Tira o documento desta fase; das outras, só se ele não valer em nenhuma mais.
   *
   * O botão focado sai junto com a linha, e o foco cairia no corpo da página. Ele vai então para o
   * seletor do público, que continua na tela enquanto houver documento, ou para o campo de
   * "Documento a exigir", que é fixo; a região de status diz o que saiu.
   */
  removerDocumento(id: string, seletorDoPublico: HTMLElement): void {
    const nome = this.resumos().find((resumo) => resumo.id === id)?.nome ?? '';
    this.alternarExigencia(id, false);
    this.alternarEdicao(id, false);
    this.avisoDaRemocao.set(`${nome} removido dos documentos exigidos nesta fase.`);

    const destino =
      this.resumos().length > 0
        ? seletorDoPublico
        : this.hospedeiroDoSeletor()?.nativeElement.querySelector('input');
    destino?.focus();
  }

  /**
   * Os documentos cujos campos estão à mostra, por fase: a mesma exigência em outra fase é
   * outra exigência, e abri-la numa não a abre nas demais. A conferência lê o resumo; os campos
   * abrem por documento, porque a fase com dezenas deles abertos de uma vez não se confere.
   */
  private readonly documentosEmEdicao = signal<ReadonlySet<string>>(new Set());

  private chaveDeEdicao(id: string): string {
    return `${this.faseDoRascunho()?.codigo ?? ''}|${id}`;
  }

  emEdicao(id: string): boolean {
    return this.documentosEmEdicao().has(this.chaveDeEdicao(id));
  }

  alternarEdicao(id: string, aberto = !this.emEdicao(id)): void {
    const chave = this.chaveDeEdicao(id);
    this.documentosEmEdicao.update((atuais) => {
      const proximos = new Set(atuais);
      if (aberto) proximos.add(chave);
      else proximos.delete(chave);
      return proximos;
    });
  }

  /** O resumo de cada documento da fase: o que decide a exigência, sem abrir os campos. */
  readonly resumos = computed<readonly ResumoDoDocumento[]>(() =>
    this.documentosDaFase().map((doc) => {
      const exigencia = this.exigenciaDoDocumento(doc.id);
      const publico = publicoDaExigencia(exigencia, this.fatoPorCodigo());
      return {
        id: doc.id,
        nome: doc.nome,
        documento: doc,
        publico,
        aplicaA: descreverPublico(publico),
        entrega: exigencia.obrigatorio ? 'Obrigatória' : 'Facultativa',
        composicao: composicaoResumida(this.grupoDoDocumento(doc.id)),
        repeticao: this.repeticaoResumidaDoDocumento(doc.id),
        consequencia: rotuloDaConsequencia(
          exigencia.consequenciaIndeferimento,
          exigencia.obrigatorio,
        ),
        coleta: this.coletaDoDocumento(doc.id),
        bases: exigencia.basesLegais,
        normas: exigencia.basesLegais.map(descreverNorma),
        faltaNorma: this.faltaNormaResolvida(doc.id),
        repetido: this.declaradoMaisDeUmaVez(doc.id),
        finalidade: this.finalidadeDoDocumento(doc.id),
      };
    }),
  );

  /**
   * A conferência por formulário: na fase que divide inscrição e isenção, o candidato apresenta
   * cada documento no bloco de comprovação de um deles, e a lista única misturaria os dois. A fase
   * de um formulário só, ou de nenhum, segue numa lista.
   */
  readonly conferenciaPorFormulario = computed(() =>
    agrupadosPorFormulario(this.resumosVisiveis(), (resumo) => resumo.finalidade, this.finalidadesDaFaseAberta()),
  );

  /** Como a conferência nomeia o grupo de um formulário; o grupo sem formulário pede a escolha. */
  tituloDoFormulario(finalidade: string | null): string {
    return finalidade === null ? 'Formulário a escolher' : `Formulário de ${nomeDaFinalidade(finalidade)}`;
  }

  /**
   * A norma que sustenta todos os documentos da fase, quando é uma só e resolvida. Ela aparece
   * uma vez, acima da tabela, e a coluna sai: repetida em cada linha, dobraria a altura de cada
   * documento sem dizer nada que a primeira linha já não dissesse.
   */
  readonly normaComumDaFase = computed(() => {
    const comum = normaComum(this.resumos().map((resumo) => resumo.bases));
    return comum === null ? null : descreverNorma(comum);
  });

  /** Quantas colunas a tabela da conferência tem — a linha dos campos ocupa todas. */
  readonly colunasDaConferencia = computed(() => (this.normaComumDaFase() === null ? 6 : 5));

  /**
   * Em que ponto desta fase o documento é coletado, e se ele vale também nas outras. A fase é a
   * da própria tabela, e repeti-la em cada linha só alongaria a coluna.
   */
  private coletaDoDocumento(id: string): string {
    const etapaId = this.etapaDoDocumento(id);
    const etapa = this.etapasDaFaseAberta().find((candidata) => candidata.id === etapaId);
    const momento = etapa === undefined ? 'na fase inteira' : `na etapa ${etapa.nome}`;
    return this.valeEmTodasAsFases(id)
      ? `Todas as fases; nesta, ${momento}`
      : `${momento.charAt(0).toUpperCase()}${momento.slice(1)}`;
  }

  /**
   * O id de um elemento desta fase, único por instância: o Cronograma embute um passo destes por
   * fase aberta, e com id fixo o rótulo, o `aria-describedby` e o `aria-controls` da segunda fase
   * apontariam para os da primeira. Todo id do template passa por aqui.
   */
  idDaFase(sufixo: string): string {
    return `fase-${this.faseDoRascunho()?.codigo ?? ''}-${sufixo}`;
  }

  /**
   * Quem a conferência está olhando: o valor do filtro, codificado para o seletor. É da fase
   * aberta: outra fase pode não declarar o público escolhido, e abriria vazia sem motivo.
   */
  readonly filtroDoPublico = linkedSignal({ source: this.faseAberta, computation: () => '' });

  /** O aviso de que o documento recolhido saiu da lista filtrada; vazio no resto do tempo. */
  readonly saiuDaLista = linkedSignal({ source: this.faseAberta, computation: () => '' });

  escolherPublico(valor: string): void {
    this.filtroDoPublico.set(valor);
    this.saiuDaLista.set('');
  }

  /**
   * Abre ou recolhe os campos a partir do nome do documento na conferência.
   *
   * O documento aberto fica na lista mesmo fora do público filtrado; recolhido, ele sai, e o
   * botão focado sairia junto, deixando o foco no corpo da página. O foco vai então para o
   * seletor do público, e a contagem ligada a ele, que é uma região de status, diz o que saiu.
   */
  alternarEdicaoNaConferencia(id: string, seletorDoPublico: HTMLElement): void {
    this.saiuDaLista.set('');
    this.alternarEdicao(id);
    if (this.emEdicao(id) || this.resumosVisiveis().some((resumo) => resumo.id === id)) return;

    const nome = this.resumos().find((resumo) => resumo.id === id)?.nome ?? '';
    this.saiuDaLista.set(`${nome} saiu da lista, porque não é mais do público filtrado.`);
    seletorDoPublico.focus();
  }

  /**
   * Os públicos que a conferência oferece: todo candidato, cada modalidade do quadro e cada
   * condição que algum documento da fase declara.
   */
  readonly opcoesDoFiltro = computed<readonly OpcaoDoFiltro[]>(() => {
    const condicoes = [
      ...new Set(this.resumos().flatMap((resumo) => resumo.publico.alternativas.flat())),
    ];
    const opcoes: OpcaoDoFiltro[] = [
      { valor: '', rotulo: 'Todos os documentos da fase' },
      { valor: 'todo-candidato', rotulo: 'Exigidos de todo candidato' },
      ...this.modalidades().map((codigo) => opcaoDoFiltro(`modalidade:${codigo}`)),
      ...condicoes.map((condicao) => opcaoDoFiltro(`condicao:${condicao}`)),
    ];

    // O público escolhido continua na lista mesmo quando nenhum documento o declara mais — a
    // condição sendo reescrita, a modalidade que saiu do quadro. Voltar sozinho a "todos" a
    // cada tecla trocaria a lista inteira debaixo de quem edita; mantido, o seletor diz qual
    // filtro está valendo.
    const escolhido = this.filtroDoPublico();
    return opcoes.some((opcao) => opcao.valor === escolhido)
      ? opcoes
      : [...opcoes, opcaoDoFiltro(escolhido)];
  });

  /**
   * Os documentos que o filtro alcança, e sempre o que está com os campos abertos: tirá-lo da
   * tela porque a edição mudou a quem ele se aplica levaria junto o campo em foco.
   */
  readonly resumosVisiveis = computed(() => {
    const filtro = filtroDoValor(this.filtroDoPublico());
    return this.resumos().filter(
      (resumo) => alcancaOPublico(resumo.publico, filtro) || this.emEdicao(resumo.id),
    );
  });

  /** O rótulo da consequência, o mesmo no seletor do editor e no resumo. */
  rotuloDaConsequencia(valor: string, obrigatorio: boolean): string {
    return rotuloDaConsequencia(valor, obrigatorio);
  }

  /**
   * A exigência deste documento NESTA fase — a unidade que o contrato guarda. Duas fases que
   * pedem o mesmo documento são duas exigências, com entrega, consequência e normas próprias:
   * antes, o rascunho guardava um registro por documento e a segunda fase herdava, calada, o
   * que a primeira declarasse.
   */
  exigenciaDoDocumento(id: string): ExigenciaDeDocumento {
    const fase = this.faseDoRascunho();
    const codigo = fase?.codigo ?? '';
    const exigencias = this.store.draft().documentos;
    const achada = exigenciasDaFase(exigencias, codigo).find(
      (exigencia) => exigencia.tipoDocumentoId === id,
    );
    if (achada !== undefined) return achada;

    // Fase alcançada por "vale em todas as fases" mas ainda não materializada: mostra o que
    // será gravado — o modelo de raiz nesta fase —, não um formulário em branco que mentiria
    // sobre o que o operador já declarou.
    const modelo = exigencias.emTodasAsFases.includes(id)
      ? exigenciasDaRaiz(exigencias).find((exigencia) => exigencia.tipoDocumentoId === id)
      : undefined;
    if (modelo !== undefined) return { ...modelo, faseCodigo: codigo, etapaId: null, finalidade: null };

    return exigenciaNova(id, codigo, this.catalogos.tipoDocumentoPorId().get(id));
  }

  /**
   * As etapas em que esta fase se subdivide, na ordem em que acontecem — vazio quando
   * a fase não tem nenhuma, que é quando o documento só pode ser da fase inteira.
   */
  readonly etapasDaFaseAberta = computed<readonly EtapaPontuada[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    return [...this.store.draft().cronograma.etapas]
      .filter((etapa) => etapa.faseCodigo === fase.codigo)
      .sort((uma, outra) => uma.ordem - outra.ordem);
  });

  /** A etapa que coleta o documento nesta fase; vazio quando ele é da fase inteira. */
  etapaDoDocumento(id: string): string {
    return this.exigenciaDoDocumento(id).etapaId ?? '';
  }

  /**
   * Os formulários que se respondem na fase aberta — onde o documento pode ser apresentado. Vazio
   * na fase que não responde formulário nenhum, e aí não há o que escolher.
   */
  readonly finalidadesDaFaseAberta = computed<readonly string[]>(() => {
    const fase = this.faseDoRascunho();
    return fase === null ? [] : finalidadesDaFase(fase, this.catalogos.fasePorId());
  });

  /**
   * Os formulários que a escolha oferece, como o seletor os nomeia. Na fase que não responde
   * formulário nenhum, a escolha só aparece para desfazer um formulário declarado antes, e a saída
   * é deixar o documento fora de formulário.
   */
  readonly formulariosEscolhiveis = computed(() => {
    const atendidas = this.finalidadesDaFaseAberta();
    return atendidas.length === 0
      ? [{ valor: SEM_FORMULARIO, rotulo: 'Nenhum: a fase não responde formulário' }]
      : atendidas.map((finalidade) => ({ valor: finalidade, rotulo: `Formulário de ${nomeDaFinalidade(finalidade)}` }));
  });

  /** O formulário em que o documento é apresentado; `null` enquanto não está definido. */
  finalidadeDoDocumento(id: string): string | null {
    const formulario = finalidadeDaExigencia(this.exigenciaDoDocumento(id).finalidade, this.finalidadesDaFaseAberta());
    return formulario.situacao === 'DEFINIDO' ? formulario.finalidade : null;
  }

  /**
   * O que falta para o documento ter formulário: a escolha na fase que divide inscrição e isenção,
   * ou outra escolha quando a fase deixou de responder o formulário declarado.
   */
  faltaFormulario(id: string): string | null {
    return faltaOFormulario(this.exigenciaDoDocumento(id).finalidade, this.finalidadesDaFaseAberta());
  }

  /**
   * Se a escolha do formulário aparece: na fase que responde algum, e em qualquer fase enquanto o
   * formulário declarado não é respondido nela — escondê-la deixaria a falta sem o campo que a resolve.
   */
  mostraFormulario(id: string): boolean {
    return this.finalidadesDaFaseAberta().length > 0 || this.faltaFormulario(id) !== null;
  }

  /**
   * Declara o formulário do documento nesta fase. Vale para a árvore de raiz inteira: as
   * alternativas de um grupo se satisfazem num formulário só.
   */
  escolherFinalidade(id: string, finalidade: string): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    // A declaração passa a ser própria desta fase, como qualquer outra edição dela.
    if (this.valeEmTodasAsFases(id)) this.recortarPorFase(id);

    this.store.patchSection(
      'documentos',
      comFinalidade(
        this.store.draft().documentos,
        id,
        fase.codigo,
        finalidade === '' || finalidade === SEM_FORMULARIO ? null : finalidade,
      ),
    );
  }

  /**
   * O que a tela oferece como consequência NESTA fase.
   *
   * "Abre pendência para reenvio" só é aceita em fase que admite complementação — quem decide
   * é o cadastro da fase canônica, não este passo. Oferecê-la onde a fase não admite produzia
   * uma recusa na gravação que o operador não sabia ligar ao que fez, e sem remédio à mão: o
   * sinalizador não é editável aqui.
   */
  consequenciasDaFase(): readonly { readonly valor: string; readonly rotulo: string }[] {
    if (this.faseAdmiteComplementacao()) return CONSEQUENCIAS_ESCOLHIVEIS;
    return CONSEQUENCIAS_ESCOLHIVEIS.filter((opcao) => opcao.valor !== CONSEQUENCIA_REENVIO);
  }

  /** Se a fase aberta admite reenvio de documento depois da análise. */
  faseAdmiteComplementacao(): boolean {
    const fase = this.faseDoRascunho();
    if (fase === null) return false;
    return descreverFase(fase, this.catalogos.fasePorId()).permiteComplementacao;
  }

  protected readonly consequencias = CONSEQUENCIAS_ESCOLHIVEIS;
  protected readonly abrangencias = ABRANGENCIAS_ESCOLHIVEIS;
  protected readonly statusBaseLegal = STATUS_BASE_LEGAL_ESCOLHIVEIS;

  ehObrigatorio(id: string): boolean {
    return this.exigenciaDoDocumento(id).obrigatorio;
  }

  /**
   * Exigência obrigatória decide sozinha o resultado da análise — e é por isso que a publicação
   * cobra a norma dela. A facultativa segue sem norma declarada.
   */
  escolherObrigatoriedade(id: string, valor: string): void {
    this.escreverExigencia(id, { obrigatorio: valor === 'sim' });
  }

  /** O modelo que a exigência oferece ao candidato nesta fase; `null` quando não oferece. */
  modeloDoDocumento(id: string): ModeloDaExigencia | null {
    return this.exigenciaDoDocumento(id).modelo;
  }

  /** Vincula o modelo confirmado à exigência desta fase, ou o desvincula com `null`. */
  definirModelo(id: string, modelo: ModeloDaExigencia | null): void {
    this.escreverExigencia(id, { modelo });
  }

  consequenciaDoDocumento(id: string): string {
    return this.exigenciaDoDocumento(id).consequenciaIndeferimento;
  }

  /**
   * A consequência é o que faz a exigência decidir sozinha o resultado. Quem declara uma
   * consequência está dizendo que ela decide, e a publicação vai cobrar a norma.
   */
  escolherConsequencia(id: string, consequencia: string): void {
    this.escreverExigencia(id, { consequenciaIndeferimento: consequencia });
  }

  /** As normas que sustentam a exigência nesta fase — são N por exigência (ADR-0074). */
  basesLegaisDoDocumento(id: string): readonly BaseLegalConfig[] {
    return this.exigenciaDoDocumento(id).basesLegais;
  }

  /** Se a publicação recusaria esta exigência por falta de norma: a mesma regra que ela aplica. */
  faltaNormaResolvida(id: string): boolean {
    const exigencia = this.exigenciaDoDocumento(id);
    return exigenciaDecideResultado(exigencia) && !temNormaResolvida(exigencia.basesLegais);
  }

  /**
   * Escreve um campo de UMA das normas, endereçada pela posição.
   *
   * Antes havia três campos escalares por documento e uma união fechada de três literais: a
   * segunda norma não tinha onde existir, e a observação não tinha campo nenhum — ela era
   * escrita como `null` fixo e nunca lida de volta.
   */
  escreverBaseLegal(
    id: string,
    posicao: number,
    campo: keyof BaseLegalConfig,
    valor: string,
  ): void {
    const bases = this.basesLegaisDoDocumento(id).map((base, i) =>
      i === posicao ? { ...base, [campo]: valor } : base,
    );
    this.escreverExigencia(id, { basesLegais: bases });
  }

  /** Acrescenta uma norma à exigência — uma lei federal somada à cláusula do edital. */
  acrescentarBaseLegal(id: string): void {
    this.escreverExigencia(id, {
      basesLegais: [...this.basesLegaisDoDocumento(id), baseLegalNova()],
    });
  }

  /**
   * Remove uma norma. A última não sai: a exigência que decide o resultado precisa de norma
   * resolvida para publicar, e deixar a lista vazia tiraria da tela o campo que a publicação
   * cobra — a linha em branco não viaja no comando de qualquer forma.
   */
  removerBaseLegal(id: string, posicao: number): void {
    const bases = this.basesLegaisDoDocumento(id);
    if (bases.length <= 1) return;
    this.escreverExigencia(id, { basesLegais: bases.filter((_, i) => i !== posicao) });
  }

  /**
   * Formatos que o cadastro do tipo de documento declara e o contrato da exigência não
   * expressa. Dizer isso é o que evita o edital prometer ao candidato um arquivo que a
   * exigência recusaria na entrega.
   */
  formatosForaDoContrato(id: string): readonly string[] {
    const tipo = this.catalogos.tipoDocumentoPorId().get(id);
    return formatosDeclarados(tipo?.formatosAceitos).naoExpressos;
  }

  /**
   * Declara em que etapa desta fase o documento é coletado. Vazio devolve o documento à fase
   * inteira — a etapa sai do registro em vez de ficar guardada como texto vazio, que o
   * contrato leria como declaração.
   */
  escolherEtapaDoDocumento(id: string, etapaId: string): void {
    this.escreverExigencia(id, { etapaId: etapaId === '' ? null : etapaId });
  }

  /**
   * O documento acompanha todas as fases do edital.
   *
   * É intenção de UI, não dado da exigência: o contrato só conhece a exigência materializada
   * em cada fase. Guardar a intenção é o que faz uma fase acrescentada depois receber o
   * documento, em vez de ficar de fora em silêncio.
   */
  valeEmTodasAsFases(id: string): boolean {
    return this.store.draft().documentos.emTodasAsFases.includes(id);
  }

  /** O documento é exigido nesta fase. */
  exigidoNestaFase(id: string): boolean {
    const fase = this.faseDoRascunho();
    if (fase === null) return false;
    const exigencias = this.store.draft().documentos;
    if (exigencias.emTodasAsFases.includes(id)) return true;
    return exigenciasDaFase(exigencias, fase.codigo).some(
      (exigencia) => exigencia.tipoDocumentoId === id,
    );
  }

  /**
   * Marca ou desmarca a exigência do documento nesta fase.
   *
   * Desmarcar tira a exigência DESTA fase; a mesma exigência em outra fase continua, porque
   * são exigências distintas, com entrega e norma próprias.
   */
  alternarExigencia(id: string, marcada: boolean): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    const exigencias = this.store.draft().documentos;
    if (!marcada) {
      // Documento que valia em todas as fases é materializado ANTES de sair desta: largar o
      // alcance sem materializar tiraria o documento também de toda fase que ainda só o tinha
      // por herança — o operador desmarca numa fase e perde em outras, sem nada dizer.
      const materializadas = exigencias.emTodasAsFases.includes(id)
        ? comAlcanceDeTodasAsFases(
            exigencias,
            this.fasesDoCronograma().map((outra) => outra.codigo),
          )
        : exigencias;

      this.store.patchSection('documentos', {
        ...semAExigencia(materializadas, id, fase.codigo),
        emTodasAsFases: materializadas.emTodasAsFases.filter((item) => item !== id),
      });
      return;
    }

    this.store.patchSection(
      'documentos',
      comExigencia(
        exigencias,
        exigenciaNova(id, fase.codigo, this.catalogos.tipoDocumentoPorId().get(id)),
      ),
    );
  }

  /**
   * Troca "vale para todas as fases" pelo recorte explícito, partindo das fases que o edital
   * tem hoje. Congelar o conjunto atual preserva o que estava valendo; começar do zero
   * apagaria a exigência de todas as outras fases por causa de uma decisão tomada numa só.
   */
  recortarPorFase(id: string): void {
    const exigencias = this.store.draft().documentos;
    this.store.patchSection('documentos', {
      ...this.materializarEmTodasAsFases(exigencias, id),
      emTodasAsFases: exigencias.emTodasAsFases.filter((item) => item !== id),
    });
  }

  /** Devolve o documento ao regime de acompanhar todas as fases do edital. */
  valerEmTodasAsFases(id: string): void {
    const exigencias = this.normalizarDeclaracoesDoDocumento(this.store.draft().documentos, id);
    const materializadas = this.materializarEmTodasAsFases(exigencias, id);
    this.store.patchSection('documentos', {
      ...materializadas,
      emTodasAsFases: exigencias.emTodasAsFases.includes(id)
        ? exigencias.emTodasAsFases
        : [...exigencias.emTodasAsFases, id],
    });
  }

  /**
   * Alinha todas as declarações de raiz do documento à da fase aberta.
   *
   * "Vale em todas as fases" quer dizer a MESMA declaração em toda fase. Ligar o regime sobre
   * declarações que já divergiam deixava a tela anunciando uma coisa e a gravação enviando
   * outra: condições e consequência diferentes por fase, a fase criada depois recebendo a
   * primeira que aparecesse, e a releitura ao reabrir o processo perdendo a marca porque as
   * declarações não batem. Alinhar pela fase aberta é o que o operador vê ao ligar o regime.
   *
   * Fase, etapa e formulário ficam como estão: são próprios de cada declaração — cada fase responde
   * os seus formulários —, e é por isso que a comparação que relê a intenção também os ignora.
   */
  private normalizarDeclaracoesDoDocumento(
    exigencias: ExigenciasDoRascunho,
    id: string,
  ): ExigenciasDoRascunho {
    const modelo = this.exigenciaDoDocumento(id);
    // A repetição faz parte da declaração, como o gatilho que pode citar os campos do grupo.
    const repeticao = this.repeticaoDeclarada(id);

    return {
      ...exigencias,
      raizes: exigencias.raizes.map((no) =>
        no.tipo === 'FOLHA' && no.documento !== null && no.documento.tipoDocumentoId === id
          ? {
              ...no,
              repetePorEntidade: repeticao?.herdada === true ? no.repetePorEntidade : (repeticao?.grupo ?? null),
              documento: {
                ...modelo,
                faseCodigo: no.documento.faseCodigo,
                etapaId: no.documento.etapaId,
                finalidade: no.documento.finalidade,
              },
            }
          : no,
      ),
    };
  }

  /**
   * Garante uma exigência do documento em cada fase do cronograma, copiando o que já foi
   * declarado numa delas.
   *
   * Copiar, e não criar em branco, é o que preserva entrega, consequência e normas já
   * escritas: quem marcou "todas as fases" depois de configurar a exigência numa delas está
   * dizendo que é a mesma exigência, não uma nova.
   */
  private materializarEmTodasAsFases(
    exigencias: ReturnType<ProcessoSeletivoStore['draft']>['documentos'],
    id: string,
  ) {
    const fases = this.fasesDoCronograma().map((fase) => fase.codigo);
    // Garante um modelo de raiz antes de espalhar: sem nenhuma exigência declarada na raiz,
    // não há o que copiar, e `comAlcanceDeTodasAsFases` não inventa uma.
    //
    // O modelo nasce na fase ABERTA, não na primeira do cronograma: é nela que o operador
    // está, e é o que ele vê ali que ele espera ver replicado. Semear noutra fase punha uma
    // exigência em branco num lugar que ele não estava olhando.
    const temModelo = exigenciasDaRaiz(exigencias).some(
      (exigencia) => exigencia.tipoDocumentoId === id,
    );
    const aberta = this.faseDoRascunho()?.codigo ?? fases[0] ?? '';
    // O modelo é semeado na RAIZ, não por `comExigencia`: quando o documento só existe como
    // alternativa dentro de um grupo OU, aquela substituiria a folha do grupo e a raiz
    // continuaria sem modelo — a marca ficaria posta sem nada para espalhar, e a gravação
    // sairia com a alternativa de sempre, sem as exigências prometidas.
    const base = temModelo
      ? exigencias
      : comExigenciaNaRaiz(
          exigencias,
          exigenciaNova(id, aberta, this.catalogos.tipoDocumentoPorId().get(id)),
        );

    return comAlcanceDeTodasAsFases({ ...base, emTodasAsFases: [id] }, fases);
  }

  /**
   * Modalidades que valem para o documento. Sem recorte, ele acompanha o que o quadro de
   * vagas oferta — derivado, não copiado: uma lista própria ficaria vazia no documento
   * recém-incluído e dependeria de alguém sincronizá-la.
   */
  modalidadesEfetivas(id: string): readonly string[] {
    const aceitas = this.modalidades();
    const recorte = modalidadesDaExigencia(this.exigenciaDoDocumento(id));
    if (recorte === null) return aceitas;

    const conjunto = new Set(aceitas);
    return recorte.filter((codigo) => conjunto.has(codigo));
  }

  /** As modalidades que o quadro de vagas oferta, como a lista de escolha as apresenta. */
  readonly modalidadesEscolhiveis = computed<readonly UiComboboxGroup[]>(() => {
    const codigos = this.modalidades();
    if (codigos.length === 0) return [];
    return [
      {
        label: 'Modalidades do quadro de vagas',
        options: codigos.map((codigo) => ({ value: codigo, label: codigo })),
      },
    ];
  });

  /**
   * Substitui de uma vez o recorte de quem entrega o documento.
   *
   * Marcar todas as ofertadas volta ao padrão — o documento acompanha o quadro de vagas —
   * em vez de gravar uma lista que por acaso coincide com ele: a diferença aparece quando o
   * quadro muda depois, e o que acompanha o quadro acompanha a mudança.
   */
  definirModalidades(id: string, escolhidas: readonly string[]): void {
    this.escreverGatilho(
      id,
      comRecorteEscolhido(this.exigenciaDoDocumento(id), escolhidas, this.modalidades()),
    );
  }

  /**
   * O que o operador perde ao dizer que o documento é de todo candidato: o recorte por
   * modalidade e as condições declaradas saem junto, porque uma exigência geral que carrega
   * gatilho é recusada pelo servidor.
   */
  avisoDeDescarteDoGatilho(id: string): string {
    if (this.ehExigidoDeTodos(id)) return '';

    const exigencia = this.exigenciaDoDocumento(id);
    const recorte = modalidadesDaExigencia(exigencia) !== null;
    const condicoes = clausulasDoGatilho(exigencia).length > 0;
    if (!recorte && !condicoes) return '';

    if (recorte && condicoes) {
      return 'Passar para "todo candidato" descarta o recorte por modalidade e as condições declaradas abaixo.';
    }
    return recorte
      ? 'Passar para "todo candidato" descarta o recorte por modalidade.'
      : 'Passar para "todo candidato" descarta as condições declaradas abaixo.';
  }

  /**
   * O que a exigência alcança quando nenhuma condição foi declarada no editor: ou o recorte
   * por modalidade a sustenta, ou ela não é cobrada de ninguém. As duas situações têm a mesma
   * tela vazia, e dizer "de ninguém" nas duas fazia o operador desfazer o recorte que acabara
   * de declarar.
   */
  gatilhoSemCondicaoDiz(id: string): string {
    const recorte = modalidadesDaExigencia(this.exigenciaDoDocumento(id));
    if (recorte === null) {
      return 'Sem condição declarada, este documento não é cobrado de ninguém.';
    }
    return 'Este documento é cobrado de quem concorre nas modalidades escolhidas acima. Acrescente condição para restringir mais.';
  }


  /**
   * Em que fases o documento é exigido. É outro eixo do "Coletado em": este diz em QUAIS
   * fases, aquele em que ponto DESTA fase — e a resposta do segundo continua sendo por fase
   * mesmo quando o primeiro diz "todas".
   */
  escolherAlcanceDoDocumento(id: string, alcance: string): void {
    if (alcance === 'todas') {
      this.valerEmTodasAsFases(id);
      return;
    }
    this.recortarPorFase(id);
  }

  // ─── Gatilho por fato do candidato ──────────────────────────────────────
  //
  // Há documento que só se cobra de quem tem certo fato: o título de eleitor não se pede a
  // estrangeiro, a mulher nem a menor de dezoito; a quitação com o serviço militar só se pede
  // a homem maior de dezoito, e nem dele quando é indígena. É isto que estes controles
  // escrevem — e a modalidade fica de fora deles, porque tem o seu próprio ali ao lado.

  /**
   * Os valores dos fatos cujo domínio vem do próprio processo — as condições de atendimento e as
   * modalidades que ele oferta —, porque é o que ele oferta que vale, não um catálogo global.
   */
  private readonly dominiosDoGatilho = computed(() =>
    dominiosDoGatilho(
      this.catalogos.fatos(),
      this.store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
      this.store.modalidadesDoProcesso(),
    ),
  );

  /**
   * Todos os fatos do catálogo que um gatilho sabe avaliar, sem o recorte de fase. É o
   * vocabulário com que a tela lê o público de uma exigência já declarada.
   *
   * A lista não se escreve aqui: acrescentar um fato é mudança de software — só serve o fato
   * que exista código sabendo resolver — e o catálogo é semeado por migration.
   */
  readonly fatosDoGatilho = computed<readonly FatoEscolhivel[]>(() =>
    fatosParaGatilho(this.catalogos.fatos(), this.dominiosDoGatilho()),
  );

  private readonly fatoPorCodigo = computed(
    () => new Map(this.fatosDoGatilho().map((fato) => [fato.codigo, fato])),
  );

  /** O que o rascunho diz sobre o formulário e a fase em que cada fato é conhecido. */
  private readonly producaoDosFatos = computed(() =>
    producaoDoRascunho(
      this.store.draft().formulario,
      fasesNoCronograma(this.fasesDoCronograma(), this.catalogos.fasePorId()),
      this.catalogos.fatos(),
    ),
  );

  /** Como a orientação nomeia o fato e a fase. */
  private readonly nomesDaOrientacao = computed<NomesDaOrientacao>(() => {
    const nomeDoFato = new Map(this.catalogos.fatos().map((fato) => [fato.codigo, fato.nome]));
    return {
      fato: (codigo: string) => nomeDoFato.get(codigo) ?? codigo,
      fase: this.catalogos.nomeDaFase(),
    };
  });

  /**
   * O que o editor de cada documento da fase oferece e recusa: os fatos que o gatilho pode citar
   * nesta fase — de qualquer formulário do processo, derivados e da classificação, já conhecidos
   * aqui — e, por condição, a recusa de fase com o que fazer para resolvê-la.
   */
  private readonly gatilhoPorDocumento = computed(() => {
    const producao = this.producaoDosFatos();
    const nomes = this.nomesDaOrientacao();

    return new Map(
      this.documentosDaFase().map((doc) => {
        const exigencia = this.exigenciaDoDocumento(doc.id);
        // Os campos do grupo pelo qual o documento se repete: o gatilho os cita além dos do candidato.
        const doGrupo = camposDaRepeticao(this.repeticaoDeclarada(doc.id)?.grupo ?? null, producao);
        const erros: Record<number, string> = {};
        for (const recusa of recusasDeFaseDoGatilho(exigencia, producao, nomes, doGrupo)) {
          erros[recusa.indice] = recusa.orientacao;
        }
        return [
          doc.id,
          {
            fatos: fatosDoGatilhoNaFase(
              this.catalogos.fatos(),
              exigencia,
              producao,
              this.dominiosDoGatilho(),
              exigencia.condicoes.map((condicao) => condicao.fato),
              doGrupo,
            ),
            erros,
          },
        ] as const;
      }),
    );
  });

  /**
   * A repetição de cada documento da fase pelas ocorrências de um grupo dos formulários
   * (ADR-0138, UNI-REQ-0069): a declarada ou a herdada do grupo de alternativas, os grupos que ela
   * pode escolher onde o documento é cobrado, os que não pode e por quê, e o que fazer quando a
   * escolhida deixou de valer — grupo removido, respondido depois da fase ou só na isenção.
   */
  private readonly repeticaoPorDocumento = computed(() => {
    const producao = this.producaoDosFatos();
    const nomes = this.nomesDaOrientacao();
    const grupos = [...producao.grupos.values()];

    return new Map(
      this.documentosDaFase().map((doc): [string, RepeticaoDoDocumento] => {
        const exigencia = this.exigenciaDoDocumento(doc.id);
        const atual = this.repeticaoDeclarada(doc.id);
        const avaliados = grupos.map((grupo) => ({ grupo, recusa: recusaDaRepeticao(grupo.codigo, exigencia, producao) }));
        const recusaAtual = atual === null ? null : recusaDaRepeticao(atual.grupo, exigencia, producao);
        return [
          doc.id,
          {
            atual,
            rotulo: atual === null ? '' : (producao.grupos.get(atual.grupo)?.rotulo ?? atual.grupo),
            semGrupo: grupos.length === 0,
            oferecidos: avaliados.filter(({ recusa }) => recusa === null).map(({ grupo }) => grupo),
            naoOferecidos: avaliados.flatMap(({ recusa }) =>
              recusa?.tipo === 'GRUPO_FORA_DO_LUGAR' ? [motivoDoGrupoForaDoLugar(recusa, nomes)] : [],
            ),
            erro:
              recusaAtual === null || atual === null
                ? null
                : orientacaoDaRecusaDaRepeticao(recusaAtual, producao, nomes, atual.herdada),
          },
        ];
      }),
    );
  });

  private repeticaoResumidaDoDocumento(id: string): string {
    const repeticao = this.repeticaoDoDocumento(id);
    return repeticaoResumida(repeticao.atual === null ? null : repeticao.rotulo);
  }

  /** A repetição do documento na fase aberta, com o que o campo "Repetir por" oferece. */
  repeticaoDoDocumento(id: string): RepeticaoDoDocumento {
    return this.repeticaoPorDocumento().get(id) ?? SEM_REPETICAO;
  }

  /**
   * A repetição declarada para o documento nesta fase. Na fase alcançada por "vale em todas as
   * fases" e ainda não materializada, é a do modelo de raiz, que a gravação copia para ela.
   */
  private repeticaoDeclarada(id: string): RepeticaoDaExigencia | null {
    const declarada = (this.declaracoesPorDocumento().get(id) ?? [])[0];
    if (declarada !== undefined) return declarada.repeticao;

    const exigencias = this.store.draft().documentos;
    if (!exigencias.emTodasAsFases.includes(id)) return null;
    const modelo = exigencias.raizes.find((no) => no.tipo === 'FOLHA' && no.documento?.tipoDocumentoId === id);
    return modelo === undefined || modelo.repetePorEntidade === null
      ? null
      : { grupo: modelo.repetePorEntidade, herdada: false };
  }

  /**
   * Declara pelas ocorrências de que grupo o documento se repete, ou nenhum. O documento que vale em
   * todas as fases continua valendo: a repetição é a mesma declaração em cada uma, como o gatilho.
   * As condições que citam campo do grupo anterior ficam, marcadas, até o operador decidir.
   */
  escolherRepeticao(id: string, valor: string): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    const grupo = valor === '' ? null : valor;
    const exigencias = this.store.draft().documentos;
    this.store.patchSection(
      'documentos',
      this.valeEmTodasAsFases(id)
        ? comRepeticaoEmTodasAsFases(exigencias, id, grupo)
        : comRepeticao(exigencias, id, fase.codigo, grupo),
    );
  }

  /** Os fatos que o gatilho do documento pode citar na fase aberta. */
  fatosDoGatilhoDoDocumento(id: string): readonly FatoEscolhivel[] {
    return this.gatilhoPorDocumento().get(id)?.fatos ?? [];
  }

  /**
   * O que o editor diz quando não tem fato a oferecer: com o catálogo carregado, a falta é da
   * fase — nada do candidato é conhecido até ela —, e mandar recarregar a página não resolveria.
   */
  readonly textoSemFatosDoGatilho = computed(() =>
    this.catalogos.fatos().length === 0
      ? 'O catálogo de fatos do candidato não foi carregado. Recarregue a página para declarar condições.'
      : 'Nenhum dado do candidato é conhecido até esta fase para condicionar o documento.',
  );

  /** A recusa de fase de cada condição do gatilho do documento, com a orientação, pela posição. */
  errosDeFaseDoGatilho(id: string): Readonly<Record<number, string>> {
    return this.gatilhoPorDocumento().get(id)?.erros ?? SEM_ERROS;
  }

  /** Se a exigência é cobrada de todo candidato — é DECLARADO, não deduzido do gatilho. */
  ehExigidoDeTodos(id: string): boolean {
    return exigidoDeTodos(this.exigenciaDoDocumento(id));
  }

  /**
   * Declara de quem o documento é cobrado. Passar a "de todos" descarta o gatilho: o servidor
   * recusa a exigência geral que carrega condição, e guardá-la escondida a faria ressurgir na
   * próxima troca sem que ninguém a tivesse reescrito.
   */
  escolherExigidoDe(id: string, valor: string): void {
    this.escreverGatilho(id, comExigidoDeTodos(this.exigenciaDoDocumento(id), valor === 'todos'));
  }

  /** O fato que tem controle próprio ao lado do gatilho: o editor não o mostra. */
  protected readonly fatoDoRecorte = FATO_MODALIDADE;

  /**
   * As condições que o editor devolve: a lista inteira, já renumerada. Trocar o gatilho
   * passa pelo mesmo caminho de qualquer outra edição da declaração desta fase.
   */
  escreverCondicoes(id: string, condicoes: readonly CondicaoGatilhoConfig[]): void {
    this.escreverGatilho(id, { ...this.exigenciaDoDocumento(id), condicoes });
  }

  private escreverGatilho(id: string, exigencia: ExigenciaDeDocumento): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    // Mexer no gatilho é editar a declaração desta fase, como qualquer outro campo: modalidade,
    // aplicabilidade e condições passam por aqui, e não pelo caminho que já recortava. Mantendo
    // a marca, a tela seguia dizendo "todas as fases" sobre declarações que já divergiam.
    if (this.valeEmTodasAsFases(id)) this.recortarPorFase(id);

    this.store.patchSection('documentos', comExigencia(this.store.draft().documentos, exigencia));
  }

  private escreverExigencia(id: string, patch: Partial<ExigenciaDeDocumento>): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    // Editar numa fase só é dizer que a declaração dela é própria — e "vale em todas" quer
    // dizer a MESMA declaração em toda fase. Mantendo a marca, as fases passavam a divergir
    // com o regime global ainda ligado: a releitura ao reabrir o processo não reconhecia mais
    // a intenção, e a fase criada depois ficava sem o documento, em silêncio. O recorte
    // congela o que valia em cada fase antes de aplicar a edição nesta, e a tela passa a
    // mostrar o documento no regime por fase, que é o que ele de fato virou.
    if (this.valeEmTodasAsFases(id)) this.recortarPorFase(id);

    this.store.patchSection(
      'documentos',
      comExigencia(this.store.draft().documentos, {
        ...this.exigenciaDoDocumento(id),
        ...patch,
      }),
    );
  }

  // ─── Conferência e gravação ─────────────────────────────────────────────

  /**
   * A conferência do passo cobre **todas** as fases, não só a aberta: a
   * navegação do wizard é livre, e conferir apenas o que está à vista deixaria
   * publicar um certame com outra fase mal declarada.
   */
  validate(): StepValidation {
    const fases = this.fasesDoCronograma();
    const nomes = new Map(this.fasesNoSeletor().map((fase) => [fase.faseCanonicaId, fase.nome]));

    const mensagens = fases.flatMap((fase) =>
      problemasDaFase(fase, fases, this.atoPorCodigo(), (id) => this.nomeDaBanca(id)).map(
        (problema) => `${nomes.get(fase.faseCanonicaId) ?? fase.codigo}: ${problema.mensagem}`,
      ),
    );

    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: mensagens };
  }

  /**
   * As conferências das exigências NÃO moram aqui.
   *
   * Esta superfície é embutida no passo do Cronograma com `faseFixada`, e a página do wizard
   * coleta os passos por `viewChildren` — só o Cronograma é um passo declarado, então este
   * `validate()` nunca é chamado. Conferência escrita aqui é conferência que não roda: as três
   * que existiam (fase fora do cronograma, exigência sem modalidade, reenvio sem
   * complementação) estão em `problemasDeAncoragem`, alimentadas por `exigenciasDeclaradas`
   * do Cronograma.
   */

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava a configuração das fases pelo comando do cronograma: é uma coleção
   * só, e o `PUT` a substitui inteira. Envia na ordem do rascunho — a mesma que
   * localiza cada recusa devolvida.
   *
   * Vai pelo mesmo colaborador que a linha do tempo usa, e não direto ao
   * serviço: uma reordenação feita lá fica no rascunho até alguém gravar, e
   * quem grava pode ser esta tela. Sem o contorno da permutação, ela devolveria
   * a recusa de uma troca de posições que nem dá para desfazer daqui.
   */
  async persistir(): Promise<StepValidation> {
    // Embutido na linha do tempo, a gravação é do passo que contém: as duas leem as
    // mesmas fases do rascunho, e gravar de novo por fase mandaria o cronograma inteiro
    // uma vez para cada uma.
    if (this.faseFixada() !== null) return { valid: true };

    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar as fases.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const fases = this.store.draft().cronograma.fases;
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const gravacao = await gravarCronogramaFases(this.cadastro, processoId, fases);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacao.ok) return this.registrarRecusa(gravacao.problem, fases);

      this.limparRecusa();
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * Distribui a recusa pelos campos e devolve o que o resumo do topo anuncia.
   *
   * O resumo repete o que aparece sob cada campo, e é deliberado: ele é a região
   * que o leitor de tela anuncia depois da gravação, e sem ele a recusa de um
   * campo fora da parte visível passaria despercebida.
   */
  private registrarRecusa(
    problema: ProblemDetails,
    fases: readonly FaseDoCronograma[],
  ): StepValidation {
    const abertaEm = fases.findIndex((fase) => fase.faseCanonicaId === this.faseAberta());
    const nomes = new Map(this.fasesNoSeletor().map((fase) => [fase.faseCanonicaId, fase.nome]));
    const nomeDaFase = (indice: number): string => {
      const fase = fases[indice];
      if (fase === undefined) return `posição ${indice + 1}`;
      return nomes.get(fase.faseCanonicaId) ?? fase.codigo;
    };

    // A permutação de ordem não descreve campo nenhum desta tela: ela é da
    // linha do tempo, e o que orienta é como desfazê-la lá. Traduzi-la por
    // campo apontaria um controle que não tem nada a ver com o que foi
    // recusado.
    if (problema.code === PERMUTACAO_DE_ORDEM) {
      this.recusaPorCampo.set(new Map());
      this.recusasGerais.set([ORIENTACAO_DE_PERMUTACAO]);
      return { valid: false, messages: [ORIENTACAO_DE_PERMUTACAO] };
    }

    const traduzida = traduzirRecusa(problema, abertaEm, nomeDaFase);
    this.recusaPorCampo.set(traduzida.porCampo);
    this.recusasGerais.set(traduzida.gerais);

    const mensagens = [...traduzida.porCampo.values(), ...traduzida.gerais];
    return { valid: false, messages: mensagens.length === 0 ? [problema.title] : mensagens };
  }

  private limparRecusa(): void {
    this.recusaPorCampo.set(new Map());
    this.recusasGerais.set([]);
  }

  /**
   * Traz a fase do rascunho para o formulário, sem desfazer a digitação em
   * curso: o rascunho é reescrito a cada tecla pelo caminho de volta, e recriar
   * os controles a cada uma tiraria o foco do campo que está sendo preenchido.
   */
  private espelhar(fase: FaseDoCronograma | null): void {
    if (fase === null) {
      this.assinatura?.unsubscribe();
      this.assinatura = null;
      this.formulario.set(null);
      return;
    }

    const atual = this.formulario();
    if (atual !== null && mesmoConteudo(faseDaConfiguracao(atual), fase)) return;

    this.espelhando = true;
    try {
      const grupo = grupoDaConfiguracaoDaFase(fase);
      if (!this.store.aceitaEdicao()) grupo.disable({ emitEvent: false });

      this.assinatura?.unsubscribe();
      this.assinatura = grupo.valueChanges.subscribe(() => {
        this.versaoDoFormulario.update((versao) => versao + 1);
        if (this.espelhando) return;
        this.escreverNoRascunho(faseDaConfiguracao(grupo));
      });

      this.formulario.set(grupo);
      this.versaoDoFormulario.update((versao) => versao + 1);
    } finally {
      this.espelhando = false;
    }
  }

  /** Substitui no rascunho só a fase aberta; as demais seguem como estão. */
  private escreverNoRascunho(fase: FaseDoCronograma): void {
    this.store.patchObjectSection('cronograma', {
      fases: this.store
        .draft()
        .cronograma.fases.map((atual) =>
          atual.faseCanonicaId === fase.faseCanonicaId ? fase : atual,
        ),
    });
  }
}

/**
 * Compara conteúdo, não a ordem em que os campos foram escritos: a projeção da
 * leitura e a do formulário montam os mesmos objetos em ordens diferentes, e
 * `JSON.stringify` preserva a ordem de inserção — comparar assim daria
 * "diferente" para dado igual, e o formulário seria recriado a cada tecla.
 */
function mesmoConteudo(umLado: unknown, outroLado: unknown): boolean {
  return canonico(umLado) === canonico(outroLado);
}

function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, conteudo: unknown) =>
    conteudo !== null && typeof conteudo === 'object' && !Array.isArray(conteudo)
      ? Object.fromEntries(
          Object.entries(conteudo as Record<string, unknown>).sort(([um], [outro]) =>
            um.localeCompare(outro),
          ),
        )
      : conteudo,
  );
}

/** A repetição do documento na fase e o que o campo "Repetir por" oferece. */
interface RepeticaoDoDocumento {
  readonly atual: RepeticaoDaExigencia | null;
  /** O rótulo do grupo da repetição atual; o código, quando o grupo saiu dos formulários. */
  readonly rotulo: string;
  /** Se nenhum formulário do processo tem grupo repetível. */
  readonly semGrupo: boolean;
  readonly oferecidos: readonly GrupoDaProducao[];
  /** Os grupos que o documento não pode escolher aqui, com o motivo. */
  readonly naoOferecidos: readonly string[];
  /** O que fazer quando a repetição atual deixou de valer. */
  readonly erro: string | null;
}

const SEM_REPETICAO: RepeticaoDoDocumento = {
  atual: null,
  rotulo: '',
  semGrupo: true,
  oferecidos: [],
  naoOferecidos: [],
  erro: null,
};

/** O que a conferência mostra de um documento exigido. */
interface ResumoDoDocumento {
  readonly id: string;
  readonly nome: string;
  readonly documento: DocumentoDefinicao;
  readonly publico: PublicoDaExigencia;
  readonly aplicaA: string;
  readonly entrega: string;
  /** Como o documento compõe um grupo; vazio quando é exigido por si. */
  readonly composicao: string;
  /** Pelas ocorrências de que grupo do formulário o documento se repete; vazio quando é um por candidato. */
  readonly repeticao: string;
  readonly consequencia: string;
  readonly coleta: string;
  readonly bases: readonly BaseLegalConfig[];
  readonly normas: readonly NormaDescrita[];
  readonly faltaNorma: boolean;
  readonly repetido: string;
  /** O formulário em que o documento é apresentado; `null` enquanto a fase dividida pede a escolha. */
  readonly finalidade: string | null;
}

/** Um público que a conferência oferece, com o valor que o seletor guarda. */
interface OpcaoDoFiltro {
  readonly valor: string;
  readonly rotulo: string;
}

/** A opção do seletor de público, rotulada pelo público que o valor codifica. */
function opcaoDoFiltro(valor: string): OpcaoDoFiltro {
  const filtro = filtroDoValor(valor);
  switch (filtro.tipo) {
    case 'modalidade':
      return { valor, rotulo: `Candidato de ${filtro.codigo}` };
    case 'condicao':
      return { valor, rotulo: `Candidato com: ${filtro.condicao}` };
    case 'todo-candidato':
      return { valor, rotulo: 'Exigidos de todo candidato' };
    case 'tudo':
      return { valor, rotulo: 'Todos os documentos da fase' };
  }
}

/** O valor do seletor de público de volta ao filtro que ele codifica. */
function filtroDoValor(valor: string): FiltroDePublico {
  if (valor === 'todo-candidato') return { tipo: 'todo-candidato' };
  if (valor.startsWith('modalidade:')) {
    return { tipo: 'modalidade', codigo: valor.slice('modalidade:'.length) };
  }
  if (valor.startsWith('condicao:')) {
    return { tipo: 'condicao', condicao: valor.slice('condicao:'.length) };
  }
  return { tipo: 'tudo' };
}
