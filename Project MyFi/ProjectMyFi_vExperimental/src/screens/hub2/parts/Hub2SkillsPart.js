export async function Hub2SkillsPart(host){
  host.innerHTML = `
    <section class="card hub2-skills">
      <div class="card-hd"><h3>Skills</h3><span class="muted">(placeholder)</span></div>
      <div class="skills-grid">
        <button class="slot locked" title="Locked"></button>
        <button class="slot locked" title="Locked"></button>
        <button class="slot locked" title="Locked"></button>
        <button class="slot locked" title="Locked"></button>
      </div>
    </section>
  `;
  return { unmount(){ host.innerHTML=''; } };
}
