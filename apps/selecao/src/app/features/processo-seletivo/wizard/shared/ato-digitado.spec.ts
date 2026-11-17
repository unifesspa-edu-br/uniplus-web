import { describe, expect, it } from 'vitest';

import type { AnexoDoEdital } from '../processo-seletivo.models';
import { rascunhoInicial } from '../rascunho-inicial';
import { temAtoDigitado } from './ato-digitado';

const vazio = rascunhoInicial().publicacao;

function anexo(parcial: Partial<AnexoDoEdital> = {}): AnexoDoEdital {
  return {
    id: 'local',
    nomeArquivo: 'cronograma.pdf',
    nome: 'Cronograma',
    progress: 100,
    fase: 'confirmado',
    documentoAPublicarId: '01960000-0000-7000-0000-0000000005d1',
    enviado: true,
    ...parcial,
  };
}

describe('temAtoDigitado', () => {
  it('a tela como nasceu não tem nada a perder', () => {
    expect(temAtoDigitado(vazio)).toBe(false);
  });

  it('campo só com espaços não conta como digitado', () => {
    expect(temAtoDigitado({ ...vazio, numero: '   ' })).toBe(false);
  });

  it('o número da publicação preenchido conta', () => {
    expect(temAtoDigitado({ ...vazio, numero: '07/2027' })).toBe(true);
  });

  it('um campo do ato preenchido conta', () => {
    expect(temAtoDigitado({ ...vazio, ato: { ...vazio.ato, orgao: 'REITORIA' } })).toBe(true);
  });

  it('o período de inscrição preenchido conta', () => {
    expect(temAtoDigitado({ ...vazio, periodoInscricaoFim: '2027-02-01T10:00' })).toBe(true);
  });

  it('o anexo confirmado conta', () => {
    expect(temAtoDigitado({ ...vazio, anexos: [anexo()] })).toBe(true);
  });

  it('o anexo em envio conta', () => {
    const emEnvio = anexo({ fase: 'enviando', progress: 40, documentoAPublicarId: undefined });

    expect(temAtoDigitado({ ...vazio, anexos: [emEnvio] })).toBe(true);
  });

  it('o anexo com erro conta', () => {
    expect(temAtoDigitado({ ...vazio, anexos: [anexo({ fase: 'erro' })] })).toBe(true);
  });
});
