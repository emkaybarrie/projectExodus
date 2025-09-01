// js/TEMPLATE_menu.js
// How to use:
// 1) Copy → rename to something like "achievementsMenu.js"
// 2) Add <script src="./js/achievementsMenu.js"></script> after kit.js and modal.js
// 3) Use window.MyFiTemplateMenu in quickMenus, or call openChildItem() anywhere.

(function () {
  const { helper, field, select, primary, cancel, btnOpenItem, btnOpenMenu } = window.MyFiUI;

  // Renderers for each page in this menu
  function exampleRender() {
    const root = document.createElement('div');
    root.append(
      helper('<strong>Template Example</strong> — swap this for your content.'),
      field('Name', 'text', 'exName', { placeholder: 'Your name' }),
      select('Mode', 'exMode', [['relaxed','Relaxed'],['standard','Standard']]),
    );

    // Example: link to another menu’s item (Finances → Add Transaction)
    root.append(
      helper('Jump somewhere else:'),
      btnOpenItem('Go to Add Transaction', window.MyFiFinancesMenu, 'addTransaction', { menuTitle: 'Add Transaction' })
    );

    return [root];
  }

  function exampleFooter() {
    return [
      primary('Save', () => {
        const values = {};
        window.MyFiModal.el.contentEl
          .querySelectorAll('input,select,textarea')
          .forEach(i => values[i.id] = i.value);
        // TODO: do something with values
        window.MyFiModal.close();
      }),
      cancel('Close')
    ];
  }

  // The actual menu map
  const TemplateMenu = {
    example: {
      label: 'Example',
      title: 'Template • Example',
      preview: 'Short description shown in list/drilldown.',
      render: exampleRender,
      footer: exampleFooter,
    },
    // Add more items here...
  };

  // Expose for other code to use
  window.MyFiTemplateMenu = TemplateMenu;
})();
