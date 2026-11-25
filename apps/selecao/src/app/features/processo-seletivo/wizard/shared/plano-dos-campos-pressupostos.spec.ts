import { describe, expect, it } from 'vitest';
import { CATALOGO } from '../passos/formulario/formulario-de-inscricao.testing';
import {
  formularioDoServidor,
  campoDoServidor,
  paginaDoServidor,
} from './formulario-do-servidor.testing';
import { dtoComCronograma } from './hidratacao.testing';
import { PlanoDosCamposPressupostos } from './plano-dos-campos-pressupostos';

const formulario = formularioDoServidor({
  faseId: 'fase-1',
  paginas: [paginaDoServidor('S1', 1)],
  coleta: { itens: [campoDoServidor('PCD', 1, 'S1')], grupos: [] },
});

function plano(citados: string[], comFormulario = true, comFase = true, outras: string[] = []) {
  const servidor = dtoComCronograma({
    formularios: comFormulario ? [formulario] : [],
    cronogramaFases: comFase ? [{ id: 'fase-1', faseCanonica: { coletaInscricao: true } }] : [],
  });
  return new PlanoDosCamposPressupostos(servidor, new Set(citados), CATALOGO, outras);
}

describe('plano dos campos pressupostos', () => {
  it('considera os fatos gravados e os coletados pelas outras finalidades', () => {
    const resultado = plano(['PCD', 'RENDA_FAMILIAR'], true, true, ['RENDA_FAMILIAR']);
    expect(resultado.coletaTudo()).toBe(true);
    expect(resultado.fatosNaoColetados()).toEqual([]);
    expect(resultado.desfechoSemGravar()).toEqual({ tipo: 'garantidos' });
  });

  it('identifica fatos não coletados e desconhecidos do catálogo', () => {
    const resultado = plano(['PCD', 'RENDA_FAMILIAR', 'DESCONHECIDO']);
    expect(resultado.coletaTudo()).toBe(false);
    expect(resultado.fatosNaoColetados()).toEqual(['RENDA_FAMILIAR', 'DESCONHECIDO']);
    expect(resultado.desconhecidosDoCatalogo()).toEqual(['DESCONHECIDO']);
    expect(resultado.desfechoSemGravar()).toBeNull();
  });

  it('recusa gravação que exige campo quando falta a fase de inscrição', () => {
    expect(plano(['RENDA_FAMILIAR'], false, false).desfechoSemGravar()).toEqual({
      tipo: 'semFaseDeInscricao',
    });
  });

  it('prepara a gravação sobre o formulário existente e sobre o recém-criado', () => {
    const existente = plano(['RENDA_FAMILIAR']);
    const novo = plano(['RENDA_FAMILIAR'], false);
    expect(existente.gravacaoSobre(formulario).servidor.faseId).toBe('fase-1');
    expect(
      existente.gravacaoSobre(formulario).desejado.conteudo.itens?.map((item) => item.fatoCodigo),
    ).toContain('RENDA_FAMILIAR');
    expect(novo.cabecalhoParaCriar().conteudo.itens).toEqual([]);
    expect(
      novo.gravacaoSobre(formulario).desejado.conteudo.itens?.map((item) => item.fatoCodigo),
    ).toContain('RENDA_FAMILIAR');
  });
});
