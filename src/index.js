let EDITABLE           = false;
let CHECKBOX           = false;
const SELECTOR_ACTIONS = 'ul.ActionList.ActionList--subGroup';
const TYPE_WORKFLOW    = 1;
const TYPE_FOLDER      = 2;
const TYPE_ROOT        = 3;


let GROUP_BUILD_FORM = undefined;
let WORKFLOW_PARAMS = {};
let WORKFLOW_PARAMS_STATUS_LOADED = {};

//  TODO: 
// 0) При каких-то условиях сбрасывается стейт с сохраненными папками, пока не понял как это воспроизвести
// 3) выбрать картинку, логотип, название и что писать в html
// 4) зареилзить в google store
// 5) протетсить в safari, поправить баги
// 6) зарелизить в safari store
// 7) протестить в mozilla, поправить баги
// 8) зарелизить в mozilla store
// 9) Глобальный рефактор кода


// подписываемся на события переходов по страницам через history API, для этого в github используется: https://turbo.hotwired.dev/handbook/introduction
// https://turbo.hotwired.dev/reference/events
window.addEventListener('turbo:load', async function () {
    await init();
});


// (async () => {
//     await init();
// })();

async function init() {
    if (!checkRun()) { 
        document.removeEventListener('click', onClick);
        document.removeEventListener('mousedown', mousedown);
        window.removeEventListener('submit', onSubmit);
        window.onbeforeunload = null;
        GROUP_BUILD_FORM = undefined;
        WORKFLOW_PARAMS = {};
        WORKFLOW_PARAMS_STATUS_LOADED = {};
        return;
    }

    console.log('Github-flexible init...');
    await waitClickShowWorkflows();

    document.addEventListener('click', onClick);
    document.addEventListener('mousedown', mousedown);
    window.addEventListener('submit', onSubmit);

    
    window.onbeforeunload = function() {
        disableEditElements();
    };

    const actionList     = document.querySelector(SELECTOR_ACTIONS);
    const allWorkflowsUl = document.querySelector('ul.ActionList');

    const globalButtons = globalButtonsInit();
    globalButtonAddButton(globalButtons, globalButtonCreateFolder());
    globalButtonAddButton(globalButtons, globalButtonEdit());
    globalButtonAddButton(globalButtons, globalButtonReset());

    allWorkflowsUl.children[1].after(globalButtons);
    actionList.prepend(createDropableLine({first: true}));

    await initWorkflowsList();
    await initCheckBoxes();
    getState();
    disableEditElements();
    moveActionListBlock();

    // синхронно ищем GROUP_BUILD_FORM - надо сделать до добавления кнопки группового билда
    await depthFirstSearchSync(actionList, async function(el) {
        if (checkWorkflow(el) && !GROUP_BUILD_FORM) {
            await getParams(el);

            // Когда нашли GROUP_BUILD_FORM добавляем глобальную кнопку
            if (GROUP_BUILD_FORM) {
                globalButtonAddButton(globalButtons, globalButtonGroupBuild());
            }
        }
    });

    // На случай если совершен внутренний переход без перегрузки страницы, то объект GROUP_BUILD_FORM уже существует. Тогда нужно добавить кнопку
    if (globalButtons.children[0].children[0].children[3] == undefined) {
        globalButtonAddButton(globalButtons, globalButtonGroupBuild());
    }

    // Асинхронно заполняем WORKFLOW_PARAMS, WORKFLOW_PARAMS_STATUS_LOADED 
    depthFirstSearch(actionList, function(el) {
        if (checkWorkflow(el)) {
            // console.log(`### Run init getParams for workflow: ${workflowGetName(el)}`);
            getParams(el);
        }
    });

}

// Первая форма для группового билда берется из реальной формы workflow, поэтому там работают свои механизмы добавления параметров. С помощью этого события мы находим события изминения при выборе ветки или тега в этой форме и заново генерируем содержимое второй формы, чтобы перезапасать то что автоматически сгенерировалось gtihub'ом
async function onSubmit(event) {
    const el = event.target;

    if (el.getAttribute('data-ghflexible-form') === 'true' ) {
        WORKFLOW_PARAMS_STATUS_LOADED = {};
        await waitGroupBuildForm(GROUP_BUILD_FORM);
        await hideCheckBoxes();

        const actionList = document.querySelector(SELECTOR_ACTIONS);
        const branch     = getBranchGroupBuildForm(GROUP_BUILD_FORM);

        // Синхронно чекаем параметры для нужных workflows
        await depthFirstSearchSync(actionList, async function(el) {
            if (checkWorkflow(el)) {
                const checkBox = el.children[3];
                if (!WORKFLOW_PARAMS_STATUS_LOADED[workflowGetName(el)] && !checkHideElement(el) && checkBox.checked) {
                    //console.log(`# Run Sync getParams for checked and unhide workflows: ${workflowGetName(el)}`)
                    await getParams(el, branch);
                    updateCheckBox(el);
                    unhideCheckBox(el);
                }
            }
        });
        reloadGroupBuildForm();

        // Асинхронно заполняем WORKFLOW_PARAMS 
        depthFirstSearch(actionList, async function(el) {
            if (checkWorkflow(el) && !WORKFLOW_PARAMS_STATUS_LOADED[workflowGetName(el)]) {
                //console.log(`# Run Async getParams after change branch: ${workflowGetName(el)}`);
                await getParams(el, branch);

                if (!checkHideElement(el)) {
                    updateCheckBox(el);
                    unhideCheckBox(el);
                }
            }
        });

       
        addClassToChilds(GROUP_BUILD_FORM, 'GHflexible-click-group-build');
        const details = GROUP_BUILD_FORM.querySelector('details.details-reset.details-overlay.d-inline-block');
        details.onclick = async function () {
            addClassToChilds(GROUP_BUILD_FORM, 'GHflexible-click-group-build');
        }
    }
}

function onClick(event) {
    if (!event.target.classList.contains('GHflexible-contextmenu')) {
        removeConextMenus();
    }
}
 
function mousedown(event) {
    if (!event.target.classList.contains('GHflexible-click-group-build')) {
        deleteGroupBuild();
    }
}

function checkRun() {
    const location = window.location.pathname.split('/');
    let flag = false;
    if (location[3] === 'actions' && location.length === 4 ) {
        flag = true;
    }
    if (location[3] === 'actions' && location[4] === 'workflows' && location.length === 6 ) {
        flag = true;
    }
    if (location[3] === 'actions' &&  location[4] === 'caches' && location.length === 5 ) {
        flag = true;
    }
    return flag;
}

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
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    if (actionList.children.length < 11) {
        return;
    }
    let clicksCount = 0;
    let notExistCount = 0;
    for (let i = 0; i < 100000; i++) {
        await promiseSetTimeout(10);

        let showWorkflows = true;
        showWorkflows = searchShowWorkflows();

        if (showWorkflows && showWorkflows !== true) {
            if (clicksCount == 0) {
                showWorkflows.click();
                notExistCount = 0;
            }
            clicksCount++;
        } else {
            notExistCount++;
        }
        if (notExistCount > 5 && clicksCount > 0) {
            break;
        }
        showWorkflows = true;
    }
}

async function waitGroupBuildForm(form) {
    
    for (let i = 0; i < 100000; i++) {
        await promiseSetTimeout(10);
        if (form.querySelectorAll('form').length === 1 || form.querySelectorAll('form')[1].getAttribute('data-ghflexible-form') === 'true') {
            continue;
        }
       
        form.querySelectorAll('form').forEach((i)  => {
            const method = i.getAttribute('method');
            if (method == 'post') {
                i.remove();
            }
            if (method == 'get') {
                i.setAttribute('data-ghflexible-form', 'true');
            }
        });
        return;
    }
}

async function initWorkflowsList() {
    let actionListHtml = document.querySelector(SELECTOR_ACTIONS);

    for (let i = 0; i < actionListHtml.children.length; i++) {
        let li = actionListHtml.children[i];
        if (li.getAttribute('data-test-selector') != 'workflows-show-more' && !checkDropableLine(li)) {
            
            if (!li.classList.contains('GHflexible-dir') && !li.classList.contains('GHflexible-workflow')) {
                li.classList.add('GHflexible-workflow');
                const wIcon = workflowIcon();
                wIcon.style.width = '15px';
                wIcon.style.height = '20px';

                const editIcon = renameElement();
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
                li.children[1].style.flex = '1';
                // li.children[1].style.paddingLeft = '0em';
                li.children[1].setAttribute('class', '');
                li.appendChild(editIcon);
                li.after(createDropableLine());

            }

            if (!li.classList.contains('GHflexible-dropable')) {
                li.classList.add('GHflexible-dropable');
            }
        }
    }
    moveActionListBlock();
}

