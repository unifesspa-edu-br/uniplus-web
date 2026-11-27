import type { FormularioDoProcessoNoRascunho } from '../../processo-seletivo.models';

/** A fase do cronograma como o formulário a enxerga: só as marcas dizem o que ela é. */
export interface FaseQueRespondeFormulario {
  readonly codigo: string;
  readonly coletaInscricao: boolean;
  readonly coletaSolicitacaoIsencao: boolean;
}

/** O formulário e quem mais responde na mesma fase. */
export interface SituacaoNaFase {
  readonly atual: boolean;
  /** Os outros formulários da fase: cada fase tem um obrigatório e um facultativo, no máximo. */
  readonly ocupantes: readonly Pick<FormularioDoProcessoNoRascunho, 'obrigatorio'>[];
}

/** O que a fase decide da obrigatoriedade do formulário. */
export interface ObrigatoriedadeNaFase {
  readonly obrigatorio: boolean;
  /** A fase decide; o operador não escolhe. */
  readonly fixa: boolean;
  /** Se o operador pode inverter a escolha sem repetir a obrigatoriedade de outro formulário da fase. */
  readonly podeAlternar: boolean;
  /** O porquê de a escolha não caber, dito ao operador; nulo quando ele escolhe. */
  readonly explicacao: string | null;
}

const NA_INSCRICAO = 'Na fase de inscrição o formulário é obrigatório.';
const NA_ISENCAO = 'O pedido de isenção é facultativo.';

const decidida = (obrigatorio: boolean, explicacao: string): ObrigatoriedadeNaFase => ({
  obrigatorio,
  fixa: true,
  podeAlternar: false,
  explicacao,
});

const livre = (ocupantes: SituacaoNaFase['ocupantes'], valor: boolean): boolean =>
  !ocupantes.some((ocupante) => ocupante.obrigatorio === valor);

/** A fase que divide inscrição e isenção: o obrigatório fica com o primeiro formulário, o facultativo com o outro. */
function naFaseDividida({ atual, ocupantes }: SituacaoNaFase): ObrigatoriedadeNaFase {
  const primeiro = atual && livre(ocupantes, true);
  return decidida(primeiro, primeiro ? NA_INSCRICAO : NA_ISENCAO);
}

/** A fase sem marca: o operador escolhe, e a escolha não repete a de outro formulário da fase. */
function aEscolhaDoOperador({ atual, ocupantes }: SituacaoNaFase): ObrigatoriedadeNaFase {
  return {
    obrigatorio: livre(ocupantes, atual) ? atual : !atual,
    fixa: false,
    podeAlternar: livre(ocupantes, !atual),
    explicacao: null,
  };
}

/**
 * A obrigatoriedade que a fase impõe ao formulário. A fase que coleta inscrição tem o formulário
 * obrigatório; a que só coleta o pedido de isenção, o facultativo; a que coleta as duas divide os
 * dois, o obrigatório primeiro. Nas demais fases o operador escolhe, e o padrão é obrigatório.
 */
export function obrigatoriedadeNaFase(
  fase: FaseQueRespondeFormulario | undefined,
  situacao: SituacaoNaFase,
): ObrigatoriedadeNaFase {
  const inscricao = fase?.coletaInscricao === true;
  const isencao = fase?.coletaSolicitacaoIsencao === true;
  if (inscricao && isencao) return naFaseDividida(situacao);
  if (inscricao) return decidida(true, NA_INSCRICAO);
  if (isencao) return decidida(false, NA_ISENCAO);
  return aEscolhaDoOperador(situacao);
}

/** A consequência da falta de envio só cabe no obrigatório de fase que não coleta inscrição. */
export function consequenciaCabe(
  fase: FaseQueRespondeFormulario | undefined,
  obrigatorio: boolean,
): boolean {
  return obrigatorio && fase?.coletaInscricao !== true;
}

/** Se o formulário é o que o candidato responde ao se inscrever. */
export function ehDaInscricao(
  formulario: Pick<FormularioDoProcessoNoRascunho, 'obrigatorio'>,
  fase: FaseQueRespondeFormulario | undefined,
): boolean {
  return formulario.obrigatorio && fase?.coletaInscricao === true;
}

/** Se o formulário é o pedido de isenção da taxa: o facultativo da fase que coleta o pedido. */
export function ehDaIsencao(
  formulario: Pick<FormularioDoProcessoNoRascunho, 'obrigatorio'>,
  fase: FaseQueRespondeFormulario | undefined,
): boolean {
  return !formulario.obrigatorio && fase?.coletaSolicitacaoIsencao === true;
}

/**
 * O formulário posto na fase: a obrigatoriedade que a fase impõe, e a consequência que só cabe
 * onde cabe — trocar a fase ou desmarcar o obrigatório a zera.
 */
export function naFase(
  formulario: FormularioDoProcessoNoRascunho,
  fase: FaseQueRespondeFormulario | undefined,
  ocupantes: SituacaoNaFase['ocupantes'],
): FormularioDoProcessoNoRascunho {
  const { obrigatorio } = obrigatoriedadeNaFase(fase, { atual: formulario.obrigatorio, ocupantes });
  return {
    ...formulario,
    obrigatorio,
    consequenciaDaFaltaDeEnvio: consequenciaCabe(fase, obrigatorio)
      ? formulario.consequenciaDaFaltaDeEnvio
      : null,
  };
}

/**
 * Se a fase ainda tem lugar para um formulário: um obrigatório e um facultativo, e o facultativo
 * da fase que coleta o pedido de isenção só existe quando o processo cobra taxa de inscrição.
 * A fase de inscrição tem lugar só para o obrigatório.
 */
export function faseTemLugar(
  fase: FaseQueRespondeFormulario,
  ocupantes: readonly Pick<FormularioDoProcessoNoRascunho, 'obrigatorio'>[],
  cobraTaxa: boolean,
): boolean {
  const lugarDoObrigatorio = !ocupantes.some((ocupante) => ocupante.obrigatorio);
  const lugarDoFacultativo = !ocupantes.some((ocupante) => !ocupante.obrigatorio);
  if (fase.coletaInscricao && !fase.coletaSolicitacaoIsencao) return lugarDoObrigatorio;
  if (fase.coletaSolicitacaoIsencao && !fase.coletaInscricao) {
    return cobraTaxa && lugarDoFacultativo;
  }
  if (fase.coletaInscricao) return lugarDoObrigatorio || (cobraTaxa && lugarDoFacultativo);
  return lugarDoObrigatorio || lugarDoFacultativo;
}
