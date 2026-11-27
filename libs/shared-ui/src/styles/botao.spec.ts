import { resolve } from 'node:path';
import { declaracoesDaRegra, lerFolhaDeEstilo, valoresNosTemas } from '@uniplus/shared-testing';
import { razaoDeContraste } from './testing/contraste.testing';

const CONTRASTE_DO_TEXTO = 4.5;
const CONTRASTE_DO_COMPONENTE = 3;
const SUPERFICIES = ['--surface-page', '--surface-card', '--surface-subtle'] as const;

describe('botão secundário e terciário — contraste nos três temas', () => {
  const componentes = lerFolhaDeEstilo(resolve(__dirname, 'components.css'));
  const tokens = lerFolhaDeEstilo(resolve(__dirname, 'tokens.css'));
  const temaContraste = declaracoesDaRegra(tokens, "[data-theme='contrast']");

  function nomeDoToken(valor: string | undefined): string {
    const nome = /^var\((--[\w-]+)\)$/u.exec(valor ?? '')?.[1];
    if (nome === undefined) throw new Error(`Valor não é uma variável: ${valor}`);
    return nome;
  }

  function coresNosTresTemas(token: string): readonly string[] {
    const [claro, escuro] = valoresNosTemas(tokens, `var(${token})`);
    const noContraste = temaContraste.get(token);
    if (noContraste === undefined) throw new Error(`Tema de contraste sem ${token}`);
    return [claro, escuro, valoresNosTemas(tokens, noContraste)[0]];
  }

  function razoesNosTresTemas(primeiro: string, segundo: string): readonly number[] {
    const cores = coresNosTresTemas(segundo);
    return coresNosTresTemas(primeiro).map((cor, tema) => razaoDeContraste(cor, cores[tema]));
  }

  it.each(['.btn--secondary', '.btn--tertiary'])(
    'o texto de %s tem ao menos 4,5:1 sobre as superfícies, o hover e o ativo',
    (seletor) => {
      const regra = declaracoesDaRegra(componentes, seletor);
      const texto = nomeDoToken(regra.get('--btn-fg'));
      const fundos = [
        ...SUPERFICIES,
        nomeDoToken(regra.get('--btn-bg-hover')),
        nomeDoToken(regra.get('--btn-bg-active')),
      ];
      for (const fundo of fundos) {
        for (const razao of razoesNosTresTemas(texto, fundo))
          expect(razao).toBeGreaterThanOrEqual(CONTRASTE_DO_TEXTO);
      }
    },
  );

  it.each(['.btn--secondary', '.btn--tertiary'])(
    'o hover de %s não troca o texto medido pelo teste',
    (variante) => {
      const seletor = `${variante}:hover:not([disabled]):not(:disabled):not([aria-disabled='true'])`;
      const hover = declaracoesDaRegra(componentes, seletor);
      expect(hover.has('color')).toBe(false);
      expect(hover.has('--btn-fg')).toBe(false);
    },
  );

  it('a borda do secundário tem ao menos 3:1 sobre as superfícies', () => {
    const borda = nomeDoToken(declaracoesDaRegra(componentes, '.btn--secondary').get('--btn-bd'));
    for (const superficie of SUPERFICIES) {
      for (const razao of razoesNosTresTemas(borda, superficie))
        expect(razao).toBeGreaterThanOrEqual(CONTRASTE_DO_COMPONENTE);
    }
  });

  it('a borda do secundário sob o ponteiro tem ao menos 3:1 sobre o fundo do hover', () => {
    const hover = nomeDoToken(
      declaracoesDaRegra(componentes, '.btn--secondary').get('--btn-bg-hover'),
    );
    const seletor =
      ".btn--secondary:hover:not([disabled]):not(:disabled):not([aria-disabled='true'])";
    const borda = nomeDoToken(declaracoesDaRegra(componentes, seletor).get('border-color'));
    for (const razao of razoesNosTresTemas(borda, hover))
      expect(razao).toBeGreaterThanOrEqual(CONTRASTE_DO_COMPONENTE);
  });
});
