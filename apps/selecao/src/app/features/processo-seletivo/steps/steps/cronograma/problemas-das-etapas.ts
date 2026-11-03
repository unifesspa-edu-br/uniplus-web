import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { descreverFase } from '../../shared/descricao-da-fase';
import { decimalDoCampo } from '../../shared/numero-do-campo';
import { escalaVale, fracaoDoPercentual } from '../../shared/itens-de-avaliacao';
import { problemasDosRecursosDasEtapas } from './problemas-dos-recursos-da-etapa';
import { repetidos } from './repetidos';
import {
  componeNota,
  declaraNotaDoEnem,
  declaraNotaMaxima,
  eliminaPorCarater,
  pontuaPorCarater,
  type TipoDeEtapaDoCatalogo,
} from './regras-da-etapa';

/**
 * A etapa de nota do ENEM sempre compõe a média, e a nota dela é calculada, não julgada:
 * não tem banca, não publica ato próprio, não abre janela própria e só admite recurso
 * contado da ciência do candidato, porque não há publicação da qual contar.
 */
function problemasDaEtapaDeNotaDoEnem(etapa: EtapaPontuada): readonly string[] {
  const nome = etapa.nome.trim();
  const problemas: string[] = [];
  if (etapa.carater === 'eliminatoria' || (etapa.carater !== '' && !componeNota(etapa))) {
    problemas.push(
      `A etapa de nota do ENEM "${nome}" compõe a nota final: precisa ser classificatória (ou ambas) e ter peso maior que zero.`,
    );
  }
  const julgada =
    etapa.bancas.length > 0 ||
    etapa.produtos.length > 0 ||
    etapa.inicio !== '' ||
    etapa.fim !== '' ||
    etapa.recursos.some((recurso) => recurso.ancora !== 'cienciaIndividual');
  if (julgada) {
    problemas.push(
      `A etapa de nota do ENEM "${nome}" tem a nota calculada: não declara banca, publicação, janela própria nem recurso contado de publicação.`,
    );
  }
  return problemas;
}

/**
 * As etapas e a fase que as agrupa formam um par: uma fase que agrupa etapas sem
 * nenhuma etapa é recusada na hora da gravação, e etapas sem a fase que as
 * agrupa passam agora para serem recusadas na publicação.
 *
 * Os dois casos entram aqui porque a diferença — recusa agora ou depois — não
 * ajuda quem preenche: os dois descrevem um cronograma que não se sustenta.
 */
