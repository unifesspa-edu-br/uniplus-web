import { computed, linkedSignal, type Signal, type WritableSignal } from '@angular/core';

import type { ErroDoServidor, RespostaFixa } from './formulario-do-candidato.model';
import { estaVazia } from './interpretador/logica';
import type {
  OcorrenciaSimulada,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';
import { erroEm } from './formulario-do-candidato.model';
import { erroSobrevive } from './recusas-do-servidor';

type Fixas = Readonly<Partial<Record<string, RespostaFixa>>>;

function gruposDe(
  inicial: SimulacaoDoFormulario | null,
): Readonly<Record<string, readonly OcorrenciaSimulada[]>> {
  return Object.fromEntries(
    Object.entries(inicial?.grupos ?? {}).map(([codigo, lista]) => [codigo, lista ?? []]),
  );
}

function comAsFixas(respostas: Readonly<Record<string, ValorJson>>, fixas: Fixas) {
  return {
    ...respostas,
    ...Object.fromEntries(
      Object.entries(fixas).flatMap(([fato, f]) => (f ? [[fato, f.valor]] : [])),
    ),
  };
}

function fixasSemResposta(fixas: Fixas): ReadonlySet<string> {
  return new Set(
    Object.entries(fixas)
      .filter(([, fixa]) => fixa && estaVazia(fixa.valor))
      .map(([fato]) => fato),
  );
}

/** De onde as respostas partem, e o que muda a partida. */
export interface FontesDasRespostas {
  /** Cada partida nova — outro formulário, outra simulação inicial — recomeça tudo. */
  readonly partida: Signal<unknown>;
  readonly inicial: Signal<SimulacaoDoFormulario | null>;
  readonly termosAceitosIniciais: Signal<readonly string[]>;
  readonly errosDoServidor: Signal<readonly ErroDoServidor[]>;
  readonly respostasFixas: Signal<Fixas>;
}

/**
 * Tudo o que o candidato disse ao formulário e o que o servidor recusou: as respostas, as ocorrências
 * dos grupos, as confirmações digitadas, os termos aceitos e as recusas ainda de pé. É a única dona
 * desse estado: a resposta mudada leva a recusa dela.
 */
export class RespostasDoFormulario {
  readonly respostas: WritableSignal<Readonly<Record<string, ValorJson>>>;
  readonly grupos: WritableSignal<Readonly<Record<string, readonly OcorrenciaSimulada[]>>>;
  /**
   * A confirmação digitada de cada campo que a pede, pelo código da tela: o fato ou `grupo.ocorrência.fato`.
   * Mora aqui, e não no campo, porque o envio confere também as seções que não estão na tela e porque a
   * seção trocada recria o campo, que perderia o que se digitou.
   */
  readonly confirmacoes: WritableSignal<Readonly<Partial<Record<string, string>>>>;
  /** Os termos aceitos. O aceite não é fato das regras: não entra na simulação. */
  readonly aceitos: WritableSignal<ReadonlySet<string>>;
  /** As recusas do servidor que ainda não foram descartadas. */
  readonly errosRecebidos: WritableSignal<readonly ErroDoServidor[]>;

  /** As respostas que o candidato deu e as fixas da conta, que prevalecem. */
  readonly respostasComAsFixas: Signal<Readonly<Record<string, ValorJson>>>;
  /**
   * As respostas fixas que a conta não tem: o candidato não pode dá-las, então o formulário não as
   * cobra — a recusa é do servidor, que a aponta no campo.
   */
  readonly fixasSemResposta: Signal<ReadonlySet<string>>;

  constructor(fontes: FontesDasRespostas) {
    const { partida, inicial } = fontes;
    this.respostas = linkedSignal({
      source: partida,
      computation: () => ({ ...(inicial()?.respostas ?? {}) }),
    });
    this.grupos = linkedSignal({
      source: partida,
      computation: () => gruposDe(inicial()),
    });
    this.confirmacoes = linkedSignal({ source: partida, computation: () => ({}) });
    this.aceitos = linkedSignal<unknown, ReadonlySet<string>>({
      source: partida,
      computation: () => new Set(fontes.termosAceitosIniciais()),
    });
    this.errosRecebidos = linkedSignal({
      source: fontes.errosDoServidor,
      computation: (erros) => erros,
    });
    this.respostasComAsFixas = computed(() =>
      comAsFixas(this.respostas(), fontes.respostasFixas()),
    );
    this.fixasSemResposta = computed(() => fixasSemResposta(fontes.respostasFixas()));
  }

  confirmar(caminho: string, texto: string): void {
    this.confirmacoes.update((atuais) => ({ ...atuais, [caminho]: texto }));
  }

  responder(fato: string, valor: ValorJson | undefined): void {
    this.descartarErros(fato);
    this.respostas.update((atual) => {
      const novas = { ...atual };
      if (valor === undefined) delete novas[fato];
      else novas[fato] = valor;
      return novas;
    });
  }

  responderGrupo(codigo: string, ocorrencias: readonly OcorrenciaSimulada[] | undefined): void {
    this.errosRecebidos.update((atuais) => {
      const restantes = atuais.filter(
        (e) => !erroEm(e, codigo) || erroSobrevive(e, codigo, this.grupos()[codigo], ocorrencias),
      );
      return restantes.length === atuais.length ? atuais : restantes;
    });
    this.grupos.update((atual) => {
      const novos = { ...atual };
      if (ocorrencias === undefined) delete novos[codigo];
      else novos[codigo] = ocorrencias;
      return novos;
    });
  }

  alternarAceite(codigo: string, aceito: boolean): void {
    this.descartarErros(codigo);
    this.aceitos.update((atual) => {
      const novos = new Set(atual);
      if (aceito) novos.add(codigo);
      else novos.delete(codigo);
      return novos;
    });
  }

  private descartarErros(codigo: string): void {
    if (this.errosRecebidos().some((e) => erroEm(e, codigo)))
      this.errosRecebidos.update((atuais) => atuais.filter((e) => !erroEm(e, codigo)));
  }
}
