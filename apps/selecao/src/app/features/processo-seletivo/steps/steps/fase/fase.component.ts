import {
  ABRANGENCIAS_ESCOLHIVEIS,
  CONSEQUENCIAS_ESCOLHIVEIS,
  FATO_MODALIDADE,
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
  baseLegalNova,
} from '../../shared/exigencias/exigencias-documentais';
import {
  agrupadosPorFormulario,
  comFinalidade,
  faltaOFormulario,
} from '../../shared/exigencias/formulario-da-exigencia';
import { descreverArquivo } from '../../shared/documentos-exigidos';
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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  ComboboxComponent,
  EditorDeCondicoesComponent,
  MOTIVO_DA_PROTECAO_PENDENTE,
  type UiComboboxGroup,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';
import { consequenciasDaFase } from '@uniplus/shared-utils';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import {
  type BaseLegalConfig,
  type DocumentoDefinicao,
  type ModeloDaExigencia,
  type FaseDoCronograma,
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
import { descreverFase } from '../../shared/descricao-da-fase';
import { nomeDaFinalidade } from '../formulario/formularios-por-finalidade';
import {
  problemasDaFase,
} from './configuracao-da-fase';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './documentos/gatilho-das-exigencias.store';
import { FaseEmEdicao } from './fase-em-edicao';
import { CicloRecursalDaFaseComponent } from './secoes/ciclo-recursal-da-fase.component';
import { RegraDeRecursoDaFaseComponent } from './secoes/regra-de-recurso-da-fase.component';
import { BancasDaFaseComponent } from './secoes/bancas-da-fase.component';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';
import { traduzirRecusa } from './recusas-da-fase';
import type {
  DetalheLidoDoDocumento,
  ResumoDoDocumento,
} from './tipos-da-conferencia';
import { ModeloDaExigenciaComponent } from './modelo-da-exigencia/modelo-da-exigencia.component';
import {
  alcancaOPublico,
  filtroDoValor,
  opcaoDoFiltro,
  type OpcaoDoFiltro,
  composicaoResumida,
  descreverNorma,
  descreverPublico,
  normaComum,
  publicoDaExigencia,
  repeticaoResumida,
  rotuloDaConsequencia,
} from './resumo-da-exigencia';

/** A opção que deixa o documento fora de formulário, na fase que não responde nenhum. */
const SEM_FORMULARIO = 'SEM_FORMULARIO';


/** O gatilho sem condição recusada pela fase — a mesma referência, para o editor não se redesenhar. */

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
    BancasDaFaseComponent,
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    ComboboxComponent,
    EditorDeCondicoesComponent,
    FormsModule,
    CicloRecursalDaFaseComponent,
    ModeloDaExigenciaComponent,
    PublicacoesDaFaseComponent,
    ReactiveFormsModule,
    RegraDeRecursoDaFaseComponent,
  ],
  templateUrl: './fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(FaseStepComponent),
    FaseEmEdicao,
    ExigenciasDaFaseStore,
    GatilhoDasExigenciasStore,
  ],
})
export class FaseStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly destruicao = inject(DestroyRef);

  /** Do cadastro vivo de Configuração, não de uma lista escrita nesta tela. */
  readonly gruposDeDocumento = this.catalogos.documentosPorCategoria;

  /**
   * Quando declarada, a configuração pertence a essa fase e o seletor próprio some: é o
   * modo em que o passo Cronograma embute este bloco dentro de cada fase da linha do
   * tempo, em vez de repetir a fase num combo no rodapé.
   */
  readonly faseFixada = input<string | null>(null);

  private readonly faseEmEdicao = inject(FaseEmEdicao);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  protected readonly gatilho = inject(GatilhoDasExigenciasStore);

  readonly faseAberta = this.faseEmEdicao.faseAberta;
  readonly formulario = this.faseEmEdicao.espelho.formulario;
  readonly recusaPorCampo = this.faseEmEdicao.recusaPorCampo;
  readonly recusasGerais = this.faseEmEdicao.recusasGerais;
  readonly fasesDoCronograma = this.faseEmEdicao.fasesDoCronograma;
  readonly fasesNoSeletor = this.faseEmEdicao.fasesNoSeletor;
  readonly faseDoRascunho = this.faseEmEdicao.faseDoRascunho;
  readonly nomeDaFaseAberta = this.faseEmEdicao.nomeDaFaseAberta;
  readonly problemas = this.faseEmEdicao.problemas;
  readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  readonly nomeDaBanca = this.faseEmEdicao.nomeDaBanca;
  readonly idDaFase = this.faseEmEdicao.idDaFase;
  private readonly atoPorCodigo = this.faseEmEdicao.atoPorCodigo;
  readonly ancorasPossiveis = this.faseEmEdicao.ancorasPossiveis;
  readonly publicaPreliminar = this.faseEmEdicao.publicaPreliminar;

  constructor() {
    this.catalogos.carregar();
    this.destruicao.onDestroy(() => this.faseEmEdicao.espelho.encerrar());

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
      untracked(() => this.faseEmEdicao.espelho.espelhar(fase));
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
  }

  abrirFase(faseCanonicaId: string): void {
    this.faseAberta.set(faseCanonicaId);
    this.faseEmEdicao.limparRecusa();
  }

  // ─── Exigências documentais desta fase ──────────────────────────────────


  /** O documento escolhido no seletor, ainda não acrescentado. */
  readonly documentoAAcrescentar = signal('');







  /**
   * O que o campo ainda oferece: o catálogo menos o que esta fase já exige, agrupado pela
   * categoria do cadastro.
   *
   * A busca é do próprio campo — setenta e quatro tipos em nove categorias não se acham
   * rolando uma lista, e quem monta o edital sabe o nome do documento.
   */
  readonly documentosDisponiveis = computed<readonly UiComboboxGroup[]>(() => {
    const jaExigidos = new Set(this.exigencias.documentosDaFase().map((doc) => doc.id));
    const aguardandoProtecao = this.catalogos.tiposAguardandoProtecao();

    return this.catalogos
      .documentosPorCategoria()
      .map((grupo) => ({
        label: grupo.label,
        options: grupo.docs
          .filter((doc) => !jaExigidos.has(doc.id))
          .map((doc) =>
            aguardandoProtecao.has(doc.id)
              ? { value: doc.id, label: `${doc.nome} — ${MOTIVO_DA_PROTECAO_PENDENTE}`, disabled: true }
              : { value: doc.id, label: doc.nome },
          ),
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

    this.exigencias.alternarExigencia(id, true);
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
    this.exigencias.alternarExigencia(id, false);
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
    this.exigencias.documentosDaFase().map((doc) => {
      const exigencia = this.exigencias.exigenciaDoDocumento(doc.id);
      const publico = publicoDaExigencia(exigencia, this.gatilho.fatoPorCodigo());
      return {
        id: doc.id,
        nome: doc.nome,
        documento: doc,
        publico,
        aplicaA: descreverPublico(publico),
        entrega: exigencia.obrigatorio ? 'Obrigatória' : 'Facultativa',
        composicao: composicaoResumida(this.exigencias.grupoDoDocumento(doc.id)),
        repeticao: this.repeticaoResumidaDoDocumento(doc.id),
        consequencia: rotuloDaConsequencia(
          exigencia.consequenciaIndeferimento,
          exigencia.obrigatorio,
        ),
        coleta: this.coletaDoDocumento(doc.id),
        bases: exigencia.basesLegais,
        normas: exigencia.basesLegais.map(descreverNorma),
        faltaNorma: this.exigencias.faltaNormaResolvida(doc.id),
        repetido: this.exigencias.declaradoMaisDeUmaVez(doc.id),
        finalidade: this.exigencias.finalidadeDoDocumento(doc.id),
        orientacao: doc.orientacao,
        avisoDeFormatos: this.exigencias.avisoDeFormatos(doc.id),
        detalhe: this.store.emConsulta() ? this.detalheLidoDoDocumento(doc) : null,
      };
    }),
  );

  /** O arquivo que a exigência gravou aceitar, escrito como o formulário e a revisão o escrevem. */
  private arquivoPublicadoDoDocumento(id: string): string {
    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    return descreverArquivo(exigencia.formatosPermitidos, exigencia.tamanhoMaximoBytes);
  }

  /** O que a consulta lê de um documento além do que a conferência já resume. */
  private detalheLidoDoDocumento(doc: DocumentoDefinicao): DetalheLidoDoDocumento {
    const id = doc.id;
    const modelo = this.modeloDoDocumento(id);
    const finalidade = this.exigencias.finalidadeDoDocumento(id);
    return {
      descricao: doc.descricao,
      formatos: this.arquivoPublicadoDoDocumento(id),
      situacao: doc.situacao,
      formulario: this.mostraFormulario(id)
        ? (this.formulariosEscolhiveis().find((opcao) => opcao.valor === finalidade)?.rotulo ?? null)
        : null,
      exigidoEm: this.exigencias.valeEmTodasAsFases(id)
        ? 'Todas as fases do edital'
        : `Só em ${this.nomeDaFaseAberta()}`,
      modelo: modelo === null ? null : `${modelo.nomeArquivo} (${modelo.formato})`,
    };
  }

  /**
   * A conferência por formulário: na fase que divide inscrição e isenção, o candidato apresenta
   * cada documento no bloco de comprovação de um deles, e a lista única misturaria os dois. A fase
   * de um formulário só, ou de nenhum, segue numa lista.
   */
  readonly conferenciaPorFormulario = computed(() =>
    agrupadosPorFormulario(this.resumosVisiveis(), (resumo) => resumo.finalidade, this.exigencias.finalidadesDaFaseAberta()),
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
    const etapaId = this.exigencias.etapaDoDocumento(id);
    const etapa = this.exigencias.etapasDaFaseAberta().find((candidata) => candidata.id === etapaId);
    const momento = etapa === undefined ? 'na fase inteira' : `na etapa ${etapa.nome}`;
    return this.exigencias.valeEmTodasAsFases(id)
      ? `Todas as fases; nesta, ${momento}`
      : `${momento.charAt(0).toUpperCase()}${momento.slice(1)}`;
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
      ...this.exigencias.modalidades().map((codigo) => opcaoDoFiltro(`modalidade:${codigo}`)),
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
   * Os formulários que a escolha oferece, como o seletor os nomeia. Na fase que não responde
   * formulário nenhum, a escolha só aparece para desfazer um formulário declarado antes, e a saída
   * é deixar o documento fora de formulário.
   */
  readonly formulariosEscolhiveis = computed(() => {
    const atendidas = this.exigencias.finalidadesDaFaseAberta();
    return atendidas.length === 0
      ? [{ valor: SEM_FORMULARIO, rotulo: 'Nenhum: a fase não responde formulário' }]
      : atendidas.map((finalidade) => ({ valor: finalidade, rotulo: `Formulário de ${nomeDaFinalidade(finalidade)}` }));
  });


  /**
   * O que falta para o documento ter formulário: a escolha na fase que divide inscrição e isenção,
   * ou outra escolha quando a fase deixou de responder o formulário declarado.
   */
  faltaFormulario(id: string): string | null {
    return faltaOFormulario(this.exigencias.exigenciaDoDocumento(id).finalidade, this.exigencias.finalidadesDaFaseAberta());
  }

  /**
   * Se a escolha do formulário aparece: na fase que responde algum, e em qualquer fase enquanto o
   * formulário declarado não é respondido nela — escondê-la deixaria a falta sem o campo que a resolve.
   */
  mostraFormulario(id: string): boolean {
    return this.exigencias.finalidadesDaFaseAberta().length > 0 || this.faltaFormulario(id) !== null;
  }

  /**
   * Declara o formulário do documento nesta fase. Vale para a árvore de raiz inteira: as
   * alternativas de um grupo se satisfazem num formulário só.
   */
  escolherFinalidade(id: string, finalidade: string): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    // A declaração passa a ser própria desta fase, como qualquer outra edição dela.
    if (this.exigencias.valeEmTodasAsFases(id)) this.exigencias.recortarPorFase(id);

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
    return consequenciasDaFase(CONSEQUENCIAS_ESCOLHIVEIS, this.faseAdmiteComplementacao());
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
    return this.exigencias.exigenciaDoDocumento(id).obrigatorio;
  }

  /**
   * Exigência obrigatória decide sozinha o resultado da análise — e é por isso que a publicação
   * cobra a norma dela. A facultativa segue sem norma declarada.
   */
  escolherObrigatoriedade(id: string, valor: string): void {
    this.exigencias.escreverExigencia(id, { obrigatorio: valor === 'sim' });
  }

  /** O modelo que a exigência oferece ao candidato nesta fase; `null` quando não oferece. */
  modeloDoDocumento(id: string): ModeloDaExigencia | null {
    return this.exigencias.exigenciaDoDocumento(id).modelo;
  }

  /** Vincula o modelo confirmado à exigência desta fase, ou o desvincula com `null`. */
  definirModelo(id: string, modelo: ModeloDaExigencia | null): void {
    this.exigencias.escreverExigencia(id, { modelo });
  }

  consequenciaDoDocumento(id: string): string {
    return this.exigencias.exigenciaDoDocumento(id).consequenciaIndeferimento;
  }

  /**
   * A consequência é o que faz a exigência decidir sozinha o resultado. Quem declara uma
   * consequência está dizendo que ela decide, e a publicação vai cobrar a norma.
   */
  escolherConsequencia(id: string, consequencia: string): void {
    this.exigencias.escreverExigencia(id, { consequenciaIndeferimento: consequencia });
  }

  /** As normas que sustentam a exigência nesta fase — são N por exigência (ADR-0074). */
  basesLegaisDoDocumento(id: string): readonly BaseLegalConfig[] {
    return this.exigencias.exigenciaDoDocumento(id).basesLegais;
  }


  /** Escreve um campo de UMA das normas, endereçada pela posição. */
  escreverBaseLegal(
    id: string,
    posicao: number,
    campo: keyof BaseLegalConfig,
    valor: string,
  ): void {
    const bases = this.basesLegaisDoDocumento(id).map((base, i) =>
      i === posicao ? { ...base, [campo]: valor } : base,
    );
    this.exigencias.escreverExigencia(id, { basesLegais: bases });
  }

  /** Acrescenta uma norma à exigência — uma lei federal somada à cláusula do edital. */
  acrescentarBaseLegal(id: string): void {
    this.exigencias.escreverExigencia(id, {
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
    this.exigencias.escreverExigencia(id, { basesLegais: bases.filter((_, i) => i !== posicao) });
  }



  /**
   * Declara em que etapa desta fase o documento é coletado. Vazio devolve o documento à fase
   * inteira — a etapa sai do registro em vez de ficar guardada como texto vazio, que o
   * contrato leria como declaração.
   */
  escolherEtapaDoDocumento(id: string, etapaId: string): void {
    this.exigencias.escreverExigencia(id, { etapaId: etapaId === '' ? null : etapaId });
  }













  /**
   * Em que fases o documento é exigido. É outro eixo do "Coletado em": este diz em QUAIS
   * fases, aquele em que ponto DESTA fase — e a resposta do segundo continua sendo por fase
   * mesmo quando o primeiro diz "todas".
   */
  escolherAlcanceDoDocumento(id: string, alcance: string): void {
    if (alcance === 'todas') {
      this.exigencias.valerEmTodasAsFases(id);
      return;
    }
    this.exigencias.recortarPorFase(id);
  }

  // ─── Gatilho por fato do candidato ──────────────────────────────────────
  //
  // Há documento que só se cobra de quem tem certo fato: o título de eleitor não se pede a
  // estrangeiro, a mulher nem a menor de dezoito; a quitação com o serviço militar só se pede
  // a homem maior de dezoito, e nem dele quando é indígena. É isto que estes controles
  // escrevem — e a modalidade fica de fora deles, porque tem o seu próprio ali ao lado.








  private repeticaoResumidaDoDocumento(id: string): string {
    const repeticao = this.gatilho.repeticaoDoDocumento(id);
    return repeticaoResumida(repeticao.atual === null ? null : repeticao.rotulo);
  }









  /** O fato que tem controle próprio ao lado do gatilho: o editor não o mostra. */
  protected readonly fatoDoRecorte = FATO_MODALIDADE;




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

      this.faseEmEdicao.limparRecusa();
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

}
