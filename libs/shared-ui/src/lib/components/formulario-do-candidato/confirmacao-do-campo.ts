import { digitosDoTelefone } from '@uniplus/shared-utils';

import {
  type CampoRenderizavel,
  controleDoTipo,
  type PassoDoFormulario,
  type ProblemaDaConfirmacao,
  type RespostaFixa,
} from './formulario-do-candidato.model';
import { estaVazia, VERDADEIRO } from './interpretador/logica';
import type {
  OcorrenciaSimulada,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';

/**
 * A confirmação é a segunda digitação de um campo de texto, para o candidato conferir o que escreveu. Ela
 * não vai à API: só o portal garante a dupla digitação. Fica aqui, em funções puras, para que a tela do
 * campo e o envio — que olha também as seções que não estão na tela — decidam o mesmo.
 */

/** O campo mostra a confirmação: pede, é de texto digitado e o candidato pode alterá-lo. */
export function pedeConfirmacao(campo: CampoRenderizavel, fixa: boolean): boolean {
  return (
    campo.pedirConfirmacao === true && !fixa && controleDoTipo(campo.tipoRenderizacao) === 'texto'
  );
}

/** A resposta que o texto digitado num campo de texto dá: o telefone só com os dígitos, ou o próprio texto. */
export function respostaDoTextoLivre(
  campo: Pick<CampoRenderizavel, 'formato'>,
  texto: string,
): ValorJson | undefined {
  if (texto.trim() === '') return undefined;
  return campo.formato === 'TELEFONE' ? (digitosDoTelefone(texto) ?? texto) : texto;
}

/**
 * O que há de errado na confirmação, dadas a resposta e a confirmação digitada. A confirmação que não
 * confere com a resposta dada vale sempre; a em branco só quando a resposta foi digitada ou alterada
 * nesta sessão — a já gravada e não alterada não exige confirmar de novo. Sem resposta, não há o que
 * confirmar.
 */
export function problemaDaConfirmacao(
  campo: CampoRenderizavel,
  resposta: ValorJson | undefined,
  confirmacao: string,
  respostaAlterada: boolean,
): ProblemaDaConfirmacao | null {
  if (estaVazia(resposta)) return null;
  const confirmada = respostaDoTextoLivre(campo, confirmacao);
  if (confirmada === undefined) return respostaAlterada ? 'em-branco' : null;
  return mesmoValor(confirmada, resposta) ? null : 'diverge';
}

/** O que os problemas das confirmações dependem. */
export interface EntradaDasConfirmacoes {
  /** As respostas atuais, com as fixas. */
  readonly respostas: Readonly<Record<string, ValorJson>>;
  readonly grupos: Readonly<Record<string, readonly OcorrenciaSimulada[]>>;
  /** As respostas de partida: o que já estava gravado antes desta sessão. */
  readonly gravadas: SimulacaoDoFormulario | null;
  /** A confirmação digitada, pelo código da tela: o fato ou `grupo.ocorrência.fato`. */
  readonly confirmacoes: Readonly<Record<string, string>>;
  readonly fixas: Readonly<Partial<Record<string, RespostaFixa>>>;
}

/**
 * O problema da confirmação de cada campo que a tem na tela, pelo código com que a tela marca o campo:
 * o fato ou, no subitem de uma ocorrência, `grupo.ocorrência.fato`. Só entram os campos que aparecem.
 */
export function avaliarConfirmacoes(
  passos: readonly PassoDoFormulario[],
  entrada: EntradaDasConfirmacoes,
): ReadonlyMap<string, ProblemaDaConfirmacao> {
  const problemas = new Map<string, ProblemaDaConfirmacao>();
  const conferir = (
    caminho: string,
    campo: CampoRenderizavel,
    fixa: boolean,
    resposta: ValorJson | undefined,
    gravada: ValorJson | undefined,
  ): void => {
    if (!pedeConfirmacao(campo, fixa)) return;
    const problema = problemaDaConfirmacao(
      campo,
      resposta,
      entrada.confirmacoes[caminho] ?? '',
      !mesmoValor(resposta, gravada),
    );
    if (problema) problemas.set(caminho, problema);
  };

  for (const passo of passos) {
    for (const { campo } of passo.campos) {
      const fato = campo.fatoCodigo;
      conferir(
        fato,
        campo,
        !!entrada.fixas[fato],
        entrada.respostas[fato],
        entrada.gravadas?.respostas?.[fato],
      );
    }
    for (const { grupo, avaliado } of passo.grupos) {
      for (const ocorrencia of avaliado.ocorrencias) {
        const atuais = entrada.grupos[grupo.codigo]?.find((o) => o.id === ocorrencia.id)?.respostas;
        const gravadas = entrada.gravadas?.grupos?.[grupo.codigo]?.find(
          (o) => o.id === ocorrencia.id,
        )?.respostas;
        for (const avaliadoDoSubitem of ocorrencia.campos) {
          const subitem = grupo.subitens.find((s) => s.fatoCodigo === avaliadoDoSubitem.fatoCodigo);
          if (!subitem || avaliadoDoSubitem.visivel !== VERDADEIRO) continue;
          const fato = subitem.fatoCodigo;
          conferir(
            `${grupo.codigo}.${ocorrencia.id}.${fato}`,
            subitem,
            false,
            atuais?.[fato],
            gravadas?.[fato],
          );
        }
      }
    }
  }
  return problemas;
}

function mesmoValor(a: ValorJson | undefined, b: ValorJson | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
