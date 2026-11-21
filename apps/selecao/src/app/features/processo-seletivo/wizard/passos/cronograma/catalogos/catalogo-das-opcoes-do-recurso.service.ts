import { Injectable, computed, inject, signal } from '@angular/core';
import type { SituacaoDasOpcoes } from '@uniplus/shared-ui/components';
import {
  OpcoesDoRecursoApi,
  type EfeitoSuspensivoDto,
  type GuardaDaVagaDto,
  type UnidadeDoPrazoDeRecursoDto,
} from '@uniplus/shared-data/selecao';
import { map } from 'rxjs';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

function situacaoDe(leitura: {
  readonly carregando: () => boolean;
  readonly erro: () => string | null;
}): SituacaoDasOpcoes {
  if (leitura.carregando()) return 'carregando';
  return leitura.erro() === null ? 'pronta' : 'falhou';
}

/**
 * As opções que a API aceita na configuração do recurso: as unidades do prazo, os efeitos
 * suspensivos e as guardas da vaga, com a explicação de cada efeito e de cada guarda. São lidas a
 * cada visita à edição, e nada fica guardado fora da página: o vocabulário é da API, e o processo
 * publicado mostra o nome que a própria leitura devolveu.
 */
@Injectable()
export class CatalogoDasOpcoesDoRecurso {
  private readonly api = inject(OpcoesDoRecursoApi);

  readonly unidadesDePrazo = signal<readonly UnidadeDoPrazoDeRecursoDto[]>([]);
  readonly efeitosSuspensivos = signal<readonly EfeitoSuspensivoDto[]>([]);
  readonly guardasDaVaga = signal<readonly GuardaDaVagaDto[]>([]);

  private readonly leituraDasUnidades = new LeituraDeCatalogo({
    buscar: () => this.api.listarUnidadesDePrazo().pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.unidadesDePrazo.set(dados),
    mensagemDeErro: 'Não foi possível carregar as unidades do prazo.',
  });
  private readonly leituraDosEfeitos = new LeituraDeCatalogo({
    buscar: () => this.api.listarEfeitosSuspensivos().pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.efeitosSuspensivos.set(dados),
    mensagemDeErro: 'Não foi possível carregar os efeitos suspensivos.',
  });
  private readonly leituraDasGuardas = new LeituraDeCatalogo({
    buscar: () => this.api.listarGuardasDaVaga().pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.guardasDaVaga.set(dados),
    mensagemDeErro: 'Não foi possível carregar as guardas da vaga.',
  });

  private readonly leituras = [
    this.leituraDasUnidades,
    this.leituraDosEfeitos,
    this.leituraDasGuardas,
  ];

  readonly situacaoDasUnidades = computed(() => situacaoDe(this.leituraDasUnidades));
  readonly situacaoDosEfeitos = computed(() => situacaoDe(this.leituraDosEfeitos));
  readonly situacaoDasGuardas = computed(() => situacaoDe(this.leituraDasGuardas));

  readonly carregando = computed(() => this.leituras.some((leitura) => leitura.carregando()));
  readonly erro = computed(
    () => this.leituras.map((leitura) => leitura.erro()).find((erro) => erro !== null) ?? null,
  );

  carregar(): void {
    this.leituras.forEach((leitura) => leitura.carregar());
  }

  /** Busca de novo as três listas, descartando a resposta de uma busca anterior ainda em voo. */
  recarregar(): void {
    this.leituras.forEach((leitura) => leitura.recarregar());
  }
}