async function initCheckBoxes() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    const checkBoxes = [];
    await depthFirstSearchSync(actionList, async function(el) {
        if (checkWorkflow(el)) {
            const checkBox = checkBoxWorkflow();
            checkBox.classList.add('GHflexible-click-group-build');
            checkBoxes.push(checkBox);
            el.appendChild(checkBox);
            hideCheckBox(el);
            
            checkBox.onchange = async function () {
                // Достаем параметры выбранного workflow если они еще не известны, в случае если workflow выбран
                if (checkBox.checked && !WORKFLOW_PARAMS_STATUS_LOADED[workflowGetName(el)]) {
                    console.log(`# Run getParams for workflow: ${workflowGetName(el)}, when onchange ckecbox`)
                    await getParams(el, getBranchGroupBuildForm(GROUP_BUILD_FORM));
                }

                const formParams = generateGroupBuildForm(checkBoxes);
                const div = GROUP_BUILD_FORM.querySelector('div.workflow-dispatch');
                if (div.children[1]) {
                    div.children[1].remove();
                }
                div.appendChild(formParams);
            }

        }
    });
}
 
function reloadGroupBuildForm() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    const checkBoxes = [];

    depthFirstSearch(actionList, function(el) {
        if (checkWorkflow(el)) {
            checkBoxes.push(el.children[3]);
        }
    });

    const formParams = generateGroupBuildForm(checkBoxes);
    const div = GROUP_BUILD_FORM.querySelector('div.workflow-dispatch');
    if (div.children[1]) {
        div.children[1].remove();
    }
    div.appendChild(formParams);
}

function disableEditElements() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    EDITABLE = false;
    depthFirstSearch(actionList, function(el) {
        el.ondragstart = null;
        el.oncontextmenu = null;
        el.onmousedown = null;
        if (checkFolder(el)) {
            el.children[2].setAttribute('hidden', '');
            el.children[0].onmousedown = el.saveFunc;
            el.children[1].onmousedown = el.saveFunc;
        }
        if (checkWorkflow(el)) {
            el.children[2].setAttribute('hidden', '');

        }
    });
    saveState();
}

function enableEditElements() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    EDITABLE = true;

    depthFirstSearch(actionList, function(el) {
            // Отключаем браузерный drag
            let li = el;

            let indents = countIndents(li);
            setIndents(li, indents);

            if (checkFolder(el) || checkWorkflow(el)) {
                el.children[2].onmousedown = null;
                el.children[2].removeAttribute('hidden');
                el.children[2].onmousedown = function (event) {
                    renameButton(el.children[2], event);
                }
            }
            // if (checkWorkflow(el)) {
            //     el.children[2].onmousedown = null;
            //     el.children[2].removeAttribute('hidden');
            //     el.children[2].onmousedown = function (event) {
            //         renameButton(el.children[2], event);
            //     }
            // }

            li.ondragstart = function () {
                return false;
            };

            let saveLiStyle = Object.assign({}, li.style);
            if (checkFolder(li)) {
                li.children[0].onmousedown = null;
                li.children[1].onmousedown = null;

                li.oncontextmenu = function(event) {
                    event.stopPropagation();
                    event.preventDefault();
                    removeConextMenus();

                    const div = document.createElement('div');
                    div.classList.add('GHflexible-contextmenu');
                    div.style.position = 'absolute';
                    div.style.zIndex = 1000;
                    div.style.width = '4em';
                    div.style.height = '2.5em';
                    div.style.background = '#f6f8fa'; 
                    div.style.borderStyle  = 'solid';
                    div.style.borderColor = '#d6d9dc';
                    div.style.borderWidth = '1px';
                    div.style.borderRadius = '0.5em';
                    // console.log(li.getBoundingClientRect());
                    // console.log(event.clientY);
                    div.style.left = event.pageX + 'px';
                    div.style.top = event.pageY + 'px';

                    const p = document.createElement('p');
                    p.classList.add('GHflexible-contextmenu');
                    p.style.marginLeft = '0.45em';
                    p.style.marginRight = '0.45em';
                    p.style.marginTop = '0.4em';
                    p.style.cursor = 'pointer';
                    p.innerHTML = 'delete';
                    p.style.color = '#000000';
                    if (getColorScheme() == 'dark') {
                        p.style.color = '#ffffff';
                        div.style.background = '#000000'; 
                    }
                    div.append(p);

                    document.body.append(div);

                    p.onmouseover = function (event) {
                        p.style.background = '#B6E3FF';
                    }

                    p.onmouseout = function (event) {
                        p.style.background = '';
                    }

                    p.onclick = function (event) {
                        let parent = li.parentElement;
                        let ul = li.children[3];

                        // первый элемент пропускаем
                        while (ul.children[1]) {
                            parent.appendChild(ul.children[1]);
                        }

                        if (!checkRootFolder(parent) && checkFolder(parent.parentElement)) {
                            parent = parent.parentElement;
                        }

                        if (checkRootFolder(parent)) {
                            for (let i = 0; i < parent.children.length; i++) {
                                let el = parent.children[i];
                                if(checkWorkflow(el) || checkFolder(el)) {
                                    el.removeAttribute('hidden')
                                }
                            }
                        }

                        depthFirstSearch(parent, function(el) {
                            if (checkFolder(el)) {
                                folderReset(el);
                            }
                            setIndents(el, countIndents(el));
                        });
                        removeConextMenus();
                        
                        let i = getIndexInChildren(li.parentElement, li);
                        let dLi = li.parentElement.children[i + 1];
                        li.remove();
                        dLi.remove();
                        delete(li);
                        delete(dLi);
                    }
                }
            }

            li.onmousedown = function(event) {
                event.stopPropagation();
                event.preventDefault();

                if (event.which === 3) {
                    return;
                }

                if (checkFolder(li)) {
                    folderActionClose(li);
                    li.children[2].style.marginLeft = '40px';
                }

                // удаляем все контекстные меню
                removeConextMenus();

                // при перескавиваниях расширяем все первые элементы, для того чтобы на них можно было навестись
                document.querySelectorAll('li.GHflexible-first-dropable').forEach((el) => {
                    el.style.height = '0.5em';
                });
                
                // Запиоминаем родителя до переноса, и под какаим индексом были в нем. Чтобы вернуть назад если перенос был не в положенное место
                let parentLi = li.parentElement;
                let indexLi = getIndexInChildren(parentLi, li);

                // Также запиоминаем dropableLine которая является просто промежутком между елементами и нужна для визуализации во время переносов. Нам нужно ее запомнить чтобы перетаскивать вместе с элементом (чтобы за любым елементом всегда был такой промежуток)
                let dropableLine = parentLi.children[indexLi + 1];

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

                function decreaseLine(d) {
                    decreaseLineBefore(d);
                    decreaseLineAfter(d);
                }

                function decreaseLineBefore(d) {
                    let i = getIndexInChildren(d.parentElement, d);
                    let dline = d.parentElement.children[i - 1];
                    if (checkDropableLine(dline)) {
                        dline.style.height = '0em';
                    }
                }

                function decreaseLineAfter(d) {
                    let i = getIndexInChildren(d.parentElement, d);
                    let dline = d.parentElement.children[i + 1];
                    if (checkDropableLine(dline)) {
                        dline.style.height = '0em';
                    }
                }

                function increaseLine(d) {
                    let i = getIndexInChildren(d.parentElement, d);
                    dline = d.parentElement.children[i + 1];
                    if (checkDropableLine(dline)) {
                        dline.style.height = '1em';
                    }
                }

                function onMouseMove(event) {
                    moveAt(event.pageX, event.pageY);
 
                    // обработка целей куда можно дропать объект
                    li.hidden = true;
                    let elemBelow = document.elementFromPoint(event.clientX, event.clientY);
                    li.hidden = false;

                    if (!elemBelow) return;

                    // потенциальные цели переноса помечены классом droppable (может быть и другая логика)
                    let droppableBelow = elemBelow.closest('.GHflexible-dropable');

                    if (currentDroppable != droppableBelow) {
                        if (currentDroppable) {
                            // логика обработки процесса "вылета" из GHflexible-dropable (удаляем подсветку)
                            if (checkFolder(currentDroppable)) {
                                let i = getIndexInChildren(currentDroppable.parentElement, currentDroppable);
                                if (i == 1) {
                                    decreaseLineAfter(currentDroppable);
                                } else {
                                    decreaseLine(currentDroppable)
                                }
                                // currentDroppable.style.backgroundColor = 'transparent';
                                currentDroppable.style.removeProperty('background-color');

                            }
                            if (checkWorkflow(currentDroppable)) {
                                let i = getIndexInChildren(currentDroppable.parentElement, currentDroppable);
                                if (i == 1) {
                                    decreaseLineAfter(currentDroppable);
                                } else {
                                    decreaseLine(currentDroppable)
                                }
                            }
                            if (checkDropableLine(currentDroppable)) {
                                let i = getIndexInChildren(currentDroppable.parentElement, currentDroppable);
                                if (i == 0) {
                                    currentDroppable.style.height = '0.5em';
                                } else {
                                    currentDroppable.style.height = '0em';
                                }
                            }
                        }
                        currentDroppable = droppableBelow;
                        
                        // логика обработки процесса, когда мы "влетаем" в элемент GHflexible-dropable
                        if (currentDroppable) {
                            if (checkDropableLine(currentDroppable)) {
                                currentDroppable.style.height = '1.5em';
                            }

                            if (checkFolder(currentDroppable)) {
                                increaseLine(currentDroppable);
                                if (getColorScheme() == 'dark') {
                                    currentDroppable.style.backgroundColor = '#2f2821';
                                } else {
                                    currentDroppable.style.backgroundColor = '#d0d7de';
                                }
                            } 
                            
                            if (checkWorkflow(currentDroppable)) {
                                increaseLine(currentDroppable);
                            }
                        }
                    }
                }
                
                document.addEventListener('mousemove', onMouseMove);

                li.onmouseup = function() {
                    document.removeEventListener('mousemove', onMouseMove);
                    li.onmouseup = null;
                    // возвращаем старый стиль
                    li.style = Object.assign({}, saveLiStyle);
                    li.style.listStyleType = 'none';

                    if (checkWorkflow(li)) {
                        li.children[1].style.marginLeft = '0.3em';
                        li.style.display = 'flex';
                        li.children[1].style.flex = '1';
                    }


                    if (currentDroppable) {
                        
                        if (checkFolder(currentDroppable)) {
                            currentDroppable.style.backgroundColor = 'transparent';
                            let i = getIndexInChildren(currentDroppable.parentElement, currentDroppable);
                            if (i == 1) {
                                decreaseLineAfter(currentDroppable);
                            } else {
                                decreaseLine(currentDroppable)
                            }

                            currentDroppable.children[3].appendChild(li);
                            currentDroppable.children[3].appendChild(dropableLine);
                            folderReset(currentDroppable);

                            let indents = countIndents(li);
                            setIndents(li, indents);
                        }

                        if (checkWorkflow(currentDroppable)) {
                            let i = getIndexInChildren(currentDroppable.parentElement, currentDroppable);
                            if (i == 1) {
                                decreaseLineAfter(currentDroppable);
                            } else {
                                decreaseLine(currentDroppable)
                            }

                            let d = currentDroppable.parentElement.children[i + 1];
                            d.after(li);
                            li.after(dropableLine);

                            let indents = countIndents(li);
                            setIndents(li, indents);
                        }

                        if (checkDropableLine(currentDroppable)) {
                            // reset styles
                            currentDroppable.style.height = '0em';

                            currentDroppable.after(li);
                            li.after(dropableLine);

                            let indents = countIndents(li);
                            setIndents(li, indents);
                        }

                        if (checkFolder(currentDroppable.parentElement.parentElement)) {
                            folderReset(currentDroppable.parentElement.parentElement);
                        }

                        moveActionListBlock();

                    } else {
                        if (indexLi == 0) {
                            parentLi.prepend(li);
                        } else if (indexLi > 0) {
                            parentLi.children[indexLi - 1].after(li);
                        }
                        let indents = countIndents(li);
                        setIndents(li, indents);

                        li.after(dropableLine);
                        moveActionListBlock();
                    }

                    // когда отпустили элемент, все первые элементы сужаем обратно
                    document.querySelectorAll('li.GHflexible-first-dropable').forEach((el) => {
                        el.style.height = '0em';
                    });
                    

                    if (checkFolder(li)) {
                        depthFirstSearch(li, function(el) {
                            setIndents(el, countIndents(el));
                        });
                    }

                };
            };
    });
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

