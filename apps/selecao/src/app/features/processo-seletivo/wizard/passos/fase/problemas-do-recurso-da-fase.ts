import {
  PAPEL_PRELIMINAR,
  type FaseDoCronograma,
  type RecursoDaFase,
} from '../../processo-seletivo.models';
import { MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO } from '../../shared/instancia-superior';
import { decimalDoCampo } from '../../shared/numero-do-campo';
import { fracaoDeDiaUtil } from '../../shared/prazo-em-dias-uteis';

import type { CampoDaFase, ProblemaDaFase } from './configuracao-da-fase';

/** Os produtos preliminares da fase — os únicos que podem ancorar o prazo. */
export function produtosPreliminares(
  produtos: FaseDoCronograma['produtos'],
): FaseDoCronograma['produtos'] {
  return produtos.filter((produto) => produto.papel === PAPEL_PRELIMINAR);
}

function recusa(campo: CampoDaFase, mensagem: string): readonly ProblemaDaFase[] {
  return [{ campo, mensagem }];
}

export function problemasDoRecurso(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  return [
    ...(regra.regraCodigo === ''
      ? recusa('recurso.regra', 'Escolha a regra que rege a contagem do prazo de recurso.')
      : []),
    ...problemasDoPrazo(regra.prazoValor, regra.prazoUnidade),
    ...problemasDaAncoraDeclarada(fase),
    ...problemasDaSuspensividade(
      'recurso.suspensividadePrimeiraInstancia',
      'primeira instância',
      regra.suspensividadePrimeiraInstanciaValor,
      regra.suspensividadePrimeiraInstanciaUnidade,
    ),
    ...problemasDaInstanciaSuperior(regra),
  ];
}

function problemasDaInstanciaSuperior(regra: RecursoDaFase): readonly ProblemaDaFase[] {
  if (regra.admiteInstanciaSuperior === null) {
    return recusa('recurso.admiteInstanciaSuperior', MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO);
  }
  // Sem instância superior o tempo de bloqueio dela não existe nem viaja: conferir um campo
  // oculto recusaria a gravação por algo que o operador não vê.
  if (!regra.admiteInstanciaSuperior) return [];
  return problemasDaSuspensividade(
    'recurso.suspensividadeSegundaInstancia',
    'segunda instância',
    regra.suspensividadeSegundaInstanciaValor,
    regra.suspensividadeSegundaInstanciaUnidade,
  );
}

/**
 * O prazo de interposição.
 *
 * Dia corrido é recusado pelo domínio, e a fração só existe em hora: um prazo em
 * dias úteis conta dias inteiros. Dizer isso aqui evita que o operador descubra
 * as duas coisas por uma gravação recusada.
 */
function problemasDoPrazo(valor: string, unidade: string): readonly ProblemaDaFase[] {
  return [...problemasDoValorDoPrazo(valor), ...problemasDaUnidadeDoPrazo(valor, unidade)];
}

function problemasDoValorDoPrazo(valor: string): readonly ProblemaDaFase[] {
  const numero = decimalDoCampo(valor);

  if (valor.trim() === '' || numero === null) {
    return recusa(
      'recurso.prazo',
      'O prazo de interposição precisa ser um número, com ponto ou vírgula decimal.',
    );
  }
  if (numero <= 0) {
    return recusa('recurso.prazo', 'O prazo de interposição precisa ser maior que zero.');
  }
  return [];
}

function problemasDaUnidadeDoPrazo(valor: string, unidade: string): readonly ProblemaDaFase[] {
  if (unidade === '' || unidade === 'nenhuma') {
    return recusa(
      'recurso.prazo',
      'Declare a unidade do prazo de interposição: dias úteis ou horas.',
    );
  }
  if (unidade === 'dias') {
    return recusa(
      'recurso.prazo',
      'Prazo de interposição em dias corridos não é aceito. Use dias úteis ou horas.',
    );
  }
  return fracaoDeDiaUtil(valor, unidade)
    ? recusa('recurso.prazo', 'Prazo de interposição em dias úteis exige valor inteiro.')
    : [];
}

/**
 * A âncora é escolhida, não derivada: uma fase publica legitimamente gabarito e
 * resultado preliminares e admite recurso contra qualquer um deles, e eleger um
 * em silêncio contaria a janela da publicação errada.
 */
function problemasDaAncoraDeclarada(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  const preliminares = produtosPreliminares(fase.produtos);
  if (preliminares.length === 0) {
    return recusa(
      'produtos',
      'A fase admite recurso e não publica nenhum resultado preliminar. Declare a publicação preliminar de que cabe recurso.',
    );
  }
  if (regra.atoAncoraCodigo === '') {
    return recusa(
      'recurso.ancora',
      'Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso.',
    );
  }
  return preliminares.some((produto) => produto.atoCodigo === regra.atoAncoraCodigo)
    ? []
    : recusa(
        'recurso.ancora',
        'O prazo de recurso precisa contar de um resultado preliminar publicado por esta própria fase.',
      );
}

/**
 * O par de suspensividade é declarado inteiro ou deixado inteiro em branco:
 * metade preenchida é recusada, e a ausência dos dois é a desativação prevista
 * daquela instância.
 */
function problemasDaSuspensividade(
  campo: CampoDaFase,
  instancia: string,
  valor: string,
  unidade: string,
): readonly ProblemaDaFase[] {
  const temValor = valor.trim() !== '';
  const temUnidade = unidade !== '' && unidade !== 'nenhuma';

  if (!temValor && !temUnidade) return [];
  if (temValor !== temUnidade) {
    return recusa(
      campo,
      `A suspensividade da ${instancia} exige valor e unidade juntos, ou nenhum dos dois.`,
    );
  }

  const numero = decimalDoCampo(valor);
  if (numero === null) {
    return recusa(
      campo,
      `O prazo de suspensividade da ${instancia} precisa ser um número, com ponto ou vírgula decimal.`,
    );
  }
  return numero > 0
    ? []
    : recusa(campo, `O prazo de suspensividade da ${instancia} precisa ser maior que zero.`);
}
