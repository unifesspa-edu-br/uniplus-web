import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { fatosEscolhiveis } from '@uniplus/shared-ui/components';
import { lerCatalogoDeFatos, lerFasesCanonicas } from './leituras-do-fato';
import {
  fatoDeMembroDoBinding,
  fatosCitaveisPelaRegra,
  podeEditarDefinicao,
  podeTerRegras,
  podeTerValores,
  tipoDoFato,
  type TipoDoFato,
} from './fato-candidato.regras';

/** Uma fase como o select da definição a oferece. */
export interface OpcaoDeFase {
  readonly codigo: string;
  readonly nome: string;
}

/**
 * Leitura do fato aberto na edição: o fato completo, o catálogo que as regras citam e as fases do
 * ponto de resolução. O fato é lido de novo a cada abertura, porque o rascunho de uma abertura
 * anterior não pode reaparecer.
 */
@Injectable()
export class FatoEmEdicaoStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);

  /** O fato em edição; `null` com a edição fechada. */
  readonly id = signal<string | null>(null);

  private readonly recurso = useApiResource<FatoCandidatoDto>(() => {
    const id = this.id();
    return id === null
      ? undefined
      : {
          url: `${this.basePath}/api/configuracao/admin/fatos-candidato/${encodeURIComponent(id)}`,
          context: withVendorMime('fato-candidato', 1),
        };
  });

  readonly fato = this.recurso.data;
  readonly carregando = this.recurso.isLoading;
  readonly falhouAoCarregar = computed(
    () => this.recurso.problem() !== null || this.recurso.error() !== undefined,
  );
  readonly erroDeCarga = computed(() => {
    const problem = this.recurso.problem();
    return problem ? this.problemI18n.resolve(problem).title : null;
  });

  /** A falha do servidor (5xx) ao ler o fato é avisada também por toast, como toda falha de leitura. */
  private readonly avisoDeFalhaDoServidor = effect(() => {
    const problem = this.recurso.problem();
    if (problem && problem.status >= 500) {
      untracked(() => this.notifications.errorFromProblem(problem));
    }
  });

  readonly catalogo = lerCatalogoDeFatos(() => this.id() !== null);

  /** O fato de sistema não edita eixo nenhum, qualquer seja o vínculo dele: só a proteção de dados. */
  readonly tipo = computed<TipoDoFato>(() => {
    const fato = this.fato();
    return fato === null || fato.sistema ? 'OUTRO' : tipoDoFato(fato);
  });
  readonly temValores = computed(() => this.vale(podeTerValores));
  readonly temRegras = computed(() => this.vale(podeTerRegras));
  /** A Definição vira formulário no fato do administrador de um tipo conhecido; o de sistema só se lê. */
  readonly definicaoEditavel = computed(() => this.vale(podeEditarDefinicao));
  /** A proteção de dados se altera no fato do administrador e também no de sistema, que trava o resto da definição. */
  readonly protecaoEditavel = computed(
    () => this.definicaoEditavel() || this.fato()?.sistema === true,
  );
  /** O agregado mostra o fato de membro que resume, sem poder trocá-lo. */
  readonly membroDoAgregado = computed(() => {
    const fato = this.fato();
    return fato === null ? null : fatoDeMembroDoBinding(fato);
  });

  /** As fases do ponto de resolução: só pedidas quando o formulário da definição está na tela. */
  readonly fases = lerFasesCanonicas(() => this.definicaoEditavel());

  /** A fase atual do fato entra nas opções mesmo se a lista não a traz: a escolha salva não some do select. */
  readonly fasesDaDefinicao = computed<readonly OpcaoDeFase[]>(() => {
    const lista = this.fases.itens();
    const atual = this.fato()?.pontoResolucao;
    if (!atual || lista.some((fase) => fase.codigo === atual)) return lista;
    return [{ codigo: atual, nome: this.fases.pendente() ? 'Carregando…' : atual }, ...lista];
  });

  readonly valoresAtivos = computed(() =>
    (this.fato()?.valores ?? []).filter((valor) => valor.ativo).map((valor) => valor.codigo),
  );

  /**
   * Os fatos que as regras salvas já citam. A API recusa só a citação nova de fato desativado ou
   * fora do vocabulário; a regra que já citava continua valendo, e a tela não pode travá-la.
   */
  readonly fatosJaCitados = computed(
    () =>
      new Set(
        (this.fato()?.regrasPadrao ?? []).flatMap((regra) =>
          (regra.quando ?? []).flat().map((condicao) => condicao.fato),
        ),
      ),
  );

  readonly fatosDaRegra = computed(() => {
    const fato = this.fato();
    if (fato === null) return [];
    const catalogo = this.catalogo.itens();
    const citaveis = new Set(fatosCitaveisPelaRegra(catalogo, fato.codigo).map((f) => f.codigo));
    const jaCitados = this.fatosJaCitados();
    return fatosEscolhiveis(
      catalogo.filter((f) => citaveis.has(f.codigo) || jaCitados.has(f.codigo)),
    );
  });

  abrir(id: string): void {
    this.id.set(id);
  }

  fechar(): void {
    this.id.set(null);
  }

  recarregar(): void {
    this.recurso.reload();
  }

  private vale(regra: (fato: FatoCandidatoDto) => boolean): boolean {
    const fato = this.fato();
    return fato !== null && regra(fato);
  }
}
