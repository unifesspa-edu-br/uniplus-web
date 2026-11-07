import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  ProblemI18nService,
  STATUS_HTTP,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  FatoCandidatoView,
  FaseCanonicaDto,
  ModeloFormularioView,
  TermosConsentimentoApi,
  TipoDocumentoDto,
  TipoProcessoDto,
} from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  termoDisponivelDe,
  type LeituraAcompanhada,
  type OpcaoDoDocumento,
  type OpcoesDaLeitura,
  type TermoDisponivel,
} from '@uniplus/shared-ui/components';

/** O título do modelo fica na tela quando o aviso de falha sai com o botão: é para onde o foco volta. */
const ID_DO_TITULO_DO_MODELO = 'cfg-modelo-titulo';

/** Sem o item lido a tela não faz o que a mensagem diz. */
const SEM_OS_TERMOS =
  'Sem a lista de termos não é possível exigir um termo novo nem trocar a versão.';
const SEM_O_CATALOGO = 'Sem o catálogo não é possível acrescentar campos nem declarar condições.';
const SEM_OS_TIPOS =
  'Sem os tipos de processo o campo Tipo de processo não lista as opções nem mostra o tipo do modelo.';
const SEM_O_VOCABULARIO =
  'Sem as fases e os tipos de documento não é possível acrescentar documentos exigidos.';

function leituraNoTitulo(opcoes: Omit<OpcoesDaLeitura, 'destino'>): LeituraAcompanhada {
  return acompanharLeitura({
    ...opcoes,
    destino: () => document.getElementById(ID_DO_TITULO_DO_MODELO),
  });
}

function falhaCom(falhou: Signal<boolean>, mensagem: string): Signal<string | null> {
  return computed(() => (falhou() ? mensagem : null));
}

@Injectable()
export class ModeloFormularioEdicaoStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly termosApi = inject(TermosConsentimentoApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  private readonly detalhe = useApiResource<ModeloFormularioView>(() => ({
    url: `${this.basePath}/api/configuracao/admin/modelos-formulario/${this.id}`,
    context: withVendorMime('modelo-formulario', 1),
  }));
  readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));
  private readonly fasesCanonicas = useApiResource<readonly FaseCanonicaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/fases-canonicas`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('fase-canonica', 1),
  }));
  private readonly tiposDocumento = useApiResource<readonly TipoDocumentoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-documento`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('tipo-documento', 1),
  }));
  private readonly tipos = useApiResource<readonly TipoProcessoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-processo`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('tipo-processo', 1),
  }));

  readonly modelo = this.detalhe.data;
  readonly carregando = this.detalhe.isLoading;
  readonly erroAoCarregar = computed(() => {
    const problem = this.detalhe.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.detalhe.error()
        ? 'Erro inesperado ao carregar o modelo.'
        : null;
  });
  /** O modelo não existe: não há o que tentar de novo, e a saída é a volta à lista. */
  readonly naoEncontrado = computed(
    () => this.detalhe.problem()?.status === STATUS_HTTP.NAO_ENCONTRADO,
  );
  readonly fatos = computed(() => this.catalogo.data() ?? []);
  readonly catalogoComErro = computed(
    () => this.catalogo.problem() !== null || this.catalogo.error() !== undefined,
  );
  readonly tiposDeProcesso = computed(() => this.tipos.data() ?? []);
  readonly tiposComErro = computed(
    () => this.tipos.problem() !== null || this.tipos.error() !== undefined,
  );
  readonly fases = computed<readonly OpcaoDoDocumento[]>(() =>
    (this.fasesCanonicas.data() ?? []).map(({ codigo, nome, permiteComplementacao }) => ({
      codigo,
      nome,
      permiteComplementacao,
    })),
  );
  readonly tiposDeDocumento = computed<readonly OpcaoDoDocumento[]>(() =>
    (this.tiposDocumento.data() ?? []).map(({ codigo, nome }) => ({ codigo, nome })),
  );
  readonly vocabularioDosDocumentosComErro = computed(() =>
    [this.fasesCanonicas, this.tiposDocumento].some(
      (recurso) => recurso.problem() !== null || recurso.error() !== undefined,
    ),
  );
  readonly termosDisponiveis = signal<readonly TermoDisponivel[]>([]);
  readonly termosComErro = signal(false);
  readonly termosCarregando = signal(false);
  readonly vocabularioDosDocumentosCarregando = computed(
    () => this.fasesCanonicas.isLoading() || this.tiposDocumento.isLoading(),
  );

  readonly leituraDoModelo = leituraNoTitulo({
    assunto: 'modelo',
    falha: computed(() => (this.naoEncontrado() ? null : this.erroAoCarregar())),
    pendente: this.carregando,
    recusada: this.naoEncontrado,
    recarregar: () => this.recarregar(),
  });
  readonly leituraDosTermos = leituraNoTitulo({
    assunto: 'termos',
    falha: falhaCom(this.termosComErro, SEM_OS_TERMOS),
    pendente: this.termosCarregando,
    recarregar: () => this.carregarTermos(),
  });
  readonly leituraDoCatalogo = leituraNoTitulo({
    assunto: 'catálogo',
    falha: falhaCom(this.catalogoComErro, SEM_O_CATALOGO),
    pendente: this.catalogo.isLoading,
    recarregar: () => this.catalogo.reload(),
  });
  readonly leituraDosTipos = leituraNoTitulo({
    assunto: 'tipos de processo',
    falha: falhaCom(this.tiposComErro, SEM_OS_TIPOS),
    pendente: this.tipos.isLoading,
    recarregar: () => this.tipos.reload(),
  });
  readonly leituraDoVocabulario = leituraNoTitulo({
    assunto: 'vocabulário',
    falha: falhaCom(this.vocabularioDosDocumentosComErro, SEM_O_VOCABULARIO),
    pendente: this.vocabularioDosDocumentosCarregando,
    recarregar: () => this.recarregarVocabularioDosDocumentos(),
  });

  constructor() {
    this.carregarTermos();
  }

  carregarTermos(): void {
    this.termosCarregando.set(true);
    this.termosApi
      .listarComVersoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((termos) => {
        this.termosCarregando.set(false);
        this.termosComErro.set(!termos.ok);
        if (termos.ok) this.termosDisponiveis.set(termos.data.map(termoDisponivelDe));
      });
  }

  recarregarVocabularioDosDocumentos(): void {
    this.fasesCanonicas.reload();
    this.tiposDocumento.reload();
  }

  recarregar(): void {
    this.detalhe.reload();
  }
}
