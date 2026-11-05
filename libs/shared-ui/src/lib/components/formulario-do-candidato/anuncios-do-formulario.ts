import { anunciarMudancaDosDocumentos } from './anuncio-dos-documentos';
import type { NoDeDocumentos } from './arvore-de-documentos';
import type { PassoDoFormulario } from './passos-do-formulario';
import { anunciarMudancaDasModalidades, type ModalidadesAvaliadas } from './modalidades-avaliadas';

/** Os campos de um passo pelo código, com o rótulo. */
export interface CamposDoPasso {
  readonly chave: string | null;
  readonly campos: ReadonlyMap<string, string>;
}

/** Os campos que aparecem no passo, para anunciar o que aparece e o que some. */
export function camposDoPasso(passo: PassoDoFormulario | null): CamposDoPasso {
  return {
    chave: passo?.chave ?? null,
    campos: new Map((passo?.campos ?? []).map((c) => [c.campo.fatoCodigo, c.campo.rotulo])),
  };
}

/** "Apareceu: X. Saiu: Y." quando os campos do mesmo passo mudam com uma resposta; nada ao trocar de passo. */
export function anunciarCampos(anteriores: CamposDoPasso, atuais: CamposDoPasso): string {
  if (anteriores.chave !== atuais.chave) return '';
  const apareceram = [...atuais.campos.entries()]
    .filter(([codigo]) => !anteriores.campos.has(codigo))
    .map(([, rotulo]) => rotulo);
  const sairam = [...anteriores.campos.entries()]
    .filter(([codigo]) => !atuais.campos.has(codigo))
    .map(([, rotulo]) => rotulo);
  return [
    apareceram.length > 0 ? `Apareceu: ${apareceram.join(', ')}.` : '',
    sairam.length > 0 ? `Saiu: ${sairam.join(', ')}.` : '',
  ]
    .filter((parte) => parte !== '')
    .join(' ');
}

/** O que a avaliação da API decidiu e pode mudar com uma resposta: as modalidades e os documentos. */
export interface DecisaoDaAvaliacao {
  readonly modalidades: ModalidadesAvaliadas | null;
  readonly modalidadesDaSegundaOpcao: ModalidadesAvaliadas | null;
  readonly documentos: readonly NoDeDocumentos[] | null;
  readonly integrantes: ReadonlySet<string>;
}

/** O anúncio das modalidades de uma opção de curso, identificado quando há duas; vazio fica vazio. */
function naOpcao(opcao: string | null, anuncio: string): string {
  return opcao === null || anuncio === '' ? anuncio : `${opcao}: ${anuncio}`;
}

/**
 * Só o que mudou desta vez entra no anúncio: o de antes não volta a ser lido. A primeira avaliação não
 * é mudança.
 */
export function anunciarMudancaDaAvaliacao(
  atual: DecisaoDaAvaliacao,
  antes: DecisaoDaAvaliacao,
): string {
  return [
    atual.modalidades === antes.modalidades
      ? ''
      : naOpcao(
          atual.modalidadesDaSegundaOpcao === null ? null : '1ª opção',
          anunciarMudancaDasModalidades(antes.modalidades, atual.modalidades),
        ),
    atual.modalidadesDaSegundaOpcao === antes.modalidadesDaSegundaOpcao
      ? ''
      : naOpcao(
          '2ª opção',
          anunciarMudancaDasModalidades(
            antes.modalidadesDaSegundaOpcao,
            atual.modalidadesDaSegundaOpcao,
          ),
        ),
    atual.documentos === antes.documentos
      ? ''
      : anunciarMudancaDosDocumentos(antes.documentos, atual.documentos, atual.integrantes),
  ]
    .filter((parte) => parte)
    .join(' ');
}
