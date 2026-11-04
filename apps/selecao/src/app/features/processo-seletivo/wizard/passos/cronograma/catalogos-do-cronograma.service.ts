import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, type Subscription } from 'rxjs';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  CategoriaDocumentoDto,
  CategoriasDocumentoApi,
  FaseCanonicaDto,
  FasesCanonicasApi,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
  TipoBancaDto,
  TipoDocumentoDto,
  TipoEtapaDto,
  TiposBancaApi,
  FatoCandidatoView,
  FatosCandidatoApi,
  TiposDocumentoApi,
  TiposEtapaApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

import type { DocumentoGrupo } from '../../processo-seletivo.models';
import { hojeNoFusoInstitucional } from '../../shared/fuso-institucional';
import { comoOpcaoDeUnidade } from '../../shared/unidades-do-cadastro';
import { vigenteNoDia } from '../../shared/vigencia';
import { documentosPorCategoria } from './documentos-por-categoria';
import { ordemSugeridaDasFases } from './ordem-sugerida-das-fases';

/** Tipo do `rol_de_regras` que a convenção de contagem referencia. */
const TIPO_REGRA_CONTAGEM = 'algoritmo_contagem_prazo';

/** Tipo do `rol_de_regras` que a etapa de avaliação humana referencia para consolidar as notas. */
const TIPO_REGRA_CONSOLIDACAO = 'regra_consolidacao';

/** Tipo do `rol_de_regras` que a regra de recurso de uma fase referencia. */
const TIPO_REGRA_RECURSO = 'regra_prazo_recurso';

/**
 * Catálogos que o cronograma e a configuração de cada fase referenciam, todos de
 * fora do módulo Seleção: fases canônicas, precedências, tipos de banca, tipos de
 * etapa e categorias de documento são cadastro de Configuração, o tipo de ato é
 * de Publicações, e as regras vêm do `rol_de_regras` versionado.
 *
 * Carrega todos por cursor até o fim, porque uma escolha só sabe o que oferecer
 * quando conhece todas as opções — diferente de uma listagem, em que a página é
 * o que o operador navega. A categoria de documento é a exceção: o backend não
 * pagina aquele recurso.
 *
 * Vive na página do wizard, e não num passo: a linha do tempo e a superfície de
 * configuração por fase leem os mesmos catálogos, e uma instância por passo os
 * baixaria duas vezes para responder a mesma coisa.
 */
@Injectable()
export class CatalogosDoCronograma {
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly precedenciasApi = inject(PrecedenciasFaseApi);
  private readonly bancasApi = inject(TiposBancaApi);
  private readonly categoriasApi = inject(CategoriasDocumentoApi);
  private readonly tiposEtapaApi = inject(TiposEtapaApi);
  private readonly atosApi = inject(TiposAtoApi);
  private readonly regrasApi = inject(RegrasCatalogoApi);
  private readonly tiposDocumentoApi = inject(TiposDocumentoApi);
  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly fases = signal<readonly FaseCanonicaDto[]>([]);
  readonly precedencias = signal<readonly PrecedenciaFaseDto[]>([]);
  readonly bancas = signal<readonly TipoBancaDto[]>([]);
  readonly categorias = signal<readonly CategoriaDocumentoDto[]>([]);
  readonly tiposEtapa = signal<readonly TipoEtapaDto[]>([]);
  readonly atos = signal<readonly TipoAtoPublicadoDto[]>([]);
  readonly regrasRecurso = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasContagem = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasConsolidacao = signal<readonly RegraCatalogoDto[]>([]);
  readonly tiposDocumento = signal<readonly TipoDocumentoDto[]>([]);
  /**
   * Os tipos de documento cuja proteção de dados ainda não foi aprovada (UNI-REQ-0205): não aceitam
   * vínculo novo. A situação vem do próprio tipo, que a API informa a todo usuário.
   */
  readonly tiposAguardandoProtecao = computed<ReadonlySet<string>>(
    () => new Set(this.tiposDocumento().filter((tipo) => !tipo.protecaoAprovada).map((tipo) => tipo.id)),
  );
  /**
   * O catálogo de fatos do candidato. Carregado aqui, e não só no passo do formulário, porque
   * é a gravação das exigências que precisa dele: um gatilho que cita um fato obriga o certame
   * a coletá-lo, e sintetizar esse campo exige saber o nome e o domínio do fato.
   */
  readonly fatos = signal<readonly FatoCandidatoView[]>([]);

  /** Os tipos de documento agrupados pela categoria do cadastro, que é o que a exigência oferece. */
  readonly documentosPorCategoria = computed<readonly DocumentoGrupo[]>(() =>
    documentosPorCategoria(this.tiposDocumento(), this.categorias()),
  );

  /** As unidades do cadastro, a mesma lista que a unidade administradora do processo oferece. */
  readonly unidades = signal<readonly UnidadeDto[]>([]);
  readonly erroDeUnidades = signal<string | null>(null);
  /** Verdadeiro só depois que o cadastro de unidades respondeu com sucesso. */
  readonly unidadesCarregadas = signal(false);

