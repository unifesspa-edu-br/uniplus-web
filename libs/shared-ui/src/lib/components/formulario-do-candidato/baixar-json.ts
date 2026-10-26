import { salvarArquivo } from '@uniplus/shared-core/http';

/** Baixa o conteúdo como arquivo JSON, sem passar pelo servidor. */
export function baixarJson(nomeDoArquivo: string, conteudo: unknown): void {
  salvarArquivo(
    new Blob([`${JSON.stringify(conteudo, null, 2)}\n`], { type: 'application/json' }),
    nomeDoArquivo,
  );
}
