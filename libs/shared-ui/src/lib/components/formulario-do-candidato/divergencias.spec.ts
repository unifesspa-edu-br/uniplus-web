import { divergenciasEntre } from './divergencias';
import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  GrupoAvaliado,
} from './interpretador/regras-do-formulario';

const REGRAS_DO_CAMPO: CampoAvaliado['regras'] = {
  visivel: 'VERDADEIRO',
  obrigatorio: 'VERDADEIRO',
  restricoesVioladas: [],
  impedido: 'FALSO',
};
const campo = (fatoCodigo: string, outros: Partial<CampoAvaliado> = {}): CampoAvaliado => ({
  fatoCodigo,
  etapaCodigo: 'DADOS',
  estado: 'RESOLVIDO',
  regras: REGRAS_DO_CAMPO,
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
      campo('B', { regras: { ...REGRAS_DO_CAMPO, visivel: 'FALSO' } }),
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

  it('aponta a contagem do grupo e o campo da ocorrência que o interpretador decidiu diferente', () => {
    const grupo = (contagemValida: boolean, estado: string): GrupoAvaliado => ({
      codigo: 'FAMILIA',
      etapaCodigo: 'DADOS',
      estado: 'RESOLVIDO',
      regras: { visivel: 'VERDADEIRO', obrigatorio: 'VERDADEIRO' },
      ocorrencias: {
        contagemValida,
        ocorrenciaDoCandidatoValida: true,
        lista: [{ id: 'm1', estado: 'RESOLVIDO', campos: [campo('RENDA', { estado })] }],
      },
    });
    const com = (g: GrupoAvaliado): AvaliacaoDoFormulario => ({ ...avaliacao([]), grupos: [g] });

    expect(
      divergenciasEntre(com(grupo(false, 'PENDENTE')), com(grupo(true, 'RESOLVIDO'))).map((d) => [
        d.onde,
        d.propriedade,
      ]),
    ).toEqual([
      ['Grupo FAMILIA', 'contagemValida'],
      ['Grupo FAMILIA, ocorrência m1, Campo RENDA', 'estado'],
    ]);
  });
});
