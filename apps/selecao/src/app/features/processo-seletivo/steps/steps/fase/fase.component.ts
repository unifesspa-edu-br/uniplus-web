import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import { DOCUMENTO_GRUPOS } from '../../processo-seletivo.data';
import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type BancaRequeridaDaFase,
  type DocumentoConfig,
  type FaseDoCronograma,
  type ProdutoDaFase,
  type StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { descreverFase, produtosPreliminares } from '../cronograma/cronograma-do-certame';
import { comoComandoDeFase } from '../cronograma/cronograma-para-comando';
import {
  PAPEIS_ESCOLHIVEIS,
  problemasDaFase,
  traduzirRecusa,
  type AtoDoCatalogo,
  type CampoDaFase,
  type ProblemaDaFase,
} from './configuracao-da-fase';
import { faseDaConfiguracao, grupoDaConfiguracaoDaFase, type FaseConfigForm } from './fase-form';

/**
 * Unidades de prazo que o domínio aceita, com o rótulo que o operador lê. Dia
 * corrido fica de fora de propósito: o domínio o recusa na interposição, e
 * oferecê-lo seria convidar a uma gravação que volta recusada.
 */
const UNIDADES = [
  { valor: 'diasUteis', rotulo: 'dias úteis' },
  { valor: 'horas', rotulo: 'horas' },
] as const;

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
  imports: [FormsModule, ReactiveFormsModule],
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
  readonly gruposDeDocumento = DOCUMENTO_GRUPOS;

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
      untracked(() => {
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

  configuracaoDoDocumento(id: string): DocumentoConfig {
    return this.store.draft().documentos[id];
  }

  /**
   * O documento acompanha todas as fases do edital.
   *
   * `todasEtapas` sozinho não basta: o rascunho nasce com ele ligado e
   * `included` desligado, que é o padrão de "acompanha o edital quando for
   * incluído", não uma exigência. Ler só o sinalizador travava a caixa de todo
   * documento de um processo novo, sob o texto de que ele já era exigido em
   * toda parte — o oposto do estado real, e sem caminho para marcar nenhum.
   */
  valeEmTodasAsFases(id: string): boolean {
    const config = this.configuracaoDoDocumento(id);
    return config.included && config.todasEtapas;
  }

  /**
   * O documento é exigido nesta fase. Enquanto ele acompanha todas as fases do
   * edital, a resposta é sim para qualquer uma — e é por isso que a caixa fica
   * marcada e travada, com o recorte oferecido à parte.
   */
  exigidoNestaFase(id: string): boolean {
    const config = this.configuracaoDoDocumento(id);
    if (!config.included) return false;
    if (config.todasEtapas) return true;

    const fase = this.faseDoRascunho();
    return fase !== null && config.etapas.includes(fase.codigo);
  }

  /**
   * Marca ou desmarca a exigência do documento nesta fase.
   *
   * Desmarcar a última fase tira o documento do processo: documento incluído sem
   * nenhuma fase é recusado pela conferência, e deixá-lo assim faria a tela
   * cobrar um recorte que o operador acabou de zerar aqui.
   */
  alternarExigencia(id: string, marcada: boolean): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    const config = this.configuracaoDoDocumento(id);
    const semEsta = config.etapas.filter((codigo) => codigo !== fase.codigo);
    const declaradas = marcada ? [...semEsta, fase.codigo] : semEsta;

    this.escreverDocumento(id, {
      included: declaradas.length > 0,
      todasEtapas: false,
      etapas: declaradas,
    });
  }

  /**
   * Troca "vale para todas as fases" pelo recorte explícito, partindo das fases
   * que o edital tem hoje. Congelar o conjunto atual preserva o que estava
   * valendo; começar do zero apagaria a exigência de todas as outras fases por
   * causa de uma decisão tomada numa só.
   */
  recortarPorFase(id: string): void {
    this.escreverDocumento(id, {
      included: true,
      todasEtapas: false,
      etapas: this.fasesDoCronograma().map((fase) => fase.codigo),
    });
  }

  /** Devolve o documento ao regime de acompanhar todas as fases do edital. */
  valerEmTodasAsFases(id: string): void {
    this.escreverDocumento(id, { included: true, todasEtapas: true });
  }

  /**
   * Modalidades que valem para o documento. Sem recorte, ele acompanha o que o
   * quadro de vagas oferta — derivado, não copiado: uma lista própria ficaria
   * vazia no documento recém-incluído e dependeria de alguém sincronizá-la.
   */
  modalidadesEfetivas(id: string): readonly string[] {
    const aceitas = this.modalidades();
    const config = this.configuracaoDoDocumento(id);
    if (!config.modalidadesRecortadas) return aceitas;

    const conjunto = new Set(aceitas);
    return config.modalidades.filter((codigo) => conjunto.has(codigo));
  }

  alternarModalidade(id: string, codigo: string, marcada: boolean): void {
    const config = this.configuracaoDoDocumento(id);
    // A primeira personalização parte do que está marcado na tela — a lista
    // guardada está vazia enquanto o documento acompanha o quadro, e desmarcar
    // uma modalidade apagaria todas as outras.
    const atual = config.modalidadesRecortadas ? config.modalidades : this.modalidadesEfetivas(id);

    this.escreverDocumento(id, {
      modalidades: marcada ? [...atual, codigo] : atual.filter((item) => item !== codigo),
      modalidadesRecortadas: true,
    });
  }

  private escreverDocumento(id: string, patch: Partial<DocumentoConfig>): void {
    this.store.patchSection('documentos', {
      ...this.store.draft().documentos,
      [id]: { ...this.configuracaoDoDocumento(id), ...patch },
    });
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

    mensagens.push(...this.problemasDasExigencias());

    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: mensagens };
  }

  /** Documento exigido precisa dizer em que fase e para quem ele vale. */
  private problemasDasExigencias(): readonly string[] {
    const problemas: string[] = [];
    const documentos = Object.entries(this.store.draft().documentos);
    const fasesVivas = this.fasesDoCronograma().map((fase) => fase.codigo);

    const semFase = documentos.some(([, config]) => {
      if (!config.included) return false;
      if (config.todasEtapas) return fasesVivas.length === 0;
      return config.etapas.filter((codigo) => fasesVivas.includes(codigo)).length === 0;
    });
    if (semFase) {
      problemas.push('Todo documento exigido precisa valer em ao menos uma fase do cronograma.');
    }

    const semModalidade = documentos.some(
      ([id, config]) => config.included && this.modalidadesEfetivas(id).length === 0,
    );
    if (semModalidade) {
      problemas.push('Todo documento exigido precisa valer para ao menos uma modalidade aceita.');
    }

    return problemas;
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava a configuração das fases pelo comando do cronograma: é uma coleção
   * só, e o `PUT` a substitui inteira. Envia na ordem do rascunho — a mesma que
   * localiza cada recusa devolvida.
   */
  async persistir(): Promise<StepValidation> {
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
      const gravacao = await this.cadastro.definirCronogramaFases(
        processoId,
        fases.map(comoComandoDeFase),
      );
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