function deleteGroupBuild() {
    if (!CHECKBOX) {
        return;
    }
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    const checkBoxes = [];
    depthFirstSearch(actionList, function(el) {
        if (checkWorkflow(el)) {
            const checkBox = el.children[3];
            checkBoxes.push(checkBox);
        }
    });
    reloadGroupBuildForm();

    for (c of checkBoxes) {
        c.setAttribute('hidden', '');
    }
    moveActionListBlock();
    GROUP_BUILD_FORM.remove();
    CHECKBOX = false;
}

function globalButtonsInit() {
    const li = document.createElement('li');
    const div = document.createElement('div');
    div.style.marginLeft = 'auto';

    const divIco = document.createElement('div');

    div.appendChild(divIco);
    li.appendChild(div);
    li.setAttribute('class', 'ActionList-sectionDivider');
    return li;
}

function globalButtonAddButton(globalButton, button) {
    globalButton.children[0].children[0].appendChild(button);
}

function globalButtonEdit() {
    const editIcon = editButtonIcon();
    editIcon.style.marginRight = '0.5em';
    editIcon.style.width = "20px";
    editIcon.style.height = "20px";
    editIcon.style.cursor = 'pointer';

    editIcon.onclick = function () {
        if (EDITABLE) {
            disableEditElements();
            moveActionListBlock();
        } else {
            enableEditElements();
            moveActionListBlock();
        }
    }
    return editIcon;
}

function globalButtonReset() {
    const resetIcon = createResetIcon();
    resetIcon.style.marginRight = '0.5em';
    resetIcon.style.width = "20px";
    resetIcon.style.height = "20px";
    resetIcon.style.cursor = 'pointer';

    resetIcon.onclick = function (event) {
        resetState();
    }

    return resetIcon;
}

function globalButtonGroupBuild() {
    const groupBuildIcon = createGroupBuildIcon();
    groupBuildIcon.style.marginRight = '0.5em';
    groupBuildIcon.style.width = "20px";
    groupBuildIcon.style.height = "20px";
    groupBuildIcon.style.cursor = 'pointer';
    addClassToChilds(groupBuildIcon, 'GHflexible-click-group-build');

    groupBuildIcon.onclick = function() {
        const actionList = document.querySelector(SELECTOR_ACTIONS);

        if (CHECKBOX) {
            deleteGroupBuild();
            moveActionListBlock();
        } else {
            CHECKBOX = true;
            disableEditElements();

            const body = document.querySelector('body');
            body.appendChild(GROUP_BUILD_FORM);
            const located = document.querySelector('div.PageLayout-region.PageLayout-content').getBoundingClientRect();
            GROUP_BUILD_FORM.style.top = located.top + window.scrollY + 'px';
            GROUP_BUILD_FORM.style.left = located.left + window.scrollX + 'px';
    
            depthFirstSearch(actionList, async function(el) {
                if (checkWorkflow(el)) {
                    if (!WORKFLOW_PARAMS_STATUS_LOADED[workflowGetName(el)] && !checkHideElement(el)) {
                        console.log(`# Run getParams for workflow: ${workflowGetName(el)}, when groupBuildClick`)
                        await getParams(el, getBranchGroupBuildForm(GROUP_BUILD_FORM));
                    }
                    unhideCheckBox(el);
                }
            });
            moveActionListBlock();
        }
    }

    return groupBuildIcon;
}

function checkHideElement(el) {
    // Проверяем скрыт ли элемент, проверяя открытость/закрытость его родительских папок


    if (checkRootFolder(el)) {
        return false;
    }

    if (checkDropableLine(el) ) {
        return checkHideElement(el.parentElement);
    }

    if (checkWorkflow(el) ) {
        return checkHideElement(el.parentElement);
    }

    if (checkFolderList(el)) {
        return checkHideElement(el.parentElement);
    }

    if (checkFolder(el) && el.getAttribute('data-ghflexible-folder-open') == 'false') {
        return true;
    }

    if (checkFolder(el)) {
        return checkHideElement(el.parentElement);
    }
    return false;
}


function globalButtonCreateFolder() {
    const crFolderIcon = createFolderIcon();
    crFolderIcon.style.marginRight = '0.5em';
    crFolderIcon.style.width = "20px";
    crFolderIcon.style.height = "20px";
    crFolderIcon.style.cursor = 'pointer';

    crFolderIcon.onclick = function() {
        let actionListHtml = document.querySelector(SELECTOR_ACTIONS);
        let folder = folderCreate("");
        actionListHtml.children[0].after(folder);
        folder.after(createDropableLine());

        let span = folder.children[1];
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

        let firstNameFlag = true;

        function change(event) {
            event.stopPropagation();
            event.preventDefault();
            
            if (!input) {
                return;
            }

            // Аттрибут data-ghflexible-event-lock используется в качестве блокировки
            if (input.getAttribute('data-ghflexible-event-lock') !== null) {
                return;
            }
            // ставим блокировку
            input.setAttribute('data-ghflexible-event-lock', event.type);

            text = input.value;
            input.value = '';
            span.innerText = text;
            folder.setAttribute('data-ghflexible-rename', text);

            if (firstNameFlag) {
                firstNameFlag = false;
                folder.setAttribute('data-ghflexible-name', text);
            }

            moveActionListBlock();

            // снимаем блокировку и удаляем элемент
            input.remove(); 
            input.removeAttribute('data-ghflexible-event-lock');
            input = null;

            moveActionListBlock();
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
        moveActionListBlock();
    }

    return crFolderIcon;
}


function updateCheckBoxes() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    depthFirstSearch(actionList, function(el) {
        if (checkWorkflow(el)) {
            updateCheckBox(el);
        }
    });
}

function updateCheckBox(el) {
    const checkBox = el.children[3];
    checkBox.disabled = false;
    if (el.getAttribute('data-ghflexible-checkbox') === 'false') {
        checkBox.disabled = true;
    }
}

