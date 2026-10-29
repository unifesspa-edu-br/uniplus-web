import { rotuloDaUnidade } from './rotulo-da-unidade';

describe('rotuloDaUnidade', () => {
  it('junta a sigla e o nome com travessão', () => {
    expect(rotuloDaUnidade({ sigla: 'CEPS', nome: 'Centro de Processos Seletivos' })).toBe(
      'CEPS — Centro de Processos Seletivos',
    );
  });
});
