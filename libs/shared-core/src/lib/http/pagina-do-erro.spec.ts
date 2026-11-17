import { describe, expect, it } from 'vitest';

import { paginaDoErro, paginaDoProblema } from './pagina-do-erro';

const BASE = 'https://exemplo.unifesspa.edu.br/uniplus/erros/';
const problema = {
  type: `${BASE}uniplus.selecao.edital.conflito`,
  code: 'uniplus.selecao.edital.conflito',
};

describe('paginaDoErro', () => {
  it('resolve o código do campo ao lado da página do problema', () => {
    expect(paginaDoErro(problema, 'uniplus.selecao.edital.vigencia_invalida')).toBe(
      `${BASE}uniplus.selecao.edital.vigencia_invalida`,
    );
  });

  it.each([
    ['URN provisória', 'urn:uniplus:erro:conflito'],
    ['endereço em http', `http://exemplo.unifesspa.edu.br/erros/${problema.code}`],
    ['endereço inválido', 'sem-esquema'],
    ['type vazio', ''],
  ])('não indica página quando o type é %s', (_nome, type) => {
    expect(paginaDoErro({ type, code: problema.code }, 'uniplus.x.y')).toBeNull();
  });

  it('não indica página quando o type não termina no code do problema', () => {
    expect(paginaDoErro({ type: `${BASE}outro.codigo`, code: problema.code }, 'a.b')).toBeNull();
  });

  it('não indica página quando o type termina em barra', () => {
    expect(paginaDoErro({ type: BASE, code: '' }, 'a.b')).toBeNull();
  });

  it('ignora consulta e fragmento do type', () => {
    const comExtras = { ...problema, type: `${problema.type}?a=1#topo` };

    expect(paginaDoErro(comExtras, 'uniplus.x.y')).toBe(`${BASE}uniplus.x.y`);
  });

  it.each([
    ['sobe de pasta', '../intruso'],
    ['sobe duas pastas', '../../intruso'],
    ['troca o servidor', '//outro.host/erros/x'],
    ['troca o servidor por caminho absoluto de URL', 'https://outro.host/erros/x'],
    ['usa outro esquema', 'javascript:alert(1)'],
    ['usa http', 'http://exemplo.unifesspa.edu.br/uniplus/erros/x'],
    ['vai para a raiz', '/intruso'],
    ['entra em subpasta', 'sub/x'],
    ['traz consulta', '?next=https://externo.example'],
    ['traz consulta depois de um nome', 'x?next=https://externo.example'],
    ['traz consulta depois de barra', '/?next=https://externo.example'],
    ['traz fragmento', '#frag'],
    ['traz fragmento depois de um nome', 'x#frag'],
    ['traz fragmento depois de barra', '/#frag'],
    ['sobe de pasta codificado', '%2e%2e'],
    ['sobe de pasta codificado depois de barra', '/%2e%2e'],
    ['traz espaço', 'a b'],
    ['traz barra invertida', 'a\\b'],
    ['traz barra invertida depois de barra', '/a\\b'],
    ['é o ponto da própria pasta', '.'],
    ['é vazio', ''],
  ])('não sai da pasta e do servidor do type quando o código %s', (_nome, codigo) => {
    expect(paginaDoErro(problema, codigo)).toBeNull();
  });
});

describe('paginaDoProblema', () => {
  it('devolve o próprio type quando ele é montado com o code', () => {
    expect(paginaDoProblema(problema)).toBe(problema.type);
  });

  it('não indica página quando o type é uma URN provisória', () => {
    expect(paginaDoProblema({ type: 'urn:uniplus:erro', code: problema.code })).toBeNull();
  });
});
