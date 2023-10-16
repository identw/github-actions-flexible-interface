class DropLine {
    constructor({ first } = { first: false }) {
        const el = document.createElement('li');
        el.setAttribute('data-ghflexible-dropable-line', '');
        el.classList.add('ActionList-item');
        el.classList.add('GHflexible-dropable');
        if (first) {
            el.classList.add('GHflexible-first-dropable');
        }
        this.el = el;
    }

    html() {
        return this.el;
    }
}

export default DropLine;