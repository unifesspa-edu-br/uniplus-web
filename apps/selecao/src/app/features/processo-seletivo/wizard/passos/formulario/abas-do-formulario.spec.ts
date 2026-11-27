import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import { abaPelaTecla, abasDoFormulario } from './abas-do-formulario';
import {
  entradaDasAbas as entrada,
  inscricao,
  laudo,
  textosVazios,
} from './abas-do-formulario.testing';
import { item } from './formulario-de-inscricao.testing';

describe('as abas do passo Formulários', () => {
  it('seguem a ordem do cronograma, e a posição no rascunho dá os ids, que não mudam com o código', () => {
    const abas = abasDoFormulario(entrada([laudo(), inscricao()]));

    expect(abas.map((aba) => aba.codigo)).toEqual(['INSCRICAO', 'LAUDO']);
    expect(abas.map((aba) => [aba.aba, aba.painel, aba.idBase, aba.campoDaFase])).toEqual([
      ['form-aba-1', 'form-painel-1', 'form-1', 'form-fase-1'],
      ['form-aba-0', 'form-painel-0', 'form-0', 'form-fase-0'],
    ]);
  });

  it('a inscrição é o obrigatório da fase que coleta inscrição, e os outros citam o que ela coleta', () => {
    const [primeira, segunda] = abasDoFormulario(entrada([inscricao(), laudo()]));

    expect([primeira.ehInscricao, segunda.ehInscricao]).toEqual([true, false]);
    expect(primeira.fatosDaInscricao).toBeNull();
    expect(segunda.fatosDaInscricao).toEqual(['PCD']);
  });

  it('o fato que outro formulário coleta fica indisponível para este', () => {
    const comCampo = laudo({
      conteudo: { ...conteudoInicial(), itens: [item('RENDA', 0, 'S1')] },
    });

    const [aba] = abasDoFormulario(entrada([inscricao(), comCampo]));

    expect(aba.fatosIndisponiveis).toContain('RENDA');
  });

  it('o rótulo é o título, ou o nome da fase e a obrigatoriedade', () => {
    const comTitulo = laudo({ conteudo: { ...conteudoInicial(), titulo: 'Laudo médico' } });

    const abas = abasDoFormulario(entrada([laudo({ codigo: 'SEM_TITULO' }), comTitulo]));

    expect(abas.find((aba) => aba.codigo === 'SEM_TITULO')?.rotulo).toMatch(
      /^Fase AVALIACAO — (obrigatório|facultativo)$/,
    );
    expect(abas.find((aba) => aba.codigo === 'LAUDO')?.rotulo).toBe('Laudo médico');
  });

  it('na fase de inscrição a obrigatoriedade é fixa e a consequência não cabe', () => {
    const [aba] = abasDoFormulario(
      entrada([
        { ...inscricao(), obrigatorio: false, consequenciaDaFaltaDeEnvio: 'ELIMINA' as never },
      ]),
    );

    expect(aba.obrigatorio).toBe(true);
    expect(aba.obrigatoriedade.fixa).toBe(true);
    expect(aba.consequenciaCabe).toBe(false);
    expect(aba.formulario.consequenciaDaFaltaDeEnvio).toBeNull();
  });

  it('nas demais fases o operador escolhe, e a consequência cabe no obrigatório', () => {
    const [aba] = abasDoFormulario(entrada([laudo()]));

    expect(aba.obrigatoriedade.fixa).toBe(false);
    expect(aba.consequenciaCabe).toBe(true);
  });

  it('o outro formulário da fase passa o obrigatório a facultativo e trava a escolha', () => {
    const abas = abasDoFormulario(entrada([laudo(), laudo({ codigo: 'OUTRO' })]));
    const outro = abas.find((aba) => aba.codigo === 'OUTRO');

    expect(outro?.obrigatorio).toBe(false);
    expect(outro?.consequenciaCabe).toBe(false);
  });

  it('a recusa da remoção ou da aplicação marca a aba como recusada, e o modelo escolhido tem de servir à fase', () => {
    const textos = {
      ...textosVazios(),
      recusasDaRemocao: new Map([['LAUDO', 'Não pode.']]),
      modelos: [
        { id: 'a', codigo: 'A', nome: 'A', serveAFaseDeInscricao: true, obrigatorio: true },
        { id: 'b', codigo: 'B', nome: 'B', serveAFaseDeInscricao: false, obrigatorio: true },
      ],
      modeloEscolhido: new Map([['LAUDO', 'a']]),
    };

    const [aba] = abasDoFormulario(entrada([laudo()], { textos }));

    expect(aba.recusada).toBe(true);
    expect(aba.recusaDaRemocao).toBe('Não pode.');
    expect(aba.modelos.map((modelo) => modelo.id)).toEqual(['b']);
    expect(aba.modeloEscolhido).toBe('');
  });

  it('sem fase escolhida, o formulário não tem fase e os documentos esperam por ela', () => {
    const [aba] = abasDoFormulario(entrada([laudo({ faseCodigo: '' })]));

    expect(aba.fase).toBe('');
    expect(aba.semFaseParaDocumentos).toBe(true);
    expect(aba.nomeDaFase).toBeNull();
  });
});

describe('o teclado nas abas', () => {
  it('as setas andam em círculo, Home e End vão às pontas, e outra tecla não troca de aba', () => {
    expect([abaPelaTecla('ArrowRight', 2, 3), abaPelaTecla('ArrowLeft', 0, 3)]).toEqual([0, 2]);
    expect([abaPelaTecla('Home', 2, 3), abaPelaTecla('End', 0, 3)]).toEqual([0, 2]);
    expect(abaPelaTecla('Enter', 1, 3)).toBeNull();
  });
});
