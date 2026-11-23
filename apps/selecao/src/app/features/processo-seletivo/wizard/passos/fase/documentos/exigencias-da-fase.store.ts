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
  restritoAsFases,
  valendoEmTodasAsFases,
  type ContextoDoAlcance,
} from '../../../shared/exigencias/alcance-das-exigencias';
import { formatosDeclarados } from '../../../shared/exigencias/arquivo-da-exigencia';
import {
  exigenciasDaFase,
  exigenciasLocalizadasDaFase,
  type ExigenciaLocalizada,
  type GrupoDaExigencia,
  type RepeticaoDaExigencia,
} from '../../../shared/exigencias/consulta-das-exigencias';
import {
  comExigencia,
  comExigenciaSemGrupo,
  exigenciaNova,
  exigenciaSemNormaResolvida,
} from '../../../shared/exigencias/exigencias-documentais';
import { finalidadeDaExigencia } from '../../../shared/exigencias/formulario-da-exigencia';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import { documentosDeclarados, modeloParaTodasAsFases } from './documentos-declarados';
import { declaracaoHerdada, semDeclaracaoDaFase } from './declaracoes-da-fase';

/**
 * As exigências documentais da fase aberta: como cada documento está declarado na estrutura de regras do
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

  readonly declaracoesDaFase = computed(() => {
    this.versaoDoFormulario();
    const fase = this.faseDoRascunho();
    if (fase === null) return [];
    const exigencias = this.store.draft().documentos;
    const declaradas = exigenciasLocalizadasDaFase(exigencias, fase.codigo);
    const herdadas = exigencias.emTodasAsFases.flatMap((tipo) =>
      declaracaoHerdada(exigencias, declaradas, tipo, fase.codigo),
    );
    return [...declaradas, ...herdadas];
  });

  private declaracao(id: string): ExigenciaLocalizada | undefined {
    return (
      this.declaracoesDaFase().find((item) => item.identificadorNoRascunho === id) ??
      this.declaracoesDaFase().find((item) => item.documento.tipoDocumentoId === id)
    );
  }

  estaEmGrupo(id: string): boolean {
    return this.declaracao(id)?.grupo != null;
  }

  tipoDoDocumento(id: string): string {
    return this.declaracao(id)?.documento.tipoDocumentoId ?? id;
  }

  /**
   * Como o documento é exigido: por si, ou como alternativa dentro de um grupo. Vazio quando
   * está solto, que é o caso comum e não precisa de explicação.
   */
  posicaoNaComprovacao(id: string): string {
    const grupo = this.grupoDoDocumento(id);
    if (grupo === null) return '';

    if (grupo.forma === 'TODOS_OS_ITENS') {
      return `Faz parte de um conjunto de ${grupo.alternativas} documentos que valem juntos.`;
    }

    const minima = grupo.quantidadeMinima ?? 1;
    return minima === 1
      ? `É uma das ${grupo.alternativas} alternativas de um grupo — basta entregar uma delas.`
      : `É uma das ${grupo.alternativas} alternativas de um grupo que pede ${minima} delas.`;
  }

  /** O grupo que o documento compõe, ou `null` quando ele é exigido por si. */
  grupoDoDocumento(id: string): GrupoDaExigencia | null {
    const grupo = this.declaracao(id)?.grupo ?? null;

    // Grupo de um item só não oferece alternativa nenhuma: satisfazê-lo é satisfazer aquele
    // item, e a regra de documento é materialmente igual a uma exigência solta. Anunciá-la como grupo
    // informaria errado antes de informar mal.
    return grupo !== null && grupo.alternativas >= 2 ? grupo : null;
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
    return documentosDeclarados(
      fase.codigo,
      exigencias,
      this.catalogoDeDocumentos.documentosPorCategoria().flatMap((grupo) => grupo.docs),
    );
  });

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
    const achada = this.declaracao(id)?.documento;
    if (achada !== undefined) return achada;

    const modelo = modeloParaTodasAsFases(exigencias, id);
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
    const tipo = this.catalogoDeDocumentos.tipoDocumentoPorId().get(this.tipoDoDocumento(id));
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
    return (
      this.declaracao(id)?.grupo == null &&
      this.store.draft().documentos.emTodasAsFases.includes(this.tipoDoDocumento(id))
    );
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
      this.removerExigencia(id, fase.codigo, exigencias);
      return;
    }

    this.acrescentarExigencia(id, fase.codigo, exigencias);
  }

  private acrescentarExigencia(
    id: string,
    faseCodigo: string,
    exigencias: ExigenciasDoRascunho,
  ): void {
    const tipo = this.catalogoDeDocumentos.tipoDocumentoPorId().get(id);
    this.store.patchSection(
      'documentos',
      comExigenciaSemGrupo(exigencias, exigenciaNova(id, faseCodigo, tipo)),
    );
  }

  private removerExigencia(id: string, faseCodigo: string, exigencias: ExigenciasDoRascunho): void {
    const tipo = this.tipoDoDocumento(id);
    const declaracao = this.declaracao(id);
    const materializadas = this.valeEmTodasAsFases(id)
      ? comAlcanceDeTodasAsFases(
          exigencias,
          this.fasesDoCronograma().map((fase) => fase.codigo),
        )
      : exigencias;
    this.store.patchSection(
      'documentos',
      semDeclaracaoDaFase(materializadas, faseCodigo, tipo, declaracao),
    );
  }

  /**
   * Troca "vale para todas as fases" pela seleção explícita de fases, partindo das fases que o edital
   * tem hoje. Congelar o conjunto atual preserva o que estava valendo; começar do zero
   * apagaria a exigência de todas as outras fases por causa de uma decisão tomada numa só.
   */
  recortarPorFase(id: string): void {
    this.store.patchSection(
      'documentos',
      restritoAsFases(
        this.store.draft().documentos,
        this.tipoDoDocumento(id),
        this.contextoDoAlcance(id),
      ),
    );
  }

  /** Devolve o documento ao regime de acompanhar todas as fases do edital. */
  valerEmTodasAsFases(id: string): void {
    this.store.patchSection(
      'documentos',
      valendoEmTodasAsFases(
        this.store.draft().documentos,
        this.tipoDoDocumento(id),
        this.contextoDoAlcance(id),
      ),
    );
  }

  contextoDoAlcance(id: string): ContextoDoAlcance {
    const fases = this.fasesDoCronograma().map((fase) => fase.codigo);
    return {
      fases,
      faseAberta: this.faseDoRascunho()?.codigo ?? fases[0] ?? '',
      modelo: this.exigenciaDoDocumento(id),
      repeticao: this.repeticaoDeclarada(id),
      restricao: this.catalogoDeDocumentos.tipoDocumentoPorId().get(this.tipoDoDocumento(id)),
    };
  }

  /**
   * A repetição declarada para o documento nesta fase. Na fase alcançada por "vale em todas as
   * fases" e ainda não materializada, é a do modelo de regra principal, que a gravação copia para ela.
   */
  repeticaoDeclarada(id: string): RepeticaoDaExigencia | null {
    const declarada = this.declaracao(id);
    if (declarada !== undefined) return declarada.repeticao;

    const exigencias = this.store.draft().documentos;
    if (!exigencias.emTodasAsFases.includes(this.tipoDoDocumento(id))) return null;
    const modelo = exigencias.regrasDeComprovacao.find(
      (regra) =>
        regra.forma === 'DOCUMENTO' &&
        regra.documento?.tipoDocumentoId === this.tipoDoDocumento(id),
    );
    return modelo === undefined || modelo.grupoDoFormularioParaRepeticao === null
      ? null
      : { grupo: modelo.grupoDoFormularioParaRepeticao, herdada: false };
  }

  /**
   * Edita a declaração desta fase. Mexer nela é dizer que a declaração é própria — e "vale em
   * todas" quer dizer a MESMA declaração em toda fase. Mantendo a marca, as fases passavam a
   * divergir com o regime global ainda ligado: a releitura ao reabrir o processo não reconhecia
   * mais a intenção, e a fase criada depois ficava sem o documento, em silêncio. A seleção de fases
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
    this.editarDeclaracao(id, (exigencias) =>
      comExigencia(exigencias, this.declaracao(id)?.identificadorNoRascunho ?? id, exigencia),
    );
  }

  escreverExigencia(id: string, patch: Partial<ExigenciaDeDocumento>): void {
    this.editarDeclaracao(id, (exigencias) =>
      comExigencia(exigencias, this.declaracao(id)?.identificadorNoRascunho ?? id, {
        ...this.exigenciaDoDocumento(id),
        ...patch,
      }),
    );
  }
}
