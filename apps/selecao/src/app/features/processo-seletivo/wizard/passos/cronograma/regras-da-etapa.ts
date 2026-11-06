import { decimalDoCampo } from '../../shared/numero-do-campo';
import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import { escalaVale } from '../../shared/itens-de-avaliacao';
import type { EtapaPontuada, TipoCongeladoDaEtapa } from '../../processo-seletivo.models';

/** O caráter da etapa diz se ela entra na nota final. */
export function pontuaPorCarater(carater: string): boolean {
  return carater === 'classificatoria' || carater === 'ambas';
}

/** O caráter da etapa diz se ela elimina candidato. */
export function eliminaPorCarater(carater: string): boolean {
  return carater === 'eliminatoria' || carater === 'ambas';
}

/** O que a conferência precisa saber de um tipo de etapa do cadastro. */
export interface TipoDeEtapaDoCatalogo {
  readonly nome: string;
  readonly admitePontuacao: boolean;
  readonly admiteEliminacao: boolean;
  readonly notaDeOrigemNoEnem: boolean;
}

/**
 * A etapa traz a nota do ENEM do candidato, em vez de uma nota lançada por banca.
 *
 * Quem diz é o atributo do tipo, nunca o código: um código na tela envelheceria no dia em
 * que o cadastro ganhasse outro tipo com a mesma natureza. Na etapa gravada vale o que o
 * processo congelou, enquanto ela aponta para o mesmo tipo; trocar o tipo desfaz o vínculo,
 * e aí o que vale é o cadastro do tipo novo.
 */
export function declaraNotaDoEnem(
  etapa: Pick<EtapaPontuada, 'tipoEtapaOrigemId' | 'tipoCongelado'>,
  tipoDoCadastro: TipoDeEtapaDoCatalogo | undefined,
): boolean {
  const congelado = tipoCongeladoVigente(etapa);
  return congelado?.notaDeOrigemNoEnem ?? tipoDoCadastro?.notaDeOrigemNoEnem ?? false;
}

/**
 * O nome do tipo da etapa. O processo congela o tipo por cópia, então o nome gravado vale sobre o
 * cadastro e continua conhecido depois que o tipo sai dele: nesse caso o nome vem com a situação.
 * `undefined` quando a etapa não congelou o tipo e o cadastro não o tem.
 */
export function nomeDoTipoDaEtapa(
  etapa: Pick<EtapaPontuada, 'tipoEtapaOrigemId' | 'tipoCongelado'>,
  tipoDoCadastro: TipoDeEtapaDoCatalogo | undefined,
): string | undefined {
  const congelado = tipoCongeladoVigente(etapa);
  if (congelado === null) return tipoDoCadastro?.nome;
  return tipoDoCadastro === undefined ? `${congelado.nome} (removido do cadastro)` : congelado.nome;
}

/** O que a etapa congelou, enquanto ela aponta para o mesmo tipo; trocar o tipo desfaz o vínculo. */
function tipoCongeladoVigente(
  etapa: Pick<EtapaPontuada, 'tipoEtapaOrigemId' | 'tipoCongelado'>,
): TipoCongeladoDaEtapa | null {
  const congelado = etapa.tipoCongelado;
  return congelado != null && congelado.origemId === etapa.tipoEtapaOrigemId ? congelado : null;
}

/**
 * A etapa declara como a nota é obtida (forma de avaliação) e em que escala (nota máxima) quando
 * tem nota lançada — compõe a média ou corta por nota mínima, o que o caráter diz — e não é do
 * ENEM, cuja nota e escala vêm do INEP.
 */
export function declaraNotaMaxima(
  etapa: Pick<EtapaPontuada, 'carater' | 'tipoEtapaOrigemId' | 'tipoCongelado'>,
  tipoDoCadastro: TipoDeEtapaDoCatalogo | undefined,
): boolean {
  return etapa.carater !== '' && !declaraNotaDoEnem(etapa, tipoDoCadastro);
}

