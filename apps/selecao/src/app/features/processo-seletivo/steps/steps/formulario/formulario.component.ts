import { ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { ProblemI18nService, STATUS_HTTP, isApiOk, type ProblemDetails } from '@uniplus/shared-core/http';
import { FatoCandidatoView, FatosCandidatoApi, ModelosFormularioApi, TermosConsentimentoApi } from '@uniplus/shared-data/configuracao';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { ProcessosSeletivosApi, type AplicacaoDeModeloDto } from '@uniplus/shared-data/selecao';
import {
  BUSCA_DE_MUNICIPIOS,
  ConfirmDialogComponent,
  EditorDeFormularioComponent,
  FINALIDADE_INSCRICAO,
  FINALIDADES,
  OBRIGATORIEDADES,
  PreVisualizacaoDeFormulariosComponent,
  ValorEmConsultaComponent,
  conteudoInicial,
  distribuirRecusas,
  entradasDaSecao,
  etapasEmOrdem,
  semDadosBasicos,
  termoDisponivelDe,
  type AvaliacaoDeFormularios,
  type ConteudoDoFormulario,
  type FormularioParaSimular,
  type RecusasDoConteudo,
  type TermoDisponivel,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import type { FormularioDaFinalidade, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { descreverFase } from '../cronograma/cronograma-do-certame';
import { desempateIdosoSemApuracao, desempateSemDataDeNascimento, PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import {
  ANCORAS_DA_IDADE,
  camposSemUsoDeclarado,
  camposSemValoresOfertados,
  comCamposQueAsExigenciasPressupoem,
  comoComandoDeReferenciaTemporal,
  fatosCitadosPelasExigencias,
  fatosColetadosPelaInscricao,
  fatosForaDaColetaDaInscricao,
  problemasDoFormulario,
  quemCitaNoProcesso,
  remocoesTravadasPor,
} from './formulario-de-inscricao';
import { conteudoDoFormulario, fatosColetadosPor, formularioDaFinalidade, rascunhoDifereDoGravado } from './formulario-do-processo';
import { resultadoDoProcesso } from './pre-visualizacao-do-processo';
import {
  comAplicacaoDoServidor,
  faseQueAAplicacaoDeclara,
  modelosPorFinalidade,
  resumoDaAplicacao,
  type ModeloOferecido,
  type ProcessoAposAplicacao,
  textoDaAplicacaoEmAberto,
} from './modelo-de-formulario';
import {
  abaPelaTecla,
  comFormulario,
  faseEfetiva,
  faseServeAFinalidade,
  fatosColetadosPelasOutras,
  fatosDaInscricaoQueOutrasExigem,
  finalidadeCabeNaCobranca,
  finalidadesParaAcrescentar,
  formularioDoServidorNaFinalidade,
  formulariosDoRascunho,
  formulariosDoServidor,
  nomeDaFinalidade,
  ordemDeGravacao,
  sufixoDaFinalidade,
  emOrdemDasFinalidades,
} from './formularios-por-finalidade';


/** O que a gravação de um formulário precisa: a fase resolvida para id e o conteúdo desejado. */
interface FormularioParaEnvio {
  readonly finalidade: string;
  readonly faseId: string;
  readonly conteudo: ConteudoDoFormulario;
}

/**
 * Formulários — um por finalidade do processo (inscrição, isenção da taxa, habilitação), cada um
 * numa aba, com as etapas, os campos e os termos editados pelo editor de formulário compartilhado
 * com os modelos da Configuração.
 *
 * O passo vem depois do Cronograma porque depende dele em três frentes: cada formulário é
 * respondido numa fase dele, a apuração da idade pode ancorar no início ou no fim de uma fase, e
 * os campos que as exigências documentais pressupõem só são conhecidos depois que elas foram
 * declaradas.
 */
@Component({
  selector: 'sel-step-formulario',
  standalone: true,
  imports: [ConfirmDialogComponent, DateBrPipe, EditorDeFormularioComponent, PreVisualizacaoDeFormulariosComponent, ValorEmConsultaComponent],
  templateUrl: './formulario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(FormularioStepComponent),
    // A condição sobre município — o impedimento do campo de município, inclusive — escolhe o
    // valor pela busca no Geo.
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
})
export class FormularioStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly termosApi = inject(TermosConsentimentoApi);
  private readonly modelosApi = inject(ModelosFormularioApi);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly ancoras = ANCORAS_DA_IDADE;

  readonly catalogo = signal<readonly FatoCandidatoView[]>([]);
  readonly catalogoCarregando = signal(true);
  readonly catalogoErro = signal<string | null>(null);

  readonly termosDisponiveis = signal<readonly TermoDisponivel[]>([]);
  readonly termosComErro = signal(false);

  /** As recusas da última gravação, por finalidade, distribuídas contra o conteúdo ENVIADO — sem os dados básicos. */
  readonly recusas = signal<ReadonlyMap<string, RecusasDoConteudo>>(new Map());
  /** A recusa da remoção, por finalidade: fica na aba do formulário que não saiu. */
  readonly recusasDaRemocao = signal<ReadonlyMap<string, string>>(new Map());

  /** A finalidade da aba escolhida; a inscrição quando a escolhida deixou de existir. */
  private readonly abaEscolhida = signal(FINALIDADE_INSCRICAO);
  readonly finalidadeAAcrescentar = signal('');
  /** A finalidade cuja remoção aguarda confirmação. */
  readonly remocaoPendente = signal<string | null>(null);
  /** O que o leitor de tela ouve depois de acrescentar ou remover um formulário, ou de aplicar um modelo. */
  readonly anuncio = signal('');

  /** Os modelos ativos que servem ao tipo do processo, por finalidade. */
  readonly modelos = signal<ReadonlyMap<string, readonly ModeloOferecido[]>>(new Map());
  readonly modelosCarregando = signal(false);
  readonly modelosErro = signal<string | null>(null);
  /** O modelo escolhido em cada aba, pelo id. */
  readonly modelosEscolhidos = signal<ReadonlyMap<string, string>>(new Map());
  /** A aplicação que aguarda confirmação: a finalidade e o modelo. */
  readonly aplicacaoPendente = signal<{ readonly finalidade: string; readonly modelo: ModeloOferecido } | null>(null);
  /** O resumo da última aplicação, por finalidade: fica na aba do formulário que a recebeu. */
  readonly resumosDaAplicacao = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  /** A recusa da aplicação, por finalidade, já com o desfecho dito: fica na aba do formulário. */
  readonly recusasDaAplicacao = signal<ReadonlyMap<string, string>>(new Map());
  /** As abas cuja recusa só diz que outra cópia está sem desfecho: saem quando ela se resolve. */
  private readonly bloqueadasPorCopiaEmAberto = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.carregarCatalogo();
    this.carregarTermos();

    // Reconcilia a cada mudança do que cita fatos no processo, e não só quando o catálogo
    // responde. Os passos do wizard ficam todos montados, então "abrir o passo" não executa nada:
    // sem este efeito, o campo que um gatilho trouxe sobrevivia à remoção desse gatilho pelo resto
    // da sessão — inclusive o que o passo do cronograma acrescenta, já que aquele caminho só
    // acrescenta. Sobra dado pessoal no formulário sem nada que o justifique.
    effect(() => {
      this.citantes();
      if (this.catalogo().length > 0) untracked(() => this.reconciliar());
    });

    // O componente sobrevive à troca de processo na mesma rota: o que ele guarda de um processo —
    // confirmação pendente, escolhas, recusas e resumos — não pode valer para o seguinte.
    effect(() => {
      this.store.geracao();
      untracked(() => this.esquecerOProcessoAnterior());
    });

    // Os modelos só servem para editar, e dependem do tipo, que o passo 1 escolhe.
    effect(() => {
      if (this.store.emConsulta() || this.tipoDoProcesso() === '') return;
      untracked(() => this.carregarModelos());
    });
  }

  /** Sem cópia em aberto, a recusa das abas bloqueadas por ela não vale mais. */
  private esquecerBloqueios(): void {
    const bloqueadas = this.bloqueadasPorCopiaEmAberto();
    this.recusasDaAplicacao.update((atuais) => new Map([...atuais].filter(([aba]) => !bloqueadas.has(aba))));
    this.bloqueadasPorCopiaEmAberto.set(new Set());
  }

  private esquecerOProcessoAnterior(): void {
    this.bloqueadasPorCopiaEmAberto.set(new Set());
    this.remocaoPendente.set(null);
    this.aplicacaoPendente.set(null);
    this.modelosEscolhidos.set(new Map());
    this.resumosDaAplicacao.set(new Map());
    this.recusasDaAplicacao.set(new Map());
    this.recusasDaRemocao.set(new Map());
    this.recusas.set(new Map());
  }

  /** O código do tipo do processo — o que filtra os modelos oferecidos. */
  private readonly tipoDoProcesso = computed(() => this.store.draft().tipoProcesso.codigo);

  /**
   * Busca os modelos ativos que servem ao tipo do processo. Exposto porque a tela oferece nova
   * tentativa, como no catálogo.
   */
  carregarModelos(): void {
    const tipo = this.tipoDoProcesso();
    this.modelosCarregando.set(true);
    this.modelosErro.set(null);
    this.modelosApi
      .listar({ tipoProcesso: tipo, ativo: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        // A resposta de um tipo já trocado chegaria por cima da do tipo atual.
        if (tipo !== this.tipoDoProcesso()) return;
        this.modelosCarregando.set(false);
        if (!isApiOk(resultado)) {
          this.modelosErro.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.modelos.set(modelosPorFinalidade(resultado.data));
      });
  }

  /**
   * Busca o vocabulário de fatos. Exposto porque a tela oferece nova tentativa: sem ela, uma falha
   * passageira deixava o catálogo vazio pelo resto da sessão, e não havia como acrescentar campo.
   */
  carregarCatalogo(): void {
    this.catalogoCarregando.set(true);
    this.catalogoErro.set(null);
    this.fatosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.catalogoCarregando.set(false);
        if (!isApiOk(resultado)) {
          this.catalogoErro.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.catalogo.set(resultado.data);
      });
  }

  /** Os termos de consentimento com as versões promovidas, que o formulário pode exigir. */
  carregarTermos(): void {
    this.termosComErro.set(false);
    this.termosApi
      .listarComVersoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((termos) => {
        if (!termos.ok) {
          this.termosComErro.set(true);
          return;
        }
        this.termosDisponiveis.set(termos.data.map(termoDisponivelDe));
      });
  }

  /** Os formulários do rascunho, a inscrição primeiro. */
  readonly formularios = computed(() => formulariosDoRascunho(this.store.draft().formulario));

  readonly conteudo = computed(() => this.store.draft().formulario.conteudo);

  /**
   * O processo como o servidor o tem, da última leitura: a hidratação ou a releitura de uma
   * gravação, aplicação ou remoção deste passo.
   */
  private readonly processoLido = linkedSignal(() => this.store.remoteSnapshot());

  /**
   * Os formulários que a pré-visualização do processo pergunta e cujo resultado mostra: os
   * gravados, porque é o processo gravado que a API avalia — os do rascunho perguntariam o que ela
   * não vê e rotulariam o resultado com o que ela não tem.
   */
  readonly formulariosParaSimular = computed<readonly FormularioParaSimular[]>(() =>
    emOrdemDasFinalidades(this.processoLido()?.formularios ?? []).map((formulario) => ({
      finalidade: formulario.finalidade,
      nome: nomeDaFinalidade(formulario.finalidade),
      conteudo: conteudoDoFormulario(formulario),
    })),
  );

  /** Há alteração nos formulários ainda não gravada: a pré-visualização não a veria. */
  readonly previaDesatualizada = computed(() => rascunhoDifereDoGravado(this.processoLido()?.formularios ?? [], this.formularios()));

  /** Relê o processo e guarda a leitura, quando ela ainda é do processo em edição. */
  private async lerProcesso(processoId: string) {
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (isApiOk(detalhe) && detalhe.data.id === this.store.processoSeletivoId()) this.processoLido.set(detalhe.data);
    return detalhe;
  }

  /**
   * A pré-visualização do processo, com as ocorrências simuladas dos grupos repetíveis e os
   * documentos exigidos. A API avalia a configuração viva do processo que está no servidor, e não a
   * da tela: os formulários, as derivações e as exigências juntos, e o que foi alterado em qualquer
   * passo só entra depois de gravado. Os documentos são nomeados pelo processo lido. Nula antes de o processo existir no servidor e em consulta, em que o
   * passo mostra o gravado como texto e não há configuração em edição a conferir.
   */
  readonly avaliarProcesso = computed<AvaliacaoDeFormularios | null>(() => {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.store.emConsulta()) return null;
    return (simulacao) =>
      this.api
        .preVisualizar(processoId, simulacao)
        .pipe(
          map((resultado) =>
            resultado.ok
              ? { ...resultado, data: resultadoDoProcesso(resultado.data, this.processoLido(), this.catalogos.fasePorId()) }
              : resultado,
          ),
        );
  });

  readonly abaAtiva = computed(() => {
    const escolhida = this.abaEscolhida();
    return this.formularios().some((formulario) => formulario.finalidade === escolhida) ? escolhida : FINALIDADE_INSCRICAO;
  });

  /** As fases do cronograma, com o que decide a finalidade que cada uma atende. */
  private readonly fasesDoCronograma = computed(() => {
    const fasePorId = this.catalogos.fasePorId();
    return this.store.draft().cronograma.fases.map((fase) => {
      const descricao = descreverFase(fase, fasePorId);
      return {
        codigo: fase.codigo,
        nome: descricao.nome,
        coletaInscricao: descricao.coletaInscricao,
        coletaSolicitacaoIsencao: descricao.coletaSolicitacaoIsencao,
      };
    });
  });

  /**
   * A fase de cada formulário: a escolhida, enquanto estiver entre as que servem à finalidade, ou
   * a única que serve. A API recusa fase de outra finalidade, e enviar a fase nula apagaria a
   * gravada — a publicação recusa formulário sem fase.
   */
  private readonly fasesDosFormularios = computed(
    () =>
      new Map(
        this.formularios().map((formulario) => {
          const opcoes = this.fasesDoCronograma().filter((fase) => faseServeAFinalidade(formulario.finalidade, fase));
          return [formulario.finalidade, { opcoes, escolhida: faseEfetiva(formulario.faseCodigo, opcoes) }] as const;
        }),
      ),
  );

  readonly faseDaInscricao = computed(() => this.fasesDosFormularios().get(FINALIDADE_INSCRICAO)?.escolhida ?? '');

  /** As finalidades que o operador pode acrescentar agora. */
  readonly finalidadesOferecidas = computed(() =>
    finalidadesParaAcrescentar(
      this.formularios().map((formulario) => formulario.finalidade),
      this.store.draft().pagamento.cobra === true,
      this.fasesDoCronograma(),
    ),
  );

  /** Os fatos que a inscrição coleta, o conjunto básico ainda não gravado inclusive: as outras finalidades os citam. */
  private readonly fatosDaInscricao = computed(() => [...fatosColetadosPelaInscricao(this.conteudo())]);

  /** Quem, no processo, cita cada fato — a fonte única do que entra sozinho e do que não sai. */
  readonly citantes = computed(() => {
    const draft = this.store.draft();
    const tipoDocumento = this.catalogos.tipoDocumentoPorId();
    const nomeDoFato = new Map(this.catalogo().map((fato) => [fato.codigo, fato.nome]));
    return quemCitaNoProcesso(
      {
        documentos: draft.documentos,
        derivacao: draft.formulario.derivacao,
        desempate: draft.desempate,
        outrasFinalidades: draft.formulario.outrasFinalidades,
      },
      {
        documento: (id) => tipoDocumento.get(id)?.nome ?? id,
        fato: (codigo) => nomeDoFato.get(codigo) ?? codigo,
      },
    );
  });

  readonly remocoesTravadas = computed(() => remocoesTravadasPor(this.citantes()));

  /** Abas só quando há entre o que navegar: com um formulário só, o painel basta. */
  readonly comAbas = computed(() => this.abas().length > 1);

  /**
   * Uma aba por formulário, com o que o editor dela recebe. Na inscrição, o combo deixa de fora o
   * que as outras finalidades coletam, e os fatos que elas citam por negação são obrigatórios. Nas
   * outras, os fatos da inscrição são citáveis — o candidato já os respondeu — e nunca coletados de
   * novo.
   */
  readonly abas = computed(() => {
    const formularios = this.formularios();
    const outras = this.store.draft().formulario.outrasFinalidades;
    const fases = this.fasesDosFormularios();
    return formularios.map((formulario) => {
      const ehInscricao = formulario.finalidade === FINALIDADE_INSCRICAO;
      const sufixo = sufixoDaFinalidade(formulario.finalidade);
      const fase = fases.get(formulario.finalidade) ?? { opcoes: [], escolhida: '' };
      const recusaDaRemocao = this.recusasDaRemocao().get(formulario.finalidade) ?? null;
      const recusaDaAplicacao = this.recusasDaAplicacao().get(formulario.finalidade) ?? null;
      return {
        finalidade: formulario.finalidade,
        rotulo: FINALIDADES.find((opcao) => opcao.valor === formulario.finalidade)?.rotulo ?? formulario.finalidade,
        nome: nomeDaFinalidade(formulario.finalidade),
        ehInscricao,
        aba: `form-aba-${sufixo}`,
        painel: `form-painel-${sufixo}`,
        idBase: `form-${sufixo}`,
        campoDaFase: `form-fase-${sufixo}`,
        conteudo: formulario.conteudo,
        fases: fase.opcoes,
        fase: fase.escolhida,
        nomeDaFase: fase.opcoes.find((opcao) => opcao.codigo === fase.escolhida)?.nome ?? null,
        recusas: this.recusas().get(formulario.finalidade) ?? null,
        recusaDaRemocao,
        recusada: this.recusas().has(formulario.finalidade) || recusaDaRemocao !== null || recusaDaAplicacao !== null,
        modelos: this.modelos().get(formulario.finalidade) ?? [],
        modeloEscolhido: this.modelosEscolhidos().get(formulario.finalidade) ?? '',
        modeloOrigemCodigo: formulario.modeloOrigemCodigo ?? null,
        recusaDaAplicacao,
        resumoDaAplicacao: this.resumosDaAplicacao().get(formulario.finalidade) ?? null,
        fatosDaInscricao: ehInscricao ? null : this.fatosDaInscricao(),
        fatosIndisponiveis: ehInscricao
          ? fatosForaDaColetaDaInscricao(formulario.conteudo, fatosColetadosPelasOutras(formularios, FINALIDADE_INSCRICAO))
          : fatosColetadosPelasOutras(formularios, formulario.finalidade),
        fatosQueExigemRespostaPorFora: ehInscricao ? fatosDaInscricaoQueOutrasExigem(formulario.conteudo, outras) : [],
        leitura: leituraDe(formulario.conteudo),
      };
    });
  });

  selecionarAba(finalidade: string): void {
    this.abaEscolhida.set(finalidade);
  }

  /** Setas, Home e End trocam de aba e levam o foco a ela: só a aba ativa entra na ordem do Tab. */
  navegarNasAbas(evento: KeyboardEvent, indice: number): void {
    const abas = this.abas();
    const destino = abaPelaTecla(evento.key, indice, abas.length);
    if (destino === null) return;
    evento.preventDefault();
    this.selecionarAba(abas[destino].finalidade);
    document.getElementById(abas[destino].aba)?.focus();
  }

  /**
   * Põe no formulário de inscrição o que o processo pressupõe e tira o que nada cita mais. Roda a
   * cada mudança das exigências, da derivação, do desempate e dos formulários das outras
   * finalidades: são declarados noutros lugares, e o operador não deveria precisar lembrar que
   * mudá-los mexe aqui.
   */
  reconciliar(): readonly string[] {
    const formulario = this.store.draft().formulario;
    const antes = new Set(fatosColetadosPor(formulario.conteudo));
    const reconciliado = comCamposQueAsExigenciasPressupoem(
      formulario.conteudo,
      new Set(this.citantes().keys()),
      this.catalogo(),
      this.store.camposPostosPelasExigencias(),
      fatosColetadosPelasOutras(this.formularios(), FINALIDADE_INSCRICAO),
    );
    if (reconciliado === formulario.conteudo) return [];

    // Registra o que ENTROU agora: é esse conjunto que a reconciliação seguinte pode remover
    // quando a exigência que o pediu deixar de existir.
    const acrescentados = fatosColetadosPor(reconciliado).filter((codigo) => !antes.has(codigo));
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update((atual) => new Set([...atual, ...acrescentados]));
    }
    this.store.patchSection('formulario', { ...formulario, conteudo: reconciliado });
    return acrescentados;
  }

  /**
   * A edição feita no editor de uma aba. Na inscrição, o campo que o operador tira deixa de ser
   * "posto pela exigência": se voltar, voltou por decisão dele.
   */
  editar(finalidade: string, conteudo: ConteudoDoFormulario): void {
    if (finalidade === FINALIDADE_INSCRICAO) {
      const presentes = new Set(fatosColetadosPor(conteudo));
      this.store.camposPostosPelasExigencias.update((atual) => new Set([...atual].filter((codigo) => presentes.has(codigo))));
    }
    this.atualizarFormulario(finalidade, (formulario) => ({ ...formulario, conteudo }));
  }

  escreverFase(finalidade: string, codigo: string): void {
    this.atualizarFormulario(finalidade, (formulario) => ({ ...formulario, faseCodigo: codigo }));
  }

  private atualizarFormulario(finalidade: string, mudar: (formulario: FormularioDaFinalidade) => FormularioDaFinalidade): void {
    const atual = this.formularios().find((formulario) => formulario.finalidade === finalidade);
    if (atual === undefined) return;
    this.store.patchSection('formulario', comFormulario(this.store.draft().formulario, mudar(atual)));
  }

  /**
   * Acrescenta o formulário da finalidade escolhida com a revisão e aceite, que toda finalidade
   * exige como última etapa. Ele é criado no servidor quando o passo for gravado. A aba nova recebe
   * o foco, e o leitor de tela ouve o que aconteceu.
   */
  acrescentarFinalidade(): void {
    const finalidade = this.finalidadeAAcrescentar();
    if (!this.finalidadesOferecidas().some((opcao) => opcao.valor === finalidade)) return;

    this.store.patchSection(
      'formulario',
      comFormulario(this.store.draft().formulario, { finalidade, faseCodigo: '', conteudo: conteudoInicial() }),
    );
    this.finalidadeAAcrescentar.set('');
    this.selecionarAba(finalidade);
    this.anuncio.set(`Formulário de ${nomeDaFinalidade(finalidade)} acrescentado. Ele é criado no processo ao gravar o passo.`);
    this.focarAba(finalidade);
  }

  pedirRemocao(finalidade: string): void {
    if (finalidade === FINALIDADE_INSCRICAO) return;
    this.remocaoPendente.set(finalidade);
  }

  readonly avisoDaRemocao = computed(() => {
    const finalidade = this.remocaoPendente();
    return finalidade === null
      ? ''
      : `O formulário de ${nomeDaFinalidade(finalidade)} sai do processo com as etapas, os campos e os termos dele. Não há como desfazer.`;
  });

  cancelarRemocao(): void {
    this.remocaoPendente.set(null);
  }

  /**
   * Remove o formulário confirmado. O que já está no servidor sai pela API na hora — a remoção não
   * espera a gravação do passo —, e o que só existe no rascunho sai dele. A recusa fica em texto na
   * aba, que continua; depois da remoção, o foco vai à aba da inscrição.
   */
  async confirmarRemocao(): Promise<void> {
    const finalidade = this.remocaoPendente();
    this.remocaoPendente.set(null);
    if (finalidade === null || finalidade === FINALIDADE_INSCRICAO) return;
    this.recusasDaRemocao.update((atuais) => semChave(atuais, finalidade));

    const processoId = this.store.processoSeletivoId();
    if (processoId !== null) {
      const geracao = this.store.geracao();
      // Trava avançar, gravar e editar: um PUT da aba chegando depois do DELETE recriaria o formulário.
      this.store.salvando.set(true);
      let recusa: string | null;
      try {
        recusa = await this.removerDoServidor(processoId, finalidade);
      } finally {
        if (geracao === this.store.geracao()) this.store.salvando.set(false);
      }
      if (geracao !== this.store.geracao()) return;
      if (recusa !== null) {
        this.recusasDaRemocao.update((atuais) => new Map([...atuais, [finalidade, recusa]]));
        this.anuncio.set(`O formulário de ${nomeDaFinalidade(finalidade)} não foi removido. ${recusa}`);
        return;
      }
    }

    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      outrasFinalidades: formulario.outrasFinalidades.filter((outro) => outro.finalidade !== finalidade),
    });
    this.recusas.update((atuais) => semChave(atuais, finalidade));
    this.selecionarAba(FINALIDADE_INSCRICAO);
    this.anuncio.set(`Formulário de ${nomeDaFinalidade(finalidade)} removido.`);
    this.focarAba(FINALIDADE_INSCRICAO);
  }

  /**
   * Tira o formulário do servidor, quando ele está lá. Devolve a recusa a mostrar, ou nulo quando
   * o formulário não está mais no processo — inclusive o que nunca foi gravado.
   */
  private async removerDoServidor(processoId: string, finalidade: string): Promise<string | null> {
    const detalhe = await this.lerProcesso(processoId);
    if (!isApiOk(detalhe)) return 'Não foi possível reler o processo para remover o formulário. Tente de novo.';
    if (formularioDaFinalidade(detalhe.data.formularios, finalidade) === null) return null;

    const remocao = await this.cadastro.removerFormulario(processoId, finalidade);
    if (remocao.ok) {
      // A leitura guardada é de antes do DELETE: sem o formulário removido, ela volta a ser o gravado.
      this.processoLido.update((lido) => (lido === null ? lido : { ...lido, formularios: lido.formularios.filter((f) => f.finalidade !== finalidade) }));
      return null;
    }
    return this.textoDaRecusa(remocao.problem);
  }

  escolherModelo(finalidade: string, modeloId: string): void {
    this.modelosEscolhidos.update((atuais) => new Map([...atuais, [finalidade, modeloId]]));
  }

  pedirAplicacao(finalidade: string): void {
    const escolhido = this.modelosEscolhidos().get(finalidade);
    const modelo = this.modelos().get(finalidade)?.find((oferecido) => oferecido.id === escolhido);
    if (modelo === undefined) return;
    // Uma aplicação sem desfecho, em qualquer aba, só admite a nova tentativa dela: as cópias
    // mexem no que é do processo inteiro (fatos da inscrição, derivações) e dividem a mesma chave.
    const bloqueio = [...this.store.aplicacoesDeModeloEmAberto()].find(
      ([outra, emAberto]) => emAberto.copiaConfirmada || outra !== finalidade || emAberto.modeloId !== modelo.id,
    );
    if (bloqueio !== undefined) {
      const [outra, emAberto] = bloqueio;
      this.mostrarRecusaDaAplicacao(finalidade, textoDaAplicacaoEmAberto(nomeDaFinalidade(outra), emAberto));
      this.bloqueadasPorCopiaEmAberto.update((atuais) => new Set([...atuais, finalidade]));
      return;
    }
    this.aplicacaoPendente.set({ finalidade, modelo });
  }

  private mostrarRecusaDaAplicacao(finalidade: string, texto: string): void {
    this.recusasDaAplicacao.update((atuais) => new Map([...atuais, [finalidade, texto]]));
    this.anuncio.set(texto);
  }

  cancelarAplicacao(): void {
    this.aplicacaoPendente.set(null);
  }

  /** O que a confirmação diz antes de substituir: o formulário sai inteiro, com o que não foi gravado. */
  readonly avisoDaAplicacao = computed(() => {
    const pendente = this.aplicacaoPendente();
    if (pendente === null) return '';
    const inscricao =
      pendente.finalidade === FINALIDADE_INSCRICAO
        ? ' Os campos do modelo que outro formulário coleta passam para a inscrição, e esse formulário volta ao que está gravado no processo.'
        : '';
    return (
      `O formulário de ${nomeDaFinalidade(pendente.finalidade)} passa a ser a cópia do modelo "${pendente.modelo.nome}": ` +
      `as etapas, os campos e os termos que ele tem agora saem, inclusive as edições desta aba ainda não gravadas.${inscricao} Não há como desfazer.`
    );
  });

  /**
   * Aplica o modelo confirmado. A aplicação vai à API na hora — não espera a gravação do passo — e
   * trava o passo enquanto está no ar: um PUT da aba chegando depois substituiria a cópia pelo que
   * estava na tela. Depois, o rascunho recebe o que o servidor ficou tendo, e a reconciliação
   * devolve ao formulário o que o processo pressupõe e o modelo não trazia — a cópia não confere as
   * exigências. O resumo e a recusa ficam em texto na aba.
   */
  async confirmarAplicacao(): Promise<void> {
    const pendente = this.aplicacaoPendente();
    this.aplicacaoPendente.set(null);
    const processoId = this.store.processoSeletivoId();
    if (pendente === null || processoId === null) return;
    const { finalidade, modelo } = pendente;
    const faseDaAba = this.fasesDosFormularios().get(finalidade)?.escolhida ?? '';
    this.recusasDaAplicacao.update((atuais) => semChave(atuais, finalidade));
    this.bloqueadasPorCopiaEmAberto.update((atuais) => new Set([...atuais].filter((aba) => aba !== finalidade)));
    this.resumosDaAplicacao.update((atuais) => semChave(atuais, finalidade));

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    let desfecho: DesfechoDaAplicacao;
    try {
      desfecho = await this.aplicarNoServidor(processoId, finalidade, modelo.id, faseDaAba);
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
    if (geracao !== this.store.geracao()) return;

    if (desfecho.ok) {
      this.store.aplicacoesDeModeloEmAberto.update((atuais) => semChave(atuais, finalidade));
      if (this.store.aplicacoesDeModeloEmAberto().size === 0) this.esquecerBloqueios();
    } else if (desfecho.copiaConfirmada !== null) {
      const emAberto = { modeloId: modelo.id, modeloNome: modelo.nome, copiaConfirmada: desfecho.copiaConfirmada };
      this.store.aplicacoesDeModeloEmAberto.update((atuais) => new Map([...atuais, [finalidade, emAberto]]));
    }
    if (!desfecho.ok) {
      // Enquanto houver cópia sem desfecho — desta tentativa ou de uma anterior —, a aba diz o
      // mesmo que a trava do passo: uma recusa nova não desfaz a cópia que pode ter chegado. A
      // recusa da nova tentativa vem antes, para o operador saber o que corrigir.
      const emAberto = this.store.aplicacoesDeModeloEmAberto().get(finalidade);
      const textoEmAberto = emAberto === undefined ? null : textoDaAplicacaoEmAberto(nomeDaFinalidade(finalidade), emAberto);
      const texto =
        textoEmAberto === null
          ? `O modelo não foi aplicado ao formulário de ${nomeDaFinalidade(finalidade)}. ${desfecho.recusa}`
          : desfecho.copiaConfirmada === null
            ? `A nova tentativa foi recusada: ${desfecho.recusa} ${textoEmAberto}`
            : textoEmAberto;
      this.mostrarRecusaDaAplicacao(finalidade, texto);
      return;
    }

    // O que o rascunho marcava como posto pelas exigências era do formulário que saiu: a cópia é
    // decisão do modelo, e só o que a reconciliação acrescentar agora volta a ser dela.
    if (finalidade === FINALIDADE_INSCRICAO) this.store.camposPostosPelasExigencias.set(new Set());
    this.store.projetarSecao('formulario', comAplicacaoDoServidor(this.store.draft().formulario, desfecho.servidor, desfecho.relato, faseDaAba));
    const acrescentados = this.reconciliar();
    this.recusas.update((atuais) => semChave(atuais, finalidade));

    const nomeDoFato = new Map(this.catalogo().map((fato) => [fato.codigo, fato.nome]));
    const resumo = [
      ...resumoDaAplicacao(desfecho.relato, modelo.nome, acrescentados, (codigo) => nomeDoFato.get(codigo) ?? codigo),
      ...(desfecho.avisoDaFase === null ? [] : [desfecho.avisoDaFase]),
    ];
    this.resumosDaAplicacao.update((atuais) => new Map([...atuais, [finalidade, resumo]]));
    this.anuncio.set(resumo.join(' '));
  }

  /**
   * A aplicação no servidor: relê o processo para saber se o formulário existe e com que fase, aplica
   * o modelo, declara a fase quando a cópia ficou sem ela e relê de novo para projetar o resultado.
   * A fase precisa estar no cronograma gravado ANTES da cópia: sem ela, o formulário nasceria sem
   * fase, e a publicação o recusa.
   */
  private async aplicarNoServidor(processoId: string, finalidade: string, modeloId: string, faseDaAba: string): Promise<DesfechoDaAplicacao> {
    const antes = await this.lerProcesso(processoId);
    if (!isApiOk(antes)) return { ok: false, recusa: 'Não foi possível reler o processo para aplicar o modelo. Tente de novo.', copiaConfirmada: null };
    const fase = faseQueAAplicacaoDeclara(formularioDaFinalidade(antes.data.formularios, finalidade), faseDaAba, antes.data.cronogramaFases);
    if (fase.declarar && fase.faseId === null) {
      return {
        ok: false,
        recusa: `O formulário de ${nomeDaFinalidade(finalidade)} precisa de uma fase do cronograma gravado antes de partir de um modelo. Escolha a fase nesta aba; se ela é nova, grave antes o passo Cronograma.`,
        copiaConfirmada: null,
      };
    }

    const aplicacao = await this.cadastro.aplicarModeloDeFormulario(processoId, modeloId);
    if (!aplicacao.ok) return { ok: false, recusa: this.textoDaRecusa(aplicacao.problem), copiaConfirmada: aplicacao.inconclusiva ? false : null };

    const depois = await this.lerProcesso(processoId);
    if (!isApiOk(depois)) {
      return { ok: false, recusa: '', copiaConfirmada: true };
    }

    let avisoDaFase: string | null = null;
    const copiado = formularioDaFinalidade(depois.data.formularios, finalidade);
    if (fase.declarar && copiado !== null) {
      const conteudo = conteudoDoFormulario(copiado);
      const cabecalho = await this.cadastro.gravarFormulario(processoId, finalidade, { faseId: copiado.faseId, conteudo }, { faseId: fase.faseId, conteudo });
      if (!cabecalho.ok) avisoDaFase = `A fase do formulário não foi gravada: ${this.textoDaRecusa(cabecalho.problem)} Grave o passo para declará-la.`;
    }

    return {
      ok: true,
      relato: aplicacao.relato,
      avisoDaFase,
      servidor: {
        formularios: depois.data.formularios,
        cronogramaFases: depois.data.cronogramaFases,
        regrasDerivacao: depois.data.regrasDerivacao.map((config) => ({ codigoFato: config.codigoFato, regras: config.regras })),
      },
    };
  }

  /** A recusa em texto: o título e, quando houver, o detalhe e o que cada erro de validação diz. */
  private textoDaRecusa(problem: ProblemDetails): string {
    const { title, detail } = this.problemI18n.resolve(problem);
    return [title, detail, ...(problem.errors ?? []).map((erro) => erro.message)]
      .filter((parte): parte is string => parte !== undefined && parte !== '')
      .join(' ');
  }

  /**
   * Sem abas — sobrou um formulário só —, o foco vai ao primeiro título do painel dele, que existe
   * sempre: o combo de acrescentar some quando não há finalidade a oferecer.
   */
  private focarAba(finalidade: string): void {
    const sufixo = sufixoDaFinalidade(finalidade);
    afterNextRender(
      () => (document.getElementById(`form-aba-${sufixo}`) ?? document.getElementById(`form-${sufixo}-fase-titulo`))?.focus(),
      { injector: this.injector },
    );
  }

  readonly referencia = computed(() => this.store.draft().formulario.referenciaTemporal);

  /** A âncora da apuração como o seletor a nomeia. */
  readonly rotuloDaAncora = computed(
    () => this.ancoras.find((opcao) => opcao.valor === this.referencia().tipo)?.rotulo ?? null,
  );

  /** Se a apuração da idade precisa de fase — só então o seletor de fase aparece. */
  readonly ancoraEmFase = computed(() => {
    const tipo = this.referencia().tipo;
    return tipo === 'INICIO_FASE' || tipo === 'FIM_FASE';
  });

  /** O desempate por maior idade declarado sem a data de nascimento entre os campos. */
  readonly desempateSemDataDeNascimento = computed(() => {
    if (this.store.emConsulta()) return false;
    const draft = this.store.draft();
    return desempateSemDataDeNascimento(draft.desempate, fatosColetadosPelaInscricao(draft.formulario.conteudo));
  });

  /** O desempate por idoso declarado sem apuração da idade neste formulário. */
  readonly desempateIdosoSemApuracao = computed(() => {
    if (this.store.emConsulta()) return false;
    const draft = this.store.draft();
    return desempateIdosoSemApuracao(draft.desempate, draft.formulario.referenciaTemporal);
  });

  irParaDesempate(): void {
    this.store.goTo(PASSO_DESEMPATE);
  }

  /** Se alguma exigência condiciona por idade — é o que torna a política obrigatória. */
  readonly exigeApuracaoDeIdade = computed(() =>
    fatosCitadosPelasExigencias(this.store.draft().documentos).has('FAIXA_ETARIA'),
  );

  /** As fases do cronograma, para ancorar a apuração da idade. */
  readonly fasesEscolhiveis = computed(() => this.store.draft().cronograma.fases.map((fase) => fase.codigo));

  /**
   * Os campos que nada no certame usa. Existem porque a remoção automática só alcança o que a
   * sessão em curso acrescentou: um campo que entrou ontem por causa de um gatilho sobrevive
   * quando o gatilho é apagado hoje — dado pessoal pedido sem finalidade declarada.
   */
  readonly camposSemUso = computed(() => {
    const draft = this.store.draft();
    return camposSemUsoDeclarado(draft.formulario, draft.documentos, draft.desempate).map((campo) =>
      campo.rotulo.trim() === '' ? campo.fatoCodigo : campo.rotulo,
    );
  });

  escreverReferencia(patch: Partial<{ tipo: string; data: string; faseCodigo: string }>): void {
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      referenciaTemporal: { ...formulario.referenciaTemporal, ...patch },
    });
  }

  /**
   * Os campos que este formulário pergunta e cujos valores escolhíveis saem da oferta de
   * atendimento especializado, declarada no passo anterior. O aviso mora aqui porque é aqui que o
   * operador cria o problema; dizê-lo só na revisão obrigaria a refazer o caminho.
   */
  readonly camposSemValoresOfertados = computed(() => {
    const draft = this.store.draft();
    return camposSemValoresOfertados(draft.formulario, draft.atendimento);
  });

  validate(): StepValidation {
    const draft = this.store.draft();
    const mensagens = [
      ...this.abas()
        .filter((aba) => aba.fase === '')
        .map((aba) => mensagemDaFaseQueFalta(aba.finalidade, aba.fases.length === 0)),
      ...this.abas()
        .filter((aba) => !finalidadeCabeNaCobranca(aba.finalidade, draft.pagamento.cobra === true))
        .map(
          (aba) =>
            `O processo não cobra taxa de inscrição, e o formulário de ${aba.nome} só existe quando há cobrança. Remova o formulário, ou volte a cobrar a taxa em "Pagamento".`,
        ),
      ...[...this.store.aplicacoesDeModeloEmAberto()].map(([finalidade, emAberto]) =>
        textoDaAplicacaoEmAberto(nomeDaFinalidade(finalidade), emAberto),
      ),
      ...problemasDoFormulario(draft.formulario, draft.documentos, new Set(draft.cronograma.fases.map((fase) => fase.codigo))),
      ...this.camposSemValoresOfertados().map(
        (campo) =>
          `O formulário pergunta ${campo} ao candidato, e a oferta de atendimento especializado não declara nenhum valor para escolher. Declare ao menos um em "Atend. especial", ou retire o campo daqui.`,
      ),
    ];

    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: [...mensagens] };
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava os formulários de cada finalidade e a política que ancora a apuração da idade.
   *
   * As fases e os formulários gravados vêm de uma releitura FRESCA: a fase pode ter sido
   * acrescentada nesta sessão, e o plano de gravação compara cada parte com o que o servidor tem —
   * inclusive o que uma tentativa anterior deixou gravado pela metade. As finalidades gravam na
   * ordem em que a API aceita cada uma, e a primeira recusa para a gravação e vai à aba dela.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de declarar os formulários.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const detalhe = await this.lerProcesso(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!isApiOk(detalhe)) {
        return {
          valid: false,
          messages: ['Não foi possível reler o processo para gravar os formulários. Tente gravar de novo.'],
        };
      }

      const faseIdPorCodigo = new Map(detalhe.data.cronogramaFases.map((fase) => [fase.codigo, fase.id] as const));
      const paraEnvio: FormularioParaEnvio[] = [];
      for (const aba of this.abas()) {
        const faseId = faseIdPorCodigo.get(aba.fase);
        if (faseId === undefined) {
          return {
            valid: false,
            messages: [`A fase do formulário de ${aba.nome} ainda não está no cronograma gravado. Grave o passo Cronograma e tente de novo.`],
          };
        }
        paraEnvio.push({ finalidade: aba.finalidade, faseId, conteudo: aba.conteudo });
      }

      const gravados = (finalidade: string) => formularioDaFinalidade(detalhe.data.formularios, finalidade);
      const ordem = ordemDeGravacao(
        paraEnvio.map((formulario) => {
          const gravado = gravados(formulario.finalidade);
          return { finalidade: formulario.finalidade, servidor: gravado === null ? null : conteudoDoFormulario(gravado), desejado: formulario.conteudo };
        }),
      );

      const gravadas: string[] = [];
      for (const finalidade of ordem) {
        const desejado = paraEnvio.find((formulario) => formulario.finalidade === finalidade);
        if (desejado === undefined) continue;
        const gravado = gravados(finalidade);
        const gravacao = await this.cadastro.gravarFormulario(
          processoId,
          finalidade,
          gravado === null ? null : { faseId: gravado.faseId, conteudo: conteudoDoFormulario(gravado) },
          { faseId: desejado.faseId, conteudo: desejado.conteudo },
        );
        if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
        if (!gravacao.ok) {
          const mensagens = this.aplicarRecusa(finalidade, gravacao.problem, desejado.conteudo);
          this.selecionarAba(finalidade);
          await this.reconciliarComOServidor(processoId, geracao, gravadas);
          return { valid: false, messages: [...mensagens] };
        }
        gravadas.push(finalidade);
      }
      this.recusas.set(new Map());

      const temporal = await this.cadastro.definirReferenciaTemporalFatos(
        processoId,
        comoComandoDeReferenciaTemporal(this.store.draft().formulario.referenciaTemporal, faseIdPorCodigo),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!temporal.ok) {
        return {
          valid: false,
          messages: [`Os formulários foram gravados. ${this.problemI18n.resolve(temporal.problem).title}`],
        };
      }

      await this.reconciliarComOServidor(processoId, geracao, null);
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * A recusa que aponta um item, uma etapa, um grupo ou um termo vai para ele no editor da aba; o
   * resto — a do grafo, que só cita o fato na mensagem — volta como mensagem do passo.
   */
  private aplicarRecusa(finalidade: string, problem: ProblemDetails, conteudo: ConteudoDoFormulario): readonly string[] {
    const erros = problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? (problem.errors ?? []) : [];
    if (erros.length === 0) {
      this.recusas.set(new Map());
      return [`O formulário de ${nomeDaFinalidade(finalidade)} não foi gravado. ${this.problemI18n.resolve(problem).title}`];
    }
    const recusas = distribuirRecusas(erros, semDadosBasicos(conteudo));
    this.recusas.set(new Map([[finalidade, recusas]]));
    return recusas.gerais.length > 0
      ? recusas.gerais
      : [`O formulário de ${nomeDaFinalidade(finalidade)} foi recusado: veja os campos marcados na aba dele.`];
  }

  /**
   * Relê o processo e projeta no rascunho o que o servidor tem dos formulários. Depois de gravar
   * tudo, todos — a API repõe os dados básicos e pode deslocar a ordem. Depois de uma recusa, só os
   * que gravaram antes dela: o conteúdo dos outros, na tela, é o que o operador quer, e a próxima
   * tentativa se compara com a releitura que fizer.
   */
  private async reconciliarComOServidor(processoId: string, geracao: number, gravadas: readonly string[] | null): Promise<void> {
    const detalhe = await this.lerProcesso(processoId);
    if (geracao !== this.store.geracao() || !isApiOk(detalhe)) return;
    if (gravadas === null) {
      this.store.projetarSecao('formulario', formulariosDoServidor(detalhe.data));
      return;
    }

    let formulario = this.store.draft().formulario;
    for (const finalidade of gravadas) {
      const servidor = formularioDoServidorNaFinalidade(detalhe.data, finalidade);
      if (servidor !== null) formulario = comFormulario(formulario, servidor);
    }
    this.store.projetarSecao('formulario', formulario);
  }
}

