import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import {
  PAPEL_PRELIMINAR,
  type EtapaPontuada,
  type FaseDoCronograma,
} from '../../processo-seletivo.models';
import { descreverFase } from '../../shared/descricao-da-fase';
import { decimalDoCampo } from '../../shared/numero-do-campo';
import { escalaVale, fracaoDoPercentual } from '../../shared/itens-de-avaliacao';
import { fracaoDeDiaUtil } from '../../shared/prazo-em-dias-uteis';
import { recursoResolvido } from './cronograma-para-comando';
import { problemasDaFase, type AtoDoCatalogo } from '../fase/configuracao-da-fase';
import {
  problemasDasExigencias,
  type ExigenciaDeclarada,
} from './conferencia-das-exigencias-declaradas';
import { instanteDe, violacoesDePrecedencia } from './precedencia-de-fases';
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
 * O que impede a gravação, na ordem em que quem preenche resolve: primeiro o
 * que falta declarar, depois o que está incoerente entre si.
 *
 * Só entra aqui o que a tela consegue afirmar com o que tem em mãos. Teto de
 * vagas, vigência de ato e unicidade de código no servidor continuam sendo dele
 * — repetir a conferência aqui daria duas fontes para a mesma regra, e a que
 * ficasse desatualizada recusaria o que o servidor aceita.
 */
export function problemasDoCronograma(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
  precedencias: readonly PrecedenciaFaseDto[],
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
  nomeDaBanca: (tipoBancaId: string) => string,
  tipoDaEtapa: (tipoEtapaOrigemId: string) => TipoDeEtapaDoCatalogo | undefined,
  exigencias: readonly ExigenciaDeclarada[],
): readonly string[] {
  const problemas: string[] = [];

  if (fases.length === 0) {
    problemas.push('O cronograma precisa de ao menos uma fase.');
    return problemas;
  }

  const codigosRepetidos = repetidos(fases.map((fase) => fase.faseCanonicaId));
  if (codigosRepetidos.length > 0) {
    problemas.push('Cada fase canônica entra uma vez só no cronograma.');
  }

  if (repetidos(fases.map((fase) => fase.ordem)).length > 0) {
    problemas.push('Duas fases não podem ocupar a mesma posição na linha do tempo.');
  }

  for (const fase of fases) {
    // A mesma resolução que a tela usa: o que a fase congelou vale sobre o
    // catálogo, e a fase cuja entrada saiu continua sendo conferida pelo que
    // ela guarda. Consultar o catálogo direto aqui deixaria de conferir
    // justamente a fase que ninguém mais confere.
    const { nome, exigencias } = descreverFase(fase, fasePorId);
    if (exigencias === null) continue;

    if (exigencias.janelaObrigatoria && (fase.inicio === null || fase.fim === null)) {
      problemas.push(`A fase ${nome} precisa de data e hora de início e de fim.`);
    }

    if (
      fase.inicio !== null &&
      fase.fim !== null &&
      Date.parse(fase.fim) < Date.parse(fase.inicio)
    ) {
      problemas.push(`Na fase ${nome}, o fim não pode vir antes do início.`);
    }

    // O que a fase declara não é editado aqui, mas atravessa este passo até a
    // gravação — e a gravação substitui a coleção inteira. Sem conferir, uma
    // publicação sem ato, uma banca sem tipo ou um recurso pela metade sairiam
    // no comando por causa de uma mudança de data, e a recusa voltaria falando
    // de um campo que este passo não mostra. Quem confere é a mesma função que
    // a superfície da fase usa: duplicar a regra aqui é o que já produziu um
    // defeito nesta frente.
    for (const declarado of problemasDaFase(fase, fases, atoPorCodigo, nomeDaBanca)) {
      problemas.push(`Na fase ${nome}: ${declarado.mensagem} Corrija em Configuração por fase.`);
    }
  }

  problemas.push(...problemasDasEtapas(fases, etapas, fasePorId, tipoDaEtapa));
  problemas.push(...problemasDasJanelasDasEtapas(fases, etapas, fasePorId));
  problemas.push(...problemasDasExigencias(exigencias));

  for (const violacao of violacoesDePrecedencia(fases, precedencias)) {
    problemas.push(
      violacao.motivo === 'ordem'
        ? `${violacao.antecessora} precisa vir antes de ${violacao.sucessora} na linha do tempo.`
        : `${violacao.antecessora} não pode se sobrepor a ${violacao.sucessora}: o cadastro exige que uma termine antes da outra começar.`,
    );
  }

  return problemas;
}

