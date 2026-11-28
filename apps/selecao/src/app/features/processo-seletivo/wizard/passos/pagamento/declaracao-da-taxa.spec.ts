import { FundamentoIsencaoCodigo } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../../processo-seletivo.models';
import {
  alternarFundamentoEscolhido,
  comandoDaTaxa,
  fundamentoSemSelecao,
  validarDeclaracaoDaTaxa,
} from './declaracao-da-taxa';

const CADASTRO_UNICO = 'CADASTRO_UNICO' as FundamentoIsencaoCodigo;
const MEDULA = 'DOACAO_MEDULA_OSSEA' as FundamentoIsencaoCodigo;

function pagamento(parcial: Partial<WizardDraft['pagamento']>): WizardDraft['pagamento'] {
  return { cobra: null, valor: '', fundamentos: [], ...parcial };
}

describe('declaração da taxa', () => {
  it('pede a declaração quando o processo ainda não disse se cobra', () => {
    expect(validarDeclaracaoDaTaxa(pagamento({}))).toEqual({
      valid: false,
      messages: ['Declare se o processo cobra taxa de inscrição.'],
    });
  });

  it('aceita o processo gratuito sem valor nem fundamento', () => {
    expect(validarDeclaracaoDaTaxa(pagamento({ cobra: false }))).toEqual({ valid: true });
  });

  it('recusa a taxa sem valor e sem fundamento, nesta ordem', () => {
    const resultado = validarDeclaracaoDaTaxa(pagamento({ cobra: true }));

    expect(resultado.valid).toBe(false);
    expect(resultado).toMatchObject({
      messages: [
        expect.stringContaining('Informe o valor'),
        'Selecione ao menos um fundamento de isenção.',
      ],
    });
  });

  it('recusa o valor igual a zero', () => {
    const resultado = validarDeclaracaoDaTaxa(
      pagamento({ cobra: true, valor: '0,00', fundamentos: [CADASTRO_UNICO] }),
    );

    expect(resultado).toEqual({
      valid: false,
      messages: ['O valor da taxa precisa ser maior que zero.'],
    });
  });

  it('aceita a taxa com valor e ao menos um fundamento', () => {
    const declaracao = pagamento({ cobra: true, valor: '35,00', fundamentos: [CADASTRO_UNICO] });

    expect(validarDeclaracaoDaTaxa(declaracao)).toEqual({ valid: true });
    expect(fundamentoSemSelecao(declaracao)).toBe(false);
  });

  it('aponta o fundamento ausente só para quem cobra', () => {
    expect(fundamentoSemSelecao(pagamento({ cobra: true }))).toBe(true);
    expect(fundamentoSemSelecao(pagamento({ cobra: false }))).toBe(false);
  });

  it('marca e desmarca o fundamento sem alterar a lista original', () => {
    const escolhidos = [CADASTRO_UNICO];

    expect(alternarFundamentoEscolhido(escolhidos, MEDULA)).toEqual([CADASTRO_UNICO, MEDULA]);
    expect(alternarFundamentoEscolhido(escolhidos, CADASTRO_UNICO)).toEqual([]);
    expect(escolhidos).toEqual([CADASTRO_UNICO]);
  });

  it('monta o comando com o valor numérico', () => {
    const comando = comandoDaTaxa(
      pagamento({ cobra: true, valor: '35,00', fundamentos: [CADASTRO_UNICO] }),
    );

    expect(comando).toEqual({ cobra: true, valor: 35, fundamentos: [CADASTRO_UNICO] });
  });

  it('monta o comando do processo gratuito com a resposta "não" como foi escolhida', () => {
    expect(comandoDaTaxa(pagamento({ cobra: false })).cobra).toBe(false);
  });

  it('não monta o comando enquanto a pergunta "cobra taxa" está em aberto', () => {
    expect(() => comandoDaTaxa(pagamento({ cobra: null }))).toThrow(
      'O comando só é montado depois de responder se o processo cobra taxa de inscrição.',
    );
  });
});
