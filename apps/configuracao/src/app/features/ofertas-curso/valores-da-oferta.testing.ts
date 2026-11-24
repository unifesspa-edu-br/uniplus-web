import {
  FormatoPedagogicoCodigo,
  ProgramaDeOfertaCodigo,
  RegimeDeFuncionamentoCodigo,
  RegimeDeTurnoCodigo,
  TurnoOfertaCodigo,
} from '@uniplus/shared-data/configuracao';

export const valoresDaOferta = {
  programa: { codigo: ProgramaDeOfertaCodigo.REGULAR, rotulo: 'Regular' },
  formato: { codigo: FormatoPedagogicoCodigo.PRESENCIAL, rotulo: 'Presencial' },
  funcionamento: { codigo: RegimeDeFuncionamentoCodigo.EXTENSIVO, rotulo: 'Extensivo' },
  regime: { codigo: RegimeDeTurnoCodigo.REGULAR, rotulo: 'Regular' },
  intensivo: { codigo: RegimeDeFuncionamentoCodigo.INTENSIVO, rotulo: 'Intensivo' },
  alternancia: {
    codigo: RegimeDeFuncionamentoCodigo.ALTERNANCIA_PEDAGOGICA,
    rotulo: 'Alternância Pedagógica',
  },
  integral: { codigo: RegimeDeTurnoCodigo.INTEGRAL, rotulo: 'Integral' },
  parfor: { codigo: ProgramaDeOfertaCodigo.PARFOR, rotulo: 'PARFOR' },
  ead: { codigo: FormatoPedagogicoCodigo.EAD, rotulo: 'EAD' },
  turnos: [
    { codigo: TurnoOfertaCodigo.MATUTINO, rotulo: 'Matutino' },
    { codigo: TurnoOfertaCodigo.VESPERTINO, rotulo: 'Vespertino' },
    { codigo: TurnoOfertaCodigo.NOTURNO, rotulo: 'Noturno' },
  ],
} as const;

export const vocabulariosDaOferta = {
  'programas-oferta': [valoresDaOferta.programa, valoresDaOferta.parfor],
  'formatos-pedagogicos': [valoresDaOferta.formato, valoresDaOferta.ead],
  'regimes-turno': [valoresDaOferta.regime, valoresDaOferta.integral],
  'regimes-funcionamento': [
    valoresDaOferta.intensivo,
    valoresDaOferta.funcionamento,
    valoresDaOferta.alternancia,
  ],
  'turnos-oferta': valoresDaOferta.turnos,
} as const;
