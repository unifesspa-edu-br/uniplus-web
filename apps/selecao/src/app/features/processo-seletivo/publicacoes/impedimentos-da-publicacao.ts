import { LIMITE_DE_ANEXOS, recusaDoNomeDoAnexo } from '../steps/shared/anexos-do-edital/anexos-do-edital';
import type { EnviosDeArquivos } from './envios-de-arquivos';

/** Os arquivos do formulário e o que a tela sabe do ato corrigido, para conferir antes de publicar. */
export interface ArquivosParaPublicar {
  readonly principal: EnviosDeArquivos;
  readonly anexos: EnviosDeArquivos;
  /** O tipo exige um ato corrigido, e nenhum documento publicado pode ser o corrigido. */
  readonly semAtoParaCorrigir: boolean;
}

/** O que impede de publicar por causa dos arquivos: cada recusa é a que o servidor faria. */
export function impedimentosDosArquivos(arquivos: ArquivosParaPublicar): readonly string[] {
  return [
    ...impedimentosDoPrincipal(arquivos.principal),
    ...impedimentosDosAnexos(arquivos.anexos),
    ...(arquivos.semAtoParaCorrigir
      ? ['Não há documento publicado que possa ser corrigido por este tipo.']
      : []),
  ];
}

function impedimentosDoPrincipal(principal: EnviosDeArquivos): readonly string[] {
  if (principal.arquivos().length === 0) return ['Envie o documento principal, em PDF.'];
  if (principal.naoConfirmados() === 0) return [];
  return [
    'O documento principal não foi enviado por completo. Aguarde o envio, tente de novo ou retire o arquivo.',
  ];
}

function impedimentosDosAnexos(anexos: EnviosDeArquivos): readonly string[] {
  const mensagens: string[] = [];
  if (anexos.arquivos().length > LIMITE_DE_ANEXOS) {
    mensagens.push(`O documento aceita no máximo ${LIMITE_DE_ANEXOS} anexos.`);
  }
  if (anexos.naoConfirmados() > 0) {
    mensagens.push(
      'Há anexo que não foi enviado por completo. Aguarde o envio, tente de novo ou retire o anexo.',
    );
  }
  for (const anexo of anexos.selados()) {
    const recusa = recusaDoNomeDoAnexo(anexo.nome, anexo.nomeArquivo);
    if (recusa !== null) mensagens.push(`Anexo ${anexo.nomeArquivo}: ${recusa}`);
  }
  return mensagens;
}
