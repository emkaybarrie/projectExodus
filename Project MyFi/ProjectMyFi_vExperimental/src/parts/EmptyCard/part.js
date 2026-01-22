// ---FILE: src/parts/EmptyCard/part.js
export async function mount(ctx){
  const { hooks, vm, actions } = ctx;

  // vm slice may be hub or anything; handle gracefully
  const title = vm?.title || "EmptyCard";
  const subtitle = vm?.subtitle || "This is a safe placeholder part.";

  hooks.title.textContent = title;
  hooks.body.textContent = subtitle;

  if(hooks.btn){
    hooks.btn.addEventListener("click", () => {
      actions.toast(`EmptyCard says hi 👋 (${title})`);
    });
  }
}
