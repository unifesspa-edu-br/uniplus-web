import { expect, it } from 'vitest';
import { exigencia, rascunho } from '../../../shared/exigencias/exigencias.testing';
import { documentosQueReferenciamAFase } from './referencias-do-prazo';

it('impede remover a fase indicada na validade', () => {
  const validade = {
    escolha: 'exigeDocumentoValido',
    referencia: { tipo: 'fimDaFase', data: null, faseCodigo: 'ISENCAO' },
    efeitoDoVencimento: 'recusarDocumento',
  };
  const documentos = rascunho(exigencia({ faseCodigo: 'HABILITACAO', validade }));
  expect(
    documentosQueReferenciamAFase(documentos, ['ISENCAO', 'HABILITACAO'], 'ISENCAO'),
  ).toHaveLength(1);
});
