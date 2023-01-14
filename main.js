const SELECTOR_ACTIONS = 'ul.ActionList.ActionList--subGroup';
const actionList =  document.querySelector(SELECTOR_ACTIONS);
// document.querySelector('div.PageLayout-columns').style.gridTemplateColumns = 'none';


let actionListHtml = document.querySelector(SELECTOR_ACTIONS);
// console.log(actionListHtml.children[10].getAttribute('hidden'));

( async () => {
    await waitClickShowWorkflows();
    let actionListHtml = document.querySelector(SELECTOR_ACTIONS);

    let allWorkflowsUl = document.querySelector('ul.ActionList');
    // allWorkflowsLi.children[0].style.display = "inline";
    allWorkflowsUl.children[1].after(editButtonIcon());

    let folderProd = folderCreate("prod");
    let folderStand = folderCreate("stand");
    let folderOther = folderCreate("other");
    actionListHtml.prepend(folderOther);
    actionListHtml.prepend(folderStand);
    actionListHtml.prepend(folderProd);
    
    
    // читаем все доступные workflows
    let workflows = {};
    actionListHtml = document.querySelector(SELECTOR_ACTIONS);

    for (let i = 0; i < actionListHtml.children.length; i++) {

        let li = actionListHtml.children[i];
        if (li.getAttribute('data-test-selector') != 'workflows-show-more') {
            // let name = li.children[0].children[0].innerText;
            // workflows[name] = {
            //     li: {
            //         dataItemId: li.getAttribute('data-item-id'),
            //         class: li.getAttribute('class'),
            //     },
            //     a: {
            //         href: li.children[0].getAttribute('href'),
            //         class: li.children[0].getAttribute('class'),
            //     },
            //     span: {
            //         class: li.children[0].children[0].getAttribute('class'),
            //     }

            // }

            
            if (li.classList.contains('GHflexible-dir')) {
                let name = li.children[1].innerText;
                li.setAttribute('data-ghflexible-name', name);
                li.children[1].appendChild(renameElement());
            } else {
                li.classList.add('GHflexible-workflow');
                let name = li.children[0].children[0].innerText;
                li.setAttribute('data-ghflexible-name', name);
                li.setAttribute('data-ghflexible-type', 'workflow');
                li.setAttribute('data-ghflexible-element-indent', '0');
                li.children[0].style.display = 'inline';
                li.appendChild(renameElement());
                

                let a = li.children[0];
                a.onclick = function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                };
            }
            

            if (!li.classList.contains('GHflexible-dropable')) {
                li.classList.add('GHflexible-dropable');
            }

            // Отключаем браузерный drag
            li.ondragstart = function () {
                return false;
            };

            let saveLiStyle = Object.assign({}, li.style);

            li.oncontextmenu = function(event) {
                event.stopPropagation();
                event.preventDefault()
                console.log('##### ONCONTEXTMENU ###');
            }

            li.onmousedown = function(event) {
                event.stopPropagation();
                event.preventDefault();

                if (event.which === 3) {
                    return;
                }

                let actionListHtml = document.querySelector(SELECTOR_ACTIONS);
                let indexLi = indexInActions(actionListHtml, li.getAttribute('data-ghflexible-name'));
                console.log(`### index: ${indexLi}`);

                // запоминаем позицию курсора
                // передвижение так чтобы объект не центрировался под курсором. Странные баги поэтому отключил это
                // let shiftX = event.clientX - li.getBoundingClientRect().left;
                // let shiftY = event.clientY - li.getBoundingClientRect().top;

                // разместить поверх остального содержимого и в абсолютных координатах
                li.style.position = 'absolute';
                li.style.zIndex = 1000;
                // переместим в body, чтобы li был точно не внутри position:relative
                document.body.append(li);
                
                moveAt(event.pageX, event.pageY);
                
                // передвинуть li под координаты курсора
                // и сдвинуть на половину ширины/высоты для центрирования
                function moveAt(pageX, pageY) {
                    // передвижение так чтобы объект не центрировался под курсором. Странные баги поэтому отключил это
                    // li.style.left = pageX - shiftX + 'px';
                    // li.style.top = pageY - shiftY + 'px';
                    li.style.left = pageX - li.offsetWidth / 2 + 'px';
                    li.style.top = pageY - li.offsetHeight / 2 + 'px';
                }

                let currentDroppable = null;
                

                function onMouseMove(event) {
                    moveAt(event.pageX, event.pageY);
                    
                    // обработка целей куда можно дропать объект
                    li.hidden = true;
                    let elemBelow = document.elementFromPoint(event.clientX, event.clientY);
                    li.hidden = false;

                    if (!elemBelow) return;
                    // console.log(elemBelow);

                    // потенциальные цели переноса помечены классом droppable (может быть и другая логика)
                    let droppableBelow = elemBelow.closest('.GHflexible-dropable');

                    if (currentDroppable != droppableBelow) {
                        if (currentDroppable) {
                            // логика обработки процесса "вылета" из GHflexible-dropable (удаляем подсветку)
                        }
                        currentDroppable = droppableBelow;
                        if (currentDroppable) {
                            // логика обработки процесса, когда мы "влетаем" в элемент GHflexible-dropable
                        }
                    }
                }
                
                document.addEventListener('mousemove', onMouseMove);

                li.onmouseup = function() {
                    document.removeEventListener('mousemove', onMouseMove);
                    li.onmouseup = null;

                    // возвращаем старый стиль
                    li.style = Object.assign({}, saveLiStyle);
                    if (currentDroppable) {
                        if (checkFolder(currentDroppable)) {
                            currentDroppable.children[2].appendChild(li);
                            folderReset(currentDroppable);

                            let indents = countIndents(li);
                            console.log(`#### PUT AFTER FOLDER: ${indents} ######`);
                            setIndents(li, indents);

                        } else if (checkWorkflow(currentDroppable)) {
                           
                            currentDroppable.after(li);
                            let indents = countIndents(li);
                            console.log(`#### PUT AFTER WORKFLOW: ${indents} ######`);
                            setIndents(li, indents);
                        } else {
                            console.log('#### IS ???? ####');
                            console.log(currentDroppable);
                        }
                        moveActionListBlock();

                     } else {
                        console.log(`#### PUT IN ROOT FOLDER ######`);
                        if (indexLi == 0) {
                            actionListHtml.prepend(li);
                        } else if (indexLi > 0) {
                            actionListHtml.children[indexLi - 1].after(li);
                        } else {
                            actionListHtml.appendChild(li);
                        }
                        moveActionListBlock();
                    }

                };
            };
        }
    }

    moveActionListBlock();
})();


