import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import {
  PAPEL_PRELIMINAR,
  type EtapaPontuada,
  type FaseDoCronograma,
  type ProdutoDaFase,
} from '../../processo-seletivo.models';
import { decimalDoCampo, inteiroDoCampo } from '../../shared/numero-do-campo';
import { recursoResolvido } from './cronograma-para-comando';
import {
  problemasDaFase,
  publicaResultadoDefinitivo,
  type AtoDoCatalogo,
} from '../fase/configuracao-da-fase';

/** Origem de data que obriga a fase a declarar janela. */
export const ORIGEM_DATA_PROPRIA = 'PROPRIA';

/**
 * O que a fase escolhida exige — nunca declarado pelo operador. É a diferença
 * entre perguntar "esta fase permite recurso?" e descobrir que ela permite
 * porque publica um resultado preliminar.
 *
 * As duas origens são distintas, e é por isso que a derivação recebe duas
 * entradas. Janela e agrupamento de etapas descrevem a **fase canônica**, e vêm
 * do catálogo (ou do que a fase congelou dele). O que a fase publica é
 * declaração da **fase do cronograma**, em `produtos`: o catálogo não sabe o que
 * este edital resolveu publicar nela.
 */
export interface ExigenciasDaFase {
  readonly janelaObrigatoria: boolean;
  /** A fase publica ao menos um produto — não necessariamente um resultado. */
  readonly publicaProduto: boolean;
  /** A fase publica ao menos um produto preliminar, que é a âncora do prazo. */
  readonly admiteRecurso: boolean;
  readonly agrupaEtapas: boolean;
}

/** Os atributos da fase canônica que decidem exigência, venham do catálogo ou do congelado. */
interface AtributosDaFaseCanonica {
  readonly origemData: string;
  readonly agrupaEtapas: boolean;
}

export function exigenciasDe(
  canonica: AtributosDaFaseCanonica,
  produtos: readonly ProdutoDaFase[],
): ExigenciasDaFase {
  return {
    janelaObrigatoria: canonica.origemData === ORIGEM_DATA_PROPRIA,
    publicaProduto: produtos.length > 0,
    admiteRecurso: produtos.some((produto) => produto.papel === PAPEL_PRELIMINAR),
    agrupaEtapas: canonica.agrupaEtapas,
  };
}

/**
 * A fase como o processo a conhece: rótulo, atributos e o que ela exige.
 *
 * **O que a fase congelou tem precedência sobre o catálogo**, e não o contrário.
 * O catálogo é vivo: editar a fase canônica depois que um processo a congelou
 * não pode mudar o que aquele processo exige — ligar `agrupaEtapas` faria a
 * validação cobrar etapas de um edital que nunca as teve, e desligar esconderia
 * as que ele tem. O catálogo descreve a fase que acabou de ser acrescentada, que
 * ainda não congelou nada.
 *
 * O nome é a exceção deliberada: é rótulo de tela, e mostrar o atual ajuda quem
 * lê. Sem entrada no catálogo, o código é o que identifica a fase.
 */
export function descreverFase(
  fase: FaseDoCronograma,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): DescricaoDaFase {
  const canonica = fasePorId.get(fase.faseCanonicaId);
  const congelados = fase.congelados;

  if (congelados !== null) {
    return {
      nome: canonica?.nome ?? fase.codigo,
      donoTipico: congelados.donoTipico,
      publicaResultadoDefinitivo: publicaResultadoDefinitivo(fase.produtos),
      coletaInscricao: congelados.coletaInscricao,
      permiteComplementacao: congelados.permiteComplementacao,
      exigencias: exigenciasDe(congelados, fase.produtos),
      foraDoCatalogo: canonica === undefined,
    };
  }

  return {
    nome: canonica?.nome ?? fase.codigo,
    donoTipico: canonica?.donoTipico ?? '—',
    publicaResultadoDefinitivo: publicaResultadoDefinitivo(fase.produtos),
    coletaInscricao: canonica?.coletaInscricao ?? false,
    permiteComplementacao: canonica?.permiteComplementacao ?? false,
    exigencias: canonica === undefined ? null : exigenciasDe(canonica, fase.produtos),
    foraDoCatalogo: canonica === undefined,
  };
}

/** A fase resolvida, como tela e validação precisam vê-la. */
export interface DescricaoDaFase {
  readonly nome: string;
  readonly donoTipico: string;
  readonly publicaResultadoDefinitivo: boolean;
  readonly coletaInscricao: boolean;
  /**
   * Se a fase admite reenvio depois da análise. O que a fase congelou tem precedência sobre o
   * catálogo, pela mesma razão dos demais atributos: editar a fase canônica depois não pode
   * mudar o que um edital já congelou.
   */
  readonly permiteComplementacao: boolean;
  /** `null` quando nem o catálogo nem o congelado descrevem a fase. */
  readonly exigencias: ExigenciasDaFase | null;
  readonly foraDoCatalogo: boolean;
}