async function hideCheckBoxes() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    await depthFirstSearchSync(actionList, async function(el) {
        if (checkWorkflow(el)) {
            hideCheckBox(el);
        }
    });
}

function hideCheckBox(el) {
    const checkBox = el.children[3];
    checkBox.setAttribute('hidden', '');
}

function unhideCheckBox(el) {
    const checkBox = el.children[3];
    checkBox.removeAttribute('hidden');
}

function getColorScheme() {
    return window.getComputedStyle(document.querySelector('body')).colorScheme;
}

function svgColor() {
    if (getColorScheme() == 'dark') {
        return '#ffffff'
    }
    return '#000000';
}

function editButtonIcon() {
    const icon = document.createElement('svg');
    const color = svgColor();
    
    icon.innerHTML = `<svg fill="${color}" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="15px" height="15px" viewBox="0 0 494.936 494.936"  xml:space="preserve"><g><g><path d="M389.844,182.85c-6.743,0-12.21,5.467-12.21,12.21v222.968c0,23.562-19.174,42.735-42.736,42.735H67.157c-23.562,0-42.736-19.174-42.736-42.735V150.285c0-23.562,19.174-42.735,42.736-42.735h267.741c6.743,0,12.21-5.467,12.21-12.21s-5.467-12.21-12.21-12.21H67.157C30.126,83.13,0,113.255,0,150.285v267.743c0,37.029,30.126,67.155,67.157,67.155h267.741c37.03,0,67.156-30.126,67.156-67.155V195.061C402.054,188.318,396.587,182.85,389.844,182.85z"/><path d="M483.876,20.791c-14.72-14.72-38.669-14.714-53.377,0L221.352,229.944c-0.28,0.28-3.434,3.559-4.251,5.396l-28.963,65.069c-2.057,4.619-1.056,10.027,2.521,13.6c2.337,2.336,5.461,3.576,8.639,3.576c1.675,0,3.362-0.346,4.96-1.057l65.07-28.963c1.83-0.815,5.114-3.97,5.396-4.25L483.876,74.169c7.131-7.131,11.06-16.61,11.06-26.692C494.936,37.396,491.007,27.915,483.876,20.791z M466.61,56.897L257.457,266.05c-0.035,0.036-0.055,0.078-0.089,0.107l-33.989,15.131L238.51,247.3c0.03-0.036,0.071-0.055,0.107-0.09L447.765,38.058c5.038-5.039,13.819-5.033,18.846,0.005c2.518,2.51,3.905,5.855,3.905,9.414C470.516,51.036,469.127,54.38,466.61,56.897z"/></g></g></svg>`;
    return icon.firstChild;
}

function workflowIcon() {
    const icon = document.createElement('svg');
    const color = svgColor();
    icon.innerHTML = `<svg width="15px" height="15px" viewBox="0 0 1024 1024" class="icon"  version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M786.358857 809.325714a88.356571 88.356571 0 0 1 176.566857 0 88.283429 88.283429 0 0 1-176.566857 0z m-274.797714 89.234286c-48.64 0-88.210286-39.497143-88.210286-88.064a88.210286 88.210286 0 0 1 176.420572 0c0 48.566857-39.570286 88.064-88.210286 88.064zM512.512 59.538286c48.566857 0 88.137143 39.497143 88.137143 87.917714a88.137143 88.137143 0 0 1-176.201143 0c0-48.493714 39.497143-87.917714 88.064-87.917714zM145.334857 896.731429c-48.64 0-88.210286-39.497143-88.210286-88.137143a88.283429 88.283429 0 0 1 176.493715 0c0 48.64-39.643429 88.137143-88.283429 88.137143zM905.069714 425.691429a29.549714 29.549714 0 0 0-8.265143-20.48 30.793143 30.793143 0 0 0-20.48-8.265143H541.257143V291.181714a147.309714 147.309714 0 0 0 117.906286-144.237714 147.163429 147.163429 0 0 0-294.253715 0c0 71.826286 49.883429 131.510857 118.125715 144.237714-0.146286 0.365714-1.974857 105.691429-1.974858 105.691429H147.675429a28.452571 28.452571 0 0 0-20.48 8.265143 30.134857 30.134857 0 0 0-8.923429 20.48l0.658286 241.590857c-59.245714 9.508571-118.345143 70.656-118.345143 143.725714 0 81.042286 65.974857 147.017143 147.090286 147.017143 81.188571 0 147.163429-65.974857 147.163428-147.017143 0-70.656-53.101714-131.437714-112.128-143.725714V464.969143h300.324572v191.488c0 3.730286 0.877714 7.094857 2.048 10.24a147.017143 147.017143 0 0 0-120.173715 144.237714 147.236571 147.236571 0 0 0 294.253715 0c0-71.899429-52.077714-131.657143-120.539429-144.237714a29.110857 29.110857 0 0 0 1.974857-10.24V464.969143h300.617143v202.24c-64.365714 14.116571-112.054857 73.142857-112.054857 143.725714a147.236571 147.236571 0 0 0 294.253714 0c0-72.996571-57.344-134.656-118.345143-144.530286 0.365714-1.097143 0-240.786286 0-240.786285z" fill="${color}" /></svg>`;
    return icon.firstChild;
}


function createFolderIcon() {
    const icon = document.createElement('svg');
    const color = svgColor();
    icon.innerHTML = `<svg height="15px" width="15px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512"  xml:space="preserve"><style type="text/css">
   .st0{fill:${color};}</style><g><path class="st0" d="M503.654,101.298h-43.289V58c0-4.61-3.727-8.338-8.329-8.338h-16.833c-4.602,0-8.347,3.728-8.347,8.338v43.298h-43.289c-4.602,0-8.329,3.727-8.329,8.329v16.833c0,4.602,3.727,8.346,8.329,8.346h43.289v43.29c0,4.601,3.745,8.337,8.347,8.337h16.833c4.602,0,8.329-3.736,8.329-8.337v-43.29h43.289c4.619,0,8.346-3.744,8.346-8.346v-16.833C512,105.026,508.273,101.298,503.654,101.298z"/><path class="st0" d="M500.836,239.74l-0.21-0.428l-0.28-0.394c-8.556-12.616-22.817-20.367-38.216-20.367H382.22l-12.633-36.115l-0.385,0.096c-8.836-19.204-27.839-32.178-49.519-32.178H144.986c-1.994-0.026-4.041-1.129-5.231-3.666l0.017,0.035c-8.592-18.889-27.314-31.329-48.224-31.329H46.474c-0.035,0-0.035-0.009-0.052-0.009c-15.118,0.009-29.134,7.489-37.743,19.702l-0.595,0.866l-0.123,0.376C2.748,144.22,0,153.355,0,162.611c0,4.768,0.736,9.571,2.188,14.243H2.17l0.018,0.035l0.017,0.061l0.018,0.062v0.017l76.115,247.645v0.035l0.332,1.033c6.912,21.801,27.121,36.587,49.973,36.587l272.719,0.009c19.72-0.009,37.48-11.102,46.404-28.268l0.437,0.141l57.516-152.178l0.07-0.201l0.017-0.062l0.018-0.035c1.838-5.196,2.73-10.62,2.73-15.992c0-9.098-2.625-18.136-7.717-25.984V239.74z M472.63,270.011l-55.03,145.58l-0.035,0.106c-2.432,6.859-8.941,11.443-16.203,11.443l-272.719-0.017c-7.506,0.017-14.156-4.848-16.412-12.004L35.783,166.382l0.017,0.043c-0.402-1.251-0.595-2.537-0.595-3.814c0-2.608,0.805-5.162,2.258-7.244l-0.018,0.017c2.223-3.114,5.547-4.786,8.994-4.786h45.11c6.754,0,13.106,4.007,16.185,10.735c6.649,14.602,21.12,24.217,37.253,24.217h174.697c8.294,0,15.906,5.486,18.653,14.156l0.07,0.21l8.994,25.678H207.733c-20.279,0-38.18,13.019-44.951,32.134l-35.608,102.904l26.596,9.204l35.573-102.781l-0.035,0.122c2.974-8.276,10.376-13.42,18.425-13.42h254.399c3.482,0,6.912,1.741,9.1,4.97c1.364,2.029,2.134,4.496,2.117,7.016C473.348,267.186,473.103,268.629,472.63,270.011z"/></g></svg>`;
    return icon.firstChild;
}