  readonly opcoesDeUnidade = computed(() => this.unidades().map(comoOpcaoDeUnidade));

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /**
   * O dia que a conferência de vigência usa, fixado quando o catálogo é
   * carregado.
   *
   * É signal, e não leitura direta do relógio dentro do `computed`: um
   * `computed` só reage às fontes que lê, e o relógio não é uma delas — a lista
   * de atos vigentes ficaria congelada na data da primeira avaliação, sem nunca
   * se recalcular, o que numa aba aberta através da meia-noite ofereceria a
   * vigência do dia anterior. Amarrar ao carregamento mantém a data e os dados
   * do mesmo instante, que é a coerência que importa aqui.
   */
  private readonly diaDeReferencia = signal(hojeNoFusoInstitucional());

  /** Fase canônica por id — o que a linha do tempo lê para saber o que exigir. */
  readonly fasePorId = computed<ReadonlyMap<string, FaseCanonicaDto>>(
    () => new Map(this.fases().map((fase) => [fase.id, fase])),
  );

  /**
   * O nome da fase canônica pelo código — o que nomeia também a fase que o cronograma ainda não
   * tem. Sem o catálogo carregado, o próprio código.
   */
  readonly nomeDaFase = computed<(codigo: string) => string>(() => {
    const nomePorCodigo = new Map(this.fases().map((fase) => [fase.codigo, fase.nome]));
    return (codigo) => nomePorCodigo.get(codigo) ?? codigo;
  });

  /**
   * Tipos de etapa escolhíveis. O catálogo devolve ativos e inativos juntos, e
   * um inativo não volta a ser opção nova — mas continua exibível quando já
   * referenciado, o que `rotuloDoTipoEtapa` resolve.
   */
  readonly tiposEtapaAtivos = computed(() => this.tiposEtapa().filter((tipo) => tipo.ativo));

  /** Rótulo de um tipo de etapa, ativo ou não — um vínculo gravado precisa de nome. */
  readonly rotuloDoTipoEtapa = computed<ReadonlyMap<string, string>>(
    () => new Map(this.tiposEtapa().map((tipo) => [tipo.id, tipo.nome])),
  );

  /**
   * O tipo de etapa pelo id, ativo ou não. É por aqui que a tela sabe quais caracteres aquele
   * tipo admite — e, por consequência, se a etapa pode ter peso e nota mínima. A série completa
   * importa: uma etapa já gravada num tipo desde então desativado continua tendo de exibir o
   * que aquele tipo admitia.
   */
  readonly tipoEtapaPorId = computed<ReadonlyMap<string, TipoEtapaDto>>(
    () => new Map(this.tiposEtapa().map((tipo) => [tipo.id, tipo])),
  );

  /**
   * Atos que podem ser escolhidos hoje. A vigência é semiaberta — `[início,
   * fim)` —, e é ela que o servidor confere ao resolver o ato declarado: um
   * código fora de vigência é recusado na gravação.
   *
   * "Hoje" é o dia no fuso institucional, não em UTC: à noite em Belém a data
   * UTC já é a de amanhã, e conferir por ela ofereceria um ato horas antes de
   * ele valer — para o servidor recusá-lo em seguida.
   */
  readonly atosVigentes = computed(() => {
    const hoje = this.diaDeReferencia();
    return this.atos().filter((ato) => vigenteNoDia(ato, hoje));
  });

  /** Rótulo de um ato, vigente ou não — um cronograma gravado precisa de nome. */
  readonly rotuloDoAto = computed<ReadonlyMap<string, string>>(
    () => new Map(this.atos().map((ato) => [ato.codigo, ato.nome])),
  );

  /**
   * O ato pelo código, vigente ou não. É por aqui que a tela sabe se um ato é
   * resultado — só ato que é resultado admite papel preliminar ou definitivo — e
   * a série completa importa: um ato já declarado cuja versão encerrou continua
   * descrevendo o que a fase publica.
   */
  readonly atoPorCodigo = computed<ReadonlyMap<string, TipoAtoPublicadoDto>>(
    () => new Map(this.atos().map((ato) => [ato.codigo, ato])),
  );

  /**
   * O tipo de documento pelo id do cadastro. É dele que a exigência tira formato aceito e
   * tamanho máximo — os mesmos valores que a tela já mostra ao lado do seletor de documento.
   */
  readonly tipoDocumentoPorId = computed<ReadonlyMap<string, TipoDocumentoDto>>(
    () => new Map(this.tiposDocumento().map((tipo) => [tipo.id, tipo])),
  );

  /** Tipo de banca por id — o rótulo que a superfície da fase mostra. */
  readonly bancaPorId = computed<ReadonlyMap<string, TipoBancaDto>>(
    () => new Map(this.bancas().map((banca) => [banca.id, banca])),
  );

  /** Categoria de documento por id, para nomear o recorte de competência. */
  readonly categoriaPorId = computed<ReadonlyMap<string, CategoriaDocumentoDto>>(
    () => new Map(this.categorias().map((categoria) => [categoria.id, categoria])),
  );