/**
 * Recusa de precedência que a tela consegue antecipar.
 *
 * Só vale quando **as duas** fases da aresta estão no cronograma: a ausência de
 * uma delas não é violação, e é o que permite um cronograma curto. Quem arbitra
 * continua sendo o servidor — isto existe para avisar antes de gravar.
 */
export interface ViolacaoDePrecedencia {
  readonly antecessora: string;
  readonly sucessora: string;
  readonly motivo: 'ordem' | 'sobreposicao';
}

export function violacoesDePrecedencia(
  fases: readonly FaseDoCronograma[],
  arestas: readonly PrecedenciaFaseDto[],
): readonly ViolacaoDePrecedencia[] {
  const porCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
  const violacoes: ViolacaoDePrecedencia[] = [];

  for (const aresta of arestas) {
    const antecessora = porCodigo.get(aresta.antecessoraCodigo);
    const sucessora = porCodigo.get(aresta.sucessoraCodigo);
    if (antecessora === undefined || sucessora === undefined) continue;

    if (antecessora.ordem >= sucessora.ordem) {
      violacoes.push({
        antecessora: aresta.antecessoraCodigo,
        sucessora: aresta.sucessoraCodigo,
        motivo: 'ordem',
      });
      continue;
    }

    if (
      !aresta.permiteSobreposicao &&
      antecessora.fim !== null &&
      sucessora.inicio !== null &&
      instanteDe(antecessora.fim) > instanteDe(sucessora.inicio)
    ) {
      violacoes.push({
        antecessora: aresta.antecessoraCodigo,
        sucessora: aresta.sucessoraCodigo,
        motivo: 'sobreposicao',
      });
    }
  }

  return violacoes;
}

/**
 * Trocar a ordem entre duas fases que permanecem no cronograma forma um ciclo
 * que o servidor não consegue persistir numa chamada só — cada linha precisa que
 * a outra libere o valor primeiro.
 *
 * Renumerar a lista sequencialmente **não** evita isso: trocar duas fases de
 * lugar e renumerar produz precisamente essa permutação, e é a reordenação mais
 * comum que existe. Quem move fase na tela guarda a operação com esta função e,
 * quando ela acusa, segue o que a recusa do domínio orienta — mover uma das
 * fases para uma ordem livre numa gravação e fechar o ciclo na seguinte.
 *
 * Uma cadeia que termina numa ordem livre, ou na ordem de uma fase removida, não
 * é ciclo: a remoção libera o valor.
 */
export function trocaFechaCiclo(
  antes: readonly FaseDoCronograma[],
  depois: readonly FaseDoCronograma[],
): boolean {
  const anteriores = new Map(antes.map((fase) => [fase.faseCanonicaId, fase]));
  const novas = new Map(depois.map((fase) => [fase.faseCanonicaId, fase]));

  const retidaNaOrdem = new Map<number, string>();
  for (const [id, fase] of anteriores) {
    if (novas.has(id)) retidaNaOrdem.set(fase.ordem, id);
  }

  const estado = new Map<string, 'visitando' | 'concluido'>();
  for (const inicial of anteriores.keys()) {
    if (estado.has(inicial)) continue;

    const caminho: string[] = [];
    let atual: string | undefined = inicial;

    while (atual !== undefined) {
      const jaVisto = estado.get(atual);
      if (jaVisto !== undefined) {
        if (jaVisto === 'visitando') return true;
        break;
      }

      const nova = novas.get(atual);
      const anterior = anteriores.get(atual);
      if (nova === undefined || anterior === undefined || nova.ordem === anterior.ordem) break;

      estado.set(atual, 'visitando');
      caminho.push(atual);
      atual = retidaNaOrdem.get(nova.ordem);
    }

    for (const visitado of caminho) estado.set(visitado, 'concluido');
  }

  return false;
}

/**
 * Compara janelas pelo instante que elas representam, não pelo texto: dois
 * mesmos momentos escritos com deslocamentos diferentes precisam comparar
 * iguais, e a ordem lexicográfica do texto os separaria.
 */
function instanteDe(valor: string): number {
  return Date.parse(valor);
}

/** Renumera a lista de 1 a N, na ordem em que ela está. */
export function renumerar(fases: readonly FaseDoCronograma[]): readonly FaseDoCronograma[] {
  return fases.map((fase, indice) => ({ ...fase, ordem: indice + 1 }));
}

