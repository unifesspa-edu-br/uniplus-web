import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario, conteudo, fato, item } from './editor-de-formulario.testing';
import { distribuirRecusas, type RecusasDoConteudo } from './modelo/recusas';
import type { FatoDoFormulario } from './modelo/tipos';

describe('EditorDeFormularioComponent: opções que dependem das respostas anteriores', () => {
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  const curso = (
    codigo: string,
    valores: readonly string[],
    cardinalidade = 'VARIOS_VALORES',
  ): FatoDoFormulario => ({
    ...fato(codigo),
    dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
    cardinalidade: { codigo: cardinalidade, rotulo: cardinalidade },
    fonteValores: { codigo: 'GLOBAL', rotulo: 'GLOBAL' },
    valoresDominio: valores,
  });
  const restricaoDe = (fatoCodigo: string): HTMLElement =>
    cenario.tela.querySelector(`[aria-labelledby="f-item-${fatoCodigo}-titulo"]`) as HTMLElement;
  const grupoDeOpcoes = (numero: number): HTMLElement =>
    [...restricaoDe('ESPERA').querySelectorAll('fieldset')].find(
      (f) => f.querySelector('legend')?.textContent?.trim() === `Grupo de opções ${numero}`,
    ) as HTMLElement;
  const botao = (dentro: HTMLElement, texto: string): HTMLButtonElement =>
    [...dentro.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === texto,
    ) as HTMLButtonElement;
  const caixa = (dentro: HTMLElement, texto: string): HTMLInputElement =>
    [...dentro.querySelectorAll('label.checkbox')]
      .find((l) => l.textContent?.trim() === texto)
      ?.querySelector('input') as HTMLInputElement;
  const restricoesEmitidas = (): unknown =>
    cenario.emitidos.at(-1)?.itens?.find((i) => i.fatoCodigo === 'ESPERA')?.regras.restricoes;

  const comOpcoesPermitidas = (): void => {
    cenario.entrada('catalogo', [fato('A'), curso('ESPERA', ['MED', 'DIR'], 'VALOR_UNICO')]);
    cenario.entrada('conteudo', {
      ...conteudo,
      itens: [
        item('A', 0),
        item('ESPERA', 1, {
          apresentacao: { tipoDeCampo: 'ESCOLHA_UNICA' },
          regras: {
            restricoes: [
              { tipo: 'OPCOES_PERMITIDAS', entradas: [{ quando: null, valores: ['MED'] }] },
            ],
          },
        }),
      ],
    });
    cenario.detectar();
  };

  it('as opções permitidas ganham grupos, cada um com a condição sobre os campos anteriores e os valores dele', () => {
    comOpcoesPermitidas();

    botao(restricaoDe('ESPERA'), 'Acrescentar grupo de opções').click();
    cenario.detectar();
    botao(grupoDeOpcoes(2), 'Acrescentar alternativa').click();
    cenario.detectar();
    caixa(grupoDeOpcoes(2), 'DIR').click();
    cenario.detectar();

    const [restricao] = restricoesEmitidas() as {
      entradas: { quando: { fato: string }[][] | null; valores: string[] }[];
    }[];
    expect(restricao.entradas[0]).toEqual({ quando: null, valores: ['MED'] });
    expect(restricao.entradas[1].quando?.[0]?.[0]?.fato).toBe('A');
    expect(restricao.entradas[1].valores).toEqual(['DIR']);
  });

  const recusaNoGrupo = (grupo: number): RecusasDoConteudo =>
    distribuirRecusas(
      [
        {
          field: `conteudo.itens[1].restricoes[0].entradas[${grupo}].quando`,
          message: 'Condição inválida.',
        },
      ],
      cenario.fixture.componentInstance.conteudo(),
    );

  it('a recusa da API aparece no grupo de opções que ela aponta', () => {
    comOpcoesPermitidas();
    cenario.entrada('recusas', recusaNoGrupo(0));
    cenario.detectar();

    expect(grupoDeOpcoes(1).textContent).toContain('Condição inválida.');
  });

  it('removido o grupo recusado, a recusa não passa para o grupo que ficou na posição dele', () => {
    const quando = (valor: boolean): [[{ fato: string; operador: string; valor: boolean }]] => [
      [{ fato: 'A', operador: 'IGUAL', valor }],
    ];
    cenario.entrada('catalogo', [fato('A'), curso('ESPERA', ['MED', 'DIR'], 'VALOR_UNICO')]);
    cenario.entrada('conteudo', {
      ...conteudo,
      itens: [
        item('A', 0),
        item('ESPERA', 1, {
          apresentacao: { tipoDeCampo: 'ESCOLHA_UNICA' },
          regras: {
            restricoes: [
              {
                tipo: 'OPCOES_PERMITIDAS',
                entradas: [
                  { quando: null, valores: ['MED'] },
                  { quando: quando(true), valores: ['DIR'] },
                  { quando: quando(false), valores: ['DIR'] },
                ],
              },
            ],
          },
        }),
      ],
    });
    cenario.entrada('recusas', recusaNoGrupo(1));
    cenario.detectar();
    expect(grupoDeOpcoes(2).textContent).toContain('Condição inválida.');

    botao(grupoDeOpcoes(2), 'Remover o grupo de opções 2').click();
    cenario.detectar();

    expect(restricaoDe('ESPERA').textContent).not.toContain('Condição inválida.');
  });

  const termo = (codigo: string, ordem: number) => ({
    codigo,
    ordem,
    termo: { termoId: codigo, versaoId: 'V' },
    regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
  });
  const revisao = {
    codigo: 'REVISAO_E_ACEITE',
    ordem: 1,
    tipo: 'BLOCO',
    bloco: 'REVISAO_E_ACEITE',
    apresentacao: { titulo: 'Revisão', descricao: null, aviso: null },
  };
  const artigoDoTermo = (codigo: string): HTMLElement =>
    cenario.tela.querySelector(`[aria-labelledby="f-termo-${codigo}-titulo"]`) as HTMLElement;
  const comRecusaNoTermo = (): void => {
    const atual = {
      ...conteudo,
      paginas: [...(conteudo.paginas ?? []), revisao],
      termos: [termo('A', 0), termo('B', 1), termo('C', 2)],
    };
    cenario.entrada('conteudo', atual);
    cenario.entrada(
      'recusas',
      distribuirRecusas([{ field: 'termos[1].codigo', message: 'Termo recusado.' }], atual),
    );
    cenario.detectar();
  };

  it.each(['removido', 'movido'])('a recusa fica no termo depois que outro termo é %s', (acao) => {
    comRecusaNoTermo();
    expect(artigoDoTermo('B').textContent).toContain('Termo recusado.');
    botao(artigoDoTermo('A'), acao === 'removido' ? 'Remover' : 'Descer').click();
    cenario.detectar();
    expect(artigoDoTermo('B').textContent).toContain('Termo recusado.');
    expect(artigoDoTermo('C').textContent).not.toContain('Termo recusado.');
    if (acao === 'movido') expect(artigoDoTermo('A').textContent).not.toContain('Termo recusado.');
  });

  it('as opções das respostas escolhem entre os campos anteriores cujas opções cabem nas do campo', () => {
    cenario.entrada('catalogo', [
      curso('OPCOES', ['MED', 'DIR']),
      curso('OUTRO', ['XYZ']),
      curso('ESPERA', ['MED', 'DIR', 'ENG'], 'VALOR_UNICO'),
    ]);
    cenario.entrada('conteudo', {
      ...conteudo,
      itens: [
        item('OPCOES', 0, { apresentacao: { tipoDeCampo: 'ESCOLHA_MULTIPLA' } }),
        item('OUTRO', 1, { apresentacao: { tipoDeCampo: 'ESCOLHA_MULTIPLA' } }),
        item('ESPERA', 2, { apresentacao: { tipoDeCampo: 'ESCOLHA_UNICA' } }),
      ],
    });
    cenario.detectar();
    const combo = cenario.tela.querySelector('#f-item-ESPERA-restricao') as HTMLSelectElement;
    combo.value = 'OPCOES_DAS_RESPOSTAS';
    combo.dispatchEvent(new Event('change'));
    cenario.detectar();
    botao(restricaoDe('ESPERA'), 'Acrescentar restrição').click();
    cenario.detectar();

    const fontes = restricaoDe('ESPERA').querySelector(
      '[aria-label="Campos de onde vêm as opções de Campo ESPERA"]',
    ) as HTMLElement;
    expect(
      [...fontes.querySelectorAll('label.checkbox')].map((l) => l.textContent?.trim()),
    ).toEqual(['OPCOES']);

    caixa(fontes, 'OPCOES').click();
    cenario.detectar();

    expect(restricoesEmitidas()).toEqual([{ tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['OPCOES'] }]);
  });
});
