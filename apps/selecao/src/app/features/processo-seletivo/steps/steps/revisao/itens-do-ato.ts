import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';

import type { ItemDeConfirmacao } from '../../passo-do-wizard';

/** O ato como o operador o lê, com o número, o tipo e a data já no texto que cada tela mostra. */
export interface AtoParaListar {
  readonly numero: string;
  readonly tipo: string;
  readonly orgao: string;
  readonly serie: string;
  readonly ano: string;
  readonly dataPublicacao: string;
  readonly assinante: string;
}

/** O nome do tipo de ato com o código, ou só o código enquanto o catálogo não o conhece. */
export function rotuloDoTipoDeAto(
  tipos: readonly Pick<TipoAtoPublicadoDto, 'codigo' | 'nome'>[],
  codigo: string,
): string {
  const tipo = tipos.find((item) => item.codigo === codigo);
  return tipo ? `${tipo.nome} (${tipo.codigo})` : codigo;
}

/** Os rótulos do ato na ordem do formulário, únicos para a Revisão; o valor é de quem chama. */
export function itensDoAto(ato: AtoParaListar): readonly ItemDeConfirmacao[] {
  return [
    { rotulo: 'Número do ato', valor: ato.numero },
    { rotulo: 'Tipo de ato', valor: ato.tipo },
    { rotulo: 'Órgão', valor: ato.orgao },
    { rotulo: 'Série', valor: ato.serie },
    { rotulo: 'Ano', valor: ato.ano },
    { rotulo: 'Data de publicação do ato', valor: ato.dataPublicacao },
    { rotulo: 'Assinante', valor: ato.assinante },
  ];
}
