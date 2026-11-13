import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { descreverFase } from '../../shared/descricao-da-fase';
import { decimalDoCampo } from '../../shared/numero-do-campo';
import { escalaVale, fracaoDoPercentual } from '../../shared/itens-de-avaliacao';
import { problemasDosRecursosDasEtapas } from './problemas-dos-recursos-da-etapa';
import { repetidos } from '../../shared/repetidos';
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
 * não tem banca, não publica ato próprio, não abre janela própria e não admite recurso: a nota
 * se contesta no recurso da fase que a divulga.
 */
function problemasDaEtapaDeNotaDoEnem(etapa: EtapaPontuada): readonly string[] {
  const nome = etapa.nome.trim();
  return [
    ...(caraterNaoCompoeANota(etapa)
      ? [
          `A etapa de nota do ENEM "${nome}" compõe a nota final: precisa ser classificatória (ou ambas) e ter peso maior que zero.`,
        ]
      : []),
    ...(declaraOQueANotaDoEnemNaoTem(etapa)
      ? [
          `A etapa de nota do ENEM "${nome}" tem a nota calculada: não declara banca, publicação, janela própria nem recurso: a nota se contesta no recurso da fase que a divulga.`,
        ]
      : []),
  ];
}

function caraterNaoCompoeANota(etapa: EtapaPontuada): boolean {
  return etapa.carater === 'eliminatoria' || (etapa.carater !== '' && !componeNota(etapa));
}

function declaraOQueANotaDoEnemNaoTem(etapa: EtapaPontuada): boolean {
  return (
    etapa.bancas.length > 0 ||
    etapa.produtos.length > 0 ||
    etapa.inicio !== '' ||
    etapa.fim !== '' ||
    etapa.recursos.length > 0
  );
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
  tipoDaEtapa: TipoDaEtapaNoCadastro,
): readonly string[] {
  const doPar = problemasDoParDeFaseEEtapas(fases, etapas, fasePorId);
  if (etapas.length === 0) return doPar;
  return [
    ...doPar,
    ...problemasDeDeclaracaoEDeTipo(etapas, tipoDaEtapa),
    ...problemasDaNotaDasEtapas(etapas, tipoDaEtapa),
    ...problemasDosRecursosDasEtapas(etapas),
  ];
}

type TipoDaEtapaNoCadastro = (tipoEtapaOrigemId: string) => TipoDeEtapaDoCatalogo | undefined;

function problemasDeDeclaracaoEDeTipo(
  etapas: readonly EtapaPontuada[],
  tipoDaEtapa: TipoDaEtapaNoCadastro,
): readonly string[] {
  return [
    ...problemasDeDeclaracaoDasEtapas(etapas),
    ...problemasDeCaraterContraOTipo(etapas, tipoDaEtapa),
    ...etapas
      .filter((etapa) => declaraNotaDoEnem(etapa, tipoDaEtapa(etapa.tipoEtapaOrigemId)))
      .flatMap(problemasDaEtapaDeNotaDoEnem),
    ...(repetidos(etapas.map((etapa) => etapa.ordem)).length > 0
      ? ['Duas etapas não podem ocupar a mesma posição.']
      : []),
  ];
}

function problemasDaNotaDasEtapas(
  etapas: readonly EtapaPontuada[],
  tipoDaEtapa: TipoDaEtapaNoCadastro,
): readonly string[] {
  return [
    ...problemasDoPesoEDaNotaMinima(etapas),
    ...etapas
      .filter((etapa) => declaraNotaMaxima(etapa, tipoDaEtapa(etapa.tipoEtapaOrigemId)))
      .flatMap(problemasDaEscalaDaEtapa),
    ...problemasDaComposicaoDaNota(etapas),
  ];
}

/**
 * Pela mesma resolução da tela: uma fase de avaliação cuja entrada saiu do catálogo continua
 * agrupando as etapas do processo. Procurá-la só no catálogo vivo faria as etapas dela parecerem
 * órfãs, e a gravação nunca sairia. As duas direções da bicondicional alcançam só a etapa que NÃO
 * declara a própria fase — o formato anterior ao vínculo: a que declara pertence à fase que
 * nomeou, e qualquer fase pode recebê-la.
 */
