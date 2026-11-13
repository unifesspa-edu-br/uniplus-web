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

const MENSAGEM_SEM_UNIDADE_DO_PRAZO =
  'Declare a unidade do prazo de interposição: dias úteis ou horas.';
const MENSAGEM_PRAZO_EM_DIAS_CORRIDOS =
  'Prazo de interposição em dias corridos não é aceito. Use dias úteis ou horas.';
const MENSAGEM_SEM_PRELIMINAR =
  'A fase admite recurso e não publica nenhum resultado preliminar. Declare a publicação preliminar de que cabe recurso.';
const MENSAGEM_SEM_ANCORA =
  'Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso.';
const MENSAGEM_ANCORA_FORA_DA_FASE =
  'O prazo de recurso precisa contar de um resultado preliminar publicado por esta própria fase.';

function recusa(campo: CampoDaFase, mensagem: string): readonly ProblemaDaFase[] {
  return [{ campo, mensagem }];
}

export function problemasDoRecurso(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  return [
    ...problemasDaRegraDeContagem(regra),
    ...problemasDoPrazo(regra.prazoValor, regra.prazoUnidade),
    ...problemasDaAncoraDeclarada(fase),
    ...problemasDaPrimeiraInstancia(regra),
    ...problemasDaInstanciaSuperior(regra),
  ];
}

function problemasDaRegraDeContagem(regra: RecursoDaFase): readonly ProblemaDaFase[] {
  return regra.regraCodigo === ''
    ? recusa('recurso.regra', 'Escolha a regra que rege a contagem do prazo de recurso.')
    : [];
}

function problemasDaPrimeiraInstancia(regra: RecursoDaFase): readonly ProblemaDaFase[] {
  return problemasDaSuspensividade(
    'recurso.suspensividadePrimeiraInstancia',
    'primeira instância',
    regra.suspensividadePrimeiraInstanciaValor,
    regra.suspensividadePrimeiraInstanciaUnidade,
  );
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
    return recusa('recurso.prazo', MENSAGEM_SEM_UNIDADE_DO_PRAZO);
  }
  if (unidade === 'dias') return recusa('recurso.prazo', MENSAGEM_PRAZO_EM_DIAS_CORRIDOS);
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
  if (preliminares.length === 0) return recusa('produtos', MENSAGEM_SEM_PRELIMINAR);
  return problemasDaAncoraEscolhida(regra.atoAncoraCodigo, preliminares);
}

function problemasDaAncoraEscolhida(
  codigo: string,
  preliminares: FaseDoCronograma['produtos'],
): readonly ProblemaDaFase[] {
  if (codigo === '') return recusa('recurso.ancora', MENSAGEM_SEM_ANCORA);
  return preliminares.some((produto) => produto.atoCodigo === codigo)
    ? []
    : recusa('recurso.ancora', MENSAGEM_ANCORA_FORA_DA_FASE);
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
  if (temValor === temUnidade) return problemasDoValorDoPar(campo, instancia, valor, unidade);
  return recusa(campo, mensagemDoParIncompleto(instancia));
}

function mensagemDoParIncompleto(instancia: string): string {
  return `A suspensividade da ${instancia} exige valor e unidade juntos, ou nenhum dos dois.`;
}

function problemasDoValorDoPar(
  campo: CampoDaFase,
  instancia: string,
  valor: string,
  unidade: string,
): readonly ProblemaDaFase[] {
  const numero = decimalDoCampo(valor);
  const prazo = `O prazo de suspensividade da ${instancia}`;
  if (numero === null)
    return recusa(campo, `${prazo} precisa ser um número, com ponto ou vírgula decimal.`);
  if (numero <= 0) return recusa(campo, `${prazo} precisa ser maior que zero.`);
  return fracaoNaSuspensividade(campo, prazo, valor, unidade);
}

function fracaoNaSuspensividade(
  campo: CampoDaFase,
  prazo: string,
  valor: string,
  unidade: string,
): readonly ProblemaDaFase[] {
  return fracaoDeDiaUtil(valor, unidade)
    ? recusa(campo, `${prazo} em dias úteis exige valor inteiro; para menos de um dia, use horas.`)
    : [];
}
