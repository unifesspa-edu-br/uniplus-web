import { Injectable, computed, inject } from '@angular/core';

import {
  type DocumentoDefinicao,
  type EtapaPontuada,
  type ExigenciaDeDocumento,
  type ExigenciasDoRascunho,
} from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  comAlcanceDeTodasAsFases,
  recortadoPorFase,
  valendoEmTodasAsFases,
  type ContextoDoAlcance,
} from '../../../shared/exigencias/alcance-das-exigencias';
import { formatosDeclarados } from '../../../shared/exigencias/arquivo-da-exigencia';
import {
  exigenciasDaFase,
  exigenciasDaRaiz,
  exigenciasLocalizadasDaFase,
  todasAsExigencias,
  type ExigenciaLocalizada,
  type GrupoDaExigencia,
  type RepeticaoDaExigencia,
} from '../../../shared/exigencias/consulta-das-exigencias';
import {
  comExigencia,
  exigenciaNova,
  exigenciaSemNormaResolvida,
  semAExigencia,
} from '../../../shared/exigencias/exigencias-documentais';
import { finalidadeDaExigencia } from '../../../shared/exigencias/formulario-da-exigencia';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { FaseEmEdicao } from '../fase-em-edicao';

/**
 * As exigências documentais da fase aberta: como cada documento está declarado na árvore do
 * rascunho, o que a conferência lê dele e as escritas que passam pela declaração. Cada passo da
 * fase tem a sua instância, porque o Cronograma embute um passo por fase.
 */
@Injectable()
export class ExigenciasDaFaseStore {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeDocumentos = inject(CatalogoDeDocumentos);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly faseDoRascunho = this.faseEmEdicao.faseDoRascunho;
  private readonly fasesDoCronograma = this.faseEmEdicao.fasesDoCronograma;
  private readonly versaoDoFormulario = this.faseEmEdicao.espelho.versao;

  /** Só as modalidades que as ofertas de vagas selecionam podem exigir documento. */
  readonly modalidades = computed(() => this.store.modalidadesDoProcesso());

  /**
   * Como cada documento desta fase está declarado na árvore — solto, ou dentro de um grupo
   * que o combina com outros.
   *
   * Indexado pelo tipo de documento porque é por ele que a tela endereça a exigência. Quando o
   * mesmo tipo é declarado mais de uma vez na fase, guarda todas: a lista mostra uma linha só,
   * e é preciso dizer isso em vez de deixar o operador editar uma das declarações sem saber
   * que há outra.
   */
  readonly declaracoesPorDocumento = computed(() => {
    this.versaoDoFormulario();
    const fase = this.faseDoRascunho();
    if (fase === null) return new Map<string, readonly ExigenciaLocalizada[]>();

    const porTipo = new Map<string, ExigenciaLocalizada[]>();
    for (const achada of exigenciasLocalizadasDaFase(this.store.draft().documentos, fase.codigo)) {
      const atuais = porTipo.get(achada.documento.tipoDocumentoId) ?? [];
      atuais.push(achada);
      porTipo.set(achada.documento.tipoDocumentoId, atuais);
    }
    return porTipo;
  });

  /**
   * Como o documento é exigido: por si, ou como alternativa dentro de um grupo. Vazio quando
   * está solto, que é o caso comum e não precisa de explicação.
   */
  posicaoNaArvore(id: string): string {
    const grupo = this.grupoDoDocumento(id);
    if (grupo === null) return '';

    if (grupo.tipo === 'E') {
      return `Faz parte de um conjunto de ${grupo.alternativas} documentos que valem juntos.`;
    }

    const minima = grupo.quantidadeMinima ?? 1;
    return minima === 1
      ? `É uma das ${grupo.alternativas} alternativas de um grupo — basta entregar uma delas.`
      : `É uma das ${grupo.alternativas} alternativas de um grupo que pede ${minima} delas.`;
  }

  /** O grupo que o documento compõe, ou `null` quando ele é exigido por si. */
  grupoDoDocumento(id: string): GrupoDaExigencia | null {
    const grupo = (this.declaracoesPorDocumento().get(id) ?? [])[0]?.grupo ?? null;

    // Grupo de um filho só não oferece alternativa nenhuma: satisfazê-lo é satisfazer aquele
    // filho, e a folha é materialmente igual a uma exigência solta. Anunciá-la como grupo
    // informaria errado antes de informar mal.
    return grupo !== null && grupo.alternativas >= 2 ? grupo : null;
  }

