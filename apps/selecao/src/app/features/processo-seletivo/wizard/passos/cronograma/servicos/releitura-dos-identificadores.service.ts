import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { isApiOk } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';
import { firstValueFrom } from 'rxjs';
import type { WizardDraft } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { cronogramaDe, etapasDe } from '../../../shared/hidratacao/hidratacao-do-cronograma';
import { comOsIdentificadoresLidos } from '../../../shared/bancas/identificadores-das-bancas-lidas';
import { tituloDoPasso } from '../../../shared/titulo-do-passo';

type Escopo = 'fases' | 'etapas';
type Resultado = 'confere' | 'divergencia' | 'falha';
export const AVISO_DIVERGENCIA =
  'O cronograma foi alterado fora desta tela durante a gravação. A tela passou a mostrar o que está gravado; confira as fases e as bancas antes de gravar de novo.';
export const TEXTOS_RELEITURA: Record<Escopo, string> = {
  fases:
    'O cronograma de fases foi gravado, mas a tela não conseguiu confirmar as bancas acrescentadas nas fases. As etapas ainda não foram gravadas. A gravação fica suspensa até essa confirmação, para que essas bancas não sejam criadas de novo.',
  etapas:
    'As etapas foram gravadas, mas a tela não conseguiu confirmar as etapas e bancas acrescentadas. A gravação fica suspensa até essa confirmação: gravar agora criaria de novo essas etapas e bancas e desfaria as referências de desempate e eliminação.',
};
type Cronograma = WizardDraft['cronograma'];

function conferirEtapas(
  enviadas: Cronograma['etapas'],
  lidas: Cronograma['etapas'],
): Cronograma['etapas'] | null {
  if (enviadas.length !== lidas.length) return null;
  const resultado: Cronograma['etapas'] = [];
  for (const enviada of enviadas) {
    const lida = lidas.find((item) => item.ordem === enviada.ordem);
    if (!lida || (enviada.id !== null && enviada.id !== lida.id)) return null;
    const bancas = comOsIdentificadoresLidos(enviada.bancas, lida.bancas);
    if (!bancas.confere) return null;
    resultado.push({ ...lida, bancas: bancas.lista });
  }
  return resultado;
}

function conferirFases(
  enviadas: Cronograma['fases'],
  lidas: Cronograma['fases'],
): Cronograma['fases'] | null {
  if (enviadas.length !== lidas.length) return null;
  const resultado: Cronograma['fases'] = [];
  for (const fase of enviadas) {
    const lida = lidas.find((item) => item.faseCanonicaId === fase.faseCanonicaId);
    if (!lida) return null;
    const bancas = comOsIdentificadoresLidos(fase.bancasRequeridas, lida.bancasRequeridas);
    if (!bancas.confere) return null;
    resultado.push({ ...fase, bancasRequeridas: bancas.lista });
  }
  return resultado;
}

@Injectable()
export class ReleituraDosIdentificadores {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);
  readonly pendente = signal<Escopo | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly relendo = signal(false);
  readonly erroDeReleitura = signal<string | null>(null);
  readonly leitura = acompanharLeitura({
    falha: computed(() => {
      const escopo = this.pendente();
      if (escopo === null) return null;
      const motivo = this.erroDeReleitura();
      return motivo === null ? TEXTOS_RELEITURA[escopo] : `${TEXTOS_RELEITURA[escopo]} ${motivo}`;
    }),
    pendente: this.relendo,
    recarregar: () => void this.relerIdentificadores(),
    destino: tituloDoPasso,
  });

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.pendente.set(null);
        this.erroDeReleitura.set(null);
        this.aviso.set(null);
      });
    });
  }

  async recolher(processoId: string, escopo: Escopo): Promise<Resultado> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId)).catch(() => null);
    if (detalhe === null || !isApiOk(detalhe) || geracao !== this.store.geracao()) return 'falha';
    if (escopo === 'fases') return this.mostrarFases(cronogramaDe(detalhe.data).fases);
    return this.mostrarEtapas(etapasDe(detalhe.data));
  }

  private mostrarFases(lidas: Cronograma['fases']): Resultado {
    const conferidas = conferirFases(this.store.draft().cronograma.fases, lidas);
    this.store.projetarSecao('cronograma', { fases: conferidas ?? lidas });
    return this.resultadoDaConferencia(conferidas);
  }

  private mostrarEtapas(lidas: Cronograma['etapas']): Resultado {
    const conferidas = conferirEtapas(this.store.draft().cronograma.etapas, lidas);
    this.store.projetarSecao('cronograma', { etapas: conferidas ?? lidas });
    return this.resultadoDaConferencia(conferidas);
  }

  private resultadoDaConferencia(conferidas: unknown): Resultado {
    if (conferidas !== null) return 'confere';
    this.aviso.set(AVISO_DIVERGENCIA);
    return 'divergencia';
  }

  async relerIdentificadores(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    const escopo = this.pendente();
    if (processoId === null || escopo === null || this.relendo()) return;
    const geracao = this.store.geracao();
    this.relendo.set(true);
    this.erroDeReleitura.set(null);
    try {
      const resultado = await this.recolher(processoId, escopo);
      if (geracao !== this.store.geracao()) return;
      this.registrarResultadoDaReleitura(resultado);
    } finally {
      this.relendo.set(false);
    }
  }

  private registrarResultadoDaReleitura(resultado: Resultado): void {
    if (resultado === 'falha') {
      this.erroDeReleitura.set(
        'Não foi possível reler os dados agora. Se continuar assim, recarregue o processo.',
      );
    } else {
      this.pendente.set(null);
    }
  }
}
