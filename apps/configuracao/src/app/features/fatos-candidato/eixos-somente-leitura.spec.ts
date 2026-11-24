import { eixosSomenteLeitura } from './eixos-somente-leitura';
import {
  agregado,
  corRaca,
  fonteCatalogo,
  tipoOpcao,
  valorUnico,
} from './fatos-candidato.fixtures';

describe('eixosSomenteLeitura', () => {
  it('não apresenta eixos herdados para um fato ausente ou declarado', () => {
    expect(eixosSomenteLeitura(null, 'AGREGADO')).toEqual([]);
    expect(eixosSomenteLeitura(corRaca, 'DECLARADO')).toEqual([]);
  });

  it('apresenta os rótulos recebidos para os eixos herdados', () => {
    const eixos = eixosSomenteLeitura(corRaca, 'AGREGADO');
    expect(eixos.map((eixo) => eixo.valor)).toEqual(
      expect.arrayContaining([tipoOpcao.rotulo, valorUnico.rotulo, fonteCatalogo.rotulo]),
    );
    expect(eixos.every((eixo) => eixo.origem === 'vem do fato de membro')).toBe(true);
  });

  it('omite a fonte e o formato ausentes', () => {
    const eixos = eixosSomenteLeitura(agregado, 'DERIVADO_POR_REGRA');
    expect(eixos.some((eixo) => eixo.rotulo === 'De onde vêm os valores')).toBe(false);
    expect(eixos.some((eixo) => eixo.rotulo === 'Formato do texto')).toBe(false);
    expect(eixos.every((eixo) => eixo.origem === 'vem do tipo de dado')).toBe(true);
  });
});
