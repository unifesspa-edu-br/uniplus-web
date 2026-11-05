import { digitosDoTelefone } from '@uniplus/shared-utils';

import { type CampoRenderizavel, type RespostaFixa } from './formulario-do-candidato.model';
import { controleDoTipo } from './controle-do-campo';
import { type PassoDoFormulario } from './passos-do-formulario';
import { type ProblemaDaConfirmacao } from './pendencias-do-passo';
import { estaVazia, VERDADEIRO } from './interpretador/logica';
import type { OcorrenciaSimulada, ValorJson } from './interpretador/regras-do-formulario';

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
 * O que há de errado na confirmação, dadas a resposta e a confirmação digitada: a que não confere com a
 * resposta ou a que falta. Vale para toda resposta dada, gravada ou digitada nesta sessão: a confirmação
 * não vai à API, então nada prova que a da resposta gravada foi feita. Sem resposta, não há o que
 * confirmar.
 */
export function problemaDaConfirmacao(
  campo: CampoRenderizavel,
  resposta: ValorJson | undefined,
  confirmacao: string,
): ProblemaDaConfirmacao | null {
  if (estaVazia(resposta)) return null;
  const confirmada = respostaDoTextoLivre(campo, confirmacao);
  if (confirmada === undefined) return 'em-branco';
  return mesmoValor(confirmada, resposta) ? null : 'diverge';
}

/** O que os problemas das confirmações dependem. */
export interface EntradaDasConfirmacoes {
  /** As respostas atuais, com as fixas. */
  readonly respostas: Readonly<Record<string, ValorJson>>;
  readonly grupos: Readonly<Record<string, readonly OcorrenciaSimulada[]>>;
  /** A confirmação digitada, pelo código da tela: o fato ou `grupo.ocorrência.fato`. */
  readonly confirmacoes: Readonly<Partial<Record<string, string>>>;
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
  return new Map(
    passos.flatMap((passo) => [
      ...problemasDosCampos(passo, entrada),
      ...problemasDosGrupos(passo, entrada),
    ]),
  );
}

/** Um campo e a resposta que a confirmação confere, pelo código com que a tela o marca. */
interface CampoConfirmavel {
  readonly caminho: string;
  readonly campo: CampoRenderizavel;
  readonly fixa: boolean;
  readonly resposta: ValorJson | undefined;
}

function conferir(
  { caminho, campo, fixa, resposta }: CampoConfirmavel,
  entrada: EntradaDasConfirmacoes,
): [string, ProblemaDaConfirmacao][] {
  if (!pedeConfirmacao(campo, fixa)) return [];
  const problema = problemaDaConfirmacao(campo, resposta, entrada.confirmacoes[caminho] ?? '');
  return problema ? [[caminho, problema]] : [];
}

function problemasDosCampos(
  passo: PassoDoFormulario,
  entrada: EntradaDasConfirmacoes,
): [string, ProblemaDaConfirmacao][] {
  return passo.campos.flatMap(({ campo }) => {
    const fato = campo.fatoCodigo;
    return conferir(
      { caminho: fato, campo, fixa: !!entrada.fixas[fato], resposta: entrada.respostas[fato] },
      entrada,
    );
  });
}

function problemasDosGrupos(
  passo: PassoDoFormulario,
  entrada: EntradaDasConfirmacoes,
): [string, ProblemaDaConfirmacao][] {
  return passo.grupos.flatMap(({ grupo, avaliado }) =>
    avaliado.ocorrencias.flatMap((ocorrencia) => {
      const atuais = entrada.grupos[grupo.codigo]?.find((o) => o.id === ocorrencia.id)?.respostas;
      return ocorrencia.campos.flatMap((avaliadoDoSubitem) => {
        const subitem = grupo.subitens.find((s) => s.fatoCodigo === avaliadoDoSubitem.fatoCodigo);
        if (!subitem || avaliadoDoSubitem.visivel !== VERDADEIRO) return [];
        const fato = subitem.fatoCodigo;
        const caminho = `${grupo.codigo}.${ocorrencia.id}.${fato}`;
        return conferir(
          { caminho, campo: subitem, fixa: false, resposta: atuais?.[fato] },
          entrada,
        );
      });
    }),
  );
}

function mesmoValor(a: ValorJson | undefined, b: ValorJson | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
