import type { DefinicaoItem } from './definicao-do-formulario';
import { ehFormatoConhecido } from './formatos';
import { lerRestricao } from './leitura-da-restricao';
import { lerExibicaoEObrigatoriedade, lerImpedimento } from './leitura-do-predicado';
import { codigo, lista, Recusa } from './leitura-dos-valores';
import { fatosCitadosPor } from './predicado';
import type { ItemDasRegras, RegrasDoItemDasRegras } from './regras-do-formulario';
import { FormatoDeTexto, type Restricao } from './restricoes';

type RegrasLidasDoItem = Omit<
  DefinicaoItem,
  'fatoCodigo' | 'restricoesDaResposta' | 'fatosCitados'
> & {
  readonly restricoes: readonly Restricao[];
};

export function lerItem(item: ItemDasRegras, caminho: string): DefinicaoItem {
  const fatoCodigo = codigo(item.fatoCodigo, `${caminho}.fatoCodigo`);
  const { restricoes, ...regras } = lerRegrasDoItem(item.regras, `${caminho}.regras`, fatoCodigo);
  lista(item.oferta, `${caminho}.oferta`, (valor) => valor);
  const formato = lerFormato(item.formato, `${caminho}.formato`);

  const lido = {
    fatoCodigo,
    ...regras,
    restricoesDaResposta:
      formato === null ? restricoes : [...restricoes, new FormatoDeTexto(formato)],
  };
  return { ...lido, fatosCitados: fatosCitadosPeloItem(lido, restricoes) };
}

function lerRegrasDoItem(
  regras: RegrasDoItemDasRegras,
  caminho: string,
  fatoCodigo: string,
): RegrasLidasDoItem {
  const dono = `campo '${fatoCodigo}'`;
  const { exibicao, obrigatoriedade } = lerExibicaoEObrigatoriedade(regras, caminho, dono);
  return {
    exibicao,
    obrigatoriedade,
    restricoes: lista(regras.restricoes, `${caminho}.restricoes`, lerRestricao),
    impedimento: lerImpedimento(regras.impedimento, `${caminho}.impedimento`),
  };
}

function fatosCitadosPeloItem(
  item: Omit<DefinicaoItem, 'fatosCitados'>,
  restricoes: readonly Restricao[],
): string[] {
  return [
    ...new Set([
      ...fatosCitadosPor(item.exibicao),
      ...fatosCitadosPor(item.obrigatoriedade.predicado),
      ...restricoes.flatMap((r) => r.fatosCitados),
      ...fatosCitadosPor(item.impedimento).filter((f) => f !== item.fatoCodigo),
    ]),
  ];
}

function lerFormato(formato: string | null | undefined, caminho: string): string | null {
  if (formato === null || formato === undefined) return null;
  if (!ehFormatoConhecido(formato)) {
    throw new Recusa(caminho, `O formato de texto '${formato}' não é do vocabulário do catálogo.`);
  }
  return formato;
}
