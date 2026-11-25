import {
  EtapaDaMigracao,
  EtapaDoPedido,
  EtapaDaVersao,
  ResultadoDaDecisao,
  TipoDoEventoDaContencao,
  SituacaoDoAnexo,
  SituacaoDoPedido,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

interface Rotulo {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DO_PEDIDO: Readonly<Record<SituacaoDoPedido, Rotulo>> = {
  [SituacaoDoPedido.AGUARDANDO_DOCUMENTO]: {
    texto: 'Aguardando o documento de designação',
    variante: 'warning',
  },
  [SituacaoDoPedido.AGUARDANDO_BENEFICIARIO]: {
    texto: 'Aguardando o aceite do beneficiário',
    variante: 'warning',
  },
  [SituacaoDoPedido.AGUARDANDO_GESTOR]: {
    texto: 'Aguardando a gestão de acessos',
    variante: 'info',
  },
  [SituacaoDoPedido.AGUARDANDO_PROTECAO_DE_DADOS]: {
    texto: 'Aguardando o Representante do controlador',
    variante: 'info',
  },
  [SituacaoDoPedido.APROVADO]: { texto: 'Aprovado', variante: 'success' },
  [SituacaoDoPedido.RECUSADO]: { texto: 'Recusado', variante: 'danger' },
  [SituacaoDoPedido.DEVOLVIDO]: { texto: 'Devolvido', variante: 'warning' },
  [SituacaoDoPedido.CANCELADO]: { texto: 'Cancelado', variante: 'neutral' },
};

const SITUACAO_DO_ANEXO: Readonly<Record<SituacaoDoAnexo, string>> = {
  [SituacaoDoAnexo.AGUARDANDO_ENVIO]: 'Aguardando o envio',
  [SituacaoDoAnexo.EM_VERIFICACAO]: 'Em verificação',
  [SituacaoDoAnexo.VERIFICADO]: 'Verificado',
  [SituacaoDoAnexo.RECUSADO]: 'Recusado na verificação',
};

const TIPO_DE_EVENTO: Readonly<Record<string, string>> = {
  pedido_criado: 'Pedido criado',
  beneficiario_aceitou: 'Beneficiário aceitou o pedido',
  anexo_enviado: 'Documento enviado',
  anexo_verificado: 'Documento verificado',
  anexo_recusado: 'Documento recusado na verificação',
  anexo_lido: 'Documento consultado',
  [ResultadoDaDecisao.APROVADO]: 'Aprovação',
  [ResultadoDaDecisao.RECUSADO]: 'Recusa',
  [ResultadoDaDecisao.PERFIL_ALTERADO]: 'Perfil alterado entre as etapas',
  [ResultadoDaDecisao.PRAZO_VENCIDO]: 'Prazo vencido entre as etapas',
  [ResultadoDaDecisao.TERMO_EXIGIDO]:
    'Pedido devolvido: o perfil passou a exigir o termo de responsabilidade',
  perfil_alterado_entre_etapas: 'Perfil alterado entre as etapas',
  prazo_vencido_entre_etapas: 'Prazo vencido entre as etapas',
  segunda_aprovacao_dispensada: 'Segunda aprovação dispensada',
  cancelado: 'Pedido cancelado',
  concedida: 'Acesso concedido',
  revogada: 'Acesso revogado',
  revogada_pela_migracao: 'Acesso revogado na revisão das concessões',
  providencia_solicitada: 'Providência solicitada',
  providencia_respondida: 'Providência respondida',
  providencia_atendida: 'Providência atendida',
  vencida: 'Concessão vencida',
  migracao_migrar: 'Concessão aprovada na versão nova',
  migracao_recusar: 'Concessão recusada na revisão',
  migracao_reter: 'Concessão retida na revisão das concessões',
  migracao_nao_migrada: 'Concessão não aprovada no prazo da revisão',
  migracao_fora_da_lista: 'Concessão fora da lista da revisão',
  [TipoDoEventoDaContencao.SUSPENSAO]: 'Perfil suspenso',
  decisao_da_retomada: 'Etapa da retomada decidida',
  [TipoDoEventoDaContencao.RETOMADA]: 'Suspensão retomada',
  [TipoDoEventoDaContencao.DESATIVACAO]: 'Perfil desativado',
  [TipoDoEventoDaContencao.REATIVACAO]: 'Perfil reativado',
  instalacao_iniciada: 'Instalação iniciada',
  documento_verificado: 'Documento verificado',
  documento_recusado: 'Documento recusado na verificação',
  codigo_enviado: 'Código de confirmação enviado',
  tentativas: 'Tentativas de confirmação',
  instalacao_confirmada: 'Instalação confirmada',
  instalacao_cancelada: 'Instalação cancelada',
  instalacao_expirada: 'Instalação expirada',
  termo_aceito: 'Termo de responsabilidade aceito',
  termo_exigido: 'Pedido devolvido: o perfil passou a exigir o termo de responsabilidade',
  termo_excecao_da_instalacao: 'Instalação sem o aceite do termo de responsabilidade',
};

type ClassificacaoDeProtecao = 'PUBLICO' | 'INTERNO' | 'IDENTIFICADOR' | 'PESSOAL' | 'SENSIVEL';

const SENSIBILIDADE: Readonly<Record<ClassificacaoDeProtecao, string>> = {
  PUBLICO: 'Pública',
  INTERNO: 'Interna',
  IDENTIFICADOR: 'Dado identificador',
  PESSOAL: 'Dado pessoal',
  SENSIVEL: 'Dado sensível',
};

const ETAPA: Readonly<Record<string, string>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: 'Gestão de acessos',
  [EtapaDaMigracao.SISTEMA]: 'Sistema',
  [EtapaDoPedido.GESTOR]: 'Gestão de acessos',
  [EtapaDaVersao.PROTECAO_DE_DADOS]: 'Proteção de dados',
};

const MOTIVO_DA_DISPENSA: Readonly<Record<string, string>> = {
  designacao_de_protecao_de_dados: 'designação do Representante do controlador',
};

export function motivoDaDispensa(codigo: string): string {
  return MOTIVO_DA_DISPENSA[codigo] ?? codigo;
}

export function situacaoDoPedido(codigo: string): Rotulo {
  return SITUACAO_DO_PEDIDO[codigo as SituacaoDoPedido] ?? { texto: codigo, variante: 'neutral' };
}

export function situacaoDoAnexo(codigo: string): string {
  return SITUACAO_DO_ANEXO[codigo as SituacaoDoAnexo] ?? codigo;
}

export function tipoDeEvento(codigo: string): string {
  return TIPO_DE_EVENTO[codigo] ?? codigo;
}

export function sensibilidade(codigo: string): string {
  return SENSIBILIDADE[codigo.toUpperCase() as ClassificacaoDeProtecao] ?? codigo;
}

export function etapa(codigo: string | null): string {
  return codigo === null ? '—' : (ETAPA[codigo] ?? codigo);
}

export const OPCOES_DE_SITUACAO_DO_PEDIDO = Object.entries(SITUACAO_DO_PEDIDO).map(
  ([value, { texto }]) => ({ value, label: texto }),
);

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

/** Troca os códigos de dispensa, etapa, sensibilidade e motivo pelos rótulos da tela. */
function comRotulos(detalhe: string): string {
  return detalhe
    .replace(/Dispensa: (\w+)\./, (_, codigo: string) => `Dispensa: ${motivoDaDispensa(codigo)}.`)
    .replace(/Etapa: (\w+)\./, (_, codigo: string) => `Etapa: ${etapa(codigo)}.`)
    .replace(
      /Sensibilidade avaliada: (\w+)\./,
      (_, codigo: string) => `Sensibilidade avaliada: ${sensibilidade(codigo)}.`,
    )
    .replace(/Motivo: (\w+)\./, (trecho, codigo: string) =>
      codigo in MOTIVO_DA_DISPENSA ? `Motivo: ${motivoDaDispensa(codigo)}.` : trecho,
    );
}
