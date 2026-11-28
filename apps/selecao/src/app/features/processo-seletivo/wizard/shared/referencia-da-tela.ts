import { type RotuloDePasso, ROTULOS_DOS_PASSOS } from '../processo-seletivo.data';

/** "Passo 4 — Vagas", como a tela nomeia o passo, dado pelo rótulo dele. */
export function rotuloDoPassoNaTela(rotulo: RotuloDePasso): string {
  return `Passo ${ROTULOS_DOS_PASSOS.indexOf(rotulo) + 1} — ${rotulo}`;
}

/**
 * A frase que diz ao suporte onde o erro está, para a mensagem que a tela monta em texto (a que
 * segue por lista de mensagens): "Informe ao suporte: passo 4 — Vagas, código x.".
 */
export function fraseParaOSuporte(rotulo: RotuloDePasso, codigos: readonly string[]): string {
  const passo = rotuloDoPassoNaTela(rotulo);
  const palavra = codigos.length === 1 ? 'código' : 'códigos';
  return `Informe ao suporte: ${passo.charAt(0).toLowerCase()}${passo.slice(1)}, ${palavra} ${codigos.join(', ')}.`;
}
