import { comEscopoPeloCodigo } from '@uniplus/shared-data/configuracao';
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
  EditorDeFormularioComponent,
  BLOCO_COMPROVACAO_DOCUMENTAL,
  conteudoParaEnvio,
  semDadosBasicos,
  type ConteudoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import {
  BUSCA_DE_MUNICIPIOS,
  ConfirmDialogComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  ValorEmConsultaComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';

import type { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { abaPelaTecla, abasDoFormulario, type AbaDoFormulario } from './abas-do-formulario';
import { mensagensDoFormulario } from './validacao-do-formulario';
import { AplicacaoNoServidor } from './servicos/aplicacao-no-servidor.service';
import { AplicacaoDeModelo } from './servicos/aplicacao-de-modelo.service';
import {
  GravacaoDosFormularios,
  type FormularioParaEnviar,
} from './servicos/gravacao-dos-formularios.service';
import { RemocaoDoFormulario } from './servicos/remocao-do-formulario.service';
import { CamposPressupostosDoFormulario } from './servicos/campos-pressupostos-do-formulario.service';
import { EdicaoDosFormularios } from './servicos/edicao-dos-formularios.service';
import { FasesDosFormularios } from './servicos/fases-dos-formularios.service';
import { CatalogoDasConsequenciasDeIndeferimento } from '../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import { CatalogosDoFormulario } from './servicos/catalogos-do-formulario.service';
import { LeituraDoProcessoNoFormulario } from './servicos/leitura-do-processo-no-formulario.service';
import { ModeloDoFormularioComponent } from './secoes/modelo.component';
import { ApuracaoDaIdadeComponent } from './secoes/apuracao-da-idade.component';
import { SimulacaoDoFormularioComponent } from './secoes/simulacao.component';
import {
  AcrescimoDeFormularioComponent,
  type FormularioAAcrescentar,
} from './secoes/acrescimo.component';
import { CabecalhoDoFormularioComponent } from './secoes/cabecalho.component';
import { DocumentosDoFormularioComponent } from './documentos-do-formulario.component';
import { GravacaoDasExigenciasDocumentais } from '../../shared/exigencias/gravacao-das-exigencias-documentais.service';
import { tituloDoPasso } from '../../shared/titulo-do-passo';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { desempateSemDataDeNascimento, PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import { camposSemUsoDeclarado } from './citantes-no-processo';
import { camposSemValoresOfertados } from './problemas-do-formulario';
import { fatosColetadosPelaInscricao } from './fatos-coletados-da-inscricao';
import { fatosColetadosPor } from './formulario-do-processo';
import { conteudoDaInscricao } from './formularios-do-rascunho';

const SEM_CADASTRO_DO_PROCESSO =
  'O cadastro do processo precisa estar concluído antes de declarar os formulários.';

const paraGravar = ({
  codigo,
  nome,
  fase,
  ehInscricao,
  formulario,
}: AbaDoFormulario): FormularioParaEnviar => ({
  codigo,
  nome,
  fase,
  daInscricao: ehInscricao,
  obrigatorio: formulario.obrigatorio,
  consequenciaDaFaltaDeEnvio: formulario.consequenciaDaFaltaDeEnvio,
  conteudo: formulario.conteudo,
});

const anuncioDoAcrescimo = (codigo: string): string =>
  `Formulário ${codigo} acrescentado. Ele é criado no processo ao gravar o passo.`;

/**
 * Formulários do processo — a inscrição, o pedido de isenção, a habilitação e os que o certame
 * declarar —, cada um numa aba identificada pelo código, com as páginas, os campos e os termos
 * editados pelo editor de formulário compartilhado com os modelos da Configuração.
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
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    ValorEmConsultaComponent,
    AcrescimoDeFormularioComponent,
    ApuracaoDaIdadeComponent,
    CabecalhoDoFormularioComponent,
    ModeloDoFormularioComponent,
    SimulacaoDoFormularioComponent,
  ],
  templateUrl: './formulario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    AplicacaoDeModelo,
    AplicacaoNoServidor,
    CatalogosDoFormulario,
    CatalogoDasConsequenciasDeIndeferimento,
    GravacaoDosFormularios,
    GravacaoDasExigenciasDocumentais,
    RemocaoDoFormulario,
    CamposPressupostosDoFormulario,
    EdicaoDosFormularios,
    FasesDosFormularios,
    LeituraDoProcessoNoFormulario,
    provePassoDoWizard(FormularioPassoComponent),
    // A condição sobre município — o impedimento do campo de município, inclusive — escolhe o
    // valor pela busca no Geo.
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
})
export class FormularioPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  protected readonly dados = inject(CatalogosDoFormulario);
  protected readonly fatosDoFormulario = computed(() => comEscopoPeloCodigo(this.dados.catalogo()));
  protected readonly consequencias = inject(CatalogoDasConsequenciasDeIndeferimento);
  protected readonly leituraDasConsequencias = acompanharLeitura({
    falha: this.consequencias.erro,
    pendente: computed(() => this.consequencias.situacao() === 'carregando'),
    recarregar: () => this.consequencias.repetir(),
    destino: tituloDoPasso,
  });
  /** O que o leitor de tela ouve depois de acrescentar ou remover um formulário, ou de aplicar um modelo. */
  protected readonly anuncio = signal('');
  protected readonly remocao = inject(RemocaoDoFormulario);
  protected readonly aplicacao = inject(AplicacaoDeModelo);
  private readonly gravacao = inject(GravacaoDosFormularios);
  protected readonly fases = inject(FasesDosFormularios);
  protected readonly edicao = inject(EdicaoDosFormularios);
  protected readonly campos = inject(CamposPressupostosDoFormulario);
  private readonly injector = inject(Injector);
  private readonly editores = viewChildren(EditorDeFormularioComponent);

  /** O código da aba escolhida; a primeira quando a escolhida deixou de existir. */
  private readonly abaEscolhida = signal('');
  constructor() {
    this.consequencias.carregar();
    this.dados.carregarCatalogo();
    this.dados.carregarTermos();
  }

  /** Os formulários do rascunho, na ordem em que o rascunho os guarda. */
  readonly formularios = computed(() => this.store.draft().formulario.formularios);

  protected readonly codigosEmUso = computed(() =>
    this.formularios().map((formulario) => formulario.codigo),
  );

  /** Os códigos dos outros formulários: o código de um não repete o de outro. */
  protected codigosDosOutros(codigo: string): readonly string[] {
    return this.codigosEmUso().filter((outro) => outro !== codigo);
  }

  /** O conteúdo do formulário em que o candidato se inscreve. */
  private readonly conteudoDaInscricao = computed(() =>
    conteudoDaInscricao(this.store.draft().formulario, this.fases.fasesDaInscricao()),
  );

  readonly abaAtiva = computed(() => {
    const escolhida = this.abaEscolhida();
    return this.codigosEmUso().includes(escolhida) ? escolhida : (this.abas()[0]?.codigo ?? '');
  });

  /** O bloco de comprovação documental, que o formulário em consulta lê como lista de documentos. */
  protected readonly blocoDocumental = BLOCO_COMPROVACAO_DOCUMENTAL;

  /** Os fatos que a inscrição coleta, o conjunto básico ainda não gravado inclusive: os outros formulários os citam. */
  private readonly fatosDaInscricao = computed(() => [
    ...fatosColetadosPelaInscricao(this.conteudoDaInscricao()),
  ]);

  private readonly textosDasAbas = computed(() => ({
    recusasDaGravacao: this.gravacao.recusas(),
    recusasDaRemocao: this.remocao.recusas(),
    recusasDaAplicacao: this.aplicacao.recusas(),
    resumosDaAplicacao: this.aplicacao.resumos(),
    modelos: this.aplicacao.modelos(),
    modeloEscolhido: this.aplicacao.escolhidos(),
  }));

  /** Abas só quando há entre o que navegar: com um formulário só, o painel basta. */
  readonly comAbas = computed(() => this.abas().length > 1);

  /**
   * Uma aba por formulário, com o que o editor dela recebe. Na inscrição, o combo deixa de fora o
   * que os outros formulários coletam, e os fatos que eles citam por negação são obrigatórios. Nos
   * outros, os fatos da inscrição são citáveis — o candidato já os respondeu — e nunca coletados
   * de novo.
   */
  readonly abas = computed(() =>
    abasDoFormulario({
      formularios: this.formularios(),
      fases: this.fases.porFormulario(),
      fasesDoCronograma: this.fases.fasesDoCronograma(),
      documentos: this.store.draft().documentos,
      vocabulario: this.fases.vocabularioDosDocumentos(),
      fatosDaInscricao: this.fatosDaInscricao(),
      textos: this.textosDasAbas(),
    }),
  );

  private abasComNumeroInvalido() {
    return this.abas().filter((aba) => conteudoParaEnvio(semDadosBasicos(aba.conteudo)) === null);
  }

  /** Abre a primeira aba com número inválido e leva o foco ao campo marcado, depois que ela aparece. */
  async revelarCampoInvalido(): Promise<boolean> {
    const aba = this.abasComNumeroInvalido()[0];
    if (aba === undefined) return false;
    this.selecionarAba(aba.codigo);
    await new Promise<void>((resolve) =>
      afterNextRender(() => resolve(), { injector: this.injector }),
    );
    return (
      (await this.editores()
        .find((editor) => editor.idBase() === aba.idBase)
        ?.focarPrimeiroCampoInvalido()) ?? false
    );
  }

  selecionarAba(codigo: string): void {
    this.abaEscolhida.set(codigo);
  }

  /** Setas, Home e End trocam de aba e levam o foco a ela: só a aba ativa entra na ordem do Tab. */
  navegarNasAbas(evento: KeyboardEvent, indice: number): void {
    const abas = this.abas();
    const destino = abaPelaTecla(evento.key, indice, abas.length);
    if (destino === null) return;
    evento.preventDefault();
    this.selecionarAba(abas[destino].codigo);
    document.getElementById(abas[destino].aba)?.focus();
  }

  /**
   * A edição feita no editor de uma aba. Na inscrição, o campo que o operador tira deixa de ser
   * "posto pela exigência": se voltar, voltou por decisão dele.
   */
  editar(aba: AbaDoFormulario, conteudo: ConteudoDoFormulario): void {
    if (aba.ehInscricao) {
      const presentes = new Set(fatosColetadosPor(conteudo));
      this.store.camposPostosPelasExigencias.update((atual) => atual.soOsPresentes(presentes));
    }
    this.edicao.conteudo(aba.codigo, conteudo);
  }

  /** O código muda antes de gravar: a aba escolhida segue o formulário. */
  escreverCodigo(anterior: string, novo: string): void {
    if (this.edicao.codigo(anterior, novo) && this.abaEscolhida() === anterior) {
      this.selecionarAba(novo);
    }
  }

  /** O foco vai à aba nova, e o leitor de tela ouve o que aconteceu. */
  acrescentar(pedido: FormularioAAcrescentar): void {
    this.edicao.acrescentar(pedido);
    this.selecionarAba(pedido.codigo);
    this.anuncio.set(anuncioDoAcrescimo(pedido.codigo));
    this.focarAba(this.formularios().length - 1);
  }

  /**
   * Confirma a remoção: se o formulário saiu, a primeira aba recebe o foco e o leitor de tela ouve
   * o que aconteceu; se o servidor recusou, a aba fica e a recusa vai em texto nela.
   */
  async confirmarRemocao(): Promise<void> {
    const desfecho = await this.remocao.confirmar();
    if (desfecho === null) return;

    if (desfecho.recusa !== null) {
      this.anuncio.set(`O formulário ${desfecho.codigo} não foi removido. ${desfecho.recusa}`);
      return;
    }
    this.gravacao.esquecerRecusasDa(desfecho.codigo);
    this.selecionarAba('');
    this.anuncio.set(`Formulário ${desfecho.codigo} removido.`);
    this.focarAba(this.abas()[0]?.posicao ?? 0);
  }

  /** Aplica o modelo confirmado: a reconciliação devolve ao formulário o que o processo pressupõe. */
  async confirmarAplicacao(): Promise<void> {
    const texto = await this.aplicacao.confirmar(() => this.campos.reconciliar());
    if (texto !== null) this.anuncio.set(texto);
  }

  /**
   * Sem abas — sobrou um formulário só —, o foco vai ao primeiro título do painel dele, que existe
   * sempre.
   */
  private focarAba(posicao: number): void {
    focarAposRenderizar(this.injector, `form-aba-${posicao}`, `form-${posicao}-fase-titulo`);
  }

  /** O desempate por maior idade declarado sem a data de nascimento entre os campos. */
  readonly desempateSemDataDeNascimento = computed(() => {
    if (this.store.emConsulta()) return false;
    const draft = this.store.draft();
    return desempateSemDataDeNascimento(
      draft.desempate,
      fatosColetadosPelaInscricao(this.conteudoDaInscricao()),
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
    return camposSemUsoDeclarado(
      this.store.draft(),
      this.store.regrasDasModalidades(),
      this.fases.fasesDaInscricao(),
    ).map((campo) =>
      campo.apresentacao.rotulo.trim() === '' ? campo.fatoCodigo : campo.apresentacao.rotulo,
    );
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

  validar(): ValidacaoDoPasso {
    const mensagens = mensagensDoFormulario({
      abas: this.abas().map((aba) => ({
        ...aba,
        numeroInvalido: conteudoParaEnvio(semDadosBasicos(aba.conteudo)) === null,
      })),
      fasesDoCronograma: this.fases.fasesDoCronograma(),
      draft: this.store.draft(),
      aplicacoesEmAberto: this.store.aplicacoesDeModeloEmAberto(),
      camposSemValoresOfertados: this.camposSemValoresOfertados(),
    });
    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: mensagens };
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /** Grava os formulários e a política que ancora a apuração da idade. */
  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) return { valid: false, messages: [SEM_CADASTRO_DO_PROCESSO] };

    const conferencia = this.validar();
    if (!conferencia.valid) return conferencia;

    return this.gravacao.gravar(processoId, this.abas().map(paraGravar), (codigo) =>
      this.selecionarAba(codigo),
    );
  }
}
