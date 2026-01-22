// ---FILE: src/parts/HubShell/part.js
export async function mount(ctx){
  const { hooks, vm, actions } = ctx;

  // Populate header from VM if available
  const hub = vm?.hub || vm || {};
  if(hooks.headerTitle) hooks.headerTitle.textContent = hub.title || "Hub";
  if(hooks.headerSubtitle) hooks.headerSubtitle.textContent = hub.subtitle || "—";

  if(hooks.footerLeft) hooks.footerLeft.textContent = "MyFi Forge v1";
  if(hooks.footerRight) hooks.footerRight.textContent = new Date().toLocaleString();

  const btnLeft = hooks.headerBtnLeft;
  const btnRight = hooks.headerBtnRight;

  if(btnLeft){
    btnLeft.addEventListener("click", () => {
      actions.toast("Ping ✅ (runtime alive)");
    });
  }
  if(btnRight){
    btnRight.addEventListener("click", () => {
      actions.navigate("hub");
    });
  }
}
