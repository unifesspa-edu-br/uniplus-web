import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
} from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { ValorLegivelDirective, ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import {
  type ProdutoDaFase,
  type RecursoDaEtapa,
  type StepValidation,
} from '../../processo-seletivo.models';
import { PAPEIS_ESCOLHIVEIS } from '../fase/configuracao-da-fase';
import { FaseStepComponent } from '../fase/fase.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CamposPressupostosService } from '../../shared/campos-pressupostos.service';
import { MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO } from '../../shared/instancia-superior';
import {
  inicioDeHojeNoFusoInstitucional,
  pisoDoCampoDeData,
} from '../../shared/fuso-institucional';
import { FORMAS_DE_AVALIACAO } from '../../shared/forma-de-avaliacao';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import {
  caracteresAdmitidos,
  componeNota,
  eliminaPorCarater,
  pontuaPorCarater,
} from './regras-da-etapa';
import { etapaDoFormulario, type EtapaForm, type FaseForm } from './cronograma-form';
import { ConferenciaDoCronograma } from './servicos/conferencia-do-cronograma.service';
import { ExpansaoDoCronograma } from './servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { GravacaoDasExigenciasDocumentais } from './servicos/gravacao-das-exigencias-documentais.service';
import { GravacaoDoCronograma } from './servicos/gravacao-do-cronograma.service';
import { RecusasDasEtapas } from './servicos/recusas-das-etapas.service';
import { ReconciliacaoDasEtapas } from './servicos/reconciliacao-das-etapas.service';
import { UnidadesDasFases } from './servicos/unidades-das-fases.service';
import {
  baseLegalDaConvencao,
  convencaoLida,
  invariantesDaConvencao,
  textosDoCatalogo,
} from './convencao-de-contagem';
import {
  etapaDeclaraNotaMaxima,
  etapaDeNotaDoEnem,
  etapaEhDeAvaliacaoHumana,
  etapaUsaEscalaDeAtendimento,
} from './declaracoes-da-etapa';
import {
  trocarCaraterDaEtapa,
  trocarFormaDeAvaliacao,
  trocarRegraDeConsolidacao,
  trocarTipoDaEtapa,
} from './edicao-da-etapa';
import { dataHoraLida, etapaLida, nomeDaEtapa, rotuloDoPapel } from './leitura-da-etapa';
import {
  acrescentarProduto,
  escolherAtoDoProduto,
  escolherPapelDoProduto,
  removerProduto,
} from './produtos-da-etapa';
import {
  acrescentarRecurso,
  alterarRecurso,
  declararInstanciaSuperior,
  preliminaresDaEtapa,
  removerRecurso,
} from './recursos-da-etapa';
import { ItensDeAvaliacaoDaEtapaComponent } from './itens-de-avaliacao-da-etapa.component';

@Component({
  selector: 'sel-step-cronograma',
  imports: [
    ItensDeAvaliacaoDaEtapaComponent,
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    FormsModule,
    ReactiveFormsModule,
    FaseStepComponent,
  ],
  templateUrl: './cronograma.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(CronogramaStepComponent),
    UnidadesDasFases,
    ReconciliacaoDasEtapas,
    FormularioDoCronograma,
    RecusasDasEtapas,
    ConferenciaDoCronograma,
    GravacaoDasExigenciasDocumentais,
    GravacaoDoCronograma,
    ExpansaoDoCronograma,
  ],
})
export class CronogramaStepComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly camposPressupostos = inject(CamposPressupostosService);
  private readonly injector = inject(Injector);
  protected readonly unidades = inject(UnidadesDasFases);
  protected readonly reconciliacao = inject(ReconciliacaoDasEtapas);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly recusas = inject(RecusasDasEtapas);
  protected readonly conferencia = inject(ConferenciaDoCronograma);
  protected readonly gravacao = inject(GravacaoDoCronograma);
  protected readonly expansao = inject(ExpansaoDoCronograma);

  readonly formulario = this.cronograma.formulario;
  readonly fases = this.cronograma.fases;
  readonly etapas = this.cronograma.etapas;
  readonly linhaDoTempo = this.cronograma.linhaDoTempo;
  readonly fasesDisponiveis = this.cronograma.fasesDisponiveis;
  readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  readonly avisoDeReordenacao = this.cronograma.avisoDeReordenacao;
  readonly reconciliacaoPendente = this.reconciliacao.reconciliacaoPendente;
  readonly relendo = this.reconciliacao.relendo;
  readonly erroDeReleitura = this.reconciliacao.erroDeReleitura;
  private readonly versaoDoFormulario = this.cronograma.versao;

  readonly algoritmoDeclaradoNoServidor = this.gravacao.algoritmoDeclaradoNoServidor;

  constructor() {
    this.catalogos.carregar();
  }

  /** Os papéis escolhíveis, no mesmo vocabulário que a configuração da fase usa. */
  readonly papeis = PAPEIS_ESCOLHIVEIS;
  readonly mensagemDaInstanciaSuperiorEmAberto = MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO;

  /**
   * Convenções de contagem de prazo publicadas no catálogo versionado. O DTO
   * não tem `nome` nem `descricao` — só `codigo`, `versao` e `baseLegal` são
   * legíveis, e é isso que o seletor exibe. Nenhum mapa código→rótulo é
   * escrito aqui: seria vocabulário institucional duplicado no frontend.
   */
  readonly regrasDeContagem = computed(() =>
    this.catalogos
      .regrasContagem()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  readonly invariantesDaContagem = computed<readonly string[]>(() => {
    this.versaoDoFormulario();
    return invariantesDaConvencao(
      this.catalogos.regrasContagem(),
      this.formulario.controls.algoritmoContagemCodigo.value,
    );
  });

  readonly baseLegalDaContagem = computed<string>(() => {
    this.versaoDoFormulario();
    return baseLegalDaConvencao(
      this.catalogos.regrasContagem(),
      this.formulario.controls.algoritmoContagemCodigo.value,
    );
  });

  /**
   * Os controles de etapa que declaram pertencer a esta fase, com o índice que cada um
   * ocupa no FormArray — é por ele que o template liga rótulo, `id` e remoção.
   *
   * A etapa é filha da fase no domínio, mas no formulário continua irmã de `fases`: um
   * `formArrayName` aninhado seria procurado dentro do grupo da fase, que não a contém.
   * Por isso a ligação é por referência, e o recorte acontece aqui.
   */
  etapasDaFase(
    codigo: string,
    agrupaEtapas: boolean,
  ): readonly { indice: number; grupo: FormGroup<EtapaForm> }[] {
    this.versaoDoFormulario();
    return this.etapas.controls
      .map((grupo, indice) => ({ indice, grupo }))
      .filter(({ grupo }) => {
        const declarada = grupo.controls.faseCodigo.value;
        // Etapa gravada antes do vínculo não declara fase: continua aparecendo sob a
        // fase que o cadastro marca como agrupadora, que é onde ela sempre esteve.
        return declarada === '' ? agrupaEtapas : declarada === codigo;
      });
  }

  readonly etapasQueCompoemNota = computed(() => {
    this.versaoDoFormulario();
    return this.etapas.controls.map(etapaDoFormulario).filter(componeNota).length;
  });

  /**
   * Etapas que nenhuma fase da linha do tempo agrupa.
   *
   * O agregado tolera o estado — só a publicação o recusa —, e chega-se a ele
   * quando a fase de avaliação sai e a gravação que esvaziaria as etapas não
   * acontece. Elas não têm onde aparecer na linha do tempo, então a tela as
   * mostra à parte: sem isso a conferência cobra a remoção de etapas que não
   * estão em lugar nenhum, e o cronograma fica sem gravação possível.
   *
   * Resolve pelo mesmo caminho da conferência — o que a fase congelou vale
   * sobre o catálogo —, para que as duas nunca discordem sobre haver ou não
   * quem agrupe.
   */
  readonly etapasOrfas = computed<readonly { indice: number; rotulo: string }[]>(() => {
    this.versaoDoFormulario();
    const codigosNaLinha = new Set(this.fases.controls.map((grupo) => grupo.controls.codigo.value));
    const haAgrupadora = this.linhaDoTempo().some((item) => item.exigencias?.agrupaEtapas === true);

    return this.etapas.controls
      .map((grupo, indice) => ({ indice, grupo }))
      .filter(({ grupo }) => {
        const codigo = grupo.controls.faseCodigo.value;
        // Sem fase declarada, a etapa só é órfã quando nenhuma fase a agruparia.
        return codigo === '' ? !haAgrupadora : !codigosNaLinha.has(codigo);
      })
      .map(({ indice, grupo }) => {
        const nome = grupo.controls.nome.value.trim();
        return { indice, rotulo: nome === '' ? `Etapa ${indice + 1}, ainda sem nome` : nome };
      });
  });

  /**
   * Tipos que o seletor de uma etapa oferece: os ativos, mais o que ela já
   * referencia quando esse saiu de atividade.
   *
   * Um tipo inativo não volta a ser escolha nova, mas continua descrevendo a
   * etapa que o gravou. Sem ele na lista, nenhuma opção casa e o campo aparece
   * em branco — o operador não veria qual classificação está configurada, e
   * gravaria por cima dela sem perceber.
   */
  tiposEscolhiveisPara(grupo: FormGroup<EtapaForm>): readonly { id: string; nome: string }[] {
    const referenciado = grupo.controls.tipoEtapaOrigemId.value;
    const ativos = this.catalogos
      .tiposEtapaAtivos()
      .map((tipo) => ({ id: tipo.id, nome: tipo.nome }));

    if (referenciado === '' || ativos.some((tipo) => tipo.id === referenciado)) {
      return ativos;
    }

    const rotulo = this.catalogos.rotuloDoTipoEtapa().get(referenciado);
    return [
      ...ativos,
      {
        id: referenciado,
        nome: rotulo === undefined ? 'Tipo fora do catálogo atual' : `${rotulo} (inativo)`,
      },
    ];
  }

  /**
   * O que a fase publica, como a tela o mostra: nome do ato e papel da
   * publicação. É leitura, não escolha — a declaração dos produtos é de outro
   * passo, e o que está aqui atravessa a gravação inalterado.
   *
   * O ato cujo rótulo o catálogo não resolve aparece pelo código: ele descreve
   * o cronograma gravado, e escondê-lo faria a fase parecer publicar menos do
   * que publica.
   */
  produtosDaFase(
    grupo: FormGroup<FaseForm>,
  ): readonly { atoCodigo: string; nome: string; papel: string }[] {
    const rotulos = this.catalogos.rotuloDoAto();

    return grupo.controls.produtos.value.map((produto) => ({
      atoCodigo: produto.atoCodigo,
      nome: rotulos.get(produto.atoCodigo) ?? produto.atoCodigo,
      papel: rotuloDoPapel(produto.papel),
    }));
  }

  /**
   * O que a fase fechada diz de si: quantas etapas acontecem nela e quantos documentos ela
   * exige. É o bastante para o operador saber onde entrar sem abrir uma por uma.
   */
  marcasDaFase(indice: number): readonly string[] {
    const { etapas, documentos } = this.cronograma.dependentesDaFase(indice);
    const marcas: string[] = [];
    if (etapas > 0) marcas.push(etapas === 1 ? '1 etapa' : `${etapas} etapas`);
    if (documentos > 0) {
      marcas.push(documentos === 1 ? '1 documento' : `${documentos} documentos`);
    }
    return marcas;
  }

  /** O que o cabeçalho recolhido diz sobre as janelas recursais da etapa. */
  resumoDosRecursos(grupo: FormGroup<EtapaForm>): string {
    const total = this.recursosDaEtapa(grupo).length;
    if (total === 0) return 'nenhum recurso';
    return total === 1 ? '1 recurso' : `${total} recursos`;
  }

  /** O que o cabeçalho recolhido diz sobre o que a etapa publica. */
  resumoDasPublicacoes(grupo: FormGroup<EtapaForm>): string {
    const total = this.produtosDaEtapa(grupo).filter((p) => p.atoCodigo !== '').length;
    if (total === 0) return 'não publica nada';
    return total === 1 ? '1 publicação' : `${total} publicações`;
  }

  caracteresPara(grupo: FormGroup<EtapaForm>): readonly { valor: string; rotulo: string }[] {
    this.versaoDoFormulario();
    return caracteresAdmitidos(
      this.catalogos.tipoEtapaPorId().get(grupo.controls.tipoEtapaOrigemId.value),
      this.etapaDeNotaDoEnem(grupo),
      grupo.controls.carater.value,
    );
  }

  escolherTipoEtapa(grupo: FormGroup<EtapaForm>, tipoEtapaOrigemId: string): void {
    trocarTipoDaEtapa(grupo, tipoEtapaOrigemId, this.catalogos.tipoEtapaPorId());
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  etapaDeNotaDoEnem(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaDeNotaDoEnem(grupo, this.catalogos.tipoEtapaPorId());
  }

  /**
   * A etapa entra no cálculo da nota final — e, por isso, o peso dela tem efeito.
   *
   * Quem decide é o caráter, não o tipo: `CalcularDivisorMedia` soma o peso das etapas
   * classificatórias e das que são ambas, e ignora as puramente eliminatórias. Peso numa
   * eliminatória é dado morto que o operador acredita estar declarando.
   */
  etapaComponeNota(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return pontuaPorCarater(grupo.controls.carater.value);
  }

  etapaDeclaraNotaMaxima(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaDeclaraNotaMaxima(grupo, this.catalogos.tipoEtapaPorId());
  }

  readonly formasDeAvaliacao = FORMAS_DE_AVALIACAO;

  etapaEhDeAvaliacaoHumana(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaEhDeAvaliacaoHumana(grupo, this.catalogos.tipoEtapaPorId());
  }

  escolherFormaDeAvaliacao(grupo: FormGroup<EtapaForm>, forma: string): void {
    trocarFormaDeAvaliacao(grupo, forma);
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  /**
   * As regras de consolidação que o catálogo publica, com a prosa dos invariantes como
   * descrição. O DTO não tem `nome`: o código é o que identifica, e nenhuma lista é escrita aqui.
   */
  readonly regrasDeConsolidacao = computed(() =>
    this.catalogos.regrasConsolidacao().map((regra) => ({
      codigo: regra.codigo,
      versao: regra.versao,
      descricao: textosDoCatalogo(regra.invariantes),
    })),
  );

  escolherRegraDeConsolidacao(grupo: FormGroup<EtapaForm>, codigo: string, versao: string): void {
    trocarRegraDeConsolidacao(grupo, codigo, versao);
    this.versaoDoFormulario.update((atual) => atual + 1);
  }

  etapaUsaEscalaDeAtendimento(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaUsaEscalaDeAtendimento(grupo, this.catalogos.tipoEtapaPorId());
  }

  /** A etapa corta candidato — é onde a nota mínima tem o que fazer. */
  etapaElimina(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return eliminaPorCarater(grupo.controls.carater.value);
  }

  escolherCarater(grupo: FormGroup<EtapaForm>, carater: string): void {
    trocarCaraterDaEtapa(grupo, carater, this.catalogos.tipoEtapaPorId());
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  /**
   * O que a linha fechada diz sobre a etapa, para o operador não precisar abrir para saber.
   *
   * Só o que está declarado aparece: uma etapa recém-acrescentada mostra o tipo e nada mais,
   * e é assim que a lista distingue o que já foi configurado do que ainda não.
   */
  marcasDaEtapa(grupo: FormGroup<EtapaForm>): readonly string[] {
    const marcas: string[] = [];

    const tipo = this.catalogos.rotuloDoTipoEtapa().get(grupo.controls.tipoEtapaOrigemId.value);
    if (tipo !== undefined) marcas.push(tipo);

    const publicacoes = this.produtosDaEtapa(grupo).filter((p) => p.atoCodigo !== '').length;
    if (publicacoes > 0) {
      marcas.push(publicacoes === 1 ? '1 publicação' : `${publicacoes} publicações`);
    }

    const bancas = this.bancasDaEtapa(grupo).length;
    if (bancas > 0) marcas.push(bancas === 1 ? '1 banca' : `${bancas} bancas`);

    const recursos = this.recursosDaEtapa(grupo).length;
    if (recursos > 0) marcas.push(recursos === 1 ? '1 recurso' : `${recursos} recursos`);

    if (grupo.controls.emiteParecerIndividual.value) marcas.push('parecer individual');

    return marcas;
  }

  /** O que a fase publica, em texto: o ato e o papel dele no ciclo recursal. */
  produtosLidosDaFase(grupo: FormGroup<FaseForm>): readonly string[] {
    return this.produtosDaFase(grupo).map((produto) => `${produto.nome} — ${produto.papel}`);
  }

  readonly nomeDaEtapa = nomeDaEtapa;
  readonly dataHoraLida = dataHoraLida;

  etapaLida(grupo: FormGroup<EtapaForm>) {
    return etapaLida(grupo, this.catalogos);
  }

  readonly convencaoDeContagemLida = computed(() => {
    this.versaoDoFormulario();
    const { algoritmoContagemCodigo, algoritmoContagemVersao } = this.formulario.controls;
    return convencaoLida(algoritmoContagemCodigo.value, algoritmoContagemVersao.value);
  });

  /**
   * A convenção é identificada por código **e** versão: publicar versão nova
   * do catálogo não pode mudar a regra que um processo já declarou. Escolher
   * pelo código e deduzir a versão do que está carregado é o que mantém o par
   * coerente — gravar código novo com versão velha é recusado.
   */
  escolherAlgoritmo(codigo: string): void {
    const versao = this.regrasDeContagem().find((regra) => regra.codigo === codigo)?.versao ?? '';
    this.formulario.controls.algoritmoContagemCodigo.setValue(codigo);
    this.formulario.controls.algoritmoContagemVersao.setValue(versao);
    // O valor de um FormControl não é signal: sem avisar, a descrição da convenção
    // escolhida continuaria mostrando a anterior.
    this.versaoDoFormulario.update((versaoAtual) => versaoAtual + 1);
  }

  // ── O que a etapa publica ──────────────────────────────────────────────────
  // Mesmo desenho que a fase já usa um nível acima: a coleção é substituída por
  // inteiro, e trocar o ato zera o papel, porque só ato que o catálogo marca como
  // resultado o recebe.

  produtosDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return grupo.controls.produtos.value;
  }

  readonly acrescentarProdutoNaEtapa = acrescentarProduto;
  readonly removerProdutoDaEtapa = removerProduto;
  readonly escolherAtoDaEtapa = escolherAtoDoProduto;
  readonly escolherPapelDaEtapa = escolherPapelDoProduto;

  /** Só ato que o catálogo marca como resultado admite papel no ciclo recursal. */
  atoEhResultado(atoCodigo: string): boolean {
    return this.catalogos.atoPorCodigo().get(atoCodigo)?.ehResultado === true;
  }

  // ── Bancas e janelas recursais da etapa ────────────────────────────────────

  bancasDaEtapa(grupo: FormGroup<EtapaForm>): readonly string[] {
    this.versaoDoFormulario();
    return grupo.controls.bancas.value;
  }

  alternarBancaDaEtapa(grupo: FormGroup<EtapaForm>, tipoBancaId: string, marcada: boolean): void {
    const atuais = grupo.controls.bancas.value;
    const proximas = marcada
      ? [...new Set([...atuais, tipoBancaId])]
      : atuais.filter((id) => id !== tipoBancaId);
    grupo.controls.bancas.setValue(proximas);
    grupo.controls.bancas.markAsDirty();
  }

  recursosDaEtapa(grupo: FormGroup<EtapaForm>): readonly RecursoDaEtapa[] {
    this.versaoDoFormulario();
    return grupo.controls.recursos.value;
  }

  acrescentarRecursoNaEtapa(grupo: FormGroup<EtapaForm>): void {
    acrescentarRecurso(grupo, this.catalogos.regrasRecurso(), this.etapaDeNotaDoEnem(grupo));
  }

  /** Sem regra de prazo no catálogo, não há janela recursal declarável. */
  temRegraDeRecurso(): boolean {
    return this.catalogos.regrasRecurso().length > 0;
  }

  readonly removerRecursoDaEtapa = removerRecurso;

  alterarRecursoDaEtapa(
    grupo: FormGroup<EtapaForm>,
    posicao: number,
    campo: keyof RecursoDaEtapa,
    valor: string,
  ): void {
    alterarRecurso(grupo, posicao, campo, valor, this.catalogos.regrasRecurso());
  }

  readonly declararInstanciaSuperiorDaEtapa = declararInstanciaSuperior;

  preliminaresDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return preliminaresDaEtapa(grupo);
  }

  validate(): StepValidation {
    return this.conferencia.validar();
  }

  persistir(): Promise<StepValidation> {
    return this.gravacao.persistir();
  }

  /**
   * O piso do campo de data e hora: nunca antes de hoje, e nunca depois do que o campo já
   * carrega.
   *
   * Recebe os limites que valem para aquele campo — o início da fase, para uma etapa que precisa
   * caber nela; o início da própria janela, para um fim. Passar o valor atual é o que impede o
   * piso de invalidar cronograma já em curso, que é o caso da retificação.
   */
  pisoDeData(
    valorAtual: string,
    ...limites: readonly (string | null | undefined)[]
  ): string | null {
    return pisoDoCampoDeData(valorAtual, inicioDeHojeNoFusoInstitucional(), ...limites);
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }
}
