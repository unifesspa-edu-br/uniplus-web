import type { PassoDoFormulario } from './formulario-do-candidato.model';
import {
  anunciarMudancaDasModalidades,
  type ModalidadesAvaliadas,
  secoesQueDefinemAsModalidades,
} from './modalidades-avaliadas';

const AMPLA = { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 };
const PCD = { codigo: 'AC_PCD', nome: 'Pessoa com deficiência', ordem: 1 };

const concorre = (...itens: (typeof AMPLA)[]): ModalidadesAvaliadas => ({
  derivada: true,
  situacao: 'CONCORRE',
  itens,
  pendencias: [],
});

describe('anunciarMudancaDasModalidades', () => {
  it('diz o que entrou e o que saiu entre dois conjuntos', () => {
    expect(anunciarMudancaDasModalidades(concorre(AMPLA, PCD), concorre(AMPLA))).toBe(
      'Você deixou de concorrer em: Pessoa com deficiência.',
    );
    expect(anunciarMudancaDasModalidades(concorre(PCD), concorre(AMPLA))).toBe(
      'Você passou a concorrer em: Ampla concorrência; deixou de concorrer em: Pessoa com deficiência.',
    );
  });

  it('não anuncia quando falta responder: o conjunto ainda não é conhecido', () => {
    const faltando: ModalidadesAvaliadas = { ...concorre(), situacao: 'FALTA_RESPONDER' };

    expect(anunciarMudancaDasModalidades(faltando, concorre(AMPLA))).toBe('');
    expect(anunciarMudancaDasModalidades(concorre(AMPLA), faltando)).toBe('');
  });

  it('passar a não concorrer em nada também é mudança', () => {
    const nenhuma: ModalidadesAvaliadas = { ...concorre(), situacao: 'NAO_CONCORRE' };

    expect(anunciarMudancaDasModalidades(concorre(AMPLA), nenhuma)).toBe(
      'Você deixou de concorrer em: Ampla concorrência.',
    );
  });
});

describe('secoesQueDefinemAsModalidades', () => {
  const passo = (
    chave: string,
    campos: string[],
    grupos: string[] = [],
    bloco: string | null = null,
  ): PassoDoFormulario =>
    ({
      chave,
      titulo: chave,
      bloco,
      campos: campos.map((fatoCodigo) => ({ campo: { fatoCodigo } })),
      grupos: grupos.map((codigo) => ({ grupo: { codigo } })),
    }) as unknown as PassoDoFormulario;

  it('pega a seção do campo e a do grupo cujo subitem decide, e nunca um bloco do sistema', () => {
    const passos = [
      passo('contato', ['EMAIL']),
      passo('reserva', ['CONCORRER_EP']),
      passo('familia', [], ['FAMILIA']),
      passo('modalidades', ['CONCORRER_EP'], [], 'MODALIDADES_CALCULADAS'),
    ];

    expect(
      secoesQueDefinemAsModalidades(passos, {
        fatos: ['CONCORRER_EP', 'FAMILIA.RENDA'],
        grupos: [],
      }).map((s) => s.chave),
    ).toEqual(['reserva', 'familia']);
  });
});
