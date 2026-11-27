import {
  EtapaDaMigracao,
  EtapaDaVersao,
  EtapaDoPedido,
  SituacaoDoPedidoCodigo,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

interface Rotulo {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const VARIANTE_DA_SITUACAO_DO_PEDIDO: Readonly<Record<string, UiTagVariant>> = {
  [SituacaoDoPedidoCodigo.AGUARDANDO_DOCUMENTO]: 'warning',
  [SituacaoDoPedidoCodigo.AGUARDANDO_BENEFICIARIO]: 'warning',
  [SituacaoDoPedidoCodigo.AGUARDANDO_GESTOR]: 'info',
  [SituacaoDoPedidoCodigo.AGUARDANDO_PROTECAO_DE_DADOS]: 'info',
  [SituacaoDoPedidoCodigo.APROVADO]: 'success',
  [SituacaoDoPedidoCodigo.RECUSADO]: 'danger',
  [SituacaoDoPedidoCodigo.DEVOLVIDO]: 'warning',
  [SituacaoDoPedidoCodigo.CANCELADO]: 'neutral',
};

/** Os códigos que a API deixa dentro da frase do detalhe de um evento, que ela não devolve como rótulo. */
const ETAPA_NO_DETALHE: Readonly<Record<string, string>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: 'Gestão de acessos',
  [EtapaDaMigracao.SISTEMA]: 'Sistema',
  [EtapaDoPedido.GESTOR]: 'Gestão de acessos',
  [EtapaDaVersao.PROTECAO_DE_DADOS]: 'Proteção de dados',
};

const SENSIBILIDADE_NO_DETALHE: Readonly<Record<string, string>> = {
  PUBLICO: 'Pública',
  INTERNO: 'Interna',
  IDENTIFICADOR: 'Dado identificador',
  PESSOAL: 'Dado pessoal',
  SENSIVEL: 'Dado sensível',
};

const MOTIVO_DA_DISPENSA: Readonly<Record<string, string>> = {
  designacao_de_protecao_de_dados: 'designação do Representante do controlador',
};

export function motivoDaDispensa(codigo: string): string {
  return MOTIVO_DA_DISPENSA[codigo] ?? codigo;
}

/** O texto da situação vem da API; a cor da etiqueta é da tela, escolhida pelo código. */
export function situacaoDoPedido(situacao: {
  readonly codigo: string;
  readonly rotulo: string;
}): Rotulo {
  return {
    texto: situacao.rotulo,
    variante: VARIANTE_DA_SITUACAO_DO_PEDIDO[situacao.codigo] ?? 'neutral',
  };
}

/** As situações do filtro de pedidos, na ordem da tela; a API não serve a lista, só o rótulo de cada pedido. */
export const OPCOES_DE_SITUACAO_DO_PEDIDO: readonly { value: string; label: string }[] = [
  { value: SituacaoDoPedidoCodigo.AGUARDANDO_DOCUMENTO, label: 'Aguardando documento' },
  { value: SituacaoDoPedidoCodigo.AGUARDANDO_BENEFICIARIO, label: 'Aguardando beneficiário' },
  { value: SituacaoDoPedidoCodigo.AGUARDANDO_GESTOR, label: 'Aguardando gestor' },
  {
    value: SituacaoDoPedidoCodigo.AGUARDANDO_PROTECAO_DE_DADOS,
    label: 'Aguardando proteção de dados',
  },
  { value: SituacaoDoPedidoCodigo.APROVADO, label: 'Aprovado' },
  { value: SituacaoDoPedidoCodigo.RECUSADO, label: 'Recusado' },
  { value: SituacaoDoPedidoCodigo.DEVOLVIDO, label: 'Devolvido' },
  { value: SituacaoDoPedidoCodigo.CANCELADO, label: 'Cancelado' },
];

const IDENTIFICADOR = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SHA256 = /\b[0-9a-f]{64}\b/gi;
const TAMANHO_DO_RESUMO = 8;

/** Abrevia um identificador longo (SHA-256, GUID) aos primeiros caracteres, com reticências. */
export function abreviado(valor: string): string {
  return valor.length > TAMANHO_DO_RESUMO ? `${valor.slice(0, TAMANHO_DO_RESUMO)}…` : valor;
}

/**
 * O detalhe de um evento da trilha chega da API como frase com códigos dentro. Troca o que é código
 * pelo rótulo legível, tira o identificador do anexo e abrevia o SHA-256, sem tocar no texto livre
 * (justificativa, motivo digitado).
 */
export function detalheDaTrilha(detalhe: string | null): string {
  return detalhe === null ? '—' : comRotulos(semIdentificadores(detalhe));
}

/** Tira o identificador do anexo e o da janela e abrevia o SHA-256, que não dizem nada a quem lê. */
function semIdentificadores(detalhe: string): string {
  return detalhe
    .replace(/Anexo \S+?\./gi, (trecho) => (IDENTIFICADOR.test(trecho) ? 'Documento.' : trecho))
    .replace(SHA256, (hash) => abreviado(hash))
    .replace(/ ?(?:Janela|Revisão): [0-9a-f-]{36}\./i, '');
}

function nomeDaEtapa(codigo: string): string {
  return ETAPA_NO_DETALHE[codigo] ?? codigo;
}

function nomeDaSensibilidade(codigo: string): string {
  return SENSIBILIDADE_NO_DETALHE[codigo.toUpperCase()] ?? codigo;
}

/** Troca os códigos de dispensa, etapa, sensibilidade e motivo pelos rótulos da tela. */
function comRotulos(detalhe: string): string {
  return detalhe
    .replace(/Dispensa: (\w+)\./, (_, codigo: string) => `Dispensa: ${motivoDaDispensa(codigo)}.`)
    .replace(/Etapa: (\w+)\./, (_, codigo: string) => `Etapa: ${nomeDaEtapa(codigo)}.`)
    .replace(
      /Sensibilidade avaliada: (\w+)\./,
      (_, codigo: string) => `Sensibilidade avaliada: ${nomeDaSensibilidade(codigo)}.`,
    )
    .replace(/Motivo: (\w+)\./, (trecho, codigo: string) =>
      codigo in MOTIVO_DA_DISPENSA ? `Motivo: ${motivoDaDispensa(codigo)}.` : trecho,
    );
}