/**
 * A janela própria da etapa: coerente consigo mesma, e cabendo na janela da fase.
 *
 * A etapa não precisa declarar datas — em branco ela acontece na janela da fase, e é isso que a
 * dica do campo promete ao operador. Declarada, a janela da etapa é um REFINAMENTO da janela da
 * fase: a prova e a entrevista caem em dias diferentes, mas ambas dentro da avaliação. Uma etapa
 * que começasse antes da fase ou terminasse depois dela desmentiria o cronograma que o edital
 * publica.
 *
 * As bordas coincidentes passam: a etapa pode começar no instante em que a fase começa e
 * terminar no instante em que ela termina — refinar não obriga a encolher.
 *
 * Fase sem janela declarada não é conferida: não há o que conter, e exigir data da fase por
 * causa da etapa inventaria uma obrigação que o cadastro não faz. A etapa nesse caso responde
 * só pela própria coerência.
 *
 * <b>Esta regra vive só aqui, no cliente.</b> `EtapaProcesso` não valida datas, então um
 * chamador que vá direto à API ainda consegue gravar etapa fora da janela — decisão consciente
 * de escopo, registrada como pendência.
 */
function problemasDasJanelasDasEtapas(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const problemas: string[] = [];
  const faseDoCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));

  for (const etapa of etapas) {
    const inicio = etapa.inicio === '' ? null : instanteDe(etapa.inicio);
    const fim = etapa.fim === '' ? null : instanteDe(etapa.fim);
    if (inicio === null && fim === null) continue;

    const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;

    if (inicio !== null && fim !== null && fim < inicio) {
      problemas.push(`Na etapa ${nome}, o fim não pode vir antes do início.`);
      // Sem coerência interna, comparar com a fase só somaria ruído ao mesmo defeito.
      continue;
    }

    const fase = faseDoCodigo.get(etapa.faseCodigo);
    if (fase === undefined) continue;

    const nomeDaFase = descreverFase(fase, fasePorId).nome;
    const faseInicio = fase.inicio === null ? null : instanteDe(fase.inicio);
    const faseFim = fase.fim === null ? null : instanteDe(fase.fim);

    if (inicio !== null && faseInicio !== null && inicio < faseInicio) {
      problemas.push(
        `A etapa ${nome} começa antes da fase ${nomeDaFase}. A janela da etapa precisa caber na da fase.`,
      );
    }

    if (fim !== null && faseFim !== null && fim > faseFim) {
      problemas.push(
        `A etapa ${nome} termina depois da fase ${nomeDaFase}. A janela da etapa precisa caber na da fase.`,
      );
    }
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
function problemasDasEtapas(
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

  // A janela recursal sem regra resolvida é descartada pelo mapeador — o catálogo de regras
  // ainda não respondeu, ou o código escolhido não está nele. Descartar é o certo (o servidor
  // recusaria um campo que o operador não liga ao que fez); calar não é: sem este aviso, a
  // janela que a pessoa acabou de declarar some na gravação e nada explica.
  // Prazo que não converte vira 0 na gravação — o campo é obrigatório no comando —, e janela
  // com prazo zero fecha no instante em que abre. O servidor aceita; quem perde é o candidato.
  //
  // Três casos com a mesma consequência: em branco, texto que a gramática numérica não aceita
  // ("2,5 dias", "dois"), e zero declarado. É o mesmo conjunto que a conferência da FASE já
  // cobre — a da etapa era um subconjunto estrito da irmã.
  for (const etapa of etapas) {
    const invalidos = etapa.recursos.filter(
      (recurso) => recursoResolvido(recurso) && !prazoUtilizavel(recurso.prazoValor),
    ).length;
    if (invalidos === 0) continue;

    const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;
    problemas.push(
      `A janela de recurso da etapa ${nome} precisa de um prazo maior que zero — informe por quanto tempo o recurso pode ser apresentado.`,
    );
  }

  // As duas conferências que só a fase tinha. O value object do prazo é o mesmo nas duas, e o
  // servidor passou a prová-las nos dois donos — a tela que aprovasse aqui mandaria o operador
  // colher um 422 que a fase nunca deixaria acontecer.
  for (const etapa of etapas) {
    const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;

    if (
      etapa.recursos.some(
        (r) => recursoResolvido(r) && fracaoDeDiaUtil(r.prazoValor, r.prazoUnidade),
      )
    ) {
      problemas.push(
        `O prazo de recurso da etapa ${nome} está em fração de dia útil. Use valor inteiro, ou declare o prazo em horas.`,
      );
    }

    if (etapa.recursos.some((r) => recursoResolvido(r) && r.admiteInstanciaSuperior === null)) {
      problemas.push(
        `Responda, na janela de recurso da etapa ${nome}, se ela admite recurso em instância superior.`,
      );
    }

    // O tempo de bloqueio da instância superior só vale quando a janela a admite: oculto, ele
    // não é conferido nem enviado.
    const suspensividadeQuebrada = etapa.recursos.some(
      (r) =>
        recursoResolvido(r) &&
        (suspensividadeIncoerente(
          r.suspensividadePrimeiraInstanciaValor,
          r.suspensividadePrimeiraInstanciaUnidade,
        ) ||
          (r.admiteInstanciaSuperior === true &&
            suspensividadeIncoerente(
              r.suspensividadeSegundaInstanciaValor,
              r.suspensividadeSegundaInstanciaUnidade,
            ))),
    );
    if (suspensividadeQuebrada) {
      problemas.push(
        `A suspensividade do recurso da etapa ${nome} exige valor e unidade juntos, e maior que zero — ou nenhum dos dois, que desativa aquela instância.`,
      );
    }
  }

  // A janela ancorada em ato aponta para uma publicação preliminar DA PRÓPRIA etapa, e os
  // produtos mudam por outro caminho: retirar o preliminar, ou trocar-lhe o ato ou o papel,
  // deixava a janela apontando para o que não existe mais. A gravação seguia, e o servidor
  // recusava a etapa inteira — sem dizer que o problema era a âncora, nem em qual etapa.
  for (const etapa of etapas) {
    const preliminares = new Set(
      etapa.produtos.filter((p) => p.papel === PAPEL_PRELIMINAR).map((p) => p.atoCodigo),
    );
    const orfas = etapa.recursos.filter(
      (recurso) =>
        recurso.ancora === 'atoPublicado' &&
        recursoResolvido(recurso) &&
        !preliminares.has(recurso.atoAncoraCodigo),
    );
    if (orfas.length === 0) continue;

    const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;
    problemas.push(
      `A janela de recurso da etapa ${nome} corre da publicação de um resultado preliminar que a etapa não declara mais. Escolha outra publicação, ou remova a janela.`,
    );
  }

  for (const etapa of etapas) {
    const pendentes = etapa.recursos.filter((recurso) => !recursoResolvido(recurso)).length;
    if (pendentes === 0) continue;

    const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;
    problemas.push(
      pendentes === 1
        ? `A janela de recurso da etapa ${nome} está sem a regra de prazo. Escolha a regra, ou remova a janela.`
        : `${pendentes} janelas de recurso da etapa ${nome} estão sem a regra de prazo. Escolha a regra de cada uma, ou remova-as.`,
    );
  }

  return problemas;
}

/** Prazo que a gravação consegue usar: converte e é maior que zero. */
function prazoUtilizavel(prazo: string): boolean {
  const valor = decimalDoCampo(prazo);
  return valor !== null && valor > 0;
}

/**
 * A suspensividade é par valor-unidade: um lado sem o outro não descreve janela alguma, e a
 * ausência dos dois é a desativação prevista daquela instância. Meio par é recusado pelo
 * servidor — antes desta conferência, na etapa, era gravado calado.
 */
function suspensividadeIncoerente(valor: string, unidade: string): boolean {
  const temValor = valor.trim() !== '';
  const temUnidade = unidade !== '';

  if (!temValor && !temUnidade) return false;
  if (temValor !== temUnidade) return true;

  const numero = decimalDoCampo(valor);
  return numero === null || numero <= 0;
}

/**
 * Só o que não vira número é recusado aqui: o texto que não converte não tem número a enviar
 * no comando. O resto (rótulo, soma, passo) quem diz é o
 * servidor, sob o campo, ou a publicação.
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

function repetidos<T>(valores: readonly T[]): readonly T[] {
  const vistos = new Set<T>();
  const repetidos = new Set<T>();
  for (const valor of valores) {
    if (vistos.has(valor)) repetidos.add(valor);
    vistos.add(valor);
  }
  return [...repetidos];
}
