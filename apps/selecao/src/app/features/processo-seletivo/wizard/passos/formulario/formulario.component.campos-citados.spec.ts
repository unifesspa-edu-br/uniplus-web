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

  it('o campo que uma exigência documental cita não sai, e o editor diz por quê', () => {
    const exigencia = {
      ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
    } as ExigenciaDeDocumento;
    store.patchSection('documentos', comExigencia({ raizes: [], emTodasAsFases: [] }, exigencia));
    fixture.detectChanges();

    expect(
      fixture.debugElement.injector
        .get(CamposPressupostosDoFormulario)
        .remocoesTravadas()
        .get('PCD'),
    ).toMatch(/^Não pode sair: o documento/);
    expect(host.textContent).toContain('Não pode sair: o documento');
  });

  it('o campo que a regra de uma modalidade ofertada cita não sai depois de gravar o quadro', () => {
    store.registrarRegrasDasModalidades({
      distribuicaoVagas: [
        {
          modalidades: [
            {
              codigo: 'AC_PCD',
              descricao: 'Pessoa com deficiência',
              regraDeAplicabilidade: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]],
            },
          ],
        },
      ],
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(
      fixture.debugElement.injector
        .get(CamposPressupostosDoFormulario)
        .remocoesTravadas()
        .get('PCD'),
    ).toBe(
      'Não pode sair: a regra de quem concorre em AC_PCD depende deste dado. Desfaça a dependência antes de remover o campo.',
    );
  });
});
