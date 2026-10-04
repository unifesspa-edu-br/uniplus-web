import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ProblemI18nService, STATUS_HTTP, isApiOk, type ProblemDetails } from '@uniplus/shared-core/http';
import { FatoCandidatoView, FatosCandidatoApi, TermosConsentimentoApi } from '@uniplus/shared-data/configuracao';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import {
  EditorDeFormularioComponent,
  FINALIDADE_INSCRICAO,
  OBRIGATORIEDADES,
  ValorEmConsultaComponent,
  distribuirRecusas,
  entradasDaSecao,
  etapasEmOrdem,
  semDadosBasicos,
  termoDisponivelDe,
  type ConteudoDoFormulario,
  type RecusasDoConteudo,
  type TermoDisponivel,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import type { StepValidation } from '../../processo-seletivo.models';
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
import { conteudoDoFormulario, fatosColetadosPor, formularioDaFinalidade, inscricaoDoServidor } from './formulario-do-processo';

/**
 * Formulário de inscrição — as etapas, os campos e os termos que o candidato responde ao se
 * inscrever, editados pelo editor de formulário compartilhado com os modelos da Configuração.
 *
 * O passo vem depois do Cronograma porque depende dele em três frentes: a inscrição é respondida
 * numa fase dele, a apuração da idade pode ancorar no início ou no fim de uma fase, e os campos
 * que as exigências documentais pressupõem só são conhecidos depois que elas foram declaradas.
 */
@Component({
  selector: 'sel-step-formulario',
  standalone: true,
  imports: [DateBrPipe, EditorDeFormularioComponent, ValorEmConsultaComponent],
  templateUrl: './formulario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(FormularioStepComponent)],
})
export class FormularioStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly termosApi = inject(TermosConsentimentoApi);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly finalidade = FINALIDADE_INSCRICAO;
  protected readonly ancoras = ANCORAS_DA_IDADE;

  readonly catalogo = signal<readonly FatoCandidatoView[]>([]);
  readonly catalogoCarregando = signal(true);
  readonly catalogoErro = signal<string | null>(null);

  readonly termosDisponiveis = signal<readonly TermoDisponivel[]>([]);
  readonly termosComErro = signal(false);

  /** As recusas da última gravação, distribuídas contra o conteúdo ENVIADO — sem os dados básicos. */
  readonly recusas = signal<RecusasDoConteudo | null>(null);

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

  readonly conteudo = computed(() => this.store.draft().formulario.conteudo);

  /**
   * O formulário como texto, para o processo em consulta: cada etapa com os campos e os grupos
   * dela, e se a resposta é obrigatória. Em consulta os passos mostram o gravado, não um
   * formulário desabilitado.
   */
  readonly leitura = computed(() => {
    const conteudo = this.conteudo();
    const resposta = (obrigatoriedade: string | null): string =>
      OBRIGATORIEDADES.find((opcao) => opcao.valor === obrigatoriedade)?.rotulo ?? 'Opcional';
    return etapasEmOrdem(conteudo).map((etapa) => ({
      codigo: etapa.codigo,
      titulo: etapa.titulo,
      entradas: entradasDaSecao(conteudo, etapa.codigo).map((entrada) =>
        entrada.tipo === 'item'
          ? { chave: entrada.item.fatoCodigo, rotulo: entrada.item.rotulo, resposta: resposta(entrada.item.obrigatoriedade) }
          : { chave: entrada.grupo.codigo, rotulo: entrada.grupo.rotulo, resposta: `Grupo repetível — ${resposta(entrada.grupo.obrigatoriedade).toLocaleLowerCase('pt-BR')}` },
      ),
    }));
  });

  /** Os fatos fora do combo de campos: os das outras finalidades e o conjunto básico ainda não gravado. */
  readonly fatosIndisponiveis = computed(() => {
    const formulario = this.store.draft().formulario;
    return fatosForaDaColetaDaInscricao(formulario.conteudo, formulario.fatosDasOutrasFinalidades);
  });

  /** Quem, no processo, cita cada fato — a fonte única do que entra sozinho e do que não sai. */
  readonly citantes = computed(() => {
    const draft = this.store.draft();
    const tipoDocumento = this.catalogos.tipoDocumentoPorId();
    const nomeDoFato = new Map(this.catalogo().map((fato) => [fato.codigo, fato.nome]));
    return quemCitaNoProcesso(
      { documentos: draft.documentos, derivacao: draft.formulario.derivacao, desempate: draft.desempate },
      {
        documento: (id) => tipoDocumento.get(id)?.nome ?? id,
        fato: (codigo) => nomeDoFato.get(codigo) ?? codigo,
      },
    );
  });

  readonly remocoesTravadas = computed(() => remocoesTravadasPor(this.citantes()));

  /**
   * Põe no formulário o que o processo pressupõe e tira o que nada cita mais. Roda a cada mudança
   * das exigências, da derivação e do desempate: são declarados noutros passos, e o operador não
   * deveria precisar lembrar que mudá-los mexe aqui.
   */
  reconciliar(): void {
    const formulario = this.store.draft().formulario;
    const antes = new Set(fatosColetadosPor(formulario.conteudo));
    const reconciliado = comCamposQueAsExigenciasPressupoem(
      formulario.conteudo,
      new Set(this.citantes().keys()),
      this.catalogo(),
      this.store.camposPostosPelasExigencias(),
      formulario.fatosDasOutrasFinalidades,
    );
    if (reconciliado === formulario.conteudo) return;

    // Registra o que ENTROU agora: é esse conjunto que a reconciliação seguinte pode remover
    // quando a exigência que o pediu deixar de existir.
    const acrescentados = fatosColetadosPor(reconciliado).filter((codigo) => !antes.has(codigo));
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update((atual) => new Set([...atual, ...acrescentados]));
    }
    this.store.patchSection('formulario', { ...formulario, conteudo: reconciliado });
  }

  /**
   * A edição feita no editor. O campo que o operador tira deixa de ser "posto pela exigência": se
   * voltar, voltou por decisão dele.
   */
  editar(conteudo: ConteudoDoFormulario): void {
    const presentes = new Set(fatosColetadosPor(conteudo));
    this.store.camposPostosPelasExigencias.update((atual) => new Set([...atual].filter((codigo) => presentes.has(codigo))));
    this.store.patchSection('formulario', { ...this.store.draft().formulario, conteudo });
  }

  /** As fases do cronograma em que a inscrição pode ser respondida: as que coletam inscrição. */
  readonly fasesDaInscricao = computed(() => {
    const fasePorId = this.catalogos.fasePorId();
    return this.store
      .draft()
      .cronograma.fases.map((fase) => ({ fase, descricao: descreverFase(fase, fasePorId) }))
      .filter(({ descricao }) => descricao.coletaInscricao)
      .map(({ fase, descricao }) => ({ codigo: fase.codigo, nome: descricao.nome }));
  });

  /**
   * A fase em que a inscrição é respondida: a escolhida, enquanto estiver entre as que servem, ou
   * a única que serve. A API recusa fase que não coleta inscrição, e enviar a fase nula apagaria a
   * gravada — a publicação recusa formulário sem fase.
   */
  readonly faseDaInscricao = computed(() => {
    const opcoes = this.fasesDaInscricao();
    const escolhida = this.store.draft().formulario.faseCodigo;
    if (opcoes.some((opcao) => opcao.codigo === escolhida)) return escolhida;
    return opcoes.length === 1 ? opcoes[0].codigo : '';
  });

  readonly nomeDaFaseDaInscricao = computed(
    () => this.fasesDaInscricao().find((opcao) => opcao.codigo === this.faseDaInscricao())?.nome ?? null,
  );

  escreverFase(codigo: string): void {
    this.store.patchSection('formulario', { ...this.store.draft().formulario, faseCodigo: codigo });
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
      ...(this.faseDaInscricao() === ''
        ? [
            this.fasesDaInscricao().length === 0
              ? 'O cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição no passo Cronograma.'
              : 'Escolha em que fase do cronograma a inscrição é respondida.',
          ]
        : []),
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
   * Grava o formulário de inscrição e a política que ancora a apuração da idade.
   *
   * A fase e o formulário gravado vêm de uma releitura FRESCA: a fase pode ter sido acrescentada
   * nesta sessão, e o plano de gravação compara cada parte com o que o servidor tem — inclusive o
   * que uma tentativa anterior deixou gravado pela metade.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de declarar o formulário.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const detalhe = await firstValueFrom(this.api.obter(processoId));
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!isApiOk(detalhe)) {
        return {
          valid: false,
          messages: ['Não foi possível reler o processo para gravar o formulário de inscrição. Tente gravar de novo.'],
        };
      }

      const faseIdPorCodigo = new Map(detalhe.data.cronogramaFases.map((fase) => [fase.codigo, fase.id] as const));
      const faseId = faseIdPorCodigo.get(this.faseDaInscricao());
      if (faseId === undefined) {
        return {
          valid: false,
          messages: ['A fase da inscrição ainda não está no cronograma gravado. Grave o passo Cronograma e tente de novo.'],
        };
      }

      const formulario = this.store.draft().formulario;
      const gravado = formularioDaFinalidade(detalhe.data.formularios, FINALIDADE_INSCRICAO);
      const gravacao = await this.cadastro.gravarFormulario(
        processoId,
        FINALIDADE_INSCRICAO,
        gravado === null ? null : { faseId: gravado.faseId, conteudo: conteudoDoFormulario(gravado) },
        { faseId, conteudo: formulario.conteudo },
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacao.ok) {
        const mensagens = this.aplicarRecusa(gravacao.problem, formulario.conteudo);
        await this.reconciliarComOServidor(processoId, geracao, false);
        return { valid: false, messages: [...mensagens] };
      }
      this.recusas.set(null);

      const temporal = await this.cadastro.definirReferenciaTemporalFatos(
        processoId,
        comoComandoDeReferenciaTemporal(formulario.referenciaTemporal, faseIdPorCodigo),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!temporal.ok) {
        return {
          valid: false,
          messages: [`O formulário de inscrição foi gravado. ${this.problemI18n.resolve(temporal.problem).title}`],
        };
      }

      await this.reconciliarComOServidor(processoId, geracao, true);
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * A recusa que aponta um item, uma etapa, um grupo ou um termo vai para ele no editor; o resto —
   * a do grafo, que só cita o fato na mensagem — volta como mensagem do passo.
   */
  private aplicarRecusa(problem: ProblemDetails, conteudo: ConteudoDoFormulario): readonly string[] {
    const erros = problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? (problem.errors ?? []) : [];
    if (erros.length === 0) {
      this.recusas.set(null);
      return [this.problemI18n.resolve(problem).title];
    }
    const recusas = distribuirRecusas(erros, semDadosBasicos(conteudo));
    this.recusas.set(recusas);
    return recusas.gerais.length > 0 ? recusas.gerais : ['O formulário de inscrição foi recusado: veja os campos marcados no editor.'];
  }

  /**
   * Relê o processo e projeta no rascunho o que o servidor tem do formulário. Depois de gravar, o
   * conteúdo inteiro — a API repõe os dados básicos e pode deslocar a ordem. Depois de uma recusa,
   * só os fatos das outras finalidades: o conteúdo na tela é o que o operador quer, e a próxima
   * tentativa se compara com a releitura que fizer.
   */
  private async reconciliarComOServidor(processoId: string, geracao: number, gravou: boolean): Promise<void> {
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao() || !isApiOk(detalhe)) return;
    const servidor = inscricaoDoServidor(detalhe.data);
    this.store.projetarSecao(
      'formulario',
      gravou ? servidor : { fatosDasOutrasFinalidades: servidor.fatosDasOutrasFinalidades },
    );
  }
}