/**
 * Uma etapa compõe a nota quando pontua e declara peso **positivo**. Havendo
 * etapas, ao menos uma precisa fazê-lo: sem nenhuma, o divisor da média seria
 * zero, e o agregado recusa com uma mensagem que fala de nota final, não de
 * etapa.
 *
 * Peso zero não compõe: ele não soma ao divisor, e o domínio o recusa à parte,
 * exigindo peso maior que zero quando informado. Aceitá-lo aqui faria um
 * conjunto de etapas todo zerado passar na conferência da tela para ser
 * recusado no servidor por outro motivo — com uma mensagem que fala do peso de
 * uma etapa, não da nota final que ficou sem divisor.
 */
/** O que a conferência precisa saber de uma exigência documental declarada. */
export interface ExigenciaDeclarada {
  readonly nome: string;
  readonly decideResultado: boolean;
  readonly normaResolvida: boolean;
  /** Código da fase em que a exigência foi declarada. */
  readonly faseCodigo: string;
  /** Se essa fase ainda está no cronograma. */
  readonly faseViva: boolean;
  /** Se a exigência alcança ao menos uma modalidade que o quadro de vagas oferta. */
  readonly alcancaModalidade: boolean;
  /** Se pede reenvio numa fase que não admite complementação. */
  readonly reenvioSemComplementacao: boolean;
  /**
   * O que impede o gatilho de ser gravado — fato fora do catálogo, comparação que o domínio
   * não admite, condição sem valor. Vazio quando o gatilho está íntegro, ou quando não há
   * gatilho nenhum.
   */
  readonly problemasDeGatilho: readonly string[];
}

/**
 * O que impede a exigência de ser gravada: a fase que a ancora saiu do cronograma, ela não
 * alcança modalidade nenhuma, ou pede reenvio onde a fase não admite complementação.
 *
 * Mora aqui, e não na superfície da fase, porque é o passo do Cronograma que grava as
 * exigências e é o `validate()` dele que o wizard chama — a superfície da fase é embutida com
 * `faseFixada` e o `validate()` dela nunca é invocado pela página.
 */
function problemasDeAncoragem(exigencias: readonly ExigenciaDeclarada[]): readonly string[] {
  const problemas: string[] = [];

  const orfas = exigencias.filter((e) => !e.faseViva).map((e) => e.nome);
  if (orfas.length > 0) {
    problemas.push(
      `Há documento exigido numa fase que saiu do cronograma: ${[...new Set(orfas)].join(', ')}. Declare-o em outra fase, ou remova a exigência.`,
    );
  }

  if (exigencias.some((e) => e.faseViva && !e.alcancaModalidade)) {
    problemas.push('Todo documento exigido precisa valer para ao menos uma modalidade aceita.');
  }

  const comGatilhoIncompleto = exigencias.filter(
    (e) => e.faseViva && e.problemasDeGatilho.length > 0,
  );
  for (const exigencia of comGatilhoIncompleto) {
    problemas.push(
      `A condição de "${exigencia.nome}" ainda não está completa: ${exigencia.problemasDeGatilho.join('; ')}.`,
    );
  }

  const semComplementacao = exigencias
    .filter((e) => e.faseViva && e.reenvioSemComplementacao)
    .map((e) => e.nome);
  if (semComplementacao.length > 0) {
    problemas.push(
      `A consequência "abre pendência para reenvio" só vale em fase que admite complementação, e ${[...new Set(semComplementacao)].join(', ')} está em fase que não admite. Escolha outra consequência, ou declare o documento em outra fase.`,
    );
  }

  return problemas;
}

/**
 * O que a publicação vai cobrar de um GRUPO de exigências, dito como AVISO.
 *
 * Não bloqueia a gravação, e a diferença em relação à exigência individual é o que a torna
 * corrigível: a norma de uma exigência se edita nesta mesma tela, a de um grupo não — o wizard
 * não tem controle que a alcance. Bloquear aqui prenderia quem tem um grupo com norma pendente
 * num passo sem saída, e a única fuga seria remover os documentos do grupo um a um até ele
 * desaparecer, destruindo a configuração.
 *
 * O `PUT` aceita esse estado; quem o recusa é a publicação, e é lá que ele trava.
 */
export function avisosDosGrupos(grupos: readonly GrupoDeclarado[]): readonly string[] {
  return grupos
    .filter((grupo) => grupo.decideResultado && !grupo.normaResolvida)
    .map((grupo) =>
      grupo.documentos.length === 0
        ? 'Um grupo de documentos decide o resultado da análise e ainda não tem norma resolvida. A publicação vai cobrá-la.'
        : `Um grupo de documentos decide o resultado da análise e ainda não tem norma resolvida — o que reúne ${grupo.documentos.join(', ')}. A publicação vai cobrá-la.`,
    );
}

