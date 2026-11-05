import { computed, type Signal } from '@angular/core';

import type { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';
import { resumoDoFator } from './fator-de-atenuacao';
import {
  type ErroDoServidor,
  type FormularioDoCandidato,
  mensagemDosErros,
  type PassoPrefixado,
  type RespostaFixa,
} from './formulario-do-candidato.model';
import type { OcorrenciaSimulada, ValorJson } from './interpretador/regras-do-formulario';
import { type AvaliacaoNaTela, secoesQueDefinemAsModalidades } from './modalidades-avaliadas';
import type { PassoDoFormulario, TermoNoPasso } from './passos-do-formulario';
import { termoSemAceite } from './pendencias-do-passo';
import type { MunicipiosGravados } from './valor-de-municipio-gravado';

/** O que a Revisão resume, lido do formulário. */
export interface FontesDaRevisao {
  readonly formulario: Signal<FormularioDoCandidato>;
  readonly avaliacao: Signal<AvaliacaoNaTela | null>;
  readonly passos: () => readonly PassoDoFormulario[];
  readonly passosPrefixados: Signal<readonly PassoPrefixado[]>;
  readonly respostas: Signal<Readonly<Record<string, ValorJson>>>;
  readonly grupos: Signal<Readonly<Record<string, readonly OcorrenciaSimulada[]>>>;
  readonly respostasFixas: Signal<Readonly<Partial<Record<string, RespostaFixa>>>>;
  readonly municipiosGravados: Signal<MunicipiosGravados>;
  readonly municipios: NomesDeMunicipios;
  readonly erros: () => readonly ErroDoServidor[];
  readonly aceitos: () => ReadonlySet<string>;
  /** Se a seção mostra a pendência em cada campo: concluída, ou visitada pelo link da pendência. */
  readonly mostraPendencia: (passo: PassoDoFormulario) => boolean;
}

/** O que a seção de Revisão mostra do que o candidato respondeu e do que a API calculou. */
export class RevisaoDoFormulario {
  /** Os passos prefixados que mostram algo na Revisão. */
  readonly resumosDosPrefixados = computed(() =>
    this.fontes.passosPrefixados().filter((p) => (p.resumo?.length ?? 0) > 0),
  );
  /** A avaliação com modalidades derivadas: só ela tem resumo na Revisão. */
  readonly avaliacaoDerivada = computed(() => {
    const avaliacao = this.fontes.avaliacao();
    return avaliacao?.modalidades?.derivada ? avaliacao : null;
  });
  readonly fatorNaRevisao = computed(() =>
    resumoDoFator(
      this.fontes.passos(),
      this.fontes.respostas(),
      this.fontes.municipios,
      this.fontes.municipiosGravados(),
      this.fontes.formulario().dependenciasDoFator,
      this.fontes.grupos(),
      this.fontes.respostasFixas(),
    ),
  );
  /** As seções cujas respostas definem as modalidades: onde levar o candidato que quer corrigir. */
  readonly secoesQueDefinem = computed(() =>
    secoesQueDefinemAsModalidades(
      this.fontes.passos(),
      this.fontes.formulario().dependenciasDaAvaliacao,
    ),
  );

  constructor(private readonly fontes: FontesDaRevisao) {}

  /** O que dizer ao lado do termo: a recusa do servidor ou, com a seção concluída, a falta do aceite. */
  problemaDoTermo(passo: PassoDoFormulario, termo: TermoNoPasso): string | null {
    const { erros, aceitos, mostraPendencia } = this.fontes;
    const pendente = mostraPendencia(passo) && termoSemAceite(termo, aceitos());
    return (
      mensagemDosErros(erros(), termo.termo.codigo) ??
      (pendente ? 'Aceite o termo para concluir.' : null)
    );
  }
}
