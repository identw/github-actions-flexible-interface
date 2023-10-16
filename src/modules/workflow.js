import Icons from './icons.js';
import DropLine from './dropLine.js';

class Workflow {
  constructor(li) {

    li.classList.add('GHflexible-workflow');
    const wIcon = Icons.workflow();
    wIcon.style.width = '15px';
    wIcon.style.height = '20px';

    const editIcon = Workflow.renameElement();
    editIcon.style.width = '15px';
    editIcon.style.height = '20px';

    li.prepend(wIcon);

    let name = li.children[1].children[0].innerText;
    li.setAttribute('data-ghflexible-name', name);
    li.setAttribute('data-ghflexible-rename', name);
    li.setAttribute('data-ghflexible-type', 'workflow');
    li.setAttribute('data-ghflexible-element-indent', '0');
    li.children[1].style.marginLeft = '0.3em';
    li.style.display = 'flex';
    li.style.outline = 'none';
    li.children[1].style.flex = '1';
    // li.children[1].style.paddingLeft = '0em';
    li.children[1].setAttribute('class', '');
    li.appendChild(editIcon);
    li.after((new DropLine()).html());

  }

  static renameElement() {
    const el = Icons.editButton();
    el.style.marginLeft = '0em';
    el.style.cursor = 'text';
    // el.style.display = 'inline-block';

    el.onmousedown = function (event) {
      event.stopPropagation();
      event.preventDefault();
      renameButton(el, event);
    }
    return el;
  }
}

export default Workflow;