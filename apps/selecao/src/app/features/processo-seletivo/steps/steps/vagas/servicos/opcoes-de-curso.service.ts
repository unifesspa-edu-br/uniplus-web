import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { erroDasOpcoes, rotuloDasOpcoes, TEXTO_OPCOES_ACIMA_DAS_OFERTAS } from '../opcoes-de-curso';
import { PadraoDoEditalService } from './padrao-do-edital.service';

/** O número de opções de curso do candidato e o erro que o campo mostra. */
@Injectable()
export class OpcoesDeCursoService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly padrao = inject(PadraoDoEditalService);

  /**
   * O erro só aparece depois de uma tentativa de avançar (ou de uma recusa da API): com o número
   * escolhido antes dos cursos, avisar de imediato acusaria um passo que o operador ainda não
   * terminou. Depois disso acompanha o estado, e some assim que o campo ou o quadro o corrige.
   */
  private readonly conferidas = signal(false);

  /** O estado em que a API recusou: o erro vale enquanto o número e o quadro continuam os mesmos. */
  private readonly recusaDaApi = signal<{ numero: string; ofertas: number } | null>(null);

  /** O número escolhido, como a consulta o lê. */
  readonly opcoesLidas = computed(() => rotuloDasOpcoes(this.numero()));

  readonly erro = computed<string | null>(() => {
    const recusa = this.recusaDaApi();
    if (
      recusa !== null &&
      recusa.numero === this.numero() &&
      recusa.ofertas === this.padrao.distribuicoes().length
    ) {
      return TEXTO_OPCOES_ACIMA_DAS_OFERTAS;
    }
    if (!this.conferidas()) return null;
    return erroDasOpcoes(this.numero(), this.padrao.distribuicoes().length);
  });

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.conferidas.set(false);
        this.recusaDaApi.set(null);
      });
    });
  }

  numero(): string {
    return this.store.draft().opcoesDeCurso.numero;
  }

  alterar(numero: string): void {
    this.store.patchObjectSection('opcoesDeCurso', { numero });
  }

  marcarComoConferidas(): void {
    this.conferidas.set(true);
  }

  registrarRecusaDaApi(): void {
    this.recusaDaApi.set({ numero: this.numero(), ofertas: this.padrao.distribuicoes().length });
  }

  limparRecusaDaApi(): void {
    this.recusaDaApi.set(null);
  }
}
