import { describe, expect, it } from 'vitest';

import { eventoDoEditalDeAbertura } from './publicacoes.model';
import type { Publicacao } from './publicacoes.model';

const base: Omit<Publicacao, 'historico'> = {
  id: 'certame-1',
  numeroEdital: '001/2026',
  titulo: 'Certame de teste',
  descricao: '',
  situacao: 'inscricoesAbertas',
  dataPublicacao: '2026-01-05T12:00:00Z',
};

describe('eventoDoEditalDeAbertura', () => {
  it('retorna undefined quando não há publicação', () => {
    expect(eventoDoEditalDeAbertura(undefined)).toBeUndefined();
  });

  it('retorna undefined quando o evento `edital` não tem documento', () => {
    const publicacao: Publicacao = {
      ...base,
      historico: [
        { id: 'evt-1', categoria: 'edital', data: '2026-01-05T12:00:00Z', titulo: 'Edital publicado' },
      ],
    };

    expect(eventoDoEditalDeAbertura(publicacao)).toBeUndefined();
  });

  it('retorna o evento mais antigo com documento, mesmo havendo uma retificação posterior', () => {
    const publicacao: Publicacao = {
      ...base,
      historico: [
        {
          id: 'evt-retificacao',
          categoria: 'edital',
          data: '2026-01-10T12:00:00Z',
          titulo: 'Retificação do edital',
          documentoArquivo: 'retificacao.pdf',
        },
        {
          id: 'evt-abertura',
          categoria: 'edital',
          data: '2026-01-05T12:00:00Z',
          titulo: 'Edital publicado',
          documentoArquivo: 'edital.pdf',
        },
      ],
    };

    expect(eventoDoEditalDeAbertura(publicacao)?.id).toBe('evt-abertura');
  });
});
