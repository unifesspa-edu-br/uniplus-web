import { FinalidadeFormularioCodigo } from '@uniplus/shared-data/configuracao';

const ROTULOS: Record<FinalidadeFormularioCodigo, string> = {
  [FinalidadeFormularioCodigo.INSCRICAO]: 'Inscrição',
  [FinalidadeFormularioCodigo.ISENCAO_TAXA]: 'Isenção da taxa de inscrição',
  [FinalidadeFormularioCodigo.HABILITACAO]: 'Habilitação',
};

export const FINALIDADES_DO_FORMULARIO = Object.values(FinalidadeFormularioCodigo).map(
  (codigo) => ({
    codigo,
    rotulo: ROTULOS[codigo],
  }),
);