function problemasDoParDeFaseEEtapas(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const agrupa = fases.some(
    (fase) => descreverFase(fase, fasePorId).exigencias?.agrupaEtapas === true,
  );
  if (agrupa) return etapas.length === 0 ? [MENSAGEM_FASE_SEM_ETAPA] : [];
  return etapas.some((etapa) => (etapa.faseCodigo ?? '') === '') ? [MENSAGEM_ETAPA_SEM_FASE] : [];
}

const MENSAGEM_FASE_SEM_ETAPA =
  'A fase de avaliação agrupa as etapas pontuadas e precisa de ao menos uma. Declare a etapa, ou remova a fase.';
const MENSAGEM_ETAPA_SEM_FASE =
  'Estas etapas não dizem a que fase pertencem. Declare a fase de cada uma, ou remova-as.';

function problemasDeDeclaracaoDasEtapas(etapas: readonly EtapaPontuada[]): readonly string[] {
  const problemas: string[] = [];
  if (etapas.some((etapa) => etapa.nome.trim() === '')) {
    problemas.push('Toda etapa precisa de nome.');
  }
  if (etapas.some((etapa) => etapa.tipoEtapaOrigemId === '')) {
    problemas.push('Toda etapa precisa do tipo que diz de que natureza ela é.');
  }
  if (etapas.some((etapa) => etapa.carater === '')) {
    problemas.push('Toda etapa precisa declarar o caráter dela, entre os que o tipo admite.');
  }
  return problemas;
}

// Espelha a recusa do servidor, que confere o caráter declarado contra o que o tipo admite no
// cadastro. Sem isto a tela deixaria gravar para receber um 422 que a pessoa não pediu — e o
// caso acontece sem ninguém errar nada: basta o cadastro estreitar um tipo depois de a etapa
// ter sido declarada.
function problemasDeCaraterContraOTipo(
  etapas: readonly EtapaPontuada[],
  tipoDaEtapa: TipoDaEtapaNoCadastro,
): readonly string[] {
  return etapas.flatMap((etapa) => {
    const tipo = tipoDaEtapa(etapa.tipoEtapaOrigemId);
    return tipo === undefined || etapa.carater === '' ? [] : problemasDoCaraterDaEtapa(etapa, tipo);
  });
}

function problemasDoCaraterDaEtapa(
  etapa: EtapaPontuada,
  tipo: TipoDeEtapaDoCatalogo,
): readonly string[] {
  const nome = etapa.nome.trim();
  const pontuaSemPoder = pontuaPorCarater(etapa.carater) && !tipo.admitePontuacao;
  const eliminaSemPoder = eliminaPorCarater(etapa.carater) && !tipo.admiteEliminacao;
  return [
    ...(pontuaSemPoder ? [mensagemDoTipoQueNaoPontua(tipo, nome)] : []),
    ...(eliminaSemPoder ? [mensagemDoTipoQueNaoElimina(tipo, nome)] : []),
  ];
}

const mensagemDoTipoQueNaoPontua = (tipo: TipoDeEtapaDoCatalogo, nome: string): string =>
  `O tipo ${tipo.nome} não compõe a nota final: a etapa "${nome}" não pode ter caráter que pontua.`;

const mensagemDoTipoQueNaoElimina = (tipo: TipoDeEtapaDoCatalogo, nome: string): string =>
  `O tipo ${tipo.nome} não elimina candidato: a etapa "${nome}" não pode ter caráter que reprova.`;

// Texto que não converte vira `null` no comando, e `null` é o valor legítimo
// de "não declarado": sem esta conferência, `7,5,` digitado na nota mínima
// grava com sucesso e apaga o que estava lá, sem nada dizer.
function problemasDoPesoEDaNotaMinima(etapas: readonly EtapaPontuada[]): readonly string[] {
  const problemas: string[] = [];
  if (etapas.some((etapa) => naoConverte(etapa.peso))) {
    problemas.push('O peso de uma etapa precisa ser um número, com ponto ou vírgula decimal.');
  }
  if (etapas.some((etapa) => naoConverte(etapa.notaMinima))) {
    problemas.push(
      'A nota mínima de uma etapa precisa ser um número, com ponto ou vírgula decimal.',
    );
  }
  return problemas;
}

