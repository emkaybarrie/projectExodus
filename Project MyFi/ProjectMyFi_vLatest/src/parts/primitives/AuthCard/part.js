export default async function mount(host, { ctx }){
  host.innerHTML = `
    <div class="Part-AuthCard AuthCard">
      <div class="AuthCard__title">Sign in (dummy)</div>
      <div class="AuthCard__body">
        This sets <code>localStorage["myfi.authed"] = "1"</code> then goes to Hub.
      </div>
      <button class="AuthCard__btn" type="button">Sign in</button>
      <button class="AuthCard__btnSecondary" type="button">Back</button>
    </div>
  `;

  const btn = host.querySelector('.AuthCard__btn');
  const back = host.querySelector('.AuthCard__btnSecondary');

  const onSignIn = () => {
    ctx?.session?.setAuthed?.(true);
    ctx?.navigate?.('hub');
  };
  const onBack = () => ctx?.navigate?.('start');

  btn.addEventListener('click', onSignIn);
  back.addEventListener('click', onBack);

  return {
    unmount(){
      btn.removeEventListener('click', onSignIn);
      back.removeEventListener('click', onBack);
      host.innerHTML = '';
    }
  };
}