  /**
   * O aviso de que este documento está declarado mais de uma vez nesta fase.
   *
   * A tela mostra uma linha por tipo de documento, e editar essa linha mexe na primeira
   * declaração. Enquanto isso ficava calado, o operador acreditava estar editando a exigência
   * que estava vendo.
   */
  declaradoMaisDeUmaVez(id: string): string {
    const quantas = (this.declaracoesPorDocumento().get(id) ?? []).length;
    if (quantas <= 1) return '';

    return `Este documento está declarado ${quantas} vezes nesta fase, em posições diferentes da árvore. O que se edita aqui é a primeira declaração.`;
  }

  /**
   * Os documentos que esta fase exige, na ordem do catálogo.
   *
   * A tela lista o que foi declarado, não o catálogo inteiro: com setenta e quatro tipos
   * em nove categorias, uma caixa por documento em cada fase punha centenas de controles
   * numa rolagem só, e o que o certame de fato exige — dois, três por fase — ficava
   * perdido no meio deles.
   */
  readonly documentosDaFase = computed<readonly DocumentoDefinicao[]>(() => {
    this.versaoDoFormulario();
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    const exigencias = this.store.draft().documentos;
    // Inclui o que vale em todas as fases: a intenção só se materializa na gravação, e sem
    // isto a fase acrescentada depois não mostraria o documento que o operador já declarou
    // valer nela.
    const declarados = new Set([
      ...exigenciasDaFase(exigencias, fase.codigo).map((e) => e.tipoDocumentoId),
      ...exigencias.emTodasAsFases,
    ]);
    const doCatalogo = this.catalogoDeDocumentos
      .documentosPorCategoria()
      .flatMap((grupo) => grupo.docs)
      .filter((doc) => declarados.has(doc.id));

    // O tipo removido do cadastro sai do catálogo vivo, e a exigência que o cita continua no
    // rascunho — a gravação seguinte a reenvia inteira. Sem sintetizar a linha, ela sumia da
    // tela: o operador não conseguia nem conferir nem remover o que continuava sendo exigido.
    const visiveis = new Set(doCatalogo.map((doc) => doc.id));
    const foraDoCadastro = [...declarados]
      .filter((id) => !visiveis.has(id))
      .map((id) => this.documentoForaDoCadastro(id, exigencias));

    return [...doCatalogo, ...foraDoCadastro];
  });

  /** A linha do tipo que o cadastro não oferece mais, nomeada pelo que o processo guardou. */
  documentoForaDoCadastro(
    tipoDocumentoId: string,
    exigencias: ExigenciasDoRascunho,
  ): DocumentoDefinicao {
    const declarada = todasAsExigencias(exigencias).find(
      (exigencia) => exigencia.tipoDocumentoId === tipoDocumentoId,
    );

    const situacao =
      'Este tipo saiu do cadastro depois de ser exigido aqui. Continua valendo enquanto estiver na lista.';

    return {
      id: tipoDocumentoId,
      nome: declarada?.tipoDocumentoNome ?? 'Documento fora do cadastro ativo',
      descricao: null,
      formatos: null,
      orientacao: `${situacao} Remova-o se não for mais pedido.`,
      situacao,
    };
  }

  /**
   * A exigência deste documento NESTA fase — a unidade que o contrato guarda. Duas fases que
   * pedem o mesmo documento são duas exigências, com entrega, consequência e normas próprias:
   * antes, o rascunho guardava um registro por documento e a segunda fase herdava, calada, o
   * que a primeira declarasse.
   */
  exigenciaDoDocumento(id: string): ExigenciaDeDocumento {
    const fase = this.faseDoRascunho();
    const codigo = fase?.codigo ?? '';
    const exigencias = this.store.draft().documentos;
    const achada = exigenciasDaFase(exigencias, codigo).find(
      (exigencia) => exigencia.tipoDocumentoId === id,
    );
    if (achada !== undefined) return achada;

    // Fase alcançada por "vale em todas as fases" mas ainda não materializada: mostra o que
    // será gravado — o modelo de raiz nesta fase —, não um formulário em branco que mentiria
    // sobre o que o operador já declarou.
    const modelo = exigencias.emTodasAsFases.includes(id)
      ? exigenciasDaRaiz(exigencias).find((exigencia) => exigencia.tipoDocumentoId === id)
      : undefined;
    if (modelo !== undefined)
      return { ...modelo, faseCodigo: codigo, etapaId: null, finalidade: null };

    return exigenciaNova(id, codigo, this.catalogoDeDocumentos.tipoDocumentoPorId().get(id));
  }

