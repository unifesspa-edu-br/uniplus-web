import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { MOTIVO_DA_PROTECAO_PENDENTE } from '@uniplus/shared-inscricao/formulario';
import { ComboboxComponent, type UiComboboxGroup } from '@uniplus/shared-ui/components';

import type { DocumentoDefinicao } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverArquivo } from '../../../shared/documentos-exigidos';
import {
  agrupadosPorFormulario,
  formulariosEscolhiveis,
} from '../../../shared/exigencias/formulario-da-exigencia';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { CatalogoDasConsequenciasDeIndeferimento } from '../../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import {
  alcancaOPublico,
  composicaoResumida,
  descreverNorma,
  descreverPublico,
  filtroDoValor,
  normaComum,
  opcaoDoFiltro,
  publicoDaExigencia,
  repeticaoResumida,
  rotuloDaConsequencia,
  type OpcaoDoFiltro,
} from '../resumo-da-exigencia';
import type { DetalheLidoDoDocumento, ResumoDoDocumento } from '../tipos-da-conferencia';
import { ConfirmacaoDaRemocaoStore } from './confirmacao-da-remocao.store';
import { ConfirmacaoDaRemocaoDoDocumentoComponent } from './confirmacao-da-remocao-do-documento.component';
import { DetalheDoDocumentoComponent } from './detalhe-do-documento.component';
import { EditorDaExigenciaComponent } from './editor-da-exigencia.component';
import { EdicaoDeGruposComponent } from './edicao-de-grupos.component';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './gatilho-das-exigencias.store';
import { LinhaDoDocumentoComponent } from './linha-do-documento.component';
import { DocumentosEmEdicao } from './documentos-em-edicao.service';

