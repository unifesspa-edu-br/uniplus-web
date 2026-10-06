import { divergenciasEntre } from './divergencias';
import type { AvaliacaoDoFormulario, CampoAvaliado } from './interpretador/regras-do-formulario';

const campo = (fatoCodigo: string, outros: Partial<CampoAvaliado> = {}): CampoAvaliado => ({
  fatoCodigo,
  etapaCodigo: 'DADOS',
  estado: 'RESOLVIDO',
  visivel: 'VERDADEIRO',
  obrigatorio: 'VERDADEIRO',
  restricoesVioladas: [],
  impedido: 'FALSO',
  opcoes: null,
  ...outros,
});
const avaliacao = (campos: CampoAvaliado[]): AvaliacaoDoFormulario => ({
  etapas: [],
  campos,
  grupos: [],
  termos: [],
});

describe('divergências entre o interpretador e o servidor', () => {
  it('aponta o campo e a propriedade que o interpretador decidiu diferente, sem contar a ordem das opções', () => {
    const local = avaliacao([
      campo('A', { opcoes: { codigos: ['X', 'Y'], definitivas: true } }),
      campo('B', { visivel: 'FALSO' }),
    ]);
    const servidor = avaliacao([
      campo('A', { opcoes: { codigos: ['Y', 'X'], definitivas: true } }),
      campo('B'),
    ]);

    expect(divergenciasEntre(local, servidor)).toEqual([
      {
        onde: 'Campo B',
        propriedade: 'visivel',
        interpretador: '"FALSO"',
        servidor: '"VERDADEIRO"',
      },
    ]);
  });
});
