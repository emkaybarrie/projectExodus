export default async function mount(host, { kind }){
  host.innerHTML = `
    <div class="Part-EmptyCard EmptyCard">
      <div class="EmptyCard__title">Empty Surface</div>
      <div class="EmptyCard__body">Mounted part: <b>${kind}</b>. Ready to populate.</div>
    </div>
  `;
  return {
    unmount(){ host.innerHTML = ''; }
  };
}
