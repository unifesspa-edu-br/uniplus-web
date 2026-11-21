import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { API_MAX_PAGE_SIZE, lookupCompleto } from '@uniplus/shared-core/http';
import {
  FasesCanonicasApi,
  type FaseCanonicaVocabularioDto,
} from '@uniplus/shared-data/configuracao';
import { comCodigoAparado, temCodigoUtilizavel } from '../../shared/codigo-e-rotulo';
import { listaDeReferencia } from '../../shared/lista-de-referencia';

export interface OpcaoDeFase {
  readonly codigo: string;
  readonly rotulo: string;
}

const MARCA_SEM_CADASTRO = '(não cadastrada)';

/**
 * As fases que a API oferece, lidas a cada abertura da página: o catálogo dá as opções, na ordem
 * dele, e os nomes. O cadastro de fases só diz quais delas ainda não foram cadastradas.
 */
@Injectable()
export class FasesDoGrafoStore {
  private readonly api = inject(FasesCanonicasApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogo = listaDeReferencia<FaseCanonicaVocabularioDto>(
    () => this.api.listarVocabulario(),
    this.destroyRef,
    temCodigoUtilizavel,
    comCodigoAparado,
  );
  private readonly cadastro = lookupCompleto(
    (cursor) => this.api.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );

  readonly nomes = computed(
    () => new Map(this.catalogo.opcoes().map((fase) => [fase.codigo, fase.nome])),
  );

  /** Sem o catálogo não há opção a oferecer; o aviso da página traz a nova tentativa. */
  readonly falhou = this.catalogo.falhou;
  readonly pendente = this.catalogo.pendente;

  /**
   * Fase do catálogo que o cadastro não tem continua selecionável: a API aceita a aresta, e o
   * seed dela cria arestas antes de as fases serem cadastradas. Sem a resposta do cadastro, não
   * se afirma que a fase falta.
   */
  private readonly semCadastro = computed(() => {
    if (this.cadastro.pendente() || this.cadastro.comErro()) return new Set<string>();
    const cadastradas = new Set(this.cadastro.opcoes().map((fase) => fase.codigo));
    return new Set(
      this.catalogo
        .opcoes()
        .map((fase) => fase.codigo)
        .filter((codigo) => !cadastradas.has(codigo)),
    );
  });

  readonly opcoes = computed<readonly OpcaoDeFase[]>(() =>
    this.catalogo.opcoes().map(({ codigo, nome }) => ({
      codigo,
      rotulo: this.semCadastro().has(codigo)
        ? `${codigo} — ${nome} ${MARCA_SEM_CADASTRO}`
        : `${codigo} — ${nome}`,
    })),
  );

  constructor() {
    this.catalogo.garantirCarregado();
    this.cadastro.recarregar();
  }

  tentarDeNovo(): void {
    this.catalogo.tentarDeNovo();
  }

  nomeDaFase(codigo: string): string {
    return this.nomes().get(codigo) ?? '';
  }
}
