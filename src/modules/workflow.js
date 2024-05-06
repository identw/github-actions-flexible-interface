class Workflow {
    static INDEX_NEW_GH_BUTTON = 2;
    static INDEX_EDIT_BUTTON   = 3;
    static INDEX_CHECKBOX      = 4;

    constructor(o) {
        this.original = o;
        this.hideNewGHButton();
    }

    getCheckBox() {
        return this.original.children[Workflow.INDEX_CHECKBOX];
    }

    getEditButton() {
        return this.original.children[Workflow.INDEX_EDIT_BUTTON];
    }

    hideEditButton() {
        this.original.children[Workflow.INDEX_EDIT_BUTTON].setAttribute('hidden', '');
    }

    unhideEditButton() {
        this.original.children[Workflow.INDEX_EDIT_BUTTON].removeAttribute('hidden');
    }

    hideNewGHButton() {
        this.original.children[Workflow.INDEX_NEW_GH_BUTTON].setAttribute('hidden', '');
    }

    static isWorkflow(element) {
        if (element.getAttribute('data-ghflexible-type') === 'workflow') {
            return true;
        }
        return false;
    }
}

export default Workflow;