function searchShowWorkflows() {
    let actionListHtml = document.querySelector(SELECTOR_ACTIONS);
    let showWorkflows = false;
    for (let i = 0; i < actionListHtml.children.length; i++) {
        let li = actionListHtml.children[i];
        if (li.getAttribute('data-test-selector') == 'workflows-show-more' && li.getAttribute('hidden') === null) {
            showWorkflows = li.children[0];
        }
    }
    return showWorkflows;
}

function promiseSetTimeout(timeout) {
    return new Promise((res, reject) => {
        setTimeout(() => {
            res("result");
        }, timeout)
    });
}

async function waitClickShowWorkflows() {
    let showWorkflows = true;

    let i = 0;
    while(showWorkflows && i < 100) {
        await promiseSetTimeout(1000);
        showWorkflows = searchShowWorkflows();
        if (showWorkflows && showWorkflows !== true) {
            showWorkflows.click();
        }
        i++;
    }
}

function indexInActions(actionList, name) {
    for (let i = 0; i < actionList.children.length; i++) {
        let element = actionList.children[i];
        let elementName = element.getAttribute('data-ghflexible-name');

        if (name == elementName) {
            return i;
        }
    }
}

function getIndexInChildren(parent, element) {
    for (let i = 0; i < parent.children.length; i++) {
        let el = parent.children[i];
        if (element == el) {
            return i;
        }
    }
}

function editButtonIcon() {
    const li = document.createElement('li');
    const icon = document.createElement('svg');
    icon.innerHTML = `<svg fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="15px" height="15px" viewBox="0 0 494.936 494.936"  xml:space="preserve"><g><g><path d="M389.844,182.85c-6.743,0-12.21,5.467-12.21,12.21v222.968c0,23.562-19.174,42.735-42.736,42.735H67.157c-23.562,0-42.736-19.174-42.736-42.735V150.285c0-23.562,19.174-42.735,42.736-42.735h267.741c6.743,0,12.21-5.467,12.21-12.21s-5.467-12.21-12.21-12.21H67.157C30.126,83.13,0,113.255,0,150.285v267.743c0,37.029,30.126,67.155,67.157,67.155h267.741c37.03,0,67.156-30.126,67.156-67.155V195.061C402.054,188.318,396.587,182.85,389.844,182.85z"/><path d="M483.876,20.791c-14.72-14.72-38.669-14.714-53.377,0L221.352,229.944c-0.28,0.28-3.434,3.559-4.251,5.396l-28.963,65.069c-2.057,4.619-1.056,10.027,2.521,13.6c2.337,2.336,5.461,3.576,8.639,3.576c1.675,0,3.362-0.346,4.96-1.057l65.07-28.963c1.83-0.815,5.114-3.97,5.396-4.25L483.876,74.169c7.131-7.131,11.06-16.61,11.06-26.692C494.936,37.396,491.007,27.915,483.876,20.791z M466.61,56.897L257.457,266.05c-0.035,0.036-0.055,0.078-0.089,0.107l-33.989,15.131L238.51,247.3c0.03-0.036,0.071-0.055,0.107-0.09L447.765,38.058c5.038-5.039,13.819-5.033,18.846,0.005c2.518,2.51,3.905,5.855,3.905,9.414C470.516,51.036,469.127,54.38,466.61,56.897z"/></g></g></svg>`;
    ;
    
    const div = document.createElement('div');
    div.style.marginLeft = 'auto';

    const divIco = document.createElement('div');

    divIco.appendChild(icon.firstChild);
    div.appendChild(divIco);
    li.appendChild(div);
    li.setAttribute('class', 'ActionList-sectionDivider');
    return li;
}


