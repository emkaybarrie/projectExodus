export default async function mount(host, { ctx }){
  host.innerHTML = `
    <div class="Part-StartCard StartCard">
      <div class="StartCard__title">Project MyFi</div>
      <div class="StartCard__body">
        A blank-slate skeleton. Start → Auth → Hub.
      </div>
      <button class="StartCard__btn" type="button">Tap to Start</button>
    </div>
  `;

  const btn = host.querySelector('.StartCard__btn');
  const onClick = () => ctx?.navigate?.('auth');
  btn.addEventListener('click', onClick);

  return {
    unmount(){
      btn.removeEventListener('click', onClick);
      host.innerHTML = '';
    }
  };
}
