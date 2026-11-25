import { createProjectGraphAsync } from '@nx/devkit';
import { beforeAll, describe, expect, it } from 'vitest';
import { analisar } from './analise-do-lint.testing';

const PROJETO = 'libs/shared-data';
const ARQUIVO = 'src/lib/api/exemplo/exemplo.api.ts';
const REGRA = 'no-restricted-syntax';
const MENSAGEM_INJETAVEL =
  "Toda classe declarada no arquivo deve usar @Injectable({ providedIn: 'root' }).";
const DECORADOR = "@Injectable({ providedIn: 'root' })";

function servico(metodo: string, decorador = DECORADOR): string {
  return `${decorador}
export class ExemploApi { ${metodo} }`;
}

beforeAll(async () => {
  await createProjectGraphAsync();
});

describe('padrão dos serviços de API', () => {
  it.each([
    ['sem decorador', servico('consultar(): void {}', ''), MENSAGEM_INJETAVEL],
    [
      'registro fora da raiz',
      servico('consultar(): void {}', "@Injectable({ providedIn: 'any' })"),
      MENSAGEM_INJETAVEL,
    ],
    [
      'Injectable sem argumento',
      servico('consultar(): void {}', '@Injectable()'),
      MENSAGEM_INJETAVEL,
    ],
    ['Promise', servico('consultar(): Promise<string> { throw 1; }')],
    ['Observable cru', servico('consultar(): Observable<string> { throw 1; }')],
    ['Observable sem tipo', servico('consultar(): Observable { throw 1; }')],
    ['ApiResult sem tipo', servico('consultar(): Observable<ApiResult> { throw 1; }')],
    ['sem tipo de retorno', servico('consultar() { return 1; }')],
  ])('recusa %s', async (_caso, codigo, mensagem) => {
    const resultado = await analisar(PROJETO, ARQUIVO, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).toContain(REGRA);
    if (mensagem) expect(resultado.mensagens.some((item) => item.message === mensagem)).toBe(true);
  });

  it('aceita retornos explícitos e Observable de ApiResult', async () => {
    const codigo = servico('consultar(): Observable<ApiResult<string>> { throw 1; }');
    const resultado = await analisar(PROJETO, ARQUIVO, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).not.toContain(REGRA);
  });

  it('não exige tipos de retorno de métodos privados, protegidos ou estáticos', async () => {
    const codigo = servico('private a() {} protected b() {} static c() {}');
    const resultado = await analisar(PROJETO, ARQUIVO, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).not.toContain(REGRA);
  });

  it.each([
    ['exportação separada', 'class ExemploApi {} export { ExemploApi };'],
    ['exportação padrão por nome', 'class ExemploApi {} export default ExemploApi;'],
    ['exportação padrão direta', 'export default class ExemploApi {}'],
    ['classe auxiliar', `${servico('consultar(): void {}')} class Outra {}`],
    ['segunda classe exportada', `${servico('consultar(): void {}')} export class Outra {}`],
  ])('recusa %s sem decorador', async (_caso, codigo) => {
    const resultado = await analisar(PROJETO, ARQUIVO, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.mensagens.some((item) => item.message === MENSAGEM_INJETAVEL)).toBe(true);
  });

  it.each([
    ['exportação direta', `${DECORADOR} export class ExemploApi {}`],
    ['exportação separada', `${DECORADOR} class ExemploApi {} export { ExemploApi };`],
    ['exportação padrão por nome', `${DECORADOR} class ExemploApi {} export default ExemploApi;`],
    ['exportação padrão direta', `${DECORADOR} export default class ExemploApi {}`],
  ])('aceita %s com decorador correto', async (_caso, codigo) => {
    const resultado = await analisar(PROJETO, ARQUIVO, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).not.toContain(REGRA);
  });

  it('aceita o registro após outro decorador e outra propriedade', async () => {
    const codigo = servico(
      'consultar(): void {}',
      "@Outro() @Injectable({ x: 1, providedIn: 'root' })",
    );
    const resultado = await analisar(PROJETO, ARQUIVO, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).not.toContain(REGRA);
  });
});