/**
 * A etapa como a conferência e o envio a leem: só vale o que a tela pede dela. A que não tem
 * nota lançada não leva escala nem avaliação; a que não é de avaliação humana não leva regra de
 * consolidação nem passo, que só existem onde mais de um avaliador lança a nota.
 */
export function etapaComOQueDeclara(
  etapa: EtapaPontuada,
  tipoDoCadastro: TipoDeEtapaDoCatalogo | undefined,
): EtapaPontuada {
  if (!declaraNotaMaxima(etapa, tipoDoCadastro)) {
    return {
      ...etapa,
      notaMaxima: '',
      passoDoLancamento: '',
      formaDeAvaliacao: '',
      regraConsolidacaoCodigo: '',
      regraConsolidacaoVersao: '',
      itensDeAvaliacao: [],
      escalaDeAtendimento: [],
    };
  }
  const humana = etapa.formaDeAvaliacao === FORMA_HUMANA;
  const comAvaliacao = humana
    ? etapa
    : { ...etapa, passoDoLancamento: '', regraConsolidacaoCodigo: '', regraConsolidacaoVersao: '' };
  // A escala existe onde a banca atende cada item; com ela a banca escolhe o nível e não digita a
  // nota, então o passo do lançamento deixa de existir.
  return escalaVale(comAvaliacao)
    ? { ...comAvaliacao, passoDoLancamento: '' }
    : { ...comAvaliacao, escalaDeAtendimento: [] };
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
export function componeNota(etapa: EtapaPontuada): boolean {
  const peso = decimalDoCampo(etapa.peso);
  return pontuaPorCarater(etapa.carater) && peso !== null && peso > 0;
}

/** Caráter de uma etapa, com o rótulo que o operador lê. */
export const CARATERES = [
  { valor: 'classificatoria', rotulo: 'Classificatória' },
  { valor: 'eliminatoria', rotulo: 'Eliminatória' },
  { valor: 'ambas', rotulo: 'Classificatória e eliminatória' },
] as const;

/**
 * Os caracteres que a etapa pode ter, dado o tipo escolhido.
 *
 * O recorte vem do cadastro de Configuração, onde cada tipo declara se compõe a nota final e
 * se elimina candidato — e não de uma lista de códigos escrita aqui, que envelheceria no dia
 * em que o CEPS cadastrasse um tipo novo. É esse recorte que faz peso e nota mínima
 * desaparecerem de uma análise documental sem que a tela precise saber o que ela é.
 */
export function caracteresAdmitidos(
  tipo: TipoDeEtapaDoCatalogo | undefined,
  notaDoEnem: boolean,
  escolhido: string,
): readonly { valor: string; rotulo: string }[] {
  // Sem tipo escolhido não há o que restringir: a etapa ainda não disse de que natureza é.
  // A etapa de nota do ENEM sempre compõe a média: puramente eliminatória, ela ficaria
  // fora do divisor, e a nota que ela traz não pesaria em nada.
  const admitidos: readonly { valor: string; rotulo: string }[] =
    tipo === undefined
      ? CARATERES
      : CARATERES.filter(
          (opcao) =>
            (opcao.valor === 'classificatoria' && tipo.admitePontuacao) ||
            (opcao.valor === 'eliminatoria' && tipo.admiteEliminacao && !notaDoEnem) ||
            (opcao.valor === 'ambas' && tipo.admitePontuacao && tipo.admiteEliminacao),
        );

  if (escolhido === '' || admitidos.some((opcao) => opcao.valor === escolhido)) {
    return admitidos;
  }

  // Caráter que o cadastro deixou de admitir depois de a etapa ter sido gravada: continua na
  // lista, nomeado. Sumir seria o formulário mentindo sobre o que está gravado, e a gravação
  // seguinte recusaria sem que ninguém tivesse visto o quê.
  const rotulo = CARATERES.find((opcao) => opcao.valor === escolhido)?.rotulo ?? escolhido;
  return [...admitidos, { valor: escolhido, rotulo: `${rotulo} (não mais admitido)` }];
}
