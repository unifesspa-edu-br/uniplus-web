import { expect, it } from 'vitest';
import { exigencia, rascunho } from '../../../shared/exigencias/exigencias.testing';
import { documentosQueReferenciamAFase } from './referencias-do-prazo';

it('impede remover a fase indicada na validade', () => {
  const validade = {
    escolha: 'EXIGE_DOCUMENTO_VALIDO',
    referencia: { tipo: 'FIM_DA_FASE', data: null, faseCodigo: 'ISENCAO' },
    efeitoDoVencimento: 'RECUSAR_DOCUMENTO',
  };
  const documentos = rascunho(exigencia({ faseCodigo: 'HABILITACAO', validade }));
  expect(
    documentosQueReferenciamAFase(documentos, ['ISENCAO', 'HABILITACAO'], 'ISENCAO'),
  ).toHaveLength(1);
});
