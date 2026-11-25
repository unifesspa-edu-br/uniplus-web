import { computed, linkedSignal, type Signal } from '@angular/core';

import { aCadaPartida } from './a-cada-partida';
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
  readonly respostas = aCadaPartida(
    () => this.fontes.partida(),
    () => ({ ...(this.fontes.inicial()?.respostas ?? {}) }),
  );
  readonly grupos = aCadaPartida(
    () => this.fontes.partida(),
    () => gruposDe(this.fontes.inicial()),
  );
  /** A confirmação digitada persiste ao trocar de seção e é conferida no envio. */
  readonly confirmacoes = aCadaPartida<Readonly<Partial<Record<string, string>>>>(
    () => this.fontes.partida(),
    () => ({}),
  );
  /** Os termos aceitos não entram na simulação como fatos. */
  readonly aceitos = aCadaPartida<ReadonlySet<string>>(
    () => this.fontes.partida(),
    () => new Set(this.fontes.termosAceitosIniciais()),
  );
  /** As recusas do servidor ainda não descartadas. */
  readonly errosRecebidos = linkedSignal({
    source: () => this.fontes.errosDoServidor(),
    computation: (erros) => erros,
  });
  /** As respostas fixas da conta prevalecem sobre as dadas pelo candidato. */
  readonly respostasComAsFixas = computed(() =>
    comAsFixas(this.respostas(), this.fontes.respostasFixas()),
  );
  /** Respostas fixas ausentes da conta são recusadas pelo servidor. */
  readonly fixasSemResposta = computed(() => fixasSemResposta(this.fontes.respostasFixas()));

  constructor(private readonly fontes: FontesDasRespostas) {}

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
