import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
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
  termoDisponivelDe,
  type OpcaoDoDocumento,
  type TermoDisponivel,
} from '@uniplus/shared-ui/components';

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
  readonly fatos = computed(() => this.catalogo.data() ?? []);
  readonly catalogoComErro = computed(
    () => this.catalogo.problem() !== null || this.catalogo.error() !== undefined,
  );
  readonly tiposDeProcesso = computed(() => this.tipos.data() ?? []);
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
