import type { UiTagVariant } from '@uniplus/shared-ui/components';

interface Rotulo {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DO_PEDIDO: Readonly<Record<string, Rotulo>> = {
  aguardando_documento: { texto: 'Aguardando o documento de designação', variante: 'warning' },
  aguardando_beneficiario: { texto: 'Aguardando o aceite do beneficiário', variante: 'warning' },
  aguardando_gestor: { texto: 'Aguardando o gestor de acessos', variante: 'info' },
  aguardando_protecao_de_dados: { texto: 'Aguardando a proteção de dados', variante: 'info' },
  aprovado: { texto: 'Aprovado', variante: 'success' },
  recusado: { texto: 'Recusado', variante: 'danger' },
  cancelado: { texto: 'Cancelado', variante: 'neutral' },
};

const SITUACAO_DO_ANEXO: Readonly<Record<string, string>> = {
  aguardando_envio: 'Aguardando o envio',
  em_verificacao: 'Em verificação',
  verificado: 'Verificado',
  recusado: 'Recusado na verificação',
};

const TIPO_DE_EVENTO: Readonly<Record<string, string>> = {
  pedido_criado: 'Pedido criado',
  beneficiario_aceitou: 'Beneficiário aceitou o pedido',
  anexo_enviado: 'Documento enviado',
  anexo_verificado: 'Documento verificado',
  anexo_recusado: 'Documento recusado na verificação',
  anexo_lido: 'Documento consultado',
  aprovado: 'Aprovação',
  recusado: 'Recusa',
  perfil_alterado_entre_etapas: 'Perfil alterado entre as etapas',
  prazo_vencido_entre_etapas: 'Prazo vencido entre as etapas',
  segunda_aprovacao_dispensada: 'Segunda aprovação dispensada',
  cancelado: 'Pedido cancelado',
  concedida: 'Acesso concedido',
  revogada: 'Acesso revogado',
  instalacao_iniciada: 'Instalação iniciada',
  documento_verificado: 'Documento verificado',
  documento_recusado: 'Documento recusado na verificação',
  codigo_enviado: 'Código de confirmação enviado',
  tentativas: 'Tentativas de confirmação',
  instalacao_confirmada: 'Instalação confirmada',
  instalacao_cancelada: 'Instalação cancelada',
  instalacao_expirada: 'Instalação expirada',
};

const SENSIBILIDADE: Readonly<Record<string, string>> = {
  interno: 'Interna',
  pessoal: 'Dado pessoal',
  sensivel: 'Dado sensível',
};

const ETAPA: Readonly<Record<string, string>> = {
  gestor: 'Gestor de acessos',
  protecao_de_dados: 'Encarregado(a) pelo tratamento de dados',
};

const MOTIVO_DA_DISPENSA: Readonly<Record<string, string>> = {
  designacao_de_protecao_de_dados: 'designação de proteção de dados',
  beneficiario_ja_tem_protecao_de_dados: 'a pessoa beneficiada já exerce a proteção de dados',
};

export function motivoDaDispensa(codigo: string): string {
  return MOTIVO_DA_DISPENSA[codigo] ?? codigo;
}

export function situacaoDoPedido(codigo: string): Rotulo {
  return SITUACAO_DO_PEDIDO[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function situacaoDoAnexo(codigo: string): string {
  return SITUACAO_DO_ANEXO[codigo] ?? codigo;
}

export function tipoDeEvento(codigo: string): string {
  return TIPO_DE_EVENTO[codigo] ?? codigo;
}

export function sensibilidade(codigo: string): string {
  return SENSIBILIDADE[codigo.toLowerCase()] ?? codigo;
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
  if (detalhe === null) return '—';
  return detalhe
    .replace(/Anexo \S+?\./gi, (trecho) => (IDENTIFICADOR.test(trecho) ? 'Documento.' : trecho))
    .replace(SHA256, (hash) => abreviado(hash))
    .replace(/Etapa: (\w+)\./, (_, codigo: string) => `Etapa: ${etapa(codigo)}.`)
    .replace(
      /Sensibilidade avaliada: (\w+)\./,
      (_, codigo: string) => `Sensibilidade avaliada: ${sensibilidade(codigo)}.`,
    )
    .replace(/Motivo: (\w+)\./, (trecho, codigo: string) =>
      codigo in MOTIVO_DA_DISPENSA ? `Motivo: ${motivoDaDispensa(codigo)}.` : trecho,
    );
}
