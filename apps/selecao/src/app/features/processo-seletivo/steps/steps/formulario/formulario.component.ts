import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  BUSCA_DE_MUNICIPIOS,
  ConfirmDialogComponent,
  EditorDeFormularioComponent,
  FINALIDADE_INSCRICAO,
  BLOCO_COMPROVACAO_DOCUMENTAL,
  ValorEmConsultaComponent,
  conteudoInicial,
  conteudoParaEnvio,
  semDadosBasicos,
  type ConteudoDoFormulario,
} from '@uniplus/shared-ui/components';

import type { FormularioDaFinalidade, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { abasDoFormulario } from './abas-do-formulario';
import { mensagensDoFormulario } from './validacao-do-formulario';
import { AnuncioDoFormularioService } from './servicos/anuncio-do-formulario.service';
import { AplicacaoDeModeloService } from './servicos/aplicacao-de-modelo.service';
import { GravacaoDosFormulariosService } from './servicos/gravacao-dos-formularios.service';
import { RemocaoDoFormularioService } from './servicos/remocao-do-formulario.service';
import { CamposPressupostosDoFormularioService } from './servicos/campos-pressupostos-do-formulario.service';
import { FasesDosFormulariosService } from './servicos/fases-dos-formularios.service';
import { CatalogosDoFormularioService } from './servicos/catalogos-do-formulario.service';
import { LeituraDoProcessoNoFormularioService } from './servicos/leitura-do-processo-no-formulario.service';
import { ModeloDoFormularioComponent } from './secoes/modelo.component';
import { ApuracaoDaIdadeComponent } from './secoes/apuracao-da-idade.component';
import { SimulacaoDoFormularioComponent } from './secoes/simulacao.component';
import { DocumentosDoFormularioComponent } from './documentos-do-formulario.component';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { desempateSemDataDeNascimento, PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import { camposSemUsoDeclarado } from './citantes-no-processo';
import { camposSemValoresOfertados } from './problemas-do-formulario';
import { fatosColetadosPelaInscricao } from './fatos-coletados-da-inscricao';
import { fatosColetadosPor } from './formulario-do-processo';
import {
  abaPelaTecla,
  comFormulario,
  formulariosDoRascunho,
  nomeDaFinalidade,
  sufixoDaFinalidade,
} from './formularios-por-finalidade';

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
  imports: [
    ConfirmDialogComponent,
    DocumentosDoFormularioComponent,
    EditorDeFormularioComponent,
    ValorEmConsultaComponent,
    ApuracaoDaIdadeComponent,
    ModeloDoFormularioComponent,
    SimulacaoDoFormularioComponent,
  ],
  templateUrl: './formulario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    AnuncioDoFormularioService,
    AplicacaoDeModeloService,
    CatalogosDoFormularioService,
    GravacaoDosFormulariosService,
    RemocaoDoFormularioService,
    CamposPressupostosDoFormularioService,
    FasesDosFormulariosService,
    LeituraDoProcessoNoFormularioService,
    provePassoDoWizard(FormularioStepComponent),
    // A condição sobre município — o impedimento do campo de município, inclusive — escolhe o
    // valor pela busca no Geo.
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
})
export class FormularioStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly dados = inject(CatalogosDoFormularioService);
  protected readonly anuncio = inject(AnuncioDoFormularioService);
  protected readonly remocao = inject(RemocaoDoFormularioService);
  protected readonly aplicacao = inject(AplicacaoDeModeloService);
  private readonly gravacao = inject(GravacaoDosFormulariosService);
  protected readonly fases = inject(FasesDosFormulariosService);
  protected readonly campos = inject(CamposPressupostosDoFormularioService);
  private readonly injector = inject(Injector);
  private readonly editores = viewChildren(EditorDeFormularioComponent);

  /** A finalidade da aba escolhida; a inscrição quando a escolhida deixou de existir. */
  private readonly abaEscolhida = signal(FINALIDADE_INSCRICAO);
  readonly finalidadeAAcrescentar = signal('');
  constructor() {
    this.dados.carregarCatalogo();
    this.dados.carregarTermos();
  }

  /** Os formulários do rascunho, a inscrição primeiro. */
  readonly formularios = computed(() => formulariosDoRascunho(this.store.draft().formulario));

  readonly conteudo = computed(() => this.store.draft().formulario.conteudo);

  readonly abaAtiva = computed(() => {
    const escolhida = this.abaEscolhida();
    return this.formularios().some((formulario) => formulario.finalidade === escolhida)
      ? escolhida
      : FINALIDADE_INSCRICAO;
  });

  /** O bloco de comprovação documental, que o formulário em consulta lê como lista de documentos. */
  protected readonly blocoDocumental = BLOCO_COMPROVACAO_DOCUMENTAL;

  /** Os fatos que a inscrição coleta, o conjunto básico ainda não gravado inclusive: as outras finalidades os citam. */
  private readonly fatosDaInscricao = computed(() => [
    ...fatosColetadosPelaInscricao(this.conteudo()),
  ]);

  /** Abas só quando há entre o que navegar: com um formulário só, o painel basta. */
  readonly comAbas = computed(() => this.abas().length > 1);

  /**
   * Uma aba por formulário, com o que o editor dela recebe. Na inscrição, o combo deixa de fora o
   * que as outras finalidades coletam, e os fatos que elas citam por negação são obrigatórios. Nas
   * outras, os fatos da inscrição são citáveis — o candidato já os respondeu — e nunca coletados de
   * novo.
   */
  readonly abas = computed(() =>
    abasDoFormulario({
      formularios: this.formularios(),
      fases: this.fases.porFinalidade(),
      fasesDoCronograma: this.fases.fasesDoCronograma(),
      documentos: this.store.draft().documentos,
      vocabulario: this.fases.vocabularioDosDocumentos(),
      outrasFinalidades: this.store.draft().formulario.outrasFinalidades,
      fatosDaInscricao: this.fatosDaInscricao(),
      textos: {
        recusasDaGravacao: this.gravacao.recusas(),
        recusasDaRemocao: this.remocao.recusas(),
        recusasDaAplicacao: this.aplicacao.recusas(),
        resumosDaAplicacao: this.aplicacao.resumos(),
        modelos: this.aplicacao.modelos(),
        modeloEscolhido: this.aplicacao.escolhidos(),
      },
    }),
  );

  private abasComNumeroInvalido() {
    return this.abas().filter((aba) => conteudoParaEnvio(semDadosBasicos(aba.conteudo)) === null);
  }

  /** Abre a primeira aba com número inválido e leva o foco ao campo marcado, depois que ela aparece. */
  async revelarCampoInvalido(): Promise<boolean> {
    const aba = this.abasComNumeroInvalido()[0];
    if (aba === undefined) return false;
    this.selecionarAba(aba.finalidade);
    await new Promise<void>((resolve) =>
      afterNextRender(() => resolve(), { injector: this.injector }),
    );
    return (
      (await this.editores()
        .find((editor) => editor.idBase() === aba.idBase)
        ?.focarPrimeiroCampoInvalido()) ?? false
    );
  }

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
   * A edição feita no editor de uma aba. Na inscrição, o campo que o operador tira deixa de ser
   * "posto pela exigência": se voltar, voltou por decisão dele.
   */
  editar(finalidade: string, conteudo: ConteudoDoFormulario): void {
    if (finalidade === FINALIDADE_INSCRICAO) {
      const presentes = new Set(fatosColetadosPor(conteudo));
      this.store.camposPostosPelasExigencias.update(
        (atual) => new Set([...atual].filter((codigo) => presentes.has(codigo))),
      );
    }
    this.atualizarFormulario(finalidade, (formulario) => ({ ...formulario, conteudo }));
  }

  escreverFase(finalidade: string, codigo: string): void {
    this.atualizarFormulario(finalidade, (formulario) => ({ ...formulario, faseCodigo: codigo }));
  }

  private atualizarFormulario(
    finalidade: string,
    mudar: (formulario: FormularioDaFinalidade) => FormularioDaFinalidade,
  ): void {
    const atual = this.formularios().find((formulario) => formulario.finalidade === finalidade);
    if (atual === undefined) return;
    this.store.patchSection(
      'formulario',
      comFormulario(this.store.draft().formulario, mudar(atual)),
    );
  }

  /**
   * Acrescenta o formulário da finalidade escolhida com a revisão e aceite, que toda finalidade
   * exige como última etapa. Ele é criado no servidor quando o passo for gravado. A aba nova recebe
   * o foco, e o leitor de tela ouve o que aconteceu.
   */
  acrescentarFinalidade(): void {
    const finalidade = this.finalidadeAAcrescentar();
    if (!this.fases.finalidadesOferecidas().some((opcao) => opcao.valor === finalidade)) return;

    this.store.patchSection(
      'formulario',
      comFormulario(this.store.draft().formulario, {
        finalidade,
        faseCodigo: '',
        conteudo: conteudoInicial(),
      }),
    );
    this.finalidadeAAcrescentar.set('');
    this.selecionarAba(finalidade);
    this.anuncio.anunciar(
      `Formulário de ${nomeDaFinalidade(finalidade)} acrescentado. Ele é criado no processo ao gravar o passo.`,
    );
    this.focarAba(finalidade);
  }

  /**
   * Confirma a remoção: se o formulário saiu, a aba da inscrição recebe o foco e o leitor de tela
   * ouve o que aconteceu; se o servidor recusou, a aba fica e a recusa vai em texto nela.
   */
  async confirmarRemocao(): Promise<void> {
    const desfecho = await this.remocao.confirmar();
    if (desfecho === null) return;

    const nome = nomeDaFinalidade(desfecho.finalidade);
    if (desfecho.recusa !== null) {
      this.anuncio.anunciar(`O formulário de ${nome} não foi removido. ${desfecho.recusa}`);
      return;
    }
    this.gravacao.esquecerRecusasDa(desfecho.finalidade);
    this.selecionarAba(FINALIDADE_INSCRICAO);
    this.anuncio.anunciar(`Formulário de ${nome} removido.`);
    this.focarAba(FINALIDADE_INSCRICAO);
  }

  /** Aplica o modelo confirmado: a reconciliação devolve ao formulário o que o processo pressupõe. */
  confirmarAplicacao(): Promise<void> {
    return this.aplicacao.confirmar(
      (finalidade) => this.fases.porFinalidade().get(finalidade)?.escolhida ?? '',
      () => this.campos.reconciliar(),
    );
  }

  /**
   * Sem abas — sobrou um formulário só —, o foco vai ao primeiro título do painel dele, que existe
   * sempre: o combo de acrescentar some quando não há finalidade a oferecer.
   */
  private focarAba(finalidade: string): void {
    const sufixo = sufixoDaFinalidade(finalidade);
    focarAposRenderizar(this.injector, `form-aba-${sufixo}`, `form-${sufixo}-fase-titulo`);
  }

  /** O desempate por maior idade declarado sem a data de nascimento entre os campos. */
  readonly desempateSemDataDeNascimento = computed(() => {
    if (this.store.emConsulta()) return false;
    const draft = this.store.draft();
    return desempateSemDataDeNascimento(
      draft.desempate,
      fatosColetadosPelaInscricao(draft.formulario.conteudo),
    );
  });

  irParaDesempate(): void {
    this.store.goTo(PASSO_DESEMPATE);
  }

  /**
   * Os campos que nada no certame usa. Existem porque a remoção automática só alcança o que a
   * sessão em curso acrescentou: um campo que entrou ontem por causa de um gatilho sobrevive
   * quando o gatilho é apagado hoje — dado pessoal pedido sem finalidade declarada.
   */
  readonly camposSemUso = computed(() => {
    const draft = this.store.draft();
    return camposSemUsoDeclarado(
      draft.formulario,
      draft.documentos,
      draft.desempate,
      this.store.regrasDasModalidades(),
    ).map((campo) => (campo.rotulo.trim() === '' ? campo.fatoCodigo : campo.rotulo));
  });

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
    const mensagens = mensagensDoFormulario({
      abas: this.abas().map((aba) => ({
        ...aba,
        numeroInvalido: conteudoParaEnvio(semDadosBasicos(aba.conteudo)) === null,
      })),
      draft: this.store.draft(),
      aplicacoesEmAberto: this.store.aplicacoesDeModeloEmAberto(),
      camposSemValoresOfertados: this.camposSemValoresOfertados(),
    });
    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: mensagens };
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /** Grava os formulários de cada finalidade e a política que ancora a apuração da idade. */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de declarar os formulários.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    return this.gravacao.gravar(
      processoId,
      this.abas().map(({ finalidade, nome, fase, conteudo }) => ({
        finalidade,
        nome,
        fase,
        conteudo,
      })),
      (finalidade) => this.selecionarAba(finalidade),
    );
  }
}