function createGroupBuildIcon() {
    const icon = document.createElement('svg');
    const color = svgColor();
    icon.innerHTML = `<svg fill="${color}" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g><g><polygon points="175.425,9.748 175.425,25.477 463.788,25.477 463.788,31.768 479.517,31.768 479.517,9.748"/></g></g><g><g><path d="M70.566,384.21v-8.504H54.837v8.504H0V512h127.79V384.21H70.566z M112.061,496.271H15.729v-96.332h96.332V496.271z"/></g></g><g><g><path d="M455.399,384.21v-8.504H439.67v8.504h-55.46V512H512V384.21H455.399z M496.271,496.271h-96.332v-96.332h96.332V496.271z"/></g></g><g><g><path d="M261.41,384.21v-8.504h-15.729v8.504h-53.576V512h127.79V384.21H261.41z M304.166,496.271h-96.332v-96.332h96.332V496.271 z"/></g></g><g><g><path d="M487.987,319.895V40.022H167.811L167.808,0H24.013v319.895H245.68v18.062H54.837v30.409h15.729v-14.68h175.115v14.68 h15.729v-14.68H439.67v14.68h15.729v-30.409H261.41v-18.062H487.987z M39.742,304.166V15.729h112.34l0.003,40.022h320.174v248.416 H39.742z"/></g></g><g><g><path d="M256.001,88.048c-48.473,0-87.909,39.435-87.909,87.909c0,48.473,39.435,87.909,87.909,87.909 c48.473,0,87.908-39.435,87.908-87.909C343.909,127.484,304.473,88.048,256.001,88.048z M256.001,248.137 c-39.8,0-72.18-32.379-72.18-72.18c0-39.8,32.379-72.18,72.18-72.18c39.799,0,72.179,32.379,72.179,72.18 C328.18,215.757,295.8,248.137,256.001,248.137z"/></g></g><g><g><path d="M256.001,112.061c-35.233,0-63.896,28.663-63.896,63.896s28.663,63.896,63.896,63.896 c35.232,0,63.895-28.663,63.895-63.896S291.232,112.061,256.001,112.061z M256.001,224.123c-26.559,0-48.167-21.607-48.167-48.167 c0-26.559,21.608-48.167,48.167-48.167c26.559,0,48.166,21.607,48.166,48.167C304.166,202.516,282.56,224.123,256.001,224.123z"/></g></g><g><g><polygon points="282.456,154.386 247.996,188.848 229.544,170.395 218.422,181.518 247.996,211.092 293.579,165.51 "/></g></g><g><g><rect x="55.89" y="32.821" width="15.729" height="15.729"/></g></g><g><g><rect x="87.348" y="32.821" width="15.729" height="15.729"/></g></g><g><g><rect x="118.805" y="32.821" width="16.777" height="15.729"/></g></g></svg>`;
    return icon.firstChild;
}

function createResetIcon() {
    const icon = document.createElement('svg');
    const color = svgColor();
    icon.innerHTML = `<svg fill="${color}" width="15px" height="15px" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg"><path d="M960 0v112.941c467.125 0 847.059 379.934 847.059 847.059 0 467.125-379.934 847.059-847.059 847.059-467.125 0-847.059-379.934-847.059-847.059 0-267.106 126.607-515.915 338.824-675.727v393.374h112.94V112.941H0v112.941h342.89C127.058 407.38 0 674.711 0 960c0 529.355 430.645 960 960 960s960-430.645 960-960S1489.355 0 960 0" fill-rule="evenodd"/></svg>`;
    return icon.firstChild;
}


