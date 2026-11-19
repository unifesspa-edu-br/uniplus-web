import { TestBed } from '@angular/core/testing';

import { CatalogoDeUnidadesDoCadastro } from './catalogos/catalogo-de-unidades-do-cadastro.service';
import { BASE, PROBLEM_JSON, ROTA_FASES } from './cronograma.testing';
import type { ContextoDoCronograma } from './cronograma-passo.testing';

export const ID_CEPS = '01960000-0000-7000-0000-0000000000a1';
export const ID_CGA = '01960000-0000-7000-0000-0000000000a2';
export const ROTA_UNIDADES = `${BASE}/api/organizacao/unidades`;
export const CEPS = { id: ID_CEPS, sigla: 'CEPS', nome: 'Centro de Processos Seletivos' };
export const CGA = { id: ID_CGA, sigla: 'CGA', nome: 'Centro de Gestão Acadêmica' };

const RECUSA_DE_VALIDACAO = {
  type: 'about:blank',
  title: 'Validação',
  status: 422,
  code: 'uniplus.validacao',
  traceId: '00000000000000000000000000000009',
};
const CODIGO_DA_UNIDADE_INEXISTENTE =
  'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada';

/** A recusa do servidor à unidade responsável que a fase da posição `indice` declara. */
function recusaDeUnidadeInexistente(indice: number): object {
  const field = `fases[${indice}].unidadeResponsavelId`;
  return {
    ...RECUSA_DE_VALIDACAO,
    errors: [{ field, code: CODIGO_DA_UNIDADE_INEXISTENTE, message: 'x' }],
  };
}

/** O que os cenários da unidade responsável da fase consultam e conduzem na tela do passo. */
export class AjudantesDeUnidades {
  constructor(private readonly tela: ContextoDoCronograma) {}

  readonly comUnidadesNoCadastro = (): void => {
    const catalogos = TestBed.inject(CatalogoDeUnidadesDoCadastro);
    catalogos.unidades.set([CEPS, CGA] as never);
    catalogos.carregando.set(false);
    this.tela.detectar();
  };

  readonly botaoAcrescentar = (): HTMLButtonElement =>
    Array.from(this.tela.nativo.querySelectorAll<HTMLButtonElement>('button')).find((botao) =>
      botao.textContent?.includes('Acrescentar à linha do tempo'),
    ) as HTMLButtonElement;

  readonly unidadeDoSelect = (indice: number): HTMLSelectElement =>
    this.tela.nativo.querySelector<HTMLSelectElement>(`#cr-unidade-${indice}`) as HTMLSelectElement;

  readonly fasesDoCorpo = (requisicao: { request: { body: unknown } }) =>
    requisicao.request.body as { unidadeResponsavelId: string | null }[];

  readonly acrescentar = (faseId: string): void => {
    this.tela.cronograma.formulario.controls.faseAAcrescentar.setValue(faseId);
    this.tela.cronograma.acrescentarFase();
    this.tela.detectar();
  };

  readonly recusarUnidadeNaFase = async (indice: number): Promise<{ valid: boolean }> => {
    const gravacao = this.tela.componente.persistir();
    this.tela.controller.expectOne(ROTA_FASES).flush(recusaDeUnidadeInexistente(indice), {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    const resultado = await gravacao;
    this.tela.controller.expectOne((req) => req.url === ROTA_UNIDADES).flush([]);
    this.tela.detectar();
    return resultado;
  };
}
