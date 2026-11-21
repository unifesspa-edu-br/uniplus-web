import type { CaminhoDoCampo as Caminho, TermoDoFormulario } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario as Formulario } from '@uniplus/shared-data/selecao';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { lerExibicaoEObrigatoriedade, regrasDoDocumento } from './obrigatoriedade';
import {
  type ReferenciaDaVersaoDoTermo,
  referenciaPorCodigoENumero,
  referenciaPorIdentificadores,
} from './referencias-dos-termos';

type Termo = NonNullable<Formulario['termos']>[number];
const CAMPOS: readonly (keyof Termo)[] = [
  'codigo',
  'ordem',
  'termoCodigo',
  'versaoNumero',
  'exibicao',
  'obrigatoriedade',
];
const CATALOGO_INDISPONIVEL = 'Carregue novamente o catálogo de termos para editar o formulário.';
const SEM_CORRESPONDENCIA =
  'O termo e sua versão não têm uma correspondência única no catálogo. Carregue o catálogo novamente.';

function referenciaNaLeitura(termo: Termo, contexto: Contexto, caminho: Caminho) {
  const referencias = contexto.catalogos.termos;
  if (referencias === null) return contexto.recusar('catalogo', caminho, CATALOGO_INDISPONIVEL);
  const referencia = referenciaPorCodigoENumero(referencias, termo.termoCodigo, termo.versaoNumero);
  if (referencia !== undefined) return referencia;
  const temTermo = referencias.some((item) => item.termoCodigo === termo.termoCodigo);
  return contexto.recusar(temTermo ? 'versao' : 'termo', caminho, SEM_CORRESPONDENCIA);
}

export function lerTermo(termo: Termo, contexto: Contexto, caminho: Caminho): TermoDoFormulario {
  const referencia = referenciaNaLeitura(termo, contexto, caminho);
  return {
    codigo: termo.codigo,
    ordem: termo.ordem ?? 0,
    termo: { termoId: referencia?.termoId ?? '', versaoId: referencia?.versaoId ?? '' },
    regras: lerExibicaoEObrigatoriedade(termo.exibicao, termo.obrigatoriedade),
  };
}

function referenciaNaEdicao(termo: TermoDoFormulario, contexto: Contexto, caminho: Caminho) {
  const referencias = contexto.catalogos.termos;
  if (referencias === null) return contexto.recusar('catalogo', caminho, CATALOGO_INDISPONIVEL);
  const referencia = referenciaPorIdentificadores(
    referencias,
    termo.termo.termoId,
    termo.termo.versaoId,
  );
  if (referencia !== undefined) return referencia;
  const temTermo = referencias.some((item) => item.termoId === termo.termo.termoId);
  return contexto.recusar(temTermo ? 'versao' : 'termo', caminho, SEM_CORRESPONDENCIA);
}

function identidadeDoTermo(termo: TermoDoFormulario, referencia: ReferenciaDaVersaoDoTermo) {
  return {
    codigo: termo.codigo,
    ordem: termo.ordem,
    termoCodigo: referencia.termoCodigo,
    versaoNumero: referencia.versaoNumero,
  };
}

function converterTermo(
  termo: TermoDoFormulario,
  contexto: Contexto,
  caminho: Caminho,
): Termo | undefined {
  const referencia = referenciaNaEdicao(termo, contexto, caminho);
  if (referencia === undefined) return undefined;
  return {
    ...identidadeDoTermo(termo, referencia),
    ...regrasDoDocumento(termo.regras, contexto, caminho),
  };
}

export function gravarTermo(
  termo: TermoDoFormulario,
  original: Termo | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Termo | undefined {
  const convertido = converterTermo(termo, contexto, caminho);
  return convertido === undefined
    ? undefined
    : contexto.edicao.preservar(original, convertido, CAMPOS, caminho);
}
