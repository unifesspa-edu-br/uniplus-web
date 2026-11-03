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
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { OrigemCandidatos, ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
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
import { descreverFase, finalidadesDaFase } from '../../shared/descricao-da-fase';
import {
  CamposPressupostosService,
  fatosCitadosPelasModalidadesOfertadas,
} from '../../shared/campos-pressupostos.service';
import {
  ORIENTACAO_DE_PERMUTACAO,
  PERMUTACAO_DE_ORDEM,
  gravarCronogramaFases,
} from '../../shared/gravacao-do-cronograma';
import { comAlcanceDeTodasAsFases } from '../../shared/exigencias/alcance-das-exigencias';
import {
  type RepeticaoDaExigencia,
  exigenciasLocalizadas,
  gruposSemNormaResolvida,
  todasAsExigencias,
} from '../../shared/exigencias/consulta-das-exigencias';
import {
  CONSEQUENCIA_REENVIO,
  exigenciaDecideResultado,
  temNormaResolvida,
} from '../../shared/exigencias/exigencias-documentais';
import { faltaOFormulario } from '../../shared/exigencias/formulario-da-exigencia';
import { arvoreDeExigencias } from '../../shared/exigencias/gravacao-das-exigencias';
import { modalidadesDaExigencia } from '../../shared/exigencias/recorte-por-modalidade';
import {
  dominiosDoGatilho,
  fatosParaGatilho,
  nomesDoCatalogo,
  podeAlcancarModalidade,
  problemasDoGatilho,
  recusasDeFaseDoGatilho,
} from '../../shared/gatilho-de-exigencia';
import {
  orientacaoDaRecusaDaRepeticao,
  recusaDaExigenciaDoServidor,
  type NomesDaOrientacao,
} from '../../shared/orientacao-da-recusa-do-fato';
import {
  camposDaRepeticao,
  fasesNoCronograma,
  producaoDoRascunho,
  recusaDaRepeticao,
  type LugarDaExigencia,
  type ProducaoDosFatos,
} from '../../shared/producao-dos-fatos';
import { MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO } from '../../shared/instancia-superior';
import { quemCitaNoProcesso } from '../formulario/formulario-de-inscricao';
import { finalidadesQueAtende } from '../formulario/formularios-por-finalidade';
import {
  inicioDeHojeNoFusoInstitucional,
  pisoDoCampoDeData,
} from '../../shared/fuso-institucional';
import { FORMAS_DE_AVALIACAO } from '../../shared/forma-de-avaliacao';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import { problemasDoCronograma } from './cronograma-do-certame';
import {
  avisosDosGrupos,
  type ExigenciaDeclarada,
  type GrupoDeclarado,
} from './conferencia-das-exigencias-declaradas';
import {
  fasesComUnidadeNaoEncontrada,
  localDoErroDaEtapa,
  recusaDaEtapaDeNotaDoEnem,
  recusaDoCampoDaEtapa,
} from './recusas-do-servidor-da-etapa';
import {
  caracteresAdmitidos,
  componeNota,
  eliminaPorCarater,
  pontuaPorCarater,
} from './regras-da-etapa';
import {
  etapaDoFormulario,
  faseDoFormulario,
  type EtapaForm,
  type FaseForm,
} from './cronograma-form';
import { comoComandoDeEtapa } from './cronograma-para-comando';
import { ExpansaoDoCronograma } from './servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { RecusasDasEtapas } from './servicos/recusas-das-etapas.service';
import {
  AGUARDA_RELEITURA,
  ReconciliacaoDasEtapas,
} from './servicos/reconciliacao-das-etapas.service';
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

  /**
   * A convenção foi gravada com sucesso nesta sessão. Só `persistir()`
   * escreve aqui, no sucesso da terceira chamada — nunca a mirror genérica de
   * `espelharRascunho`, que roda por causa de qualquer uma das três dimensões
   * (inclusive uma reconciliação de etapas que nada tem a ver com o
   * algoritmo) e daria falso positivo se lida como confirmação do servidor.
   */
  private readonly algoritmoConfirmadoNestaSessao = signal(false);

  /**
   * A convenção já foi declarada no servidor — pela última leitura completa
   * (`remoteSnapshot`) ou por uma gravação desta sessão. Enquanto for
   * `false`, "nenhuma convenção" é opção legítima (CA-05); depois, deixa de
   * ser: o endpoint não tem operação de remoção —
   * `DefinirAlgoritmoContagemPrazoRequest` exige `codigo` e `versao` — e
   * oferecer a opção de novo convidaria a uma gravação que a tela pularia em
   * silêncio, relatando sucesso sem o servidor ter mudado nada.
   */
  readonly algoritmoDeclaradoNoServidor = computed(
    () =>
      this.store.remoteSnapshot()?.algoritmoContagemPrazo != null ||
      this.algoritmoConfirmadoNestaSessao(),
  );

  private recusarUnidades(
    enviadas: readonly FormGroup<FaseForm>[],
    indices: readonly number[],
  ): void {
    if (indices.length === 0) return;
    this.unidades.recusar(enviadas, indices);
    this.expansao.abrirFases(indices.filter((indice) => indice < enviadas.length));
    this.versaoDoFormulario.update((versao) => versao + 1);
    this.catalogos.carregarUnidades();
  }

  constructor() {
    this.catalogos.carregar();

    effect(() => {
      this.store.geracao();
      untracked(() => this.algoritmoConfirmadoNestaSessao.set(false));
    });
  }

  /** Os papéis escolhíveis, no mesmo vocabulário que a configuração da fase usa. */
  readonly papeis = PAPEIS_ESCOLHIVEIS;
  readonly mensagemDaInstanciaSuperiorEmAberto = MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO;

  /** O que impede a gravação, como a validação do passo o relata. */
  readonly problemas = computed(() => {
    this.versaoDoFormulario();
    return problemasDoCronograma(
      this.fases.controls.map(faseDoFormulario),
      this.cronograma.etapasParaEnvio(),
      this.catalogos.fasePorId(),
      this.catalogos.precedencias(),
      this.catalogos.atoPorCodigo(),
      (tipoBancaId) => this.catalogos.bancaPorId().get(tipoBancaId)?.nome ?? tipoBancaId,
      (tipoEtapaOrigemId) => this.catalogos.tipoEtapaPorId().get(tipoEtapaOrigemId),
      this.exigenciasDeclaradas(),
    );
  });

  /**
   * O que a publicação vai cobrar dos grupos, dito como aviso: eles não se editam aqui, e
   * bloquear a gravação por causa deles prenderia o passo sem saída.
   */
  readonly avisosDeGrupo = computed(() => avisosDosGrupos(this.gruposDeclarados()));

  /**
   * Os grupos de exigências que o rascunho carrega. A tela não os edita — eles chegam da
   * configuração do processo —, mas a publicação cobra deles a norma quando decidem o
   * resultado, e é melhor dizer isso aqui do que no último passo.
   */
  private readonly gruposDeclarados = computed<readonly GrupoDeclarado[]>(() => {
    const nomePorId = new Map(this.catalogos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome]));

    return gruposSemNormaResolvida(this.store.draft().documentos).map((grupo) => ({
      decideResultado: true,
      normaResolvida: false,
      documentos: grupo.documentos.map((id) => nomePorId.get(id) ?? id),
    }));
  });

  /**
   * As exigências que o rascunho declara, na forma que a conferência entende: o nome que a
   * pessoa lê, se a exigência decide o resultado e se a norma que a sustenta está resolvida.
   */
  private readonly exigenciasDeclaradas = computed<readonly ExigenciaDeclarada[]>(() => {
    const nomePorId = new Map(this.catalogos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome]));
    // Percorre as exigências, não os tipos de documento: a norma é declarada POR exigência,
    // e o mesmo documento pode decidir o resultado numa fase e não na outra. Conferir por
    // documento aprovaria a fase cuja norma ficou pendente por causa da outra.
    const fases = this.fases.controls.map(faseDoFormulario);
    const fasePorCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
    const ofertadas = new Set(this.store.modalidadesDoProcesso());
    // O gatilho é conferido contra o MESMO catálogo que a superfície da fase oferece: o que a
    // tela não soube propor, ela também não sabe validar, e apontar um fato que o editor não
    // mostra deixaria o operador sem o que fazer.
    const fatoPorCodigo = new Map(
      fatosParaGatilho(
        this.catalogos.fatos(),
        dominiosDoGatilho(
          this.catalogos.fatos(),
          this.store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
          [...ofertadas],
        ),
      ).map((fato) => [fato.codigo, fato]),
    );
    const nomePorCodigo = nomesDoCatalogo(this.catalogos.fatos());
    // A fase de cada fato é lida das fases como estão na tela, não das gravadas: reordenar o
    // cronograma pode deixar um gatilho citando o que só se conhece depois da exigência.
    const producao = producaoDoRascunho(
      this.store.draft().formulario,
      fasesNoCronograma(fases, this.catalogos.fasePorId()),
      this.catalogos.fatos(),
    );
    const nomes = {
      fato: (codigo: string) => nomePorCodigo.get(codigo) ?? codigo,
      fase: this.catalogos.nomeDaFase(),
    };

    // Confere o que a gravação envia: o documento que vale em todas as fases é materializado
    // também na fase acrescentada depois do regime, e só assim a cópia dela é conferida antes do
    // envio, em vez de chegar ao servidor sem ninguém a ter visto.
    const materializadas = comAlcanceDeTodasAsFases(
      this.store.draft().documentos,
      fases.map((fase) => fase.codigo),
    );
    return exigenciasLocalizadas(materializadas).map(({ documento: exigencia, repeticao }) => {
      const fase = fasePorCodigo.get(exigencia.faseCodigo);
      const admiteComplementacao =
        fase === undefined
          ? false
          : descreverFase(fase, this.catalogos.fasePorId()).permiteComplementacao;

      return {
        nome: nomePorId.get(exigencia.tipoDocumentoId) ?? exigencia.tipoDocumentoId,
        decideResultado: exigenciaDecideResultado(exigencia),
        normaResolvida: temNormaResolvida(exigencia.basesLegais),
        faseCodigo: exigencia.faseCodigo,
        faseViva: fase !== undefined,
        alcancaModalidade: [...ofertadas].some((codigo) =>
          podeAlcancarModalidade(exigencia, codigo),
        ),
        reenvioSemComplementacao:
          exigencia.consequenciaIndeferimento === CONSEQUENCIA_REENVIO && !admiteComplementacao,
        semFormulario:
          fase !== undefined &&
          faltaOFormulario(
            exigencia.finalidade,
            finalidadesDaFase(fase, this.catalogos.fasePorId()),
          ) !== null,
        problemasDeGatilho: problemasDoGatilho(exigencia, fatoPorCodigo, nomePorCodigo),
        problemasDeFase: [
          ...new Set([
            ...problemaDaRepeticao(repeticao, exigencia, producao, nomes),
            ...recusasDeFaseDoGatilho(
              exigencia,
              producao,
              nomes,
              camposDaRepeticao(repeticao?.grupo ?? null, producao),
            ).map((recusa) => recusa.orientacao),
          ]),
        ],
      };
    });
  });

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

  /**
   * A conferência do passo, que também é o que a gravação consulta antes de
   * enviar qualquer coisa: recusar aqui é o que impede a segunda gravação de
   * recriar etapas que já existem, e é o que impede a revisão final de declarar
   * íntegro um cronograma que o servidor ainda não confirmou.
   */
  validate(): StepValidation {
    if (this.reconciliacaoPendente()) return { valid: false, messages: [AGUARDA_RELEITURA] };

    const problemas = this.problemas();
    return problemas.length === 0 ? { valid: true } : { valid: false, messages: [...problemas] };
  }

  /**
   * Grava as três dimensões: etapas e cronograma de fases, na ordem que a
   * bicondicional do agregado exige, e por último a convenção de contagem de
   * prazo — só quando o rascunho declara uma.
   *
   * A ordem entre etapas e cronograma não é preferência: a fase que agrupa
   * etapas é recusada na hora se o processo não tiver nenhuma etapa, então
   * gravar o cronograma antes das etapas derrubaria a gravação de um
   * cronograma que é válido.
   *
   * As duas vão juntas mesmo quando só uma mudou. O acoplamento que isso
   * poderia criar — uma etapa malformada impedindo a correção de uma data — não
   * chega a existir, porque a conferência acima recusa antes de qualquer envio e
   * aponta a etapa; e um `PUT` que substitui a coleção pelo mesmo conteúdo não
   * muda nada no servidor.
   *
   * O algoritmo vem por último e é opcional: ausência é estado válido
   * enquanto rascunho (CA-05) — o endpoint recusa código ou versão nulos, e
   * não existe caminho para desdeclarar a convenção depois de escolhida. Se
   * ele falhar, as duas primeiras chamadas já gravaram, e a mensagem diz isso
   * em vez de tratar a falha como se nada tivesse sido salvo.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de montar o cronograma.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) {
      // O que a conferência acusa pode estar numa fase fechada: abrir todas põe o problema à
      // vista, em vez de deixar a mensagem apontar para um lugar que não está na tela.
      this.expansao.expandirTodasAsFases(this.linhaDoTempo().map((item) => item.indice));
      return conferencia;
    }

    const fases = this.fases.controls.map(faseDoFormulario);
    const grupos = [...this.etapas.controls];
    const etapas = this.cronograma.etapasParaEnvio();
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      // O cronograma vai primeiro, sempre: a etapa declara a fase em que acontece, e o
      // servidor recusa etapa cuja fase ainda não está no cronograma. Um certame montado do
      // zero — nenhuma fase gravada ainda — não teria como gravar etapa nenhuma na ordem
      // inversa.
      // Remover uma fase também é seguro por aqui: o agregado poda as etapas dela junto.
      const enviadas = [...this.fases.controls];
      const cronograma = await gravarCronogramaFases(this.cadastro, processoId, fases);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!cronograma.ok) {
        this.recusarUnidades(
          enviadas,
          fasesComUnidadeNaoEncontrada(cronograma.problem.errors ?? []),
        );
        return {
          valid: false,
          messages: [this.explicarRecusa(cronograma.problem.code, cronograma.problem)],
        };
      }

      this.unidades.limparRecusadas();
      this.recusas.limpar();
      const gravacaoDeEtapas = await this.cadastro.definirEtapas(
        processoId,
        etapas.map(comoComandoDeEtapa),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacaoDeEtapas.ok) {
        const problema = gravacaoDeEtapas.problem;
        this.recusas.aplicar(grupos, problema.errors ?? []);
        const daRaiz = recusaDaEtapaDeNotaDoEnem(problema.code);
        const resumo = resumoDaRecusa(
          problema,
          (erro) => {
            const texto = recusaDoCampoDaEtapa(erro.code);
            if (texto === null) return recusaDaEtapaDeNotaDoEnem(erro.code);
            const indice = localDoErroDaEtapa(erro.field)?.indice;
            if (indice === undefined) return texto;
            const nome = etapas[indice]?.nome.trim() ?? '';
            return `${nome === '' ? `Etapa ${indice + 1}` : nome}: ${texto}`;
          },
          () => this.problemI18n.resolve(problema).title,
        );
        return {
          valid: false,
          messages: daRaiz === null || resumo.includes(daRaiz) ? resumo : [daRaiz, ...resumo],
        };
      }

      // As etapas já mudaram no servidor: é aqui que o rascunho recolhe os
      // identificadores atribuídos. Deixar para o fim perderia a reconciliação
      // se o cronograma fosse recusado, e a tentativa seguinte reenviaria
      // etapas que já existem sem o `id`, recriando-as.
      const reconciliada = await this.reconciliacao.reconciliarEtapas(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!reconciliada) {
        // Trava a tela em vez de só avisar: o `finally` logo abaixo devolve o
        // botão de gravar, e o rascunho ainda tem `id: null` nas etapas que o
        // servidor acabou de criar.
        this.reconciliacaoPendente.set(true);
        return { valid: false, messages: [AGUARDA_RELEITURA] };
      }

      // As exigências documentais vão por último e dependem das duas gravações
      // anteriores: a exigência referencia a fase pelo id que o servidor atribui, e
      // a etapa que a coleta pelo id que a reconciliação acabou de recolher.
      const exigencias = await this.gravarExigenciasDocumentais(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!exigencias.valid) return exigencias;

      // Ausência é estado válido em rascunho (CA-05): a chamada só acontece
      // quando há escolha. O código e a versão do formulário sempre andam
      // juntos — `escolherAlgoritmo` os grava ao mesmo tempo —, então checar
      // um basta para saber que o par está completo.
      const codigoAlgoritmo = this.formulario.controls.algoritmoContagemCodigo.value;
      if (codigoAlgoritmo !== '') {
        const algoritmo = await this.cadastro.definirAlgoritmoContagemPrazo(processoId, {
          codigo: codigoAlgoritmo,
          versao: this.formulario.controls.algoritmoContagemVersao.value,
        });
        if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
        if (!algoritmo.ok) {
          return {
            valid: false,
            messages: [
              `As etapas e o cronograma de fases foram gravados. ${this.problemI18n.resolve(algoritmo.problem).title}`,
            ],
          };
        }

        // A partir daqui o endpoint não tem operação de remoção: o seletor
        // deixa de oferecer "nenhuma convenção" para não convidar a uma
        // gravação futura que a tela pularia em silêncio.
        this.algoritmoConfirmadoNestaSessao.set(true);
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
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

  /**
   * Grava os documentos que cada fase exige.
   *
   * A conversão precisa do id de cada fase, que o rascunho não guarda — ele identifica
   * a fase pelo código canônico, que é o que sobrevive à reconciliação do servidor. A
   * releitura aqui é a que traduz um no outro; sem ela, a exigência sairia apontando
   * para uma fase que só existe no rascunho.
   */
  private async gravarExigenciasDocumentais(processoId: string): Promise<StepValidation> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!isApiOk(detalhe)) {
      return {
        valid: false,
        messages: [
          'As etapas e o cronograma foram gravados, mas não foi possível reler as fases para gravar os documentos exigidos. Tente gravar de novo.',
        ],
      };
    }

    const faseIdPorCodigo = new Map(detalhe.data.cronogramaFases.map((f) => [f.codigo, f.id]));
    const raizes = arvoreDeExigencias(
      this.store.draft().documentos,
      faseIdPorCodigo,
      this.store.modalidadesDoProcesso(),
      new Set(detalhe.data.etapas.map((etapa) => etapa.id)),
      // O formulário de cada fase pelas fases que acabaram de ser gravadas: é contra elas que o
      // servidor confere o formulário de cada documento.
      new Map(
        detalhe.data.cronogramaFases.map((fase) => [fase.codigo, finalidadesQueAtende(fase)]),
      ),
    );

    // Os campos do formulário saem ANTES das exigências, e não é preferência de ordem: uma
    // exigência condicionada a um fato só se resolve se o certame coletar aquele fato. Quem
    // declara a condição é este passo, então é ele que garante o campo — o operador não
    // deveria precisar lembrar que decidir de quem o documento é cobrado mexe no formulário.
    // A exigência recortada por modalidade depende também das perguntas que as regras das
    // modalidades ofertadas fazem: é delas que a modalidade do candidato se deriva.
    const recorta = todasAsExigencias(this.store.draft().documentos).some(
      (exigencia) => modalidadesDaExigencia(exigencia) !== null,
    );
    const citadosPelasModalidades = this.pedePerguntasDasModalidades(recorta)
      ? fatosCitadosPelasModalidadesOfertadas(detalhe.data)
      : new Set<string>();

    const draft = this.store.draft();
    const citadosPelasExigencias = new Set(
      quemCitaNoProcesso({
        documentos: draft.documentos,
        derivacao: detalhe.data.regrasDerivacao ?? [],
        desempate: draft.desempate,
      }).keys(),
    );
    const campos = await this.camposPressupostos.garantirCampos(
      processoId,
      detalhe.data,
      new Set([...citadosPelasExigencias, ...citadosPelasModalidades]),
    );
    if (geracao !== this.store.geracao()) return { valid: true };
    if (campos.tipo === 'recusados') {
      return {
        valid: false,
        messages: [`As etapas e o cronograma foram gravados. ${campos.motivo}`],
      };
    }
    if (
      campos.tipo === 'semFaseDeInscricao' &&
      (recorta || !this.camposPressupostos.coletaTudo(detalhe.data, citadosPelasExigencias))
    ) {
      // Sem a fase de inscrição, as perguntas das modalidades esperam por ela; a exigência que
      // depende de um dado, não.
      return {
        valid: false,
        messages: [
          'As etapas e o cronograma foram gravados. Uma exigência documental depende de um dado que o formulário de inscrição precisa coletar, e o cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição.',
        ],
      };
    }

    const gravacao = await this.cadastro.definirDocumentosExigidos(processoId, raizes);
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!gravacao.ok) {
      return {
        valid: false,
        messages: [
          `As etapas, o cronograma e o formulário de inscrição foram gravados. ${recusaDaExigenciaDoServidor(gravacao.problem) ?? this.problemI18n.resolve(gravacao.problem).title}`,
        ],
      };
    }

    return { valid: true };
  }

  /**
   * As perguntas das modalidades vão ao formulário do processo em que o candidato se inscreve — é
   * a inscrição que coleta as respostas de que a modalidade dele se deriva —, e ao do que recorta
   * exigência por modalidade, que sem elas escreveria uma condição que nunca resolve.
   */
  private pedePerguntasDasModalidades(recorta: boolean): boolean {
    return (
      recorta ||
      this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.inscricaoPropria
    );
  }

  /**
   * A recusa de permutação de ordem descreve o que aconteceu, não o que fazer.
   * Quem reordenou duas fases precisa saber que o caminho é fazê-lo em duas
   * gravações — a informação que evita tentar de novo o mesmo movimento.
   */
  private explicarRecusa(
    codigo: string,
    problema: Parameters<ProblemI18nService['resolve']>[0],
  ): string {
    if (codigo === PERMUTACAO_DE_ORDEM) return ORIENTACAO_DE_PERMUTACAO;
    return this.problemI18n.resolve(problema).title;
  }
}

/** A repetição que não vale onde o documento é cobrado, dita com o que fazer; nada quando vale ou não há. */
function problemaDaRepeticao(
  repeticao: RepeticaoDaExigencia | null,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): readonly string[] {
  const recusa = repeticao === null ? null : recusaDaRepeticao(repeticao.grupo, lugar, producao);
  return recusa === null || repeticao === null
    ? []
    : [orientacaoDaRecusaDaRepeticao(recusa, producao, nomes, repeticao.herdada)];
}
