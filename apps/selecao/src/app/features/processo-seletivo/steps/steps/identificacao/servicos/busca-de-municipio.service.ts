import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';
import { type UiComboboxGroup } from '@uniplus/shared-ui/components';

import type { LocalidadeSelecionada } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';

/** Janela do seletor de municípios, igual à do calendário de dias úteis. */
const MUNICIPIOS_LIMIT = 20;

/** A busca do município que rege os prazos, na API Geo, e a escolha dele no rascunho. */
@Injectable()
export class BuscaDeMunicipioService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly geo = inject(GeoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Resultado corrente da busca de município na Geo. */
  readonly municipios = signal<readonly CidadeResumoDto[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  /** Termo digitado no seletor; não é persistido no rascunho. */
  readonly termo = signal('');

  /** Os municípios achados, como as opções do combobox; o código IBGE identifica cada uma. */
  readonly grupos = computed<readonly UiComboboxGroup[]>(() =>
    this.municipios().length === 0
      ? []
      : [
          {
            label: 'Municípios encontrados',
            options: this.municipios().map((m) => ({
              value: m.codigoIbge,
              label: `${m.nome} — ${m.uf}`,
            })),
          },
        ],
  );

  /** O que a lista diz enquanto não há município a escolher. */
  readonly textoSemMunicipios = computed(() => {
    if (this.erro() !== null) return 'Não foi possível buscar os municípios.';
    if (this.termo().trim().length < 3) return 'Digite ao menos três letras do município.';
    if (this.carregando()) return 'Consultando a API Geo…';
    return 'Nenhum município com esse nome.';
  });

  buscar(termo: string): void {
    this.termo.set(termo);
    const busca = termo.trim();
    if (busca.length < 3) {
      this.municipios.set([]);
      this.erro.set(null);
      // Uma busca em voo pode ter começado com termo mais longo: a resposta dela será descartada
      // pela guarda de termo obsoleto, então é aqui que o estado de carregamento precisa voltar,
      // senão o campo fica anunciando consulta que ninguém mais vai concluir.
      this.carregando.set(false);
      return;
    }

    this.carregando.set(true);
    this.erro.set(null);
    // Resultado da busca anterior sai de cena ao começar a nova: enquanto a requisição corre, uma
    // opção do termo antigo continuaria clicável, e numa conexão lenta o operador gravaria o
    // município que já não procurava.
    this.municipios.set([]);
    this.geo
      .listarCidades({ q: busca, limit: MUNICIPIOS_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        // Resposta de busca anterior chegando depois da atual: descartar, senão a lista exibiria
        // resultado de um termo que o operador já trocou.
        if (this.termo().trim() !== busca) return;

        this.carregando.set(false);
        if (!isApiOk(result)) {
          this.municipios.set([]);
          this.erro.set(this.problemI18n.resolve(result.problem).title);
          return;
        }
        this.municipios.set(result.data);
      });
  }

  escolher(codigoIbge: string): void {
    const municipio = this.municipios().find((m) => m.codigoIbge === codigoIbge);
    if (municipio === undefined) return;
    this.selecionar({
      codigoIbge: municipio.codigoIbge,
      nome: municipio.nome,
      uf: municipio.uf,
    });
  }

  /** Grava o trio inteiro vindo da opção escolhida, nunca campo a campo. */
  selecionar(localidade: LocalidadeSelecionada): void {
    this.store.patchObjectSection('identificacao', { localidade });
    this.termo.set('');
    this.municipios.set([]);
  }

  limpar(): void {
    this.store.patchObjectSection('identificacao', { localidade: null });
  }
}