/** O desfecho da aplicação de um modelo: a recusa a mostrar, ou o que o servidor relatou e ficou tendo. */
type DesfechoDaAplicacao =
  /**
   * `copiaConfirmada`: nulo quando a recusa é definitiva e nada foi copiado; `false` quando a cópia
   * pode ter acontecido; `true` quando aconteceu e a releitura falhou.
   */
  | { readonly ok: false; readonly recusa: string; readonly copiaConfirmada: boolean | null }
  | {
      readonly ok: true;
      readonly relato: AplicacaoDeModeloDto;
      readonly servidor: ProcessoAposAplicacao;
      readonly avisoDaFase: string | null;
    };

/** O formulário como texto, para o processo em consulta: cada etapa com os campos e os grupos dela, e se a resposta é obrigatória. */
function leituraDe(conteudo: ConteudoDoFormulario) {
  const resposta = (obrigatoriedade: string | null): string =>
    OBRIGATORIEDADES.find((opcao) => opcao.valor === obrigatoriedade)?.rotulo ?? 'Opcional';
  return etapasEmOrdem(conteudo).map((etapa) => ({
    codigo: etapa.codigo,
    titulo: etapa.titulo,
    entradas: entradasDaSecao(conteudo, etapa.codigo).map((entrada) =>
      entrada.tipo === 'item'
        ? { chave: entrada.item.fatoCodigo, rotulo: entrada.item.rotulo, resposta: resposta(entrada.item.obrigatoriedade) }
        : {
            chave: entrada.grupo.codigo,
            rotulo: entrada.grupo.rotulo,
            resposta: `Grupo repetível — ${resposta(entrada.grupo.obrigatoriedade).toLocaleLowerCase('pt-BR')}`,
          },
    ),
  }));
}

/** Por que o formulário não tem fase: o cronograma não tem a que serve, ou o operador ainda não escolheu entre as que servem. */
function mensagemDaFaseQueFalta(finalidade: string, semFaseQueServe: boolean): string {
  if (finalidade === FINALIDADE_INSCRICAO) {
    return semFaseQueServe
      ? 'O cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição no passo Cronograma.'
      : 'Escolha em que fase do cronograma a inscrição é respondida.';
  }
  return semFaseQueServe
    ? `O cronograma não tem fase em que o formulário de ${nomeDaFinalidade(finalidade)} é respondido. Acrescente a fase no passo Cronograma, ou remova o formulário.`
    : `Escolha em que fase do cronograma o formulário de ${nomeDaFinalidade(finalidade)} é respondido.`;
}

function semChave<V>(mapa: ReadonlyMap<string, V>, chave: string): ReadonlyMap<string, V> {
  return new Map([...mapa].filter(([atual]) => atual !== chave));
}