export function problemasDasEtapas(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
  tipoDaEtapa: (tipoEtapaOrigemId: string) => TipoDeEtapaDoCatalogo | undefined,
): readonly string[] {
  const problemas: string[] = [];
  // Pela mesma resolução da tela: uma fase de avaliação cuja entrada saiu do
  // catálogo continua agrupando as etapas do processo. Procurá-la só no catálogo
  // vivo faria as etapas dela parecerem órfãs, e a gravação nunca sairia.
  const faseQueAgrupa = fases.find(
    (fase) => descreverFase(fase, fasePorId).exigencias?.agrupaEtapas === true,
  );

  // As duas direções da bicondicional alcançam só a etapa que NÃO declara a própria
  // fase — o formato anterior ao vínculo. A que declara pertence à fase que nomeou, e
  // qualquer fase pode recebê-la.
  const semFaseDeclarada = etapas.filter((etapa) => (etapa.faseCodigo ?? '') === '');

  if (faseQueAgrupa !== undefined && etapas.length === 0) {
    problemas.push(
      'A fase de avaliação agrupa as etapas pontuadas e precisa de ao menos uma. Declare a etapa, ou remova a fase.',
    );
  }

  if (faseQueAgrupa === undefined && semFaseDeclarada.length > 0) {
    problemas.push(
      'Estas etapas não dizem a que fase pertencem. Declare a fase de cada uma, ou remova-as.',
    );
  }

  if (etapas.length === 0) return problemas;

  if (etapas.some((etapa) => etapa.nome.trim() === '')) {
    problemas.push('Toda etapa precisa de nome.');
  }

  if (etapas.some((etapa) => etapa.tipoEtapaOrigemId === '')) {
    problemas.push('Toda etapa precisa do tipo que diz de que natureza ela é.');
  }

  if (etapas.some((etapa) => etapa.carater === '')) {
    problemas.push('Toda etapa precisa declarar o caráter dela, entre os que o tipo admite.');
  }

  // Espelha a recusa do servidor, que confere o caráter declarado contra o que o tipo admite no
  // cadastro. Sem isto a tela deixaria gravar para receber um 422 que a pessoa não pediu — e o
  // caso acontece sem ninguém errar nada: basta o cadastro estreitar um tipo depois de a etapa
  // ter sido declarada.
  for (const etapa of etapas) {
    const tipo = tipoDaEtapa(etapa.tipoEtapaOrigemId);
    if (tipo === undefined || etapa.carater === '') continue;

    if (pontuaPorCarater(etapa.carater) && !tipo.admitePontuacao) {
      problemas.push(
        `O tipo ${tipo.nome} não compõe a nota final: a etapa "${etapa.nome.trim()}" não pode ter caráter que pontua.`,
      );
    }
    if (eliminaPorCarater(etapa.carater) && !tipo.admiteEliminacao) {
      problemas.push(
        `O tipo ${tipo.nome} não elimina candidato: a etapa "${etapa.nome.trim()}" não pode ter caráter que reprova.`,
      );
    }
  }

  for (const etapa of etapas) {
    if (!declaraNotaDoEnem(etapa, tipoDaEtapa(etapa.tipoEtapaOrigemId))) continue;
    problemas.push(...problemasDaEtapaDeNotaDoEnem(etapa));
  }

  if (repetidos(etapas.map((etapa) => etapa.ordem)).length > 0) {
    problemas.push('Duas etapas não podem ocupar a mesma posição.');
  }

  // Texto que não converte vira `null` no comando, e `null` é o valor legítimo
  // de "não declarado": sem esta conferência, `7,5,` digitado na nota mínima
  // grava com sucesso e apaga o que estava lá, sem nada dizer.
  if (etapas.some((etapa) => naoConverte(etapa.peso))) {
    problemas.push('O peso de uma etapa precisa ser um número, com ponto ou vírgula decimal.');
  }

  if (etapas.some((etapa) => naoConverte(etapa.notaMinima))) {
    problemas.push(
      'A nota mínima de uma etapa precisa ser um número, com ponto ou vírgula decimal.',
    );
  }

  // Só a etapa que pede nota máxima é conferida: um valor herdado em etapa que não a mostra
  // bloquearia a gravação com mensagem sobre um campo que o operador não vê.
  for (const etapa of etapas) {
    if (!declaraNotaMaxima(etapa, tipoDaEtapa(etapa.tipoEtapaOrigemId))) continue;
    const nome = `etapa "${etapa.nome.trim()}"`;
    const maxima = etapa.notaMaxima ?? '';
    if (naoConverte(maxima)) {
      problemas.push(
        `A nota máxima da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
      );
    } else if (pesoDeclaradoNaoPositivo(maxima)) {
      problemas.push(`A nota máxima da ${nome}, quando declarada, precisa ser maior que zero.`);
    } else if (notaMinimaAcimaDaMaxima(etapa)) {
      // Só o servidor confere a escala inteira, mas recusar aqui evita gravar as fases e só
      // então ter as etapas recusadas.
      problemas.push(`A nota mínima da ${nome} não pode passar da nota máxima dela.`);
    }

    const passo = etapa.passoDoLancamento ?? '';
    if (naoConverte(passo)) {
      problemas.push(
        `O passo do lançamento da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
      );
    } else if (pesoDeclaradoNaoPositivo(passo)) {
      problemas.push(
        `O passo do lançamento da ${nome}, quando declarado, precisa ser maior que zero.`,
      );
    }

    problemas.push(...problemasDosItensEDaEscala(etapa, nome));
  }

  // Zero converte, então a conferência de forma acima o deixa passar, e a
  // agregada também: basta outra etapa compor a nota. O domínio exige peso
  // maior que zero em toda etapa que o declara, e recusaria a gravação inteira
  // por causa da que ficou zerada.
  if (etapas.some((etapa) => pesoDeclaradoNaoPositivo(etapa.peso))) {
    problemas.push('O peso de uma etapa, quando declarado, precisa ser maior que zero.');
  }

  // A guarda do divisor da média só faz sentido quando o certame de fato pontua. Uma
  // fase inteiramente operacional — envio de comprovante, análise documental — tem
  // etapas sem caráter nem peso, e cobrar nota delas recusaria configuração legítima.
  const algumaPontua = etapas.some((etapa) => etapa.carater !== '' || etapa.peso.trim() !== '');
  if (algumaPontua && !etapas.some(componeNota)) {
    problemas.push(
      'Ao menos uma etapa precisa compor a nota final: ser classificatória (ou ambas) e ter peso maior que zero.',
    );
  }

  problemas.push(...problemasDosRecursosDasEtapas(etapas));

  return problemas;
}

/**
 * Só o que não vira número é recusado aqui: o texto que não converte não tem número a enviar
 * no comando. O resto (rótulo, soma, passo) quem diz é o servidor, sob o campo, ou a publicação.
 */
function problemasDosItensEDaEscala(etapa: EtapaPontuada, nome: string): readonly string[] {
  const problemas: string[] = [];
  const itens = etapa.itensDeAvaliacao ?? [];
  if (
    itens.some((item) => item.pontuacaoMaxima.trim() === '' || naoConverte(item.pontuacaoMaxima))
  ) {
    problemas.push(
      `A pontuação máxima de cada item da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
    );
  }
  if (
    escalaVale(etapa) &&
    (etapa.escalaDeAtendimento ?? []).some((nivel) => fracaoDoPercentual(nivel.percentual) === null)
  ) {
    problemas.push(
      `O percentual de cada nível da escala da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
    );
  }
  return problemas;
}

/** Peso escrito na etapa que não é maior que zero. */
function pesoDeclaradoNaoPositivo(peso: string): boolean {
  const valor = decimalDoCampo(peso);
  return peso.trim() !== '' && valor !== null && valor <= 0;
}

function notaMinimaAcimaDaMaxima(etapa: EtapaPontuada): boolean {
  const minima = decimalDoCampo(etapa.notaMinima);
  const maxima = decimalDoCampo(etapa.notaMaxima ?? '');
  return minima !== null && maxima !== null && maxima > 0 && minima > maxima;
}

/** Campo preenchido que a gramática numérica do editor não aceita. */
function naoConverte(valor: string): boolean {
  return valor.trim() !== '' && decimalDoCampo(valor) === null;
}
