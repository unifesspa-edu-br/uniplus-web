import { DestroyRef, Injectable, Signal, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  type FaseDaNovaTentativa,
  destinoAcessivel,
} from '@uniplus/shared-ui/components';
import { avisoDeFalhaDoLookup } from '../../shared/foco';
import { Observable, tap } from 'rxjs';
import {
  API_MAX_PAGE_SIZE,
  ApiResult,
  Cursor,
  LookupCompleto,
  ResolucaoDeVinculo,
  descreverVinculo,
  lookupCompleto,
  resolverVinculo,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CursosApi, LocaisOfertaApi, OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import type { UiLookupFalho } from '@uniplus/shared-ui/components';
import {
  rotularCidadeETipo,
  rotularCursoCompleto,
  rotularCursoNaListagem,
  rotularGrauENivel,
  rotularLocalOferta,
  rotularUnidade,
} from './rotulos-da-oferta';

export const ID_DO_TITULO_DA_LISTA = 'cfg-ofertas-list-title';

export type ChaveDoVinculo = 'curso' | 'local' | 'unidade';

/** Catálogo de chave estrangeira com o estado de falha que a tela mostra e a nova tentativa. */
export interface LeituraDoVinculo<T> extends LookupCompleto<T> {
  /** A busca falhou, ou o operador pediu nova tentativa e a falha anterior segue na tela até ela terminar. */
  readonly falhou: Signal<boolean>;
  /** A fase da nova tentativa, a mesma na listagem e no campo do formulário. */
  readonly fase: Signal<FaseDaNovaTentativa>;
  /** Nova tentativa pela listagem ou pelo campo: o foco, se perdido, vai ao campo aberto ou ao título da lista. */
  tentar(): void;
}

export interface VinculosEscolhidos {
  readonly cursoId: string;
  readonly localOfertaId: string;
  readonly unidadeOfertanteOrigemId: string;
}

export interface OpcaoDeVinculo {
  readonly valor: string;
  readonly rotulo: string;
}

/** O que o select de um vínculo precisa saber do catálogo. */
export interface CatalogoDoFormulario {
  readonly opcoes: readonly OpcaoDeVinculo[];
  readonly falhou: boolean;
  readonly pendente: boolean;
  readonly fase: FaseDaNovaTentativa;
  /** Descrição do item escolhido, abaixo do select. */
  readonly contexto: string | null;
}

export interface VinculosDoFormulario {
  readonly curso: CatalogoDoFormulario;
  readonly local: CatalogoDoFormulario;
  readonly unidade: CatalogoDoFormulario;
  /** Texto dos três vínculos, somente leitura, na edição. */
  readonly edicao: { readonly curso: string; readonly local: string; readonly unidade: string };
}

/**
 * Leitura dos catálogos a que a oferta se liga: Curso e Local de oferta resolvem os rótulos da
 * listagem e ficam sempre carregados; a Unidade (cross-módulo, ADR-0056) só alimenta o select de
 * criação, então é lida na primeira abertura. Percorrem todas as páginas por cursor: um select de
 * chave estrangeira não pode esconder opções.
 */
@Injectable()
export class VinculosDaOferta {
  private readonly cursosApi = inject(CursosApi);
  private readonly locaisApi = inject(LocaisOfertaApi);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private unidadesPedidas = false;

  readonly cursos = this.ler(
    (cursor) => this.cursosApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    'cfg-oferta-curso-id',
    'cursos',
  );
  readonly locais = this.ler(
    (cursor) => this.locaisApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    'cfg-oferta-local-id',
    'locais de oferta',
  );
  readonly unidades = this.ler(
    (cursor) => this.unidadesApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    'cfg-oferta-unidade-id',
    'unidades',
  );

  private readonly cursosPorId = computed(
    () => new Map(this.cursos.opcoes().map((curso) => [curso.id, curso] as const)),
  );
  private readonly locaisPorId = computed(
    () => new Map(this.locais.opcoes().map((local) => [local.id, local] as const)),
  );
  private readonly unidadesPorId = computed(
    () => new Map(this.unidades.opcoes().map((unidade) => [unidade.id, unidade] as const)),
  );

  /** Só os catálogos que a listagem precisa resolver: a unidade ofertante já vem congelada na oferta. */
  readonly lookupsComFalha = computed<readonly UiLookupFalho[]>(() => [
    ...(this.cursos.falhou()
      ? [
          {
            nome: 'cursos',
            pendente: this.cursos.pendente(),
            fase: this.cursos.fase(),
            recarregar: () => this.cursos.tentar(),
          },
        ]
      : []),
    ...(this.locais.falhou()
      ? [
          {
            nome: 'locais de oferta',
            pendente: this.locais.pendente(),
            fase: this.locais.fase(),
            recarregar: () => this.locais.tentar(),
          },
        ]
      : []),
  ]);

  constructor() {
    this.cursos.recarregar();
    this.locais.recarregar();
  }

  /** Nova tentativa pedida no campo do vínculo, no formulário. */
  tentarNoCampo(vinculo: ChaveDoVinculo): void {
    const leituras = { curso: this.cursos, local: this.locais, unidade: this.unidades };
    leituras[vinculo].tentar();
  }

  /** Lê as unidades na primeira abertura do formulário de criação; as demais reaproveitam a lista. */
  carregarUnidades(): void {
    if (!this.unidadesPedidas) {
      this.unidadesPedidas = true;
      this.unidades.recarregar();
    }
  }

  /** Estado da resolução do curso da linha: carregando, catálogo recusado ou id fora do catálogo. */
  cursoDaOferta(cursoId: string): ResolucaoDeVinculo {
    return resolverVinculo(this.cursos, this.cursosPorId().get(cursoId), rotularCursoNaListagem);
  }

  localDaOferta(localOfertaId: string): ResolucaoDeVinculo {
    return resolverVinculo(this.locais, this.locaisPorId().get(localOfertaId), rotularLocalOferta);
  }

  grauDoCurso(cursoId: string): string {
    return this.cursosPorId().get(cursoId)?.grau?.trim() || '—';
  }

  /** O curso fora da linha, onde as outras colunas não o situam: o código vem junto do nome. */
  rotuloCompletoDoCurso(cursoId: string): string {
    return descreverVinculo(
      resolverVinculo(this.cursos, this.cursosPorId().get(cursoId), rotularCursoCompleto),
    );
  }

  rotuloDoLocal(localOfertaId: string): string {
    return descreverVinculo(this.localDaOferta(localOfertaId));
  }

  /** Os catálogos como o formulário os mostra, para o que o operador escolheu até agora. */
  doFormulario(
    escolhidos: Signal<VinculosEscolhidos>,
    oferta: Signal<OfertaCursoDto | null>,
  ): Signal<VinculosDoFormulario> {
    return computed(() => {
      const { cursoId, localOfertaId, unidadeOfertanteOrigemId } = escolhidos();
      const curso = this.cursosPorId().get(cursoId);
      const local = this.locaisPorId().get(localOfertaId);
      const unidade = this.unidadesPorId().get(unidadeOfertanteOrigemId);
      const emEdicao = oferta();
      const contextoDoCurso = curso ? rotularGrauENivel(curso) : null;
      return {
        curso: this.catalogo(this.cursos, rotularCursoCompleto, contextoDoCurso),
        local: this.catalogo(
          this.locais,
          rotularLocalOferta,
          local ? rotularCidadeETipo(local) : null,
        ),
        unidade: this.catalogo(
          this.unidades,
          (item) => `${item.sigla} — ${item.nome}`,
          unidade ? rotularUnidade(unidade) : null,
        ),
        edicao: this.paraEdicao(cursoId, localOfertaId, contextoDoCurso, emEdicao),
      };
    });
  }

  private paraEdicao(
    cursoId: string,
    localOfertaId: string,
    contextoDoCurso: string | null,
    oferta: OfertaCursoDto | null,
  ) {
    return {
      curso: contextoDoCurso ?? this.rotuloCompletoDoCurso(cursoId),
      local: this.rotuloDoLocal(localOfertaId),
      unidade: oferta ? rotularUnidade(oferta.unidadeOfertante) : '—',
    };
  }

  private catalogo<T extends { readonly id: string }>(
    leitura: LeituraDoVinculo<T>,
    rotular: (item: T) => string,
    contexto: string | null,
  ): CatalogoDoFormulario {
    return {
      opcoes: leitura.opcoes().map((item) => ({ valor: item.id, rotulo: rotular(item) })),
      falhou: leitura.falhou(),
      pendente: leitura.pendente(),
      fase: leitura.fase(),
      contexto,
    };
  }

  private ler<T>(
    pagina: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>,
    idDoCampo: string,
    assunto: string,
  ): LeituraDoVinculo<T> {
    const lookup = lookupCompleto<T>(
      (cursor) => pagina(cursor).pipe(tap((resultado) => this.avisarFalhaDoServidor(resultado))),
      this.destroyRef,
    );
    const falhou = avisoDeFalhaDoLookup(lookup);
    const novaTentativa = acompanharNovaTentativa({
      assunto,
      pendente: lookup.pendente,
      falhou,
      destino: () =>
        destinoAcessivel(
          document.getElementById(idDoCampo),
          document.getElementById(ID_DO_TITULO_DA_LISTA),
        ),
    });
    return {
      ...lookup,
      falhou,
      fase: novaTentativa.fase,
      tentar: () => novaTentativa.executar(() => lookup.recarregar()),
    };
  }

  private avisarFalhaDoServidor(resultado: ApiResult<unknown>): void {
    if (!resultado.ok && resultado.problem.status >= 500) {
      this.notifications.errorFromProblem(resultado.problem);
    }
  }
}
