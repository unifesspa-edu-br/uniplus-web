import { Signal, WritableSignal } from '@angular/core';
import { anunciarLeitura } from './anuncio-da-leitura';
import { focarAposNovaTentativa, type NovaTentativa } from './focar-apos-nova-tentativa';

export interface OpcoesDaNovaTentativaAnunciada {
  /** O que é lido, como "unidades"; entra no anúncio. */
  readonly nome: string;
  /** `true` enquanto a leitura corre. */
  readonly pendente: Signal<boolean>;
  /** `true` enquanto o alerta da falha está na tela. */
  readonly falhou: Signal<boolean>;
  /** Elemento estável que recebe o foco quando a tentativa dá certo. */
  readonly destino: () => HTMLElement | null | undefined;
  /** Região de status da tela, que mostra o andamento e o desfecho de cada tentativa. */
  readonly anuncio: WritableSignal<string>;
}

/**
 * A nova tentativa de uma leitura cujo alerta de falha fica na tela durante a espera: guarda
 * contra clique repetido e devolve o foco ao concluir (`focarAposNovaTentativa`), e anuncia
 * andamento e desfecho (`anunciarLeitura`), pois o alerta, de texto igual, não é relido pelo
 * leitor de tela quando a tentativa falha de novo.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function novaTentativaAnunciada(opcoes: OpcoesDaNovaTentativaAnunciada): NovaTentativa {
  const { nome, pendente, falhou, destino, anuncio } = opcoes;
  const foco = focarAposNovaTentativa(pendente, falhou, destino);
  const anunciada = anunciarLeitura(nome, pendente, falhou, anuncio);
  return {
    executar: (disparar) =>
      foco.executar(() => {
        anunciada.iniciar();
        disparar();
      }),
  };
}
