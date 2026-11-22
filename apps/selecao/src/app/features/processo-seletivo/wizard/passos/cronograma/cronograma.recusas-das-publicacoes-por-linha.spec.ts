import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  type ErroDaFase,
} from './cronograma-recusas-das-fases.testing';

const SEM_ATO = 'uniplus.selecao.produto_da_fase.ato_nao_encontrado_no_catalogo';
const NOTA_A_CONFERIR = 'conferida de novo na próxima gravação';
const daLinha = (posicao: number, campo: string, mensagem = 'Sem ato.'): ErroDaFase => ({
  field: `fases[0].produtos[${posicao}]${campo}`,
  code: SEM_ATO,
  message: mensagem,
});

describe('CronogramaPassoComponent: recusas da gravação às linhas da lista de publicações', () => {
  let nativo: ContextoDoCronograma['nativo'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let declararRegraDeRecurso: AjudantesDeRecusasDasFases['declararRegraDeRecurso'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({ nativo, detectar, comFases, comUmaEtapa, proximoPasso, cronograma } = tela);
    ({ recusarFases, declararRegraDeRecurso, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  const recusar = async (...erros: ErroDaFase[]) => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    declararRegraDeRecurso();
    return recusarFases(erros);
  };

  const invalido = (sufixo: string): string | null =>
    nativo.querySelector(`#fase-AVALIACAO-${sufixo}`)?.getAttribute('aria-invalid') ?? null;

  const descrito = (sufixo: string): string[] =>
    (
      nativo.querySelector(`#fase-AVALIACAO-${sufixo}`)?.getAttribute('aria-describedby') ?? ''
    ).split(' ');

  const focoDepoisDeRecusar = async (...erros: ErroDaFase[]): Promise<string | undefined> => {
    await recusar(...erros);
    await proximoPasso();
    detectar();
    return document.activeElement?.id;
  };

  it('mostra as duas recusas do mesmo código a linhas diferentes, cada uma na sua linha', async () => {
    await recusar(daLinha(0, '.atoCodigo', 'Sem ato na primeira.'), daLinha(1, '.atoCodigo'));

    expect(bloco('fase-AVALIACAO-produto-0-erro')).toContain('Sem ato na primeira.');
    expect(bloco('fase-AVALIACAO-produto-1-erro')).toContain('Sem ato.');
    expect(bloco('fase-AVALIACAO-produto-1-erro')).not.toContain('Sem ato na primeira.');
  });

  it('marca como inválida só a publicação da linha recusada', async () => {
    await recusar(daLinha(1, '.atoCodigo'));

    expect(invalido('produto-ato-1')).toBe('true');
    expect(invalido('produto-ato-0')).toBeNull();
    expect(invalido('produto-papel-1')).toBeNull();
  });

  it('marca como inválido o papel da linha quando a recusa é ao papel', async () => {
    await recusar(daLinha(1, '.papel', 'Papel não aceito.'));

    expect(invalido('produto-papel-1')).toBe('true');
    expect(invalido('produto-ato-1')).toBeNull();
    expect(invalido('produto-papel-0')).toBeNull();
    expect(bloco('fase-AVALIACAO-produto-1-erro')).toContain('Papel não aceito.');
  });

  it('descreve só a publicação da linha pela recusa à publicação dela', async () => {
    await recusar(daLinha(1, '.atoCodigo'));

    expect(descrito('produto-ato-1')).toContain('fase-AVALIACAO-produto-1-publicacao-erro');
    expect(descrito('produto-papel-1')).not.toContain('fase-AVALIACAO-produto-1-publicacao-erro');
    expect(descrito('produto-ato-0')).not.toContain('fase-AVALIACAO-produto-1-publicacao-erro');
  });

  it('descreve só o papel da linha pela recusa ao papel dela', async () => {
    await recusar(daLinha(1, '.papel', 'Papel não aceito.'));

    expect(descrito('produto-papel-1')).toContain('fase-AVALIACAO-produto-1-papel-erro');
    expect(descrito('produto-ato-1')).not.toContain('fase-AVALIACAO-produto-1-papel-erro');
    expect(bloco('fase-AVALIACAO-produto-1-publicacao-erro')).toBeNull();
  });

  describe('recusa à lista inteira de publicações', () => {
    const daLista = {
      field: 'fases[0].produtos',
      code: 'uniplus.selecao.processo_seletivo.fase_com_preliminar_sem_definitivo',
      message: 'Falta o resultado definitivo.',
    };

    it('mostra a recusa abaixo da lista e marca a publicação de cada linha como inválida', async () => {
      await recusar(daLista);

      expect(bloco('fase-AVALIACAO-produtos-erro')).toContain('Falta o resultado definitivo.');
      expect(invalido('produto-ato-0')).toBe('true');
      expect(invalido('produto-ato-1')).toBe('true');
    });

    it('é descrita pela publicação e pelo papel de cada linha', async () => {
      await recusar(daLista);

      expect(descrito('produto-ato-0')).toContain('fase-AVALIACAO-produtos-erro');
      expect(descrito('produto-papel-1')).toContain('fase-AVALIACAO-produtos-erro');
    });

    it('deixa de marcar a publicação como inválida quando passa a ser conferida de novo', async () => {
      await recusar(daLista);

      cronograma.fases.at(0).controls.fim.setValue('2026-04-01T18:00');
      detectar();

      expect(invalido('produto-ato-0')).toBeNull();
      expect(bloco('fase-AVALIACAO-produtos-erro')).toContain(NOTA_A_CONFERIR);
    });
  });

  it('leva a recusa à linha inteira, sem campo próprio, à publicação dela', async () => {
    await recusar(daLinha(1, ''));

    expect(invalido('produto-ato-1')).toBe('true');
    expect(bloco('fase-AVALIACAO-produto-1-erro')).toContain('Sem ato.');
  });

  it('leva o foco à publicação da linha recusada, e não à primeira', async () => {
    expect(await focoDepoisDeRecusar(daLinha(1, '.atoCodigo'))).toBe(
      'fase-AVALIACAO-produto-ato-1',
    );
  });

  it('leva o foco ao papel da linha recusada', async () => {
    expect(await focoDepoisDeRecusar(daLinha(1, '.papel'))).toBe('fase-AVALIACAO-produto-papel-1');
  });

  it('põe na lista a recusa à linha que a fase enviada não tinha', async () => {
    await recusar(daLinha(7, '.atoCodigo', 'Linha que não existe.'));

    expect(bloco('fase-AVALIACAO-produtos-erro')).toContain('Linha que não existe.');
    expect(bloco('fase-AVALIACAO-produto-7-erro')).toBeNull();
  });

  describe('depois de alterar a fase, quando a recusa passa a ser conferida de novo', () => {
    const alterarOFim = () => {
      cronograma.fases.at(0).controls.fim.setValue('2026-04-01T18:00');
      detectar();
    };

    it('sobe a recusa da linha para o bloco da lista, com a nota, e a tira da linha', async () => {
      await recusar(daLinha(1, '.atoCodigo'));
      expect(bloco('fase-AVALIACAO-produto-1-erro')).toContain('Sem ato.');

      alterarOFim();

      expect(bloco('fase-AVALIACAO-produto-1-erro')).toBeNull();
      expect(bloco('fase-AVALIACAO-produtos-erro')).toContain('Sem ato.');
      expect(bloco('fase-AVALIACAO-produtos-erro')).toContain(NOTA_A_CONFERIR);
    });

    it('deixa de marcar a publicação como inválida', async () => {
      await recusar(daLinha(1, '.atoCodigo'));
      expect(invalido('produto-ato-1')).toBe('true');

      alterarOFim();

      expect(invalido('produto-ato-1')).toBeNull();
    });
  });
});
