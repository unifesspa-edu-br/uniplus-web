import { of } from 'rxjs';
import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { FormaAceiteCodigo } from '@uniplus/shared-data/configuracao';

export const formasDeAceite = {
  definir: { codigo: FormaAceiteCodigo.A_DEFINIR, rotulo: 'A definir' },
  comLog: {
    codigo: FormaAceiteCodigo.REGISTRO_COM_ENDERECO_IP,
    rotulo: 'Registro digital (com log de IP)',
  },
  semLog: {
    codigo: FormaAceiteCodigo.REGISTRO_SEM_ENDERECO_IP,
    rotulo: 'Registro digital (sem log de IP)',
  },
} as const;

export const provedorDeFormasDeAceite = {
  provide: VocabulariosDeConfiguracaoApi,
  useValue: { listar: () => of({ ok: true, data: Object.values(formasDeAceite) }) },
};