function renameElement() {
    const el = document.createElement('div');
    el.style.width = '3em';
    el.style.height = '1em';
    el.style.marginLeft = '0.1em';
    // el.style.background = 'transparent';
    el.style.background = 'black';
    el.style.cursor = 'text';
    el.style.display = 'inline-block';

    el.onmousedown = function(event) {
        event.stopPropagation();
        event.preventDefault();

        let p = el.parentElement;
        let span = p.children[0].children[0];
        let text = span.innerText;

        span.innerText = '';
        
        let input = document.createElement('input');
        input.value = text;
        input.type = 'text';
        span.before(input);
        input.focus();
        input.select();

        input.onmousedown = function(event) {
            event.stopPropagation();
        }

        function change(event) {
            event.stopPropagation();
            event.preventDefault();

            // Аттрибут data-ghflexible-event-lock используется в качестве блокировки
            //  Выполняется тот евент, который первый взял блокировку
            if (input.getAttribute('data-ghflexible-event-lock') !== null) {
                return;
            }
            input.setAttribute('data-ghflexible-event-lock', event.type);

            text = input.value;
            input.value = '';
            span.innerText = text;
            p.setAttribute('data-ghflexible-rename', text);
            input.remove(); 
            moveActionListBlock();

            input.removeAttribute('data-ghflexible-event-lock');
        }

        input.onblur = function (event) {
            change(event);
        }
        
        input.onchange = function(event) {
            change(event);
        }

        input.onkeypress = function (event) {
            if (event.key === "Enter") {
                change(event);
            }
        }
    }
    return el;
}

// indents
function setIndents(element, indents) {
    element.setAttribute('data-ghflexible-element-indent', indents.toString());
    element.style.marginLeft = indents + 'em';
}

function countIndents(element) {
    let indents = 0;
    let saveElement = element;

    while(!checkRootFolder(element)) {
        element = element.parentElement;
        if (checkFolder(element)) {
            indents = indents + 1;
        }
    }
    element = saveElement;
    return indents;
}

// checkings object

function checkRootFolder(element) {
    if (element.getAttribute('data-test-selector') === 'workflows-list') {
        return true
    }
    return false;
}

function checkFolder(element) {
    if (element.getAttribute('data-ghflexible-type') === 'folder') {
        return true
    }
    return false;
}

function checkFolderList(element) {
    if (element.getAttribute('data-ghflexible-folder-list') === 'true') {
        return true
    }
    return false;
}

function checkWorkflow(element) {
    if (element.getAttribute('data-ghflexible-type') === 'workflow') {
        return true
    }
    return false;
}

function checkFolderParent(element) {
    let saveElement = element;
    while(!checkRootFolder(element)) {
        element = element.parentElement;
        if (checkFolder(element)) {
            element = saveElement;
            return true;
        }
    }
    element = saveElement;
    return false;
}

function getNearUlParent(element) {
    let saveElement = element;

    while(!checkRootFolder(element)) {
        element = element.parentElement;
        if (checkFolder(element)) {
            let returnElement = element.children[2];
            element = saveElement;
            return returnElement;
        }
    }
    element = saveElement;
    return document.querySelector(SELECTOR_ACTIONS);
}

// folder
function folderCreate(name) {
    // добавляем папку
    let li = document.createElement('li');
    // выставляю такие-же аттрибуты как в gtihub
    li.setAttribute('tabindex', -1);
    li.setAttribute('data-test-selector', 'workflow-rendered');
    li.setAttribute('data-view-component', true);
    // выставляю свои аттрибуты
    li.setAttribute('data-ghflexible-type', 'folder');
    li.setAttribute('data-ghflexible-folder-open', 'false');
    li.setAttribute('data-ghflexible-element-indent', '0');
    // ActionList-item - класс из gtihub, GHflexible-dir - свой класс
    li.setAttribute('class', 'ActionList-item GHflexible-dir');

    let span = document.createElement('span');
    span.setAttribute('class', 'ActionList-item-label ActionList-item-label--truncate');
    span.innerText = name;

    let folderIcon = folderOpenIcon();

    folderIcon.onmousedown = function(event) {
        event.stopPropagation();
        folderActionClick(this.parentElement);
    }

    let ul = document.createElement('ul')
    ul.setAttribute('data-ghflexible-folder-list', 'true');

    li.appendChild(folderIcon);
    li.appendChild(span);
    li.appendChild(ul);
    return li;
}

