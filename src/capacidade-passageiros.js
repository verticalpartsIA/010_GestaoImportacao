/* ============================================================
   capacidade-passageiros.js — regra única "kg → passageiros" (10/10/2026, pedido do Financeiro)
   Capacidade máx. (kg) é quem doa o dado. Passageiros = kg ÷ 75, arredondado PARA BAIXO (a norma
   usa 75 kg por pessoa; 630 kg = 8 passageiros, 750 kg = 10). Elevador de CARGA não leva pessoas:
   só a capacidade em kg importa, então não tem passageiros. Usada pelo Formulário, Cadastros →
   Atualização de Custos, Precificação e Proposta. window.CapacidadePassageiros
   ============================================================ */
(function () {
  const KG_POR_PASSAGEIRO = 75;
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const ehCarga = (tipo) => norm(tipo) === 'carga';
  /* null = não se aplica (carga, ou capacidade vazia/zero, ou menos de 1 pessoa) */
  function passageiros(kg, tipo) {
    if (ehCarga(tipo)) return null;
    const n = Number(kg);
    if (!(n > 0)) return null;
    const p = Math.floor(n / KG_POR_PASSAGEIRO);
    return p > 0 ? p : null;
  }
  /* "10 Passageiros x 750Kg" (carga ou sem passageiros: só "750Kg"); vazio sem capacidade */
  function textoCapacidade(kg, tipo) {
    const n = Number(kg);
    if (!(n > 0)) return '';
    const p = passageiros(n, tipo);
    return `${p ? p + ' Passageiros x ' : ''}${n}Kg`;
  }
  window.CapacidadePassageiros = { KG_POR_PASSAGEIRO, ehCarga, passageiros, textoCapacidade };
}());
