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
import {
  ComboboxComponent,
  MOTIVO_DA_PROTECAO_PENDENTE,
  type UiComboboxGroup,
} from '@uniplus/shared-ui/components';

import type { DocumentoDefinicao } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverArquivo } from '../../../shared/documentos-exigidos';
import { agrupadosPorFormulario } from '../../../shared/exigencias/formulario-da-exigencia';
import {
  mostraFormulario,
  formulariosEscolhiveis,
} from '../../../shared/exigencias/formulario-da-exigencia';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import { nomeDaFinalidade } from '../../formulario/formularios-por-finalidade';
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
import { DetalheDoDocumentoComponent } from './detalhe-do-documento.component';
import { EditorDaExigenciaComponent } from './editor-da-exigencia.component';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './gatilho-das-exigencias.store';
import { LinhaDoDocumentoComponent } from './linha-do-documento.component';

/** Os documentos que a fase exige: o seletor para acrescentar e a conferência com o que decide cada um. */
@Component({
  selector: 'sel-documentos-da-fase',
  imports: [
    ComboboxComponent,
    DetalheDoDocumentoComponent,
    EditorDaExigenciaComponent,
    LinhaDoDocumentoComponent,
  ],
  templateUrl: './documentos-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class DocumentosDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronograma);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly gatilho = inject(GatilhoDasExigenciasStore);

  private readonly faseAberta = this.faseEmEdicao.faseAberta;
  private readonly faseDoRascunho = this.faseEmEdicao.faseDoRascunho;
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
    const aguardandoProtecao = this.catalogos.tiposAguardandoProtecao();

    return this.catalogos
      .documentosPorCategoria()
      .map((grupo) => ({
        label: grupo.label,
        options: grupo.docs
          .filter((doc) => !jaExigidos.has(doc.id))
          .map((doc) =>
            aguardandoProtecao.has(doc.id)
              ? {
                  value: doc.id,
                  label: `${doc.nome} — ${MOTIVO_DA_PROTECAO_PENDENTE}`,
                  disabled: true,
                }
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

  readonly hospedeiroDoSeletor = viewChild('seletorDeDocumento', { read: ElementRef });

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
  readonly documentosEmEdicao = signal<ReadonlySet<string>>(new Set());

  chaveDeEdicao(id: string): string {
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
  arquivoPublicadoDoDocumento(id: string): string {
    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    return descreverArquivo(exigencia.formatosPermitidos, exigencia.tamanhoMaximoBytes);
  }

  /** O que a consulta lê de um documento além do que a conferência já resume. */
  detalheLidoDoDocumento(doc: DocumentoDefinicao): DetalheLidoDoDocumento {
    const id = doc.id;
    const modelo = this.exigencias.exigenciaDoDocumento(id).modelo;
    const finalidade = this.exigencias.finalidadeDoDocumento(id);
    return {
      descricao: doc.descricao,
      formatos: this.arquivoPublicadoDoDocumento(id),
      situacao: doc.situacao,
      formulario: mostraFormulario(
        this.exigencias.exigenciaDoDocumento(id).finalidade,
        this.exigencias.finalidadesDaFaseAberta(),
      )
        ? (formulariosEscolhiveis(this.exigencias.finalidadesDaFaseAberta()).find(
            (opcao) => opcao.valor === finalidade,
          )?.rotulo ?? null)
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
    agrupadosPorFormulario(
      this.resumosVisiveis(),
      (resumo) => resumo.finalidade,
      this.exigencias.finalidadesDaFaseAberta(),
    ),
  );

  /** Como a conferência nomeia o grupo de um formulário; o grupo sem formulário pede a escolha. */
  tituloDoFormulario(finalidade: string | null): string {
    return finalidade === null
      ? 'Formulário a escolher'
      : `Formulário de ${nomeDaFinalidade(finalidade)}`;
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

  repeticaoResumidaDoDocumento(id: string): string {
    const repeticao = this.gatilho.repeticaoDoDocumento(id);
    return repeticaoResumida(repeticao.atual === null ? null : repeticao.rotulo);
  }
}
