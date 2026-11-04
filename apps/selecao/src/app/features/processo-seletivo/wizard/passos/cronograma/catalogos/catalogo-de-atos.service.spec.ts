import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TipoAtoPublicadoDto,
  TiposAtoApi,
  type TiposAtoQuery,
} from '@uniplus/shared-data/publicacoes';

import { hojeNoFusoInstitucional } from '../../../shared/fuso-institucional';
import { CatalogoDeAtos } from './catalogo-de-atos.service';
import { pagina } from './catalogos.testing';

function ato(codigo: string, vigenciaFim: string | null): TipoAtoPublicadoDto {
  return {
    id: `ato-${codigo}`,
    codigo,
    nome: `Ato ${codigo}`,
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    vigenciaInicio: '2020-01-01',
    vigenciaFim,
    ehResultado: false,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  } as TipoAtoPublicadoDto;
}

function montar(atos: readonly TipoAtoPublicadoDto[] = []) {
  const listar = vi.fn((_query: TiposAtoQuery) => pagina(atos));
  TestBed.configureTestingModule({
    providers: [CatalogoDeAtos, { provide: TiposAtoApi, useValue: { listar } }],
  });
  const catalogo = TestBed.inject(CatalogoDeAtos);
  catalogo.carregar();
  return { catalogo, listar };
}

describe('CatalogoDeAtos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * A linha do tempo e a superfície de configuração por fase pedem os catálogos ao nascer, e as
   * duas nascem juntas. Sem a guarda, cada abertura do editor dispararia a mesma rodada duas vezes.
   */
  it('não repete a busca quando dois passos pedem o carregamento', () => {
    const { catalogo, listar } = montar();

    catalogo.carregar();

    expect(listar).toHaveBeenCalledTimes(1);
  });

  /**
   * O servidor assume `vigentes: true`. Sem pedir a série completa, um ato já referenciado por um
   * cronograma gravado cuja versão encerrou não voltaria, e a tela exibiria o vínculo sem rótulo.
   */
  it('pede a série histórica, não só os vigentes', () => {
    const { listar } = montar();

    expect(listar.mock.calls[0][0]).toMatchObject({ vigentes: false });
  });

  it('separa o que é escolhível hoje do que é apenas exibível', () => {
    const { catalogo } = montar([ato('VIGENTE', null), ato('ENCERRADO', '2021-01-01')]);

    expect(catalogo.atos()).toHaveLength(2);
    expect(catalogo.atosVigentes().map((a) => a.codigo)).toEqual(['VIGENTE']);
    expect(catalogo.rotuloDoAto().get('ENCERRADO')).toBe('Ato ENCERRADO');
  });

  /** A vigência é semiaberta: o dia do fim já está fora. */
  it('trata a vigência como semiaberta no extremo final', () => {
    const { catalogo } = montar([ato('FECHA_HOJE', hojeNoFusoInstitucional())]);

    expect(catalogo.atosVigentes()).toEqual([]);
  });
});
