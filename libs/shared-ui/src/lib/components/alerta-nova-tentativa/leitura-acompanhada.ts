import { Signal, computed, effect, signal, untracked } from '@angular/core';

import {
  acompanharNovaTentativa,
  type FaseDaNovaTentativa,
  type NovaTentativa,
} from './nova-tentativa';

/** Do que o acompanhamento precisa para uma leitura que a pessoa pode pedir de novo. */
export interface OpcoesDaLeitura {
  /** A mensagem da falha; `null` quando a leitura não está em falha. */
  readonly falha: Signal<string | null>;
  /**
   * `true` desde a chamada de `recarregar` até o desfecho da leitura. Vem da mesma origem de
   * `falha`, e as duas mudam na mesma tarefa: a falha nunca sobe depois de `pendente` cair, nem a
   * leitura que não marca `pendente` pode ser pedida de novo por aqui.
   */
  readonly pendente: Signal<boolean>;
  /** Dispara a leitura; devolve `false` se nenhuma começou (ver `NovaTentativa.executar`). */
  readonly recarregar: () => void | boolean;
  /** Elemento estável que recebe o foco quando a tentativa dá certo. */
  readonly destino: () => HTMLElement | null | undefined;
  /** A leitura não pode ser pedida agora por outro motivo (uma gravação corre). */
  readonly indisponivel?: Signal<boolean>;
  /** O que é lido, quando a tela cuida de mais de uma leitura. */
  readonly assunto?: string;
  /**
   * A leitura terminou numa recusa que a própria tela mostra (recurso inexistente, sem permissão):
   * não há falha a repetir nem conclusão a anunciar.
   */
  readonly recusada?: Signal<boolean>;
}

/** A leitura com tudo o que o aviso de falha mostra e a ação que ele oferece. */
export interface LeituraAcompanhada {
  /** O aviso está na tela: a leitura falhou ou a nova tentativa pedida está em curso. */
  readonly visivel: Signal<boolean>;
  /** A última mensagem de falha, preservada enquanto a nova tentativa apaga a falha da fonte. */
  readonly mensagem: Signal<string>;
  readonly fase: Signal<FaseDaNovaTentativa>;
  readonly pendente: Signal<boolean>;
  readonly indisponivel: Signal<boolean>;
  readonly assunto?: string;
  /** O "Tentar novamente": não faz nada enquanto a leitura corre ou está indisponível. */
  tentar(): void;
}

/**
 * Liga uma leitura ao aviso de falha com "Tentar novamente". Criada na classe, e não dentro do
 * aviso: o aviso vive sob `@if`, e o acompanhamento da tentativa não pode morrer junto com ele.
 *
 * Fontes que mantêm a falha durante a nova tentativa e fontes que a apagam ao recomeçar dão o
 * mesmo resultado: o aviso fica até a tentativa terminar, com a mensagem de antes.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function acompanharLeitura(opcoes: OpcoesDaLeitura): LeituraAcompanhada {
  const indisponivel = opcoes.indisponivel ?? signal(false);
  const tentativa = acompanharNovaTentativa({
    pendente: computed(() => opcoes.pendente() || indisponivel()),
    falhou: computed(() => opcoes.falha() !== null),
    destino: opcoes.destino,
    assunto: opcoes.assunto,
    recusada: opcoes.recusada,
  });
  return montarLeitura(opcoes, indisponivel, tentativa);
}

/**
 * Um efeito, e não um sinal derivado preguiçoso: a mensagem tem de ser guardada ainda que o aviso
 * não esteja montado quando a falha aparece (um campo de drawer, por exemplo).
 */
function mensagemPreservada(falha: Signal<string | null>): Signal<string> {
  const ultimaMensagem = signal('');
  effect(() => {
    const atual = falha();
    if (atual !== null) untracked(() => ultimaMensagem.set(atual));
  });
  return computed(() => falha() ?? ultimaMensagem());
}

function montarLeitura(
  opcoes: OpcoesDaLeitura,
  indisponivel: Signal<boolean>,
  tentativa: NovaTentativa,
): LeituraAcompanhada {
  return {
    visivel: computed(() => opcoes.falha() !== null || tentativa.fase() === 'tentando'),
    mensagem: mensagemPreservada(opcoes.falha),
    fase: tentativa.fase,
    pendente: opcoes.pendente,
    indisponivel,
    assunto: opcoes.assunto,
    tentar: () => tentativa.executar(opcoes.recarregar),
  };
}

/** Uma leitura que dá nome ao botão de nova tentativa de `ui-lookup-alert`: o assunto é obrigatório. */
export interface CatalogoAcompanhado extends LeituraAcompanhada {
  readonly assunto: string;
}

/** Como `acompanharLeitura`, para um catálogo que o aviso dos catálogos lista pelo assunto. */
export function acompanharCatalogo(
  opcoes: OpcoesDaLeitura & { readonly assunto: string },
): CatalogoAcompanhado {
  return { ...acompanharLeitura(opcoes), assunto: opcoes.assunto };
}