function problemasDasExigencias(
  exigencias: readonly ExigenciaDeclarada[],
): readonly string[] {
  const problemas: string[] = [...problemasDeAncoragem(exigencias)];

  const semNorma = exigencias.filter((e) => e.decideResultado && !e.normaResolvida);
  if (semNorma.length === 0) return problemas;

  return [
    ...problemas,
    semNorma.length === 1
      ? `A exigência "${semNorma[0].nome}" decide o resultado da análise e precisa da norma que a sustenta.`
      : `${semNorma.length} exigências decidem o resultado da análise e precisam da norma que as sustenta: ${semNorma
          .map((e) => e.nome)
          .join(', ')}.`,
  ];
}

/** O que a conferência precisa saber de um grupo de exigências. */
export interface GrupoDeclarado {
  /** O grupo tem consequência própria — é ele que decide, não cada documento de dentro. */
  readonly decideResultado: boolean;
  readonly normaResolvida: boolean;
  /** Os documentos que ele reúne, para nomear o grupo numa tela que não o edita. */
  readonly documentos: readonly string[];
}

/** O que a conferência precisa saber de um tipo de etapa do cadastro. */
export interface TipoDeEtapaDoCatalogo {
  readonly nome: string;
  readonly admitePontuacao: boolean;
  readonly admiteEliminacao: boolean;
}

export function componeNota(etapa: EtapaPontuada): boolean {
  const pontua = etapa.carater === 'classificatoria' || etapa.carater === 'ambas';
  const peso = decimalDoCampo(etapa.peso);
  return pontua && peso !== null && peso > 0;
}

/**
 * Peso e nota mínima, como o comando os recebe. A gramática é a dos campos
 * numéricos do editor, e não a de moeda: aqui o ponto é separador decimal,
 * porque `0.5` é meio — lê-lo como agrupador devolveria 5, e o servidor
 * aceitaria, porque 5 é um peso válido.
 */
export { decimalDoCampo as comoNumero, inteiroDoCampo };

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
 * As etapas e a fase que as agrupa formam um par: uma fase que agrupa etapas sem
 * nenhuma etapa é recusada na hora da gravação, e etapas sem a fase que as
 * agrupa passam agora para serem recusadas na publicação.
 *
 * Os dois casos entram aqui porque a diferença — recusa agora ou depois — não
 * ajuda quem preenche: os dois descrevem um cronograma que não se sustenta.
 */
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

    const pontua = etapa.carater === 'classificatoria' || etapa.carater === 'ambas';
    const elimina = etapa.carater === 'eliminatoria' || etapa.carater === 'ambas';
    if (pontua && !tipo.admitePontuacao) {
      problemas.push(
        `O tipo ${tipo.nome} não compõe a nota final: a etapa "${etapa.nome.trim()}" não pode ter caráter que pontua.`,
      );
    }
    if (elimina && !tipo.admiteEliminacao) {
      problemas.push(
        `O tipo ${tipo.nome} não elimina candidato: a etapa "${etapa.nome.trim()}" não pode ter caráter que reprova.`,
      );
    }
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

    if (etapa.recursos.some((r) => recursoResolvido(r) && fracaoDeDiaUtil(r.prazoValor, r.prazoUnidade))) {
      problemas.push(
        `O prazo de recurso da etapa ${nome} está em fração de dia útil. Use valor inteiro, ou declare o prazo em horas.`,
      );
    }

    const suspensividadeQuebrada = etapa.recursos.some(
      (r) =>
        recursoResolvido(r) &&
        (suspensividadeIncoerente(
          r.suspensividadePrimeiraInstanciaValor,
          r.suspensividadePrimeiraInstanciaUnidade,
        ) ||
          suspensividadeIncoerente(
            r.suspensividadeSegundaInstanciaValor,
            r.suspensividadeSegundaInstanciaUnidade,
          )),
    );
    if (suspensividadeQuebrada) {
      problemas.push(
        `A suspensividade do recurso da etapa ${nome} exige valor e unidade juntos, e maior que zero — ou nenhum dos dois, que desativa aquela instância.`,
      );
    }
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
 * Fração de dia útil não tem leitura unívoca — meio expediente, doze horas dentro do dia, ou
 * metade de um dia civil que numa transição de fuso nem sempre tem vinte e quatro horas. As
 * três fecham a janela em instantes diferentes, e o servidor recusa em vez de eleger uma.
 * Prazo menor que um dia se declara em horas.
 */
function fracaoDeDiaUtil(prazo: string, unidade: string): boolean {
  if (unidade !== 'diasUteis') return false;
  const valor = decimalDoCampo(prazo);
  return valor !== null && !Number.isInteger(valor);
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

/** Peso escrito na etapa que não é maior que zero. */
function pesoDeclaradoNaoPositivo(peso: string): boolean {
  const valor = decimalDoCampo(peso);
  return peso.trim() !== '' && valor !== null && valor <= 0;
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
