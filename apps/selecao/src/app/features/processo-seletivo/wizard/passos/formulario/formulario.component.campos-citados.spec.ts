import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento } from '../../processo-seletivo.models';
import { comExigencia, exigenciaNova } from '../../shared/exigencias/exigencias-documentais';
import { usarPasso, type ContextoDoPasso } from './formulario-passo.testing';
import { CamposPressupostosDoFormulario } from './servicos/campos-pressupostos-do-formulario.service';

describe('FormularioPassoComponent: campos citados por outras partes do processo', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let host: ContextoDoPasso['host'];

  usarPasso((contexto) => {
    ({ fixture, store, host } = contexto);
  });

  const botaoDeRemoverPcd = () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="Remover o campo PCD"]');
  const pcdNoFormulario = () =>
    store.draft().formulario.conteudo.itens?.some((item) => item.fatoCodigo === 'PCD') ?? false;
  const motivoDaTrava = () =>
    fixture.debugElement.injector.get(CamposPressupostosDoFormulario).remocoesTravadas().get('PCD');

  function documentoQueCitaPcd(): void {
    const exigencia = {
      ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
    } as ExigenciaDeDocumento;
    store.patchSection('documentos', comExigencia({ raizes: [], emTodasAsFases: [] }, exigencia));
  }

  function modalidadeQueCitaPcd(): void {
    const regraDeAplicabilidade = [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]];
    store.registrarRegrasDasModalidades({
      distribuicaoVagas: [
        {
          modalidades: [
            { codigo: 'AC_PCD', descricao: 'Pessoa com deficiência', regraDeAplicabilidade },
          ],
        },
      ],
    } as unknown as ProcessoSeletivoDto);
  }

  function tentarRemoverPcd(): void {
    botaoDeRemoverPcd()?.click();
    fixture.detectChanges();
  }

  it('o campo que uma exigência documental cita não sai, e o editor diz por quê', () => {
    documentoQueCitaPcd();
    fixture.detectChanges();

    tentarRemoverPcd();

    expect(motivoDaTrava()).toMatch(/^Não pode sair: o documento/);
    expect(host.textContent).toContain('Não pode sair: o documento');
    expect(botaoDeRemoverPcd()?.disabled).toBe(true);
    expect(pcdNoFormulario()).toBe(true);
  });

  it('o campo que a regra de uma modalidade ofertada cita não sai depois de gravar o quadro', () => {
    modalidadeQueCitaPcd();
    fixture.detectChanges();

    tentarRemoverPcd();

    expect(motivoDaTrava()).toContain('a regra de quem concorre em AC_PCD depende deste dado');
    expect(botaoDeRemoverPcd()?.disabled).toBe(true);
    expect(pcdNoFormulario()).toBe(true);
  });
});