// Só a etapa que pede nota máxima é conferida: um valor herdado em etapa que não a mostra
// bloquearia a gravação com mensagem sobre um campo que o operador não vê.
function problemasDaEscalaDaEtapa(etapa: EtapaPontuada): readonly string[] {
  const nome = `etapa "${etapa.nome.trim()}"`;
  return [
    ...problemasDaNotaMaxima(etapa, nome),
    ...problemasDoPassoDoLancamento(etapa, nome),
    ...problemasDosItensEDaEscala(etapa, nome),
  ];
}

function problemasDaNotaMaxima(etapa: EtapaPontuada, nome: string): readonly string[] {
  const maxima = etapa.notaMaxima ?? '';
  if (naoConverte(maxima)) {
    return [`A nota máxima da ${nome} precisa ser um número, com ponto ou vírgula decimal.`];
  }
  if (pesoDeclaradoNaoPositivo(maxima)) {
    return [`A nota máxima da ${nome}, quando declarada, precisa ser maior que zero.`];
  }
  // Só o servidor confere a escala inteira, mas recusar aqui evita gravar as fases e só
  // então ter as etapas recusadas.
  if (notaMinimaAcimaDaMaxima(etapa)) {
    return [`A nota mínima da ${nome} não pode passar da nota máxima dela.`];
  }
  return [];
}

function problemasDoPassoDoLancamento(etapa: EtapaPontuada, nome: string): readonly string[] {
  const passo = etapa.passoDoLancamento ?? '';
  if (naoConverte(passo)) {
    return [
      `O passo do lançamento da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
    ];
  }
  if (pesoDeclaradoNaoPositivo(passo)) {
    return [`O passo do lançamento da ${nome}, quando declarado, precisa ser maior que zero.`];
  }
  return [];
}

function problemasDaComposicaoDaNota(etapas: readonly EtapaPontuada[]): readonly string[] {
  return [...problemasDoPesoNaoPositivo(etapas), ...problemasDeNenhumaEtapaCompoeANota(etapas)];
}

// Zero converte, então a conferência de forma acima o deixa passar, e a agregada também: basta
// outra etapa compor a nota. O domínio exige peso maior que zero em toda etapa que o declara, e
// recusaria a gravação inteira por causa da que ficou zerada.
function problemasDoPesoNaoPositivo(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.some((etapa) => pesoDeclaradoNaoPositivo(etapa.peso))
    ? ['O peso de uma etapa, quando declarado, precisa ser maior que zero.']
    : [];
}

// A guarda do divisor da média só faz sentido quando o certame de fato pontua. Uma fase
// inteiramente operacional — envio de comprovante, análise documental — tem etapas sem caráter
// nem peso, e cobrar nota delas recusaria configuração legítima.
function problemasDeNenhumaEtapaCompoeANota(etapas: readonly EtapaPontuada[]): readonly string[] {
  const algumaPontua = etapas.some((etapa) => etapa.carater !== '' || etapa.peso.trim() !== '');
  return algumaPontua && !etapas.some(componeNota)
    ? [
        'Ao menos uma etapa precisa compor a nota final: ser classificatória (ou ambas) e ter peso maior que zero.',
      ]
    : [];
}

/**
 * Só o que não vira número é recusado aqui: o texto que não converte não tem número a enviar
 * no comando. O resto (rótulo, soma, passo) quem diz é o servidor, sob o campo, ou a publicação.
 */
function problemasDosItensEDaEscala(etapa: EtapaPontuada, nome: string): readonly string[] {
  return [...problemasDosItens(etapa, nome), ...problemasDaEscalaDeAtendimento(etapa, nome)];
}

function problemasDosItens(etapa: EtapaPontuada, nome: string): readonly string[] {
  const itens = etapa.itensDeAvaliacao ?? [];
  return itens.some(
    (item) => item.pontuacaoMaxima.trim() === '' || naoConverte(item.pontuacaoMaxima),
  )
    ? [
        `A pontuação máxima de cada item da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
      ]
    : [];
}

function problemasDaEscalaDeAtendimento(etapa: EtapaPontuada, nome: string): readonly string[] {
  const niveis = etapa.escalaDeAtendimento ?? [];
  return escalaVale(etapa) && niveis.some((nivel) => fracaoDoPercentual(nivel.percentual) === null)
    ? [
        `O percentual de cada nível da escala da ${nome} precisa ser um número, com ponto ou vírgula decimal.`,
      ]
    : [];
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
