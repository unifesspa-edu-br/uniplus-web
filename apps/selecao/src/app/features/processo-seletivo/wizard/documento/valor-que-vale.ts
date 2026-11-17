import { decimalDoCampo, inteiroDoCampo } from '../shared/numero-do-campo';
import { escalaDaNotaFinal } from '../shared/escala-da-nota-final';
import { campoDoInstante } from '../shared/fuso-institucional';
import { analisarValorEmReais, formatarValorEmReais } from '../shared/valor-em-reais';
import { instanteEmUtc } from './instante-em-utc';
import { fracaoDoPercentual, percentualDaFracao } from './percentual-do-campo';
import { textoDoNumero, textoPreenchido } from './texto-do-campo';

/** Como um campo do documento vira o texto do formulário e como o texto digitado volta a ele. */
interface FormaDoCampo<V> {
  readonly comoTexto: (valor: V) => string;
  readonly doTexto: (texto: string) => V | undefined;
}

/**
 * O valor que fica no documento depois da edição. Reaplicar o texto que o formulário leu do próprio
 * documento devolve o valor lido como estava, com os espaços, o formato e a precisão que o esquema
 * admite; só o que a pessoa digitou de diferente é interpretado, apara e normaliza.
 */
function valorQueVale<V>(
  atual: V | null | undefined,
  texto: string,
  forma: FormaDoCampo<V>,
): V | undefined {
  const inalterado = atual != null && forma.comoTexto(atual).trim() === texto.trim();
  return inalterado ? atual : forma.doTexto(texto);
}

export function textoQueVale(atual: string | null | undefined, texto: string): string | undefined {
  return valorQueVale(atual, texto, { comoTexto: (valor) => valor, doTexto: textoPreenchido });
}

export function inteiroQueVale(
  atual: number | null | undefined,
  texto: string,
): number | undefined {
  return valorQueVale(atual, texto, {
    comoTexto: textoDoNumero,
    doTexto: (digitado) => inteiroDoCampo(digitado) ?? undefined,
  });
}

export function decimalQueVale(
  atual: number | null | undefined,
  texto: string,
): number | undefined {
  return valorQueVale(atual, texto, {
    comoTexto: textoDoNumero,
    doTexto: (digitado) => decimalDoCampo(digitado) ?? undefined,
  });
}

export function escalaQueVale(atual: number | null | undefined, texto: string): number | undefined {
  return valorQueVale(atual, texto, {
    comoTexto: textoDoNumero,
    doTexto: (digitado) => escalaDaNotaFinal(digitado) ?? undefined,
  });
}

export function valorEmReaisQueVale(
  atual: number | null | undefined,
  texto: string,
): number | undefined {
  return valorQueVale(atual, texto, {
    comoTexto: formatarValorEmReais,
    doTexto: (digitado) => analisarValorEmReais(digitado) ?? undefined,
  });
}

/** A janela como o campo de data e hora a mostra, no fuso institucional; o documento guarda UTC. */
export function instanteQueVale(
  atual: string | null | undefined,
  texto: string,
): string | undefined {
  return valorQueVale(atual, texto, { comoTexto: campoDoInstante, doTexto: instanteEmUtc });
}

/** A fração de 0 a 1 do documento, que o campo mostra como percentual. */
export function fracaoQueVale(atual: number | null | undefined, texto: string): number | undefined {
  return valorQueVale(atual, texto, {
    comoTexto: percentualDaFracao,
    doTexto: fracaoDoPercentual,
  });
}
