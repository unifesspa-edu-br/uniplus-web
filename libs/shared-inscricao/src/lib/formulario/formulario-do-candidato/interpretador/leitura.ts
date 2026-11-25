import type {
  DefinicaoAgregado,
  DefinicaoPagina,
  DefinicaoFormulario,
  DefinicaoTermo,
  LeituraDasRegras,
} from './definicao-do-formulario';
import { lerAgregado, lerDerivacao } from './leitura-das-derivacoes';
import { lerGrupo } from './leitura-do-grupo';
import { lerItem } from './leitura-do-item';
import { lerExibicaoEObrigatoriedade, lerPredicado } from './leitura-do-predicado';
import { codigo, ehObjeto, garantirUnicos, lista, Recusa } from './leitura-dos-valores';
import type { PaginaDasRegras, RegrasDoFormulario, TermoDasRegras } from './regras-do-formulario';

type ElementosLidos = Omit<DefinicaoFormulario, 'ofertas'>;

/**
 * Lê as regras como a API as lê antes de avaliar: a forma que não forma formulário — elemento nulo,
 * obrigatoriedade sem o predicado que pede, restrição incoerente, código repetido — é recusada com o
 * caminho e a causa, para que um arquivo importado nunca chegue ao avaliador pela metade.
 */
export function lerRegras(regras: RegrasDoFormulario | null | undefined): LeituraDasRegras {
  try {
    if (!ehObjeto(regras)) throw new Recusa('regras', 'As regras do formulário são um objeto.');
    return { valida: true, definicao: lerFormulario(regras) };
  } catch (erro) {
    if (erro instanceof Recusa)
      return { valida: false, erro: { caminho: erro.caminho, mensagem: erro.message } };
    throw erro;
  }
}

function lerFormulario(regras: RegrasDoFormulario): DefinicaoFormulario {
  const lidos: ElementosLidos = {
    paginas: lista(regras.paginas, 'paginas', lerPagina),
    termos: lista(regras.termos, 'termos', lerTermo),
    derivacoes: lista(regras.derivacoes, 'derivacoes', lerDerivacao),
    agregados: lista(regras.agregados, 'agregados', lerAgregado),
  };
  garantirCodigosUnicos(lidos);
  garantirGruposDosAgregados(lidos.paginas, lidos.agregados);
  return { ...lidos, ofertas: ofertasDe(regras) };
}

function garantirCodigosUnicos({ paginas, termos, ...produtores }: ElementosLidos): void {
  garantirUnicos(
    paginas.map((e) => e.codigo),
    'pagina',
  );
  garantirUnicos(
    termos.map((t) => t.codigo),
    'termo',
  );
  garantirUnicos(codigosProduzidos(paginas, produtores), 'fato produzido ou grupo do formulário');
}

/** Os códigos que o formulário produz — fatos dos campos, dos subitens, derivados e agregados — e os dos grupos. */
function codigosProduzidos(
  paginas: readonly DefinicaoPagina[],
  { derivacoes, agregados }: Pick<ElementosLidos, 'derivacoes' | 'agregados'>,
): string[] {
  const grupos = paginas.flatMap((e) => e.grupos);
  return [
    ...paginas.flatMap((e) => e.itens.map((i) => i.fatoCodigo)),
    ...grupos.flatMap((g) => g.subitens.map((s) => s.fatoCodigo)),
    ...derivacoes.map((d) => d.fatoCodigo),
    ...agregados.map((a) => a.codigo),
    ...grupos.map((g) => g.codigo),
  ];
}

function garantirGruposDosAgregados(
  paginas: readonly DefinicaoPagina[],
  agregados: readonly DefinicaoAgregado[],
): void {
  const codigosDosGrupos = new Set(paginas.flatMap((e) => e.grupos).map((g) => g.codigo));
  agregados.forEach((agregado, i) => {
    if (!codigosDosGrupos.has(agregado.grupoCodigo)) {
      throw new Recusa(
        `agregados[${i}].grupoCodigo`,
        `O agregado '${agregado.codigo}' é sobre o grupo '${agregado.grupoCodigo}', que o formulário não tem.`,
      );
    }
  });
}

function lerPagina(pagina: PaginaDasRegras, caminho: string): DefinicaoPagina {
  return {
    codigo: codigo(pagina.codigo, `${caminho}.codigo`),
    exibicao: lerPredicado(pagina.exibicao, `${caminho}.exibicao`),
    itens: lista(pagina.itens, `${caminho}.itens`, lerItem),
    grupos: lista(pagina.grupos, `${caminho}.grupos`, lerGrupo),
  };
}

function lerTermo(termo: TermoDasRegras, caminho: string): DefinicaoTermo {
  const codigoDoTermo = codigo(termo.codigo, `${caminho}.codigo`);
  return {
    codigo: codigoDoTermo,
    ...lerExibicaoEObrigatoriedade(termo.regras, `${caminho}.regras`, `termo '${codigoDoTermo}'`),
  };
}

/** A oferta de valores de cada campo — itens e subitens. */
function ofertasDe(regras: RegrasDoFormulario): ReadonlyMap<string, ReadonlySet<string>> {
  const ofertas = new Map<string, ReadonlySet<string>>();
  for (const item of (regras.paginas ?? []).flatMap((e) => [
    ...(e.itens ?? []),
    ...(e.grupos ?? []).flatMap((g) => g.subitens ?? []),
  ])) {
    if (item.oferta && !ofertas.has(item.fatoCodigo))
      ofertas.set(item.fatoCodigo, new Set(item.oferta));
  }
  return ofertas;
}
