import {
  PARAMETRO_ENTRAR_DE_NOVO,
  urlDeRetornoParaEntrarDeNovo,
  urlSemOParametroDeEntrarDeNovo,
} from './retorno-para-entrar-de-novo';

describe('retorno para entrar de novo', () => {
  it('leva a rota resolvida contra a base e o parâmetro', () => {
    const url = urlDeRetornoParaEntrarDeNovo(
      '/processo-seletivo/novo',
      'https://uni.test/selecao/',
    );

    expect(url).toBe(
      `https://uni.test/selecao/processo-seletivo/novo?${PARAMETRO_ENTRAR_DE_NOVO}=1`,
    );
  });

  it('mantém os parâmetros que a rota já tinha', () => {
    const url = urlDeRetornoParaEntrarDeNovo('/processos?busca=a', 'https://uni.test/');

    expect(new URL(url).searchParams.get('busca')).toBe('a');
  });

  it('retira só o parâmetro e devolve a rota original', () => {
    const href = urlDeRetornoParaEntrarDeNovo('/processos?busca=a', 'https://uni.test/');

    expect(urlSemOParametroDeEntrarDeNovo(href)).toBe('https://uni.test/processos?busca=a');
  });

  it('não reconhece a URL que não veio de entrar de novo', () => {
    expect(urlSemOParametroDeEntrarDeNovo('https://uni.test/processos')).toBeNull();
  });
});
