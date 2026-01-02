export async function Hub2HeaderPart(host, { ctx }){
  host.innerHTML = `
    <section class="card hub2-intro">
      <h2 class="hub2-title">Vitals</h2>
      <p class="hub2-sub">JSON-first Hub rebuild (Studio dry-run). Uses the same Vitals feature pack model.</p>
    </section>
  `;
  return { unmount(){ host.innerHTML=''; } };
}
