import type { AnexoDoEdital, WizardDraft } from '../processo-seletivo.models';
import { anexoConfirmado } from './anexos-do-edital/anexos-do-edital';

/**
 * A versão do FORMATO em que o bloco do ato é gravado no servidor.
 *
 * Quem lê um rascunho de versão diferente descarta em vez de traduzir pela metade — meio
 * preenchido com campos de outro formato seria pior que vazio, porque o operador publicaria
 * acreditando ter conferido. Suba este número ao mudar a forma de `publicacao`; rascunhos
 * antigos passam a abrir vazios, que é o comportamento de hoje e não uma regressão.
 */
export const VERSAO_DO_RASCUNHO = 1;

/** A seção que o passo de Revisão guarda entre uma sessão e outra. */
export type BlocoDaPublicacao = WizardDraft['publicacao'];

/** O anexo como o rascunho o guarda: o documento já confirmado e o nome com que se apresenta. */
export interface AnexoGuardado {
  readonly documentoId: string;
  readonly nome: string;
  readonly nomeArquivo: string;
}

/** O documento que o servidor guarda: o bloco do ato e os anexos já confirmados. */
export type DocumentoDoRascunho = Omit<BlocoDaPublicacao, 'anexos'> & {
  readonly anexos: readonly AnexoGuardado[];
};

/**
 * O documento que vai para o servidor.
 *
 * Manda a seção INTEIRA, e não só o que mudou: a gravação é substituição, então um campo que o
 * operador apagou precisa sumir de lá também. Dos anexos vão só os confirmados — o envio em curso
 * ou falho não tem documento selado a que o rascunho possa se referir.
 */
export function documentoDoRascunho(publicacao: BlocoDaPublicacao): DocumentoDoRascunho {
  return {
    numero: publicacao.numero,
    periodoInscricaoInicio: publicacao.periodoInscricaoInicio,
    periodoInscricaoFim: publicacao.periodoInscricaoFim,
    ato: { ...publicacao.ato },
    anexos: publicacao.anexos.filter(anexoConfirmado).map((anexo) => ({
      documentoId: anexo.documentoAPublicarId as string,
      nome: anexo.nome,
      nomeArquivo: anexo.nomeArquivo,
    })),
  };
}

/**
 * Reidrata o bloco a partir do que o servidor devolveu, com o vazio como piso de cada campo.
 *
 * `projetarSecao` é patch RASO: devolver só `ato` deixaria `numero` e o par de período do
 * processo anterior em tela — exatamente o vazamento entre processos que a limpeza do editor
 * existe para impedir. Por isso as chaves de topo voltam sempre, mesmo ausentes no documento
 * guardado.
 */
export function blocoDoDocumento(documento: unknown): BlocoDaPublicacao {
  const raiz = objetoOuVazio(documento);
  const ato = objetoOuVazio(raiz['ato']);

  return {
    numero: texto(raiz['numero']),
    periodoInscricaoInicio: texto(raiz['periodoInscricaoInicio']),
    periodoInscricaoFim: texto(raiz['periodoInscricaoFim']),
    ato: {
      orgao: texto(ato['orgao']),
      serie: texto(ato['serie']),
      ano: texto(ato['ano']),
      dataPublicacao: texto(ato['dataPublicacao']),
      assinante: texto(ato['assinante']),
      tipoAtoCodigo: texto(ato['tipoAtoCodigo']),
    },
    anexos: anexosDoDocumento(raiz['anexos']),
  };
}

/**
 * O rascunho vale a pena guardar? Um bloco sem nada preenchido não tem o que preservar, e
 * gravá-lo só criaria linha no servidor com o nome de ninguém.
 */
export function temAlgoAGuardar(publicacao: BlocoDaPublicacao): boolean {
  const { ato, anexos, ...resto } = publicacao;
  return (
    [...Object.values(resto), ...Object.values(ato)].some((valor) => valor.trim() !== '') ||
    anexos.some(anexoConfirmado)
  );
}

/**
 * Os anexos guardados voltam como confirmados: só o confirmado é guardado, e o servidor recusa na
 * publicação o que já não valer. Entrada sem identificador do documento ou sem nome não vira anexo.
 */
function anexosDoDocumento(valor: unknown): AnexoDoEdital[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item): AnexoDoEdital[] => {
    const anexo = objetoOuVazio(item);
    const documentoId = texto(anexo['documentoId']);
    const nomeArquivo = texto(anexo['nomeArquivo']);
    if (documentoId === '' || nomeArquivo === '') return [];
    return [
      {
        id: documentoId,
        nomeArquivo,
        nome: texto(anexo['nome']),
        progress: 100,
        fase: 'confirmado',
        documentoAPublicarId: documentoId,
        enviado: true,
      },
    ];
  });
}

/**
 * O servidor guarda o documento sem interpretar, então o que volta pode ser qualquer coisa —
 * inclusive o que uma versão futura da tela escreveu. Ler campo a campo com piso no vazio é o
 * que impede `undefined` de chegar a um `<input>` e apagar o valor por baixo do operador.
 */
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function objetoOuVazio(valor: unknown): Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
