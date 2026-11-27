import { describe, expect, it } from 'vitest';

import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: documentos exigidos que aguardam formulário', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  const aviso = () => tela.nativo.querySelector('p.alert--info')?.textContent ?? '';

  it('avisa que os documentos serão gravados com os formulários e que recarregar os perde', () => {
    tela.store.documentosExigidosAguardandoFormulario.set(true);
    tela.detectar();

    expect(aviso()).toContain('serão gravados quando você gravar os Formulários');
    expect(aviso()).toContain('Se recarregar a página antes disso, eles se perdem');
  });

  it('não avisa quando nada aguarda', () => {
    tela.detectar();

    expect(aviso()).toBe('');
  });
});