  /** Fases em ordem cronológica sugerida pelas precedências cadastradas. */
  readonly fasesEmOrdemSugerida = computed<readonly FaseCanonicaDto[]>(() =>
    ordemSugeridaDasFases(this.fases(), this.precedencias()),
  );

  /**
   * Já buscou, ou está buscando. Dois passos do wizard dependem destes
   * catálogos e ambos pedem o carregamento ao nascer; sem a guarda, cada
   * abertura do editor faria a mesma rodada de requisições duas vezes.
   */
  private buscaIniciada = false;

  carregar(): void {
    if (this.buscaIniciada) return;
    this.buscaIniciada = true;
    this.carregando.set(true);
    this.erro.set(null);
    this.diaDeReferencia.set(hojeNoFusoInstitucional());
    this.carregarUnidades();

    forkJoin({
      fases: coletarPaginas((cursor) => this.fasesApi.listar({ cursor })),
      precedencias: coletarPaginas((cursor) => this.precedenciasApi.listar({ cursor })),
      bancas: coletarPaginas((cursor) => this.bancasApi.listar({ cursor })),
      // Conjunto de referência fechado, que o backend devolve inteiro.
      categorias: this.categoriasApi.listar(),
      tiposEtapa: coletarPaginas((cursor) => this.tiposEtapaApi.listar({ cursor })),
      tiposDocumento: coletarPaginas((cursor) => this.tiposDocumentoApi.listar({ cursor })),
      // Conjunto fechado, semeado e governado por código — o servidor o devolve inteiro.
      fatos: this.fatosApi.listar(),
      // `vigentes` assume `true` no servidor, e a série completa é o que
      // resolve o rótulo de um ato já referenciado cuja versão encerrou. Quais
      // podem ser escolhidos é recorte da tela, em `atosVigentes`.
      atos: coletarPaginas((cursor) => this.atosApi.listar({ cursor, vigentes: false })),
      recurso: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_RECURSO, cursor }),
      ),
      contagem: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_CONTAGEM, cursor }),
      ),
      consolidacao: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_CONSOLIDACAO, cursor }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultados) => {
          const {
            fases,
            precedencias,
            bancas,
            categorias,
            tiposEtapa,
            tiposDocumento,
            fatos,
            atos,
            recurso,
            contagem,
            consolidacao,
          } = resultados;

          // Um catálogo faltando deixa a tela oferecendo menos do que existe, e
          // o operador não teria como saber. Ou vêm todos, ou nenhum.
          if (
            !isApiOk(fases) ||
            !isApiOk(precedencias) ||
            !isApiOk(bancas) ||
            !isApiOk(tiposDocumento) ||
            !isApiOk(categorias) ||
            !isApiOk(tiposEtapa) ||
            !isApiOk(fatos) ||
            !isApiOk(atos) ||
            !isApiOk(recurso) ||
            !isApiOk(contagem) ||
            !isApiOk(consolidacao)
          ) {
            this.anunciarErro();
            return;
          }

          this.fases.set(fases.data);
          this.precedencias.set(precedencias.data);
          this.bancas.set(bancas.data);
          this.categorias.set(categorias.data);
          this.tiposEtapa.set(tiposEtapa.data);
          this.tiposDocumento.set(tiposDocumento.data);
          this.fatos.set(fatos.data);
          this.atos.set(atos.data);
          this.regrasRecurso.set(recurso.data);
          this.regrasContagem.set(contagem.data);
          this.regrasConsolidacao.set(consolidacao.data);
          this.carregando.set(false);
        },
        error: () => this.anunciarErro(),
      });
  }

  /**
   * Fora do `forkJoin` dos demais catálogos: a falta das unidades não impede editar o
   * cronograma, só a escolha da unidade de cada fase, e tem o próprio caminho de nova tentativa.
   */
  carregarUnidades(): void {
    this.erroDeUnidades.set(null);
    this.unidadesCarregadas.set(false);
    this.carregamentoDeUnidades?.unsubscribe();
    this.carregamentoDeUnidades = coletarPaginas((cursor) => this.unidadesApi.listar({ cursor }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (!isApiOk(resultado)) {
            this.anunciarErroDeUnidades();
            return;
          }
          this.unidades.set(resultado.data);
          this.unidadesCarregadas.set(true);
        },
        error: () => this.anunciarErroDeUnidades(),
      });
  }

  private carregamentoDeUnidades?: Subscription;

  private anunciarErroDeUnidades(): void {
    this.erroDeUnidades.set('Não foi possível carregar as unidades. Tente novamente.');
  }

  private anunciarErro(): void {
    // Libera a guarda: o que impediu a rodada anterior pode ter passado, e a
    // tela precisa de um caminho de volta que não seja recarregar a página.
    this.buscaIniciada = false;
    this.erro.set(
      'Não foi possível carregar os catálogos de fases, bancas, categorias de documento, atos e regras. Tente novamente.',
    );
    this.carregando.set(false);
  }
}