  /**
   * As etapas em que esta fase se subdivide, na ordem em que acontecem — vazio quando
   * a fase não tem nenhuma, que é quando o documento só pode ser da fase inteira.
   */
  readonly etapasDaFaseAberta = computed<readonly EtapaPontuada[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    return [...this.store.draft().cronograma.etapas]
      .filter((etapa) => etapa.faseCodigo === fase.codigo)
      .sort((uma, outra) => uma.ordem - outra.ordem);
  });

  /** A etapa que coleta o documento nesta fase; vazio quando ele é da fase inteira. */
  etapaDoDocumento(id: string): string {
    return this.exigenciaDoDocumento(id).etapaId ?? '';
  }

  readonly finalidadesDaFaseAberta = this.faseEmEdicao.finalidadesDaFaseAberta;

  /** O formulário em que o documento é apresentado; `null` enquanto não está definido. */
  finalidadeDoDocumento(id: string): string | null {
    const formulario = finalidadeDaExigencia(
      this.exigenciaDoDocumento(id).finalidade,
      this.finalidadesDaFaseAberta(),
    );
    return formulario.situacao === 'DEFINIDO' ? formulario.finalidade : null;
  }

  /** Se a publicação recusaria esta exigência por falta de norma: a mesma regra que ela aplica. */
  faltaNormaResolvida(id: string): boolean {
    return exigenciaSemNormaResolvida(this.exigenciaDoDocumento(id));
  }

  /**
   * Formatos que o cadastro do tipo de documento declara e o contrato da exigência não
   * expressa. Dizer isso é o que evita o edital prometer ao candidato um arquivo que a
   * exigência recusaria na entrega.
   */
  formatosForaDoContrato(id: string): readonly string[] {
    const tipo = this.catalogoDeDocumentos.tipoDocumentoPorId().get(id);
    return formatosDeclarados(tipo?.formatosAceitos).naoExpressos;
  }

  /** O aviso desses formatos, pronto: edição e consulta dizem a mesma coisa, de uma só origem. */
  avisoDeFormatos(id: string): string | null {
    const foraDoContrato = this.formatosForaDoContrato(id);
    return foraDoContrato.length === 0
      ? null
      : `O cadastro aceita ${foraDoContrato.join(', ')}, que a exigência não sabe declarar — o candidato só poderá entregar os demais.`;
  }

  /**
   * O documento acompanha todas as fases do edital.
   *
   * É intenção de UI, não dado da exigência: o contrato só conhece a exigência materializada
   * em cada fase. Guardar a intenção é o que faz uma fase acrescentada depois receber o
   * documento, em vez de ficar de fora em silêncio.
   */
  valeEmTodasAsFases(id: string): boolean {
    return this.store.draft().documentos.emTodasAsFases.includes(id);
  }

  /** O documento é exigido nesta fase. */
  exigidoNestaFase(id: string): boolean {
    const fase = this.faseDoRascunho();
    if (fase === null) return false;
    const exigencias = this.store.draft().documentos;
    if (exigencias.emTodasAsFases.includes(id)) return true;
    return exigenciasDaFase(exigencias, fase.codigo).some(
      (exigencia) => exigencia.tipoDocumentoId === id,
    );
  }

  /**
   * Marca ou desmarca a exigência do documento nesta fase.
   *
   * Desmarcar tira a exigência DESTA fase; a mesma exigência em outra fase continua, porque
   * são exigências distintas, com entrega e norma próprias.
   */
  alternarExigencia(id: string, marcada: boolean): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    const exigencias = this.store.draft().documentos;
    if (!marcada) {
      // Documento que valia em todas as fases é materializado ANTES de sair desta: largar o
      // alcance sem materializar tiraria o documento também de toda fase que ainda só o tinha
      // por herança — o operador desmarca numa fase e perde em outras, sem nada dizer.
      const materializadas = exigencias.emTodasAsFases.includes(id)
        ? comAlcanceDeTodasAsFases(
            exigencias,
            this.fasesDoCronograma().map((outra) => outra.codigo),
          )
        : exigencias;

      this.store.patchSection('documentos', {
        ...semAExigencia(materializadas, id, fase.codigo),
        emTodasAsFases: materializadas.emTodasAsFases.filter((item) => item !== id),
      });
      return;
    }

    this.store.patchSection(
      'documentos',
      comExigencia(
        exigencias,
        exigenciaNova(id, fase.codigo, this.catalogoDeDocumentos.tipoDocumentoPorId().get(id)),
      ),
    );
  }

  /**
   * Troca "vale para todas as fases" pelo recorte explícito, partindo das fases que o edital
   * tem hoje. Congelar o conjunto atual preserva o que estava valendo; começar do zero
   * apagaria a exigência de todas as outras fases por causa de uma decisão tomada numa só.
   */
  recortarPorFase(id: string): void {
    this.store.patchSection(
      'documentos',
      recortadoPorFase(this.store.draft().documentos, id, this.contextoDoAlcance(id)),
    );
  }

  /** Devolve o documento ao regime de acompanhar todas as fases do edital. */
  valerEmTodasAsFases(id: string): void {
    this.store.patchSection(
      'documentos',
      valendoEmTodasAsFases(this.store.draft().documentos, id, this.contextoDoAlcance(id)),
    );
  }

  contextoDoAlcance(id: string): ContextoDoAlcance {
    const fases = this.fasesDoCronograma().map((fase) => fase.codigo);
    return {
      fases,
      faseAberta: this.faseDoRascunho()?.codigo ?? fases[0] ?? '',
      modelo: this.exigenciaDoDocumento(id),
      repeticao: this.repeticaoDeclarada(id),
      restricao: this.catalogoDeDocumentos.tipoDocumentoPorId().get(id),
    };
  }

  /**
   * A repetição declarada para o documento nesta fase. Na fase alcançada por "vale em todas as
   * fases" e ainda não materializada, é a do modelo de raiz, que a gravação copia para ela.
   */
  repeticaoDeclarada(id: string): RepeticaoDaExigencia | null {
    const declarada = (this.declaracoesPorDocumento().get(id) ?? [])[0];
    if (declarada !== undefined) return declarada.repeticao;

    const exigencias = this.store.draft().documentos;
    if (!exigencias.emTodasAsFases.includes(id)) return null;
    const modelo = exigencias.raizes.find(
      (no) => no.tipo === 'FOLHA' && no.documento?.tipoDocumentoId === id,
    );
    return modelo === undefined || modelo.repetePorEntidade === null
      ? null
      : { grupo: modelo.repetePorEntidade, herdada: false };
  }

  /**
   * Edita a declaração desta fase. Mexer nela é dizer que a declaração é própria — e "vale em
   * todas" quer dizer a MESMA declaração em toda fase. Mantendo a marca, as fases passavam a
   * divergir com o regime global ainda ligado: a releitura ao reabrir o processo não reconhecia
   * mais a intenção, e a fase criada depois ficava sem o documento, em silêncio. O recorte
   * congela o que valia em cada fase antes de aplicar a edição nesta.
   */
  editarDeclaracao(
    id: string,
    montar: (exigencias: ExigenciasDoRascunho) => ExigenciasDoRascunho,
  ): void {
    if (this.faseDoRascunho() === null) return;

    if (this.valeEmTodasAsFases(id)) this.recortarPorFase(id);

    this.store.patchSection('documentos', montar(this.store.draft().documentos));
  }

  escreverGatilho(id: string, exigencia: ExigenciaDeDocumento): void {
    this.editarDeclaracao(id, (exigencias) => comExigencia(exigencias, exigencia));
  }

  escreverExigencia(id: string, patch: Partial<ExigenciaDeDocumento>): void {
    this.editarDeclaracao(id, (exigencias) =>
      comExigencia(exigencias, { ...this.exigenciaDoDocumento(id), ...patch }),
    );
  }
}