function folderClosedIcon() {
    const folderIcon = document.createElement("svg");
    folderIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" fill="currentColor" class="bi bi-folder2" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7z"/></svg>`;
    folderIcon.firstChild.style.marginRight = '0.1em';
    return folderIcon.firstChild;
}

function folderOpenIcon() {
    const folderIcon = document.createElement("svg");
    folderIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" fill="currentColor" class="bi bi-folder2-open" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v.64c.57.265.94.876.856 1.546l-.64 5.124A2.5 2.5 0 0 1 12.733 15H3.266a2.5 2.5 0 0 1-2.481-2.19l-.64-5.124A1.5 1.5 0 0 1 1 6.14V3.5zM2 6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5a.5.5 0 0 0-.5.5V6zm-.367 1a.5.5 0 0 0-.496.562l.64 5.124A1.5 1.5 0 0 0 3.266 14h9.468a1.5 1.5 0 0 0 1.489-1.314l.64-5.124A.5.5 0 0 0 14.367 7H1.633z"/></svg>`;
    folderIcon.firstChild.style.marginRight = '0.1em';
    return folderIcon.firstChild;
}

function folderReset(folder) {
    let folderState = folder.getAttribute('data-ghflexible-folder-open');

    if (folderState === 'true') {
        folderActionOpen(folder);
    } else {
        folderActionClose(folder);
    }
}

function folderActionClick(folder) {
    let folderState = folder.getAttribute('data-ghflexible-folder-open');

    if (folderState === 'true') {
        folderActionClose(folder);
    } else {
        folderActionOpen(folder);
    }
}

function folderActionClose(folder) {
    folder.setAttribute('data-ghflexible-folder-open', 'false');
    let ul = folder.children[2];
    for (let i = 0; i < ul.children.length; i++) {
        ul.children[i].setAttribute('hidden', '');
    }
}

function folderActionOpen(folder) {
    folder.setAttribute('data-ghflexible-folder-open', 'true');
    let ul = folder.children[2];
    for (let i = 0; i < ul.children.length; i++) {
        ul.children[i].removeAttribute('hidden');
    }
    moveActionListBlock();
}

function folderGetName(folder) {
    return folder.getAttribute('data-ghflexible-name');
}

// workflows
function workflowGetName(workflow) {
    return workflow.getAttribute('data-ghflexible-name');
}


function moveActionListBlock() {

    let actionList = document.querySelector(SELECTOR_ACTIONS);
    let maxLetters = 0;

    depthFirstSearch(actionList, function(el) {
        let indents = parseInt(el.getAttribute('data-ghflexible-element-indent'));
        let name;
        if (el.classList.contains('GHflexible-dir')) {
            name = el.children[1].innerText;
        } else {
            name = el.children[0].children[0].innerText;
        }

        let length = name.length + indents;
        console.log(`${length}, ${maxLetters}`);

        if (length > maxLetters) {
            maxLetters = length
        }
    });

    const block = document.getElementsByClassName('PageLayout')[0];
    let px = (maxLetters * 10 + 42) + 'px';
    block.style.setProperty('--Layout-pane-width', px);
}

function depthFirstSearch(element, callback) {
    if (checkRootFolder(element)) {
        console.log("### IS ROOT ###");
        for (let i = 0; i < element.children.length; i++) {
            depthFirstSearch(element.children[i], callback);
        }
    }

    if (checkFolder(element)) {
        console.log(`### IS FOLDER: ${folderGetName(element)}`);
        callback(element);
        depthFirstSearch(element.children[2], callback);
    }

    if (checkFolderList(element)) {
        console.log(`### IS FOLDER LIST: ${folderGetName(element.parentElement)}`);
        if (element.children.length > 0) {
            depthFirstSearch(element.children[0], callback);
        }
    }

    if (checkWorkflow(element)) {
        console.log(`### IS WORKFLOW: ${workflowGetName(element)}`);
        callback(element);

        let index = getIndexInChildren(element.parentElement, element);
        let length = element.parentElement.children.length;
        if (index + 1 < length && !checkRootFolder(element.parentElement)) {
            depthFirstSearch(element.parentElement.children[index + 1], callback);
        }
    }
}

