import { Injector, Signal, WritableSignal, effect, inject, untracked } from '@angular/core';

/** Anuncia, numa região de status, o andamento e o resultado de uma nova tentativa de leitura. */
export interface AnuncioDaLeitura {
  /** Anuncia que a leitura pedida pela pessoa começou; o resultado vem quando ela termina. */
  iniciar(): void;
}

/**
 * O alerta de falha não muda de texto quando a nova tentativa falha de novo, e o leitor de tela
 * não percebe nada. O anúncio muda a cada etapa (lendo, depois resultado), então toda tentativa
 * é percebida. Só as tentativas pedidas pela pessoa são anunciadas.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 *
 * @param nome O que é lido, como "catálogo de fatos".
 * @param pendente Sinal que é `true` enquanto a leitura corre.
 * @param falhou Sinal que é `true` quando a última leitura terminou em falha.
 * @param anuncio Região de status compartilhada pela página.
 */
export function anunciarLeitura(
  nome: string,
  pendente: Signal<boolean>,
  falhou: Signal<boolean>,
  anuncio: WritableSignal<string>,
): AnuncioDaLeitura {
  let aguardando = false;
  effect(
    () => {
      const emCurso = pendente();
      const comFalha = falhou();
      if (emCurso || !aguardando) return;
      aguardando = false;
      untracked(() =>
        anuncio.set(comFalha ? `Falha na leitura: ${nome}.` : `Leitura concluída: ${nome}.`),
      );
    },
    { injector: inject(Injector) },
  );

  return {
    iniciar: () => {
      aguardando = true;
      anuncio.set(`Lendo ${nome}...`);
    },
  };
}
