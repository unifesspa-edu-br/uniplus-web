import type { CamposEditadosDoFormulario } from '@uniplus/shared-ui/components';
import { comCampo } from '../edicoes/secao-do-documento';

function objeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function chave(valor: unknown, indice: number): string {
  if (!objeto(valor)) return String(indice);
  const codigo = valor['codigo'] ?? valor['fatoCodigo'];
  return typeof codigo === 'string' ? codigo : String(indice);
}

/** Inclui efeitos da mesma ação, como a ordem e o parentesco ao incluir o candidato. */
export function camposAlterados(
  antes: unknown,
  depois: unknown,
  caminho: readonly string[] = [],
): CamposEditadosDoFormulario {
  if (JSON.stringify(antes) === JSON.stringify(depois)) return [];
  if (Array.isArray(antes) && Array.isArray(depois))
    return diferencasDaLista(antes, depois, caminho);
  if (!objeto(antes) || !objeto(depois)) return [caminho];
  return [...new Set([...Object.keys(antes), ...Object.keys(depois)])].flatMap((campo) =>
    camposAlterados(antes[campo], depois[campo], [...caminho, campo]),
  );
}

function diferencasDaLista(
  antes: readonly unknown[],
  depois: readonly unknown[],
  caminho: readonly string[],
): CamposEditadosDoFormulario {
  const chaves = antes.map(chave);
  const estruturaMudou = JSON.stringify(chaves) !== JSON.stringify(depois.map(chave));
  const campos = depois.flatMap((item, indice) => {
    const codigo = chave(item, indice);
    return camposAlterados(antes[chaves.indexOf(codigo)], item, [...caminho, codigo]);
  });
  return estruturaMudou ? [caminho, ...campos] : campos;
}

const BLOCOS_ACHATADOS_NO_DOCUMENTO: ReadonlySet<string> = new Set([
  'apresentacao',
  'ocorrencias',
  'termo',
]);
const PARTES_DA_OBRIGATORIEDADE: ReadonlySet<string> = new Set(['tipo', 'predicado']);

const NOMES_NO_DOCUMENTO: Readonly<Record<string, string>> = {
  fatoCodigo: 'codigoDoDado',
  fatos: 'codigosDosDados',
  ancora: 'referenciaDaData',
  fato: 'codigoDoDado',
  termoId: 'termoCodigo',
  versaoId: 'versaoNumero',
};

function nomeNoDocumento(campo: string): string {
  return NOMES_NO_DOCUMENTO[campo] ?? campo;
}

/** O mesmo campo no documento, que guarda a apresentação, as ocorrências e as regras sem o bloco que o editor usa. */
function caminhoNoDocumento(caminho: readonly string[]): readonly string[] {
  return caminho.reduce<readonly string[]>((atual, parte, posicao) => {
    if (BLOCOS_ACHATADOS_NO_DOCUMENTO.has(parte) || parte === 'regras') return atual;
    const naObrigatoriedade =
      caminho[posicao - 1] === 'obrigatoriedade' && PARTES_DA_OBRIGATORIEDADE.has(parte);
    return naObrigatoriedade ? atual : [...atual, nomeNoDocumento(parte)];
  }, []);
}

/** Preserva ausência, nulo e campos fora do editor; só os campos editados recebem a conversão. */
export class CamposEmEdicao {
  constructor(readonly campos: CamposEditadosDoFormulario) {}

  editou(caminho: readonly string[]): boolean {
    return this.campos.some((campo) => {
      const editado = caminhoNoDocumento(campo);
      return caminho.every((parte, indice) => editado[indice] === parte);
    });
  }

  preservar<T extends object>(
    original: T | undefined,
    convertido: T,
    chaves: readonly (keyof T)[],
    caminho: readonly string[],
  ): T {
    if (original === undefined) return convertido;
    return chaves.reduce(
      (atual, campo) =>
        this.editou([...caminho, String(campo)])
          ? comCampo(atual, campo, convertido[campo])
          : atual,
      original,
    );
  }
}
