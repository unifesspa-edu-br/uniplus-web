import { describe, expect, it } from 'vitest';
import { rotasDoProcesso } from './rotas-do-processo';

const BASE = 'https://api.exemplo.test';
const ID = '01960000-0000-7000-0000-000000000515';

describe('rotasDoProcesso', () => {
  const rotas = rotasDoProcesso(BASE);

  it('mantém a base injetada no começo das quatro formas de rota', () => {
    const urls = [
      rotas.colecao(),
      rotas.doProcesso(ID),
      rotas.doProcessoNaAdministracao(ID),
      rotas.doCatalogo('campos-divulgacao'),
    ];

    for (const url of urls) expect(url).toMatch(new RegExp(`^${BASE}/api/selecao/`));
  });

  it('monta a coleção e o item sob o segmento selecao', () => {
    expect(rotas.colecao()).toBe(`${BASE}/api/selecao/processos-seletivos`);
    expect(rotas.doProcesso(ID, 'etapas')).toBe(
      `${BASE}/api/selecao/processos-seletivos/${ID}/etapas`,
    );
    expect(rotas.doProcesso(ID)).toBe(`${BASE}/api/selecao/processos-seletivos/${ID}`);
  });

  it('codifica o id e os segmentos variáveis', () => {
    expect(rotas.doProcesso('a/b', 'fatos', 'x y', 'opcoes')).toBe(
      `${BASE}/api/selecao/processos-seletivos/a%2Fb/fatos/x%20y/opcoes`,
    );
  });

  it('põe a forma administrativa sob admin', () => {
    expect(rotas.doProcessoNaAdministracao(ID, 'formularios', 'INSCRICAO')).toBe(
      `${BASE}/api/selecao/admin/processos-seletivos/${ID}/formularios/INSCRICAO`,
    );
  });

  it('não leva processos-seletivos no catálogo', () => {
    expect(rotas.doCatalogo('fundamentos-isencao')).toBe(`${BASE}/api/selecao/fundamentos-isencao`);
  });
});