function renameElement() {
    let el = editButtonIcon();
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

function renameButton(el, event) {
    event.stopPropagation();
    event.preventDefault();
    let p = el.parentElement;
    let text, span;
    if (checkWorkflow(p)) {
        span = p.children[1].children[0];
    }
    if (checkFolder(p)) {
        span = p.children[1];
    }
    text = span.innerText;
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

    input.onclick = function(event) {
        event.stopPropagation();
        event.preventDefault();
    }

    function change(event) {
        event.stopPropagation();
        event.preventDefault();
        
        if (!input) {
            return;
        }

        // Аттрибут data-ghflexible-event-lock используется в качестве блокировки
        if (input.getAttribute('data-ghflexible-event-lock') !== null) {
            return;
        }
        // ставим блокировку
        input.setAttribute('data-ghflexible-event-lock', event.type);

        text = input.value;
        input.value = '';
        span.innerText = text;
        p.setAttribute('data-ghflexible-rename', text);

        // снимаем блокировку и удаляем элемент
        input.remove(); 
        input.removeAttribute('data-ghflexible-event-lock');
        input = null;

        moveActionListBlock();
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

// indents
function setIndents(element, indents) {
    element.setAttribute('data-ghflexible-element-indent', indents.toString());
    element.style.marginLeft = indents / 2.0 + 'em';
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
            let returnElement = element.children[3];
            element = saveElement;
            return returnElement;
        }
    }
    element = saveElement;
    return document.querySelector(SELECTOR_ACTIONS);
}

// folder
function folderCreate(name, title = name) {
    // добавляем папку
    const li = document.createElement('li');
    // выставляю такие-же аттрибуты как в gtihub
    li.setAttribute('tabindex', -1);
    li.setAttribute('data-test-selector', 'workflow-rendered');
    li.setAttribute('data-view-component', true);
    // выставляю свои аттрибуты
    li.setAttribute('data-ghflexible-type', 'folder');
    li.setAttribute('data-ghflexible-name', name);
    li.setAttribute('data-ghflexible-rename', title);
    li.setAttribute('data-ghflexible-folder-open', 'false');
    li.setAttribute('data-ghflexible-element-indent', '0');
    
    // ActionList-item - класс из gtihub, GHflexible-dir - свой класс
    li.setAttribute('class', 'GHflexible-dir GHflexible-dropable');
    li.style.listStyleType = 'none';
    
    const span = document.createElement('span');
    span.setAttribute('class', 'ActionList-item-label ActionList-item-label--truncate');
    span.innerText = title;
    span.style.marginRight = '0.8em';

    const folderIcon = folderClosedIcon();
    folderIcon.style.cursor = 'default';

    folderIcon.onmousedown = function(event) {
        event.stopPropagation();
        folderActionClick(this.parentElement);
        saveState();
    }

    li.saveFunc = folderIcon.onmousedown;

    span.onmousedown = folderIcon.onmousedown;

    const ul = document.createElement('ul')
    ul.setAttribute('data-ghflexible-folder-list', 'true');
    ul.setAttribute('class', 'ActionList ActionList--subGroup');
    const dline = createDropableLine({first: true});
    dline.setAttribute('hidden', '');
    ul.appendChild(dline);

    li.appendChild(folderIcon);
    li.appendChild(span);
    const r = renameElement();
    r.setAttribute('hidden', '');
    li.appendChild(r);
    li.appendChild(ul);
    disableEditElements();
    return li;
}

function workflowCreate(name, title = name) {
    let li = document.createElement('li');
    li.setAttribute('tabindex', '-1');
    li.setAttribute('data-test-selector', 'workflow-rendered');
    li.setAttribute('tabindex', '-1');
    li.setAttribute('tabindex', '-1');
    li.setAttribute('tabindex', '-1');
    li.setAttribute('tabindex', '-1');
}

function folderClosedIcon() {
    const icon = document.createElement("svg");
    const color = svgColor();
    icon.innerHTML = `<svg width="15px" height="15px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <title>folder-outline</title><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="folder" fill="${color}" transform="translate(42.666667, 85.333333)"><path d="M426.666667,341.333333 L3.55271368e-14,341.333333 L3.55271368e-14,1.42108547e-14 L178.083413,1.42108547e-14 L232.041813,42.6666667 L426.666667,42.6666667 L426.666667,341.333333 Z M42.6666667,298.666667 L384,298.666667 L384,85.3333333 L217.20832,85.3333333 L163.24992,42.6666667 L42.6666667,42.6666667 L42.6666667,298.666667 Z" id="Shape"></path></g></g></svg>`;
    icon.firstChild.style.marginRight = '0.2em';
    return icon.firstChild;
}

function folderOpenIcon() {
    const icon = document.createElement("svg");
    const color = svgColor();
    icon.innerHTML = `<svg fill="${color}" width="15px" height="15px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M384,128 L384,42.6666667 L232.0416,42.6666667 L178.0832,1.42108547e-14 L-2.13162821e-14,1.42108547e-14 L-2.13162821e-14,341.333333 L60.9376,341.333333 L363.416533,341.333333 L372.583253,341.333333 L437.333333,128 L384,128 Z M42.6666667,253.44 L42.6666667,42.6666667 L163.24992,42.6666667 L217.20832,85.3333333 L341.333333,85.3333333 L341.333333,128 L82.0209067,128 L42.6666667,253.44 Z M340.95808,298.666667 L73.1874133,298.666667 L113.354027,170.666667 L379.79136,170.666667 L340.95808,298.666667 Z" transform="translate(42.667 85.333)"/></svg>`;
    icon.firstChild.style.marginRight = '0.2em';
    return icon.firstChild;
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
    moveActionListBlock();
}

function folderActionClose(folder) {
    folder.setAttribute('data-ghflexible-folder-open', 'false');
    let saveEventOnmouseDown = folder.children[0].onmousedown;
    folder.replaceChild(folderClosedIcon(), folder.children[0]);
    folder.children[0].onmousedown = saveEventOnmouseDown;
    folder.children[0].style.cursor = 'default';

    let ul = folder.children[3];
    for (let i = 0; i < ul.children.length; i++) {
        const el = ul.children[i];
        el.setAttribute('hidden', '');
        if (checkFolder(el) || checkWorkflow(el)) {
            setIndents(el, countIndents(el));
        }
        if (checkWorkflow(el) && CHECKBOX) {
            hideCheckBox(el);
        }
    }
    if (CHECKBOX) {
        reloadGroupBuildForm();
    }
}

async function folderActionOpen(folder) {
    folder.setAttribute('data-ghflexible-folder-open', 'true');
    let saveEventOnmouseDown = folder.children[0].onmousedown;
    folder.replaceChild(folderOpenIcon(), folder.children[0]);
    folder.children[0].onmousedown = saveEventOnmouseDown;
    folder.children[0].style.cursor = 'default';

    let ul = folder.children[3];
    for (let i = 0; i < ul.children.length; i++) {
        const el = ul.children[i];
        el.removeAttribute('hidden');
        if (checkFolder(el) || checkWorkflow(el)) {
            setIndents(el, countIndents(el));
        }
        if (checkWorkflow(el) && CHECKBOX) {
            unhideCheckBox(el);
        }
    }

    if (CHECKBOX) {
        reloadGroupBuildForm();
    }
}

function folderGetName(folder) {
    return folder.getAttribute('data-ghflexible-name');
}

function folderGetTitle(folder) {
    return folder.getAttribute('data-ghflexible-rename');
}

// workflows
function workflowGetName(workflow) {
    return workflow.getAttribute('data-ghflexible-name');
}

function workflowGetTitle(workflow) {
    return workflow.getAttribute('data-ghflexible-rename');
}

function workflowFileName(workflow) {
    const s = workflow.children[1].href.split('/');
    return '.github/' + s[s.length - 2] + '/' + s[s.length - 1];
}

function moveActionListBlock() {

    const actionList = document.querySelector(SELECTOR_ACTIONS);
    let maxLetters = 0;

    depthFirstSearch(actionList, function(el) {
        let indents = parseInt(el.getAttribute('data-ghflexible-element-indent'));
        let name = el.getAttribute('data-ghflexible-rename');
        let length = name.length + indents;

        if (length > maxLetters) {
            maxLetters = length
        }
    });
    const block = document.getElementsByClassName('PageLayout')[0];
    let px = (maxLetters * 10 + 66);
    if (px < 256) {
        px = 256;
    }
    const pixels = px + 'px';
    block.style.setProperty('--Layout-pane-width', pixels);

    depthFirstSearch(actionList, function(el) {
        const indent = el.getAttribute('data-ghflexible-element-indent');
        const indentPixels = indent * 7;

        if (checkFolder(el)) {
            const width = el.children[1].getBoundingClientRect().width;
            let diff = 93;
            if (CHECKBOX) {
                diff = 108;
            }
            if (el.children[2].tagName == 'svg' || el.children[2].tagName == 'SVG') {
                el.children[2].style.marginLeft = (px - diff - indentPixels - width) + 'px';
            }
        }
    });
}

async function depthFirstSearchSync(element, callback) {
    if (checkRootFolder(element)) {
        for (let i = 0; i < element.children.length; i++) {
            await depthFirstSearchSync(element.children[i], callback);
        }
    }

    if (checkFolder(element)) {
        await callback(element);
        await depthFirstSearchSync(element.children[3], callback);
    }

    if (checkFolderList(element)) {
        for (let i = 0; i < element.children.length; i++) {
            await depthFirstSearchSync(element.children[i], callback);
        }
    }

    if (checkDropableLine(element) ) {
    }

    if (checkWorkflow(element) ) {
       await callback(element);
    }
}


function depthFirstSearch(element, callback) {
    if (checkRootFolder(element)) {
        for (let i = 0; i < element.children.length; i++) {
            depthFirstSearch(element.children[i], callback);
        }
    }

    if (checkFolder(element)) {
        callback(element);
        depthFirstSearch(element.children[3], callback);
    }

    if (checkFolderList(element)) {
        for (let i = 0; i < element.children.length; i++) {
            depthFirstSearch(element.children[i], callback);
        }
    }

    if (checkDropableLine(element) ) {
    }

    if (checkWorkflow(element) ) {
        callback(element);
    }
}

function getSaveKey() {
    return 'ghflexible/' + window.location.pathname.split('/')[1] + '/' + window.location.pathname.split('/')[2];
}

function resetState() {
    const c = confirm("Are you sure you want to reset the settings? This will delete all folders and reset all workflows to their original state.")
    if (c === true) {
        localStorage.removeItem(getSaveKey());

        const actionList = document.querySelector(SELECTOR_ACTIONS);
        actionList.remove();
        window.location.reload();
    }
}

function saveState() {
    let state = {
        type: TYPE_ROOT,
        title: '',
        list: [],
    };
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    moveDomElementsToState(actionList, state);
    localStorage.setItem(getSaveKey(), JSON.stringify(state));
}

function moveDomElementsToState(domElement, stateElement) {
    if (checkRootFolder(domElement)) {
        for (let i = 0; i < domElement.children.length; i++) {
            moveDomElementsToState(domElement.children[i], stateElement);
        }
    }

    if (checkFolder(domElement)) {
        let folder = {
            type: TYPE_FOLDER,
            isOpen: domElement.getAttribute('data-ghflexible-folder-open') === 'true',
            name: folderGetName(domElement),
            title: folderGetTitle(domElement),
            list: [],
        };
        stateElement.list.push(folder);
        moveDomElementsToState(domElement.children[3], folder);
    }

    if (checkFolderList(domElement)) {
        for (let i = 0; i < domElement.children.length; i++ ) {
            moveDomElementsToState(domElement.children[i], stateElement);
        }
    }

    if (checkDropableLine(domElement) ) {
    }

    if (checkWorkflow(domElement)) {
        let workflow = {
            name: workflowGetName(domElement),
            title: workflowGetTitle(domElement),
            type: TYPE_WORKFLOW,
            checkbox: domElement.getAttribute('data-ghflexible-checkbox'),
        };
        stateElement.list.push(workflow);
    }
}

function getState() {
    let state = {
        type: TYPE_ROOT,
        title: '',
        list: [],
    }
    if (localStorage.hasOwnProperty(getSaveKey())) {
        state = JSON.parse(localStorage.getItem(getSaveKey()));
    }
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    moveStateToDomElements(state, actionList);
}

function moveStateToDomElements(stateElement, domElement) {
    if (stateElement.type === TYPE_ROOT) {
        for (const k in stateElement.list) {
            moveStateToDomElements(stateElement.list[k], domElement);
        }
    }

    if (stateElement.type === TYPE_FOLDER) {
        let folder = folderCreate(stateElement.name, stateElement.title);
        if (checkRootFolder(domElement)) {
            domElement.appendChild(folder);
        }
        if (checkFolder(domElement)) {
            domElement.children[3].appendChild(folder);
            folderReset(domElement);
        }
        folder.after(createDropableLine());
        folder.setAttribute('data-ghflexible-folder-open', 'false');
        if (stateElement.isOpen) {
            folder.setAttribute('data-ghflexible-folder-open', 'true');
        }
        setIndents(folder, countIndents(folder));
        folderReset(folder);
        for (const k in stateElement.list) {
            moveStateToDomElements(stateElement.list[k], folder);
        }
    }

    if (stateElement.type === TYPE_WORKFLOW) {
        const actionList = document.querySelector(SELECTOR_ACTIONS);
        let sel, index;
        for (let i = 0; i < actionList.children.length; i++) {
            const el = actionList.children[i];
            if (checkWorkflow(el) && workflowGetName(el) === stateElement.name) {
                sel = el;
                index = i;
                break;
            }
        }

        if (sel) {
            const span = sel.children[1].children[0];
            span.innerText = stateElement.title;
            sel.setAttribute('data-ghflexible-rename', stateElement.title);
            sel.setAttribute('data-ghflexible-checkbox', stateElement.checkbox);

            // после того как  найденный элемент `sel` был перенесен, индекс следующих всех элементов понизился на единицу, поэтому actionList.children[index] ссылается на следующий элемент. Cледующий элемент всегда технический элемент dropLine, его переносим тоже.
            if (checkFolder(domElement)) {
                domElement.children[3].appendChild(sel);
                domElement.children[3].appendChild(actionList.children[index]);
                folderReset(domElement);

            }
            if (checkRootFolder(domElement)) {
                domElement.appendChild(sel);
                domElement.appendChild(actionList.children[index]);
            }
        }
    }
}

function stateConvertGraph(stateElement, parent) {
    if (stateElement.type === TYPE_ROOT) {
        for (const k in stateElement.list) {
            stateConvertGraph(stateElement.list[k], stateElement);
        }
    }

    if (stateElement.type === TYPE_FOLDER) {
        stateElement.parent = parent;
        for (const k in stateElement.list) {
            stateConvertGraph(stateElement.list[k], stateElement);
        }
    }

    if (stateElement.type === TYPE_WORKFLOW) {
        stateElement.parent = parent;
    }
}

function createDropableLine({first} = {first: false}) {
    let el = document.createElement('li');
    el.setAttribute('data-ghflexible-dropable-line', '');
    el.classList.add('ActionList-item');
    el.classList.add('GHflexible-dropable');
    if (first) {
        el.classList.add('GHflexible-first-dropable');
    }
    return el;
}

function checkDropableLine(el) {
    if (el && el.getAttribute('data-ghflexible-dropable-line') === '') {
        return true;
    }
    return false;
}

function removeConextMenus() {
    document.querySelectorAll('.GHflexible-contextmenu').forEach((el) => {
        el.remove();
        delete(el);
    });
}

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.
    // Please note that calling sort on an array will modify that array.
    // you might want to clone your array first.

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function groupBuildCheckbox() {
    depthFirstSearch(actionList, function(el) {
        if (checkWorkflow(el)) {

        }
    });
}

function checkBoxWorkflow() {
    const checkbox = document.createElement('input');
    checkbox.style.marginLeft = '2px';
    checkbox.setAttribute('type', 'checkbox');
    return checkbox;
}

function generateGroupBuildForm(checkBoxes) {
    // проверяем есть ли хоть один выбранный workflow. Если да, то oneElementChecked будет равен true
    // А также составляем список выбранных workflows и добавляем их в массив checkedElements
    let checkedWorkflows = [];
    for (const i of checkBoxes) {
        if (i.checked && i.getAttribute('hidden') == null && !i.disabled) {
            checkedWorkflows.push(workflowGetName(i.parentElement));
        }
    }

    // определяем в каких workflows есть одинаковые параметры
    let uniqWorkflows = {};
    let added = {};
    for (let i = 0; i < checkedWorkflows.length; i++) {
        const iParams = WORKFLOW_PARAMS[checkedWorkflows[i]].params;
        if (!added[i]) {
            uniqWorkflows[checkedWorkflows[i]] = {
                names: [checkedWorkflows[i]]
            };
        }

        for (let j = i + 1; j < checkedWorkflows.length; j++) {
            if (added[j]) { continue};

            const jParams = WORKFLOW_PARAMS[checkedWorkflows[j]].params;
            if (isEqualParams(iParams, jParams, false)) {
                uniqWorkflows[checkedWorkflows[i]].names.push(checkedWorkflows[j]);
                added[j] = true;
            }
        }
    }

    const form = document.createElement('form');
    form.setAttribute('data-turbo', 'false');
    form.setAttribute('accept-charset', 'UTF-8');
    form.setAttribute('data-ghflexible-form', 'true');
    form.classList.add('GHflexible-click-group-build');

    for (const k in uniqWorkflows) {
        const params = WORKFLOW_PARAMS[k].params;

        const label = document.createElement('label');
        label.classList.add('color-fg-default');
        label.classList.add('text-mono');
        label.classList.add('f8');
        label.classList.add('GHflexible-click-group-build');
        label.title = uniqWorkflows[k].names + ':';
        label.innerText = uniqWorkflows[k].names + ':';
        if (uniqWorkflows[k].names.length > 3) {

            label.innerText = WORKFLOW_PARAMS[uniqWorkflows[k].names[0]].title + ',' + WORKFLOW_PARAMS[uniqWorkflows[k].names[1]].title + ', ...' + ':';
        }
        if (params.length > 0) {
            form.appendChild(label);
        }

        let indexParam = 0;
        for (const p of params) {
            if (!p.visible) {
                continue;
            }
            const div = document.createElement('div');
            div.classList.add('form-group');
            div.classList.add('mt-1');
            div.classList.add('mb-2');
            div.classList.add('GHflexible-click-group-build');
            if (p.required) {
                div.classList.add('required');
            }
            
            form.appendChild(div);

            if (p.type === 'select') {
                const divParamName = document.createElement('div');
                divParamName.classList.add('form-group-header');
                divParamName.classList.add('GHflexible-click-group-build');
                div.appendChild(divParamName);

                const label = document.createElement('label');
                label.classList.add('color-fg-default');
                label.classList.add('text-mono');
                label.classList.add('f6');
                label.classList.add('GHflexible-click-group-build');
                label.innerText = p.name;
                divParamName.appendChild(label);

                const divFormGroup = document.createElement('div');
                divFormGroup.classList.add('form-group-body');
                divFormGroup.classList.add('GHflexible-click-group-build');
                div.appendChild(divFormGroup);

                const select = document.createElement('select');
                select.classList.add('form-select');
                select.classList.add('form-control');
                select.classList.add('select-sm');
                select.classList.add('input-contrast');
                select.classList.add('width-full');
                select.classList.add('GHflexible-click-group-build');
                select.setAttribute('id', 'params');
                select.setAttribute('workflow', k);
                select.setAttribute('name', p.input);
                if (p.required) {
                    select.setAttribute('required', p.required);
                }
                select.setAttribute('title', p.name);
                divFormGroup.appendChild(select);
                
                const i = indexParam;
                select.onchange = function () {
                    WORKFLOW_PARAMS[k].params[i].value = select.value;
                }

                for (const v of p.selectValues) {
                    const option = document.createElement('option');
                    option.setAttribute('value', v);
                    option.classList.add('GHflexible-click-group-build');
                    option.innerText = v;
                    select.appendChild(option);
                }
                select.value = p.value;
            }

            if (p.type === 'string') {
                const divParamName = document.createElement('div');
                divParamName.classList.add('form-group-header');
                divParamName.classList.add('GHflexible-click-group-build');
                div.appendChild(divParamName);

                const label = document.createElement('label');
                label.classList.add('color-fg-default');
                label.classList.add('text-mono');
                label.classList.add('f6');
                label.classList.add('GHflexible-click-group-build');
                label.innerText = p.name;
                divParamName.appendChild(label);

                const divFormGroup = document.createElement('div');
                divFormGroup.classList.add('form-group-body');
                divFormGroup.classList.add('GHflexible-click-group-build');
                div.appendChild(divFormGroup);

                const input = document.createElement('input');
                input.classList.add('form-control');
                input.classList.add('input-contrast');
                input.classList.add('input-sm');
                input.classList.add('GHflexible-click-group-build');
                input.setAttribute('type', 'text');
                input.value = p.value;
                input.setAttribute('id', 'params');
                input.setAttribute('workflow', k);
                input.setAttribute('name', p.input);
                if (p.required) {
                    input.setAttribute('required', p.required);
                }
                
                input.setAttribute('title', p.name);
                const i = indexParam;
                input.onchange = function () {
                    WORKFLOW_PARAMS[k].params[i].value = input.value;
                }

                divFormGroup.appendChild(input);
            }

            if (p.type === 'boolean') {
                const divFormGroup = document.createElement('div');
                divFormGroup.classList.add('form-group-body');
                divFormGroup.classList.add('GHflexible-click-group-build');
                div.appendChild(divFormGroup);

                const divCheckbox = document.createElement('div');
                divCheckbox.classList.add('form-checkbox');
                divCheckbox.classList.add('my-0');
                divCheckbox.classList.add('GHflexible-click-group-build');
                divFormGroup.appendChild(divCheckbox);

                const label = document.createElement('label');
                label.classList.add('color-fg-default');
                label.classList.add('text-mono');
                label.classList.add('f6');
                label.classList.add('GHflexible-click-group-build');
                label.innerText = p.name;
                divCheckbox.appendChild(label);

                const input = document.createElement('input');
                input.classList.add('GHflexible-click-group-build');
                input.setAttribute('type', 'checkbox');
                input.checked = p.value;
                input.setAttribute('id', 'params');
                input.setAttribute('workflow', k);
                input.setAttribute('name', p.input);
                input.setAttribute('title', p.name);

                const i = indexParam;
                input.onchange = function () {
                    WORKFLOW_PARAMS[k].params[i].value = input.checked;
                }

                label.appendChild(input);
            }
            indexParam++;
        }
    }

    if (checkedWorkflows.length > 0) {
        const button = document.createElement('button');
        button.classList.add('btn');
        button.classList.add('btn-primary');
        button.classList.add('btn-sm');
        button.classList.add('t-2');
        button.classList.add('GHflexible-click-group-build');
        button.setAttribute('type', 'submit');
        button.setAttribute('autofocus', '');
        button.innerHTML = 'Run workflows';
        form.appendChild(button);
    }

    form.onsubmit = function(event) {
        event.preventDefault();
        const l = window.location.pathname.split('/');
        const urlWorkflowRun = window.location.origin + '/' + l[1] + '/' + l[2] + '/actions/manual';

        for (const k in uniqWorkflows) {
            ws = uniqWorkflows[k].names;

            for (const w of ws) {
                const body = {
                    authenticity_token: WORKFLOW_PARAMS[w].token,
                    workflow: WORKFLOW_PARAMS[w].workflowFile,
                    show_workflow_tip: '',
                    branch: form.parentElement.querySelector('span.css-truncate-target').innerText,
                }

                form.querySelectorAll('#params').forEach((i) => {
                    if (i.getAttribute('workflow') === k) {
                        let v = i.value;
                        if(i.getAttribute('type') === 'checkbox') {
                            v = i.checked;
                        }
                        body[i.getAttribute('name')] = v;
                        // if (v === '' && i.getAttribute('required') === 'true') {
                        //     return alert(`Workflows ${ws} must required param: ${i.getAttribute('title')}`)
                        // }
                    }
                });

                let requestBody = [];
                for (const key in body) {
                    requestBody.push(encodeURIComponent(key) + '=' + encodeURIComponent(body[key]));
                }
                requestBody = requestBody.join('&');

                fetch(urlWorkflowRun, {
                    "headers": {
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "accept-language": "en-US,en;q=0.9",
                        "cache-control": "no-cache",
                        "content-type": "application/x-www-form-urlencoded",
                        "pragma": "no-cache",
                        "sec-ch-ua": "\"Google Chrome\";v=\"113\", \"Chromium\";v=\"113\", \"Not-A.Brand\";v=\"24\"",
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": "\"macOS\"",
                        "sec-fetch-dest": "document",
                        "sec-fetch-mode": "navigate",
                        "sec-fetch-site": "same-origin",
                        "sec-fetch-user": "?1",
                        "upgrade-insecure-requests": "1"
                    },
                    "referrer": window.location.origin + '/' + window.location.pathname,
                    "referrerPolicy": "no-referrer-when-downgrade",
                    "body": requestBody,
                    "method": "POST",
                    "mode": "cors",
                    "credentials": "include"
                });
            }
        }

        deleteGroupBuild();
        if ( window.location.href === (window.origin + uriWorkflows())) {
            window.location.reload();
        } else {
            window.location.href = window.origin + uriWorkflows();
        }
        
    }

    return form;
}

function getParam(el) {
    if (
        !el.classList.contains('form-group') ||
        !el.classList.contains('mt-1') ||
        !el.classList.contains('mb-2')
    ) {
        return undefined;
    }

    const div = el.querySelector('div.form-group-header');
    let required = false;
    if (el.classList.contains('required')) {
        required = true;
    }

    let name = '';
    if (div) {
        name = div.children[0].innerText.trim();
    } else {
        const label = el.querySelector('label.color-fg-default');
        name = label.innerText.trim();
    }
    
    type = '';
    value = ''
    selectValues = [];
    input = '';
    if (el.querySelector('select.form-select')) {
        type = 'select';
        const select = el.querySelector('select.form-select');
        value = select.getAttribute('value');
        input = select.getAttribute('name');

        el.querySelectorAll('option').forEach((i) => {
            selectValues.push(i.getAttribute('value'));
        });
        selectValues.sort();
    }
    if (el.querySelector('div.form-checkbox')) {
        type = 'boolean';
        el.querySelectorAll('input').forEach((i) => {
            if (i.getAttribute('type') == "checkbox") {
                value = i.getAttribute('value');
                input = i.getAttribute('name');
            }
        });

    }
    if (el.querySelector('input.form-control.input-contrast')) {
        type = 'string';
        value = el.querySelector('input.form-control.input-contrast').getAttribute('value');
        input = el.querySelector('input.form-control.input-contrast').getAttribute('name');

    }

    return {
        name: name,
        input: input,
        type: type,
        value: value,
        required: required,
        selectValues: selectValues,
        visible: true,
    }
}

function uriWorkflows() {
    const l = window.location.pathname.split('/');
    return '/' + l[1] + '/' + l[2] + '/actions';
}

async function getParams(el, branch = null) {
    const checkBox = el.children[3];
    let params = {
        workflow: workflowFileName(el),
    };
    if (branch) {
        params = {
            branch: branch,
            workflow: workflowFileName(el),
            show_workflow_tip: '',
        };
    }
    params = '?' + uriEncodeParams(params);

    const r = await fetch(urlWorkflowManual() + params, {
        "headers": {
        "accept": "text/html",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest"
        },
        "referrer": window.location.origin + '/' + window.location.pathname,
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    });
    const form = new DOMParser().parseFromString(await r.text(), 'text/html');
    WORKFLOW_PARAMS_STATUS_LOADED[workflowGetName(el)] = true;
    
    // Проверяем есть ли workflow для ветки
    const span = form.querySelector('div.workflow-dispatch').querySelector('span.d-block');
    if (span && span.innerText.includes('Workflow does not exist or does not have')) {
        el.setAttribute('data-ghflexible-checkbox', 'false');
        checkBox.disabled = true;
        
        return;
    };

    if (WORKFLOW_PARAMS[workflowGetName(el)]) {
        const newParams = [];
        form.querySelectorAll('div.form-group.mt-1.mb-2').forEach((i)  => {
            newParams.push(getParam(i));
        });

        for (const p of WORKFLOW_PARAMS[workflowGetName(el)].params) {
            if (paramFromParams(p, newParams).param) {
                p.visible = true;
            } else {
                p.visible = false;
            }
        }
        
        for (const p of newParams) {
            const oldParam = paramFromParams(p, WORKFLOW_PARAMS[workflowGetName(el)].params);
            if (oldParam.param) {
                WORKFLOW_PARAMS[workflowGetName(el)].params[oldParam.index].visible = true;
            }
        }
    } else {
        WORKFLOW_PARAMS[workflowGetName(el)] = {
            token: '',
            title: workflowGetTitle(el),
            workflowFile: workflowFileName(el),
            params: [],
        };
        form.querySelectorAll('div.form-group.mt-1.mb-2').forEach((i)  => {
            WORKFLOW_PARAMS[workflowGetName(el)].params.push(getParam(i));
        });
    }

    let token = '';
    //  querySelectorAll return NodeList object. And it object don't support "filter" method =(. Therefore I am using forEach to find token 
    form.querySelectorAll('input').forEach((i)  => {
        if (i.getAttribute('name') == 'authenticity_token') {
            token = i.value
        }
    });
    WORKFLOW_PARAMS[workflowGetName(el)].token = token;


    el.setAttribute('data-ghflexible-checkbox', 'true');
    checkBox.disabled = false;
    // GROUP_BUILD_FORM - записываем первую часть формы 
    if (!GROUP_BUILD_FORM) {
        form.querySelectorAll('form').forEach((i)  => {
            const method = i.getAttribute('method');
            if (method == 'post') {
                i.remove();
            }
            if (method == 'get') {
                i.setAttribute('data-ghflexible-form', 'true');
                
            }
        });
        const body = form.querySelector('body');

        GROUP_BUILD_FORM = document.createElement('div');
        GROUP_BUILD_FORM.setAttribute('class', 'position-absolute Popover-message Popover-message--large Popover-message--ight mt-2 right-0 text-left p-3 mx-auto Box color-shadow-large GHGroupBuild');
        GROUP_BUILD_FORM.appendChild(body.children[0]);
        GROUP_BUILD_FORM.style.position = 'absolute';
        GROUP_BUILD_FORM.style.zIndex = 1000;
        GROUP_BUILD_FORM.classList.remove('right-0');

        const details = GROUP_BUILD_FORM.querySelector('details.details-reset.details-overlay.d-inline-block');
        details.onclick = async function () {
            addClassToChilds(GROUP_BUILD_FORM, 'GHflexible-click-group-build');
        }
        addClassToChilds(GROUP_BUILD_FORM, 'GHflexible-click-group-build');
    }
}

function getBranchGroupBuildForm() {
    return GROUP_BUILD_FORM.querySelector('span.css-truncate-target').innerText.trim();
}

function urlWorkflowManual() {
    const l = window.location.pathname.split('/');
    return window.location.origin + '/' + l[1] + '/' + l[2] + '/actions/manual';
}

function isEqualParam(aParam, bParam, ignoreVisibleField = true) {
    if ( 
        aParam.name === bParam.name && 
        aParam.type === bParam.type && 
        aParam.required === bParam.required && 
        aParam.input === bParam.input && 
        arraysEqual(aParam.selectValues, bParam.selectValues) &&
        (ignoreVisibleField === true || aParam.visible === bParam.visible)
    ) {
        return true;
    } else {
        return false;
    }
}

function isEqualParams(aParams, bParams, ignoreVisibleField = true) {
    if (aParams.length != bParams.length) { return false; }

    for (const i of aParams) {
        let flag = false;
        for (const j of bParams) {
            if (isEqualParam(i, j, ignoreVisibleField)) {
                flag = true;
            }
        }
        if (!flag) { return false; }
    }

    return true;
}

function isExistParam(param, params) {
    for (const i = 0; i < params.lengt; i++) {
        if (isEqualParam(params[i], param)) {
            return true;
        }
    }
    return false;
}

function paramFromParams(param, params) {
    for (let i = 0; i < params.length; i++) {
        if (isEqualParam(params[i], param)) {
            return {
                param: params[i],
                index: i,
            };
        }
    }
    return {
        param: undefined,
        index: 0,
    };
}

function addClassToChilds(element, className) {
    // Проверяем, существует ли уже класс на элементе
    if (!element.classList.contains(className)) {
      // Добавляем класс к текущему элементу
      element.classList.add(className);
    }
  
    // Получаем все дочерние элементы
    var childElements = element.children;
  
    // Перебираем дочерние элементы и вызываем функцию рекурсивно
    for (var i = 0; i < childElements.length; i++) {
      var childElement = childElements[i];
      addClassToChilds(childElement, className);
    }
}

function uriEncodeParams(params) {
    let encodeParams = [];
    for (const key in params) {
        encodeParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
    encodeParams = encodeParams.join('&');
    return encodeParams;
}