/** Os documentos que a fase exige: o seletor para acrescentar e a conferência com o que decide cada um. */
@Component({
  selector: 'sel-documentos-da-fase',
  providers: [
    ConfirmacaoDaRemocaoStore,
    DocumentosEmEdicao,
    CatalogoDasConsequenciasDeIndeferimento,
  ],
  imports: [
    ComboboxComponent,
    ConfirmacaoDaRemocaoDoDocumentoComponent,
    DetalheDoDocumentoComponent,
    EditorDaExigenciaComponent,
    EdicaoDeGruposComponent,
    LinhaDoDocumentoComponent,
  ],
  templateUrl: './documentos-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class DocumentosDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly cronograma = inject(FormularioDoCronograma);
  private readonly catalogoDeDocumentos = inject(CatalogoDeDocumentos);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  protected readonly confirmacao = inject(ConfirmacaoDaRemocaoStore);
  private readonly gatilho = inject(GatilhoDasExigenciasStore);
  private readonly edicao = inject(DocumentosEmEdicao);
  private readonly catalogoDeConsequencias = inject(CatalogoDasConsequenciasDeIndeferimento);

  constructor() {
    this.catalogoDeConsequencias.carregar();
  }

  private readonly faseAberta = this.faseEmEdicao.faseAberta;
  protected readonly nomeDaFaseAberta = this.faseEmEdicao.nomeDaFaseAberta;
  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly modalidades = this.exigencias.modalidades;

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
    const aguardandoProtecao = this.catalogoDeDocumentos.tiposAguardandoProtecao();

    return this.catalogoDeDocumentos
      .documentosPorCategoria()
      .map((grupo) => ({
        label: grupo.label,
        options: grupo.docs
          .filter((doc) => !jaExigidos.has(doc.id))
          .map((doc) => this.opcaoDoDocumento(doc, aguardandoProtecao)),
      }))
      .filter((grupo) => grupo.options.length > 0);
  });

  private opcaoDoDocumento(doc: DocumentoDefinicao, aguardandoProtecao: ReadonlySet<string>) {
    return aguardandoProtecao.has(doc.id)
      ? { value: doc.id, label: `${doc.nome} — ${MOTIVO_DA_PROTECAO_PENDENTE}`, disabled: true }
      : { value: doc.id, label: doc.nome };
  }

  /** Quantos documentos o catálogo ainda oferece a esta fase. */
  readonly documentosAlcancados = computed(() =>
    this.documentosDisponiveis().reduce((total, grupo) => total + grupo.options.length, 0),
  );

  /** Acrescenta à fase o documento escolhido, e devolve o seletor ao estado neutro. */
  acrescentarDocumento(): void {
    const id = this.documentoAAcrescentar();
    if (id === '') return;

    this.exigencias.alternarExigencia(id, true);
    this.avisoDaRemocao.set('');
    const declaracao = this.exigencias
      .declaracoesDaFase()
      .find((item) => item.documento.tipoDocumentoId === id);
    this.alternarEdicao(declaracao?.identificadorNoRascunho ?? id, true);
    this.documentoAAcrescentar.set('');
  }

  escolherDocumento(id: string): void {
    this.documentoAAcrescentar.set(id);
  }

  /** O aviso de que o documento saiu da fase; vazio até a primeira remoção e ao trocar de fase. */
  readonly avisoDaRemocao = linkedSignal({ source: this.faseAberta, computation: () => '' });

  readonly hospedeiroDoSeletor = viewChild('seletorDeDocumento', { read: ElementRef });

  removerDocumento(id: string, seletorDoPublico: HTMLElement): void {
    const nome = this.resumos().find((resumo) => resumo.id === id)?.nome ?? '';
    this.confirmacao.solicitar(id, nome, seletorDoPublico);
  }

  confirmarRemocao(): void {
    const id = this.confirmacao.documento;
    const nome = this.resumos().find((resumo) => resumo.id === id)?.nome ?? '';
    this.exigencias.alternarExigencia(id, false);
    this.alternarEdicao(id, false);
    this.avisoDaRemocao.set(`${nome} removido dos documentos exigidos nesta fase.`);
    const destino =
      this.resumos().length > 0
        ? this.confirmacao.destino
        : this.hospedeiroDoSeletor()?.nativeElement.querySelector('input');
    destino?.focus();
  }

  readonly emEdicao = (id: string): boolean => this.edicao.aberto(id);
  readonly alternarEdicao = (id: string, aberto?: boolean): void =>
    this.edicao.alternar(id, aberto);

  /** O resumo de cada documento da fase: o que decide a exigência, sem abrir os campos. */
  readonly resumos = computed<readonly ResumoDoDocumento[]>(() =>
    this.exigencias.documentosDaFase().flatMap((doc) => {
      const declaracoes = this.exigencias
        .declaracoesDaFase()
        .filter((item) => item.documento.tipoDocumentoId === doc.id);
      return declaracoes.length === 0
        ? [this.resumoDoDocumento(doc, doc.id)]
        : declaracoes.map((item) => this.resumoDoDocumento(doc, item.identificadorNoRascunho));
    }),
  );

  private resumoDoDocumento(doc: DocumentoDefinicao, id: string): ResumoDoDocumento {
    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    const publico = publicoDaExigencia(exigencia, this.gatilho.fatoPorCodigo());
    return {
      id,
      nome: doc.nome,
      documento: doc,
      publico,
      aplicaA: descreverPublico(publico),
      entrega: exigencia.obrigatorio ? 'Obrigatória' : 'Facultativa',
      composicao: composicaoResumida(this.exigencias.grupoDoDocumento(id)),
      repeticao: this.repeticaoResumidaDoDocumento(id),
      ...this.detalhesDoResumo(doc, id),
    };
  }

  private detalhesDoResumo(doc: DocumentoDefinicao, id: string) {
    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    return {
      coleta: this.coletaDoDocumento(id),
      consequencia: this.consequenciaDoDocumento(id),
      bases: exigencia.basesLegais,
      normas: exigencia.basesLegais.map(descreverNorma),
      faltaNorma: this.exigencias.faltaNormaResolvida(id),
      formularioCodigo: this.exigencias.formularioDoDocumento(id),
      orientacao: doc.orientacao,
      avisoDeFormatos: this.exigencias.avisoDeFormatos(doc.id),
      detalhe: this.store.emConsulta() ? this.detalheLidoDoDocumento(doc, id) : null,
    };
  }

  private consequenciaDoDocumento(id: string): string {
    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    return rotuloDaConsequencia(
      exigencia.consequenciaIndeferimento,
      exigencia.obrigatorio,
      this.catalogoDeConsequencias.consequencias(),
    );
  }

  /** O arquivo que a exigência gravou aceitar, escrito como o formulário e a revisão o escrevem. */
  arquivoPublicadoDoDocumento(id: string): string {
    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    return descreverArquivo(exigencia.formatosPermitidos, exigencia.tamanhoMaximoBytes);
  }

  /** O que a consulta lê de um documento além do que a conferência já resume. */
  detalheLidoDoDocumento(doc: DocumentoDefinicao, id: string): DetalheLidoDoDocumento {
    const modelo = this.exigencias.exigenciaDoDocumento(id).modelo;
    return {
      descricao: doc.descricao,
      formatos: this.arquivoPublicadoDoDocumento(id),
      situacao: doc.situacao,
      formulario: this.formularioDoDocumento(id),
      exigidoEm: this.exigencias.valeEmTodasAsFases(id)
        ? 'Todas as fases do edital'
        : `Só em ${this.nomeDaFaseAberta()}`,
      modelo: modelo === null ? null : `${modelo.nomeArquivo} (${modelo.formato})`,
    };
  }

  private formularioDoDocumento(id: string): string | null {
    const codigo = this.exigencias.formularioDoDocumento(id);
    return (
      formulariosEscolhiveis(this.exigencias.formulariosDaFaseAberta()).find(
        (opcao) => opcao.valor === codigo,
      )?.rotulo ?? null
    );
  }

  /**
   * A conferência por formulário: na fase que divide inscrição e isenção, o candidato apresenta
   * cada documento no bloco de comprovação de um deles, e a lista única misturaria os dois. A fase
   * de um formulário só, ou de nenhum, segue numa lista.
   */
  readonly conferenciaPorFormulario = computed(() =>
    agrupadosPorFormulario(
      this.resumosVisiveis(),
      (resumo) => resumo.formularioCodigo,
      this.exigencias.codigosDaFaseAberta(),
    ),
  );

  /** Como a conferência nomeia o grupo de um formulário; o grupo sem formulário pede a escolha. */
  tituloDoFormulario(codigo: string | null): string {
    const formulario = this.exigencias
      .formulariosDaFaseAberta()
      .find((item) => item.codigo === codigo);
    return formulario === undefined ? 'Formulário a escolher' : `Formulário ${formulario.rotulo}`;
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
  coletaDoDocumento(id: string): string {
    const etapaId = this.exigencias.etapaDoDocumento(id);
    const etapa = this.exigencias
      .etapasDaFaseAberta()
      .find((candidata) => candidata.id === etapaId);
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

    return this.manterFiltroEscolhido(opcoes);
  });

  /** Mantém o filtro escolhido mesmo quando nenhum documento mais o declara. */
  private manterFiltroEscolhido(opcoes: OpcaoDoFiltro[]): OpcaoDoFiltro[] {
    const escolhido = this.filtroDoPublico();
    return opcoes.some((opcao) => opcao.valor === escolhido)
      ? opcoes
      : [...opcoes, opcaoDoFiltro(escolhido)];
  }

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

  repeticaoResumidaDoDocumento(id: string): string {
    const repeticao = this.gatilho.repeticaoDoDocumento(id);
    return repeticaoResumida(repeticao.atual === null ? null : repeticao.rotulo);
  }
}
