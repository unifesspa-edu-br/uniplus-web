import type { WizardDraft } from '../processo-seletivo.models';

/** O que o passo Revisão reúne para o `POST …/publicacao`, vivo só na memória da página. */
export type DadosDoAto = WizardDraft['publicacao'];

/**
 * Há algo a perder ao sair da página: um campo do ato preenchido ou um anexo, ainda sem uso na
 * publicação. O anexo em envio ou com erro conta como o confirmado: é arquivo que a pessoa escolheu
 * e terá de escolher de novo.
 */
export function temAtoDigitado(publicacao: DadosDoAto): boolean {
  const { ato, anexos, ...resto } = publicacao;
  return (
    [...Object.values(resto), ...Object.values(ato)].some((valor) => valor.trim() !== '') ||
    anexos.length > 0
  );
}
