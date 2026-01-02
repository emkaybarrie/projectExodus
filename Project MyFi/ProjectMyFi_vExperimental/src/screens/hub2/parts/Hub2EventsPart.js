export async function Hub2EventsPart(host){
  host.innerHTML = `
    <section class="card hub2-events">
      <div class="card-hd"><h3>Events</h3><span class="muted">(placeholder)</span></div>
      <div class="events-list">
        <div class="event">No events wired yet. This part exists to prove slot/part composition for Hub.</div>
      </div>
    </section>
  `;
  return { unmount(){ host.innerHTML=''; } };
}
