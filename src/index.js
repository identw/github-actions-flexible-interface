import Utils from './modules/utils.js';
import Icons from './modules/icons.js';
import { getColorScheme } from './modules/theme.js';

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
// 1) протестить в mozilla, поправить баги
// 2) зарелизить в mozilla store
// 3) Глобальный рефактор кода


// подписываемся на события переходов по страницам через history API, для этого в github используется: https://turbo.hotwired.dev/handbook/introduction
// https://turbo.hotwired.dev/reference/events
window.addEventListener('turbo:load', async function () {
    await init();
});


(async () => {
    await init();
})();

async function init() {
    if (!checkUri()) { 
        document.removeEventListener('click', onClick);
        document.removeEventListener('mousedown', mousedown);
        window.removeEventListener('submit', onSubmit);
        window.removeEventListener('beforeunload', onBeforeunload);
        GROUP_BUILD_FORM = undefined;
        WORKFLOW_PARAMS = {};
        WORKFLOW_PARAMS_STATUS_LOADED = {};
        return;
    }
    if (checkWasLaunched()) {
        return;
    }

    console.log('Github-flexible init...');
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    actionList.classList.add('GHflexible-globals');

    await waitClickShowWorkflows();
    

    document.addEventListener('click', onClick);
    document.addEventListener('mousedown', mousedown);
    window.addEventListener('submit', onSubmit);
    window.addEventListener('beforeunload', onBeforeunload);
  
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

function onBeforeunload(event) {
    disableEditElements();
}

// Первая форма для группового билда берется из реальной формы workflow, поэтому там работают свои механизмы добавления параметров. С помощью этого события мы находим события изминения при выборе ветки или тега в этой форме и заново генерируем содержимое второй формы, чтобы перезапасать то что автоматически сгенерировалось gtihub'ом
async function onSubmit(event) {
    const el = event.target;

    if (el.getAttribute('data-ghflexible-form') === 'true' ) {
        WORKFLOW_PARAMS_STATUS_LOADED = {};
        await waitGroupBuildForm(GROUP_BUILD_FORM);
        await hideCheckBoxes();

        const actionList = document.querySelector(SELECTOR_ACTIONS);
        const ref        = getRefGroupBuildForm(GROUP_BUILD_FORM);

        // Синхронно чекаем параметры для нужных workflows
        await depthFirstSearchSync(actionList, async function(el) {
            if (checkWorkflow(el)) {
                const checkBox = el.children[3];
                if (!WORKFLOW_PARAMS_STATUS_LOADED[workflowGetName(el)] && !checkHideElement(el) && checkBox.checked) {
                    // console.log(`# Run Sync getParams for checked and unhide workflows: ${workflowGetName(el)}`)
                    await getParams(el, ref);
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
                await getParams(el, ref);

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
    if (!checkContainParrentClass(event.target, 'GHflexible-click-group-build')) {
        deleteGroupBuild();
    }
}

function checkUri() {
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

function checkWasLaunched() {
    let flag = false;
    if (document.querySelector('ul.GHflexible-globals') !== null) {
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

async function waitClickShowWorkflows() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    if (actionList.children.length < 11) {
        return;
    }
    let clicksCount = 0;
    let notExistCount = 0;
    for (let i = 0; i < 100000; i++) {
        await Utils.promiseSetTimeout(10);

        let showWorkflows = true;
        showWorkflows = searchShowWorkflows();

        if (showWorkflows && showWorkflows !== true) {
            showWorkflows.click();
            await Utils.promiseSetTimeout(330);
            notExistCount = 0;
            clicksCount++;
        } else {
            notExistCount++;
        }
        if (notExistCount > 30 && clicksCount > 0) {
            break;
        }
        showWorkflows = true;
    }
}

async function waitGroupBuildForm(form) {
    
    for (let i = 0; i < 100000; i++) {
        await Utils.promiseSetTimeout(10);
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
        // if (li.classList.contains('GHflexible-dir')) {
        //     console.log('########## DIR');
        // }
        // if (li.classList.contains('GHflexible-workflow')) {
        //     console.log('########### WORKFLOW');
        // }
        // if (checkDropableLine(li)) {
        //     console.log('########### DROPLINE');
        // }

        if (li.getAttribute('data-test-selector') != 'workflows-show-more' && !checkDropableLine(li)) {
            

            if (!li.classList.contains('GHflexible-dir') && !li.classList.contains('GHflexible-workflow')) {
                li.classList.add('GHflexible-workflow');
                const wIcon = Icons.workflow();
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
                li.style.outline = 'none';
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
                    await getParams(el, getRefGroupBuildForm(GROUP_BUILD_FORM));
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
        el.ondragstart   = null;
        el.onclick       = null;
        el.oncontextmenu = null;
        el.onmousedown   = null;
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

            li.onclick = function (event) {
                return false;
            };

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
                        // delete(li);
                        // delete(dLi);
                    }
                }
            }

            li.onmousedown = function(event) {
                const startDragTime = Date.now();
                event.stopPropagation();
                event.preventDefault();

                if (event.which === 3) {
                    return;
                }
                hideEditIcons();

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
                    const dline = d.parentElement.children[i + 1];
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
                    if (currentDroppable && (Date.now() - startDragTime) > 250) {
                        
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
                    unHideEditIcons();
                    

                    if (checkFolder(li)) {
                        depthFirstSearch(li, function(el) {
                            setIndents(el, countIndents(el));
                        });
                    }

                };
            };
    });
}

function hideEditIcons() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    depthFirstSearch(actionList, function(el) {
        el.children[2].setAttribute('hidden', '');
    });
}

function unHideEditIcons() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    depthFirstSearch(actionList, function(el) {
        el.children[2].removeAttribute('hidden');
    });
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

    for (const c of checkBoxes) {
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
    const editIcon = Icons.editButton();
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
    const resetIcon = Icons.reset();
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
    const groupBuildIcon = Icons.groupBuild();
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
                        await getParams(el, getRefGroupBuildForm(GROUP_BUILD_FORM));
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

function checkContainParrentClass(el, className) {
    // Проверяем скрыт ли элемент, проверяя открытость/закрытость его родительских папок
    if (el.classList.contains(className)) {
        return true;
    }
    if (el.parentElement) {
        if (el.parentElement.classList.contains(className)) {
            return true;
        } else {
            return checkContainParrentClass(el.parentElement, className);
        }
    }

    return false;
}


function globalButtonCreateFolder() {
    const crFolderIcon = Icons.createFolder();
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

function renameElement() {
    let el = Icons.editButton();
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
    const p = el.parentElement;

    // провярем есть ли input в элементе, на случай если уже идет редактирование этого элемента. В таком случае просто выходим из функции
    const checkInput = p.querySelector('input');
    if (checkInput && checkInput.type == 'text') {
        return;
    }
    event.preventDefault();
    el.setAttribute('hidden', '');

    let text, span, a;
    if (checkWorkflow(p)) {
        a = p.children[1];
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
    a.setAttribute('hidden', '');
    a.before(input);
    // span.before(input);
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
        el.removeAttribute('hidden');
        a.removeAttribute('hidden');

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
    element.style.marginLeft = '0.5em';
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
    li.style.outline = 'none';
    
    const span = document.createElement('span');
    span.setAttribute('class', 'ActionList-item-label ActionList-item-label--truncate');
    span.innerText = title;
    span.style.marginRight = '0.8em';

    const folderIcon = Icons.folderClosed();
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
    folder.replaceChild(Icons.folderClosed(), folder.children[0]);
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
    folder.replaceChild(Icons.folderOpened(), folder.children[0]);
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
   
    if (px < 270) {
        px = 270;
    }
    const pixels = px + 'px';
    block.style.setProperty('--Layout-pane-width', pixels);

    depthFirstSearch(actionList, function(el) {
        const indent = parseInt(el.getAttribute('data-ghflexible-element-indent'));
       
        if (checkFolder(el)) {
            const width = el.children[1].getBoundingClientRect().width;
            let diff = 93;
            if (CHECKBOX) {
                diff = 108;
            }
            
            const indentPixels = (indent + 1) * 7;

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
        // delete(el);
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

        const refElement = form.parentElement.querySelector('span.css-truncate-target');
        const refPrevElement = refElement.previousElementSibling;
        let ref = {
            refName: refElement.innerText.trim(),
            refType: 'branch'
        };
        if (refPrevElement.innerText.toLowerCase().includes('tag')) {
            ref['refType'] = 'tag';
        }

        for (const k in uniqWorkflows) {
            const ws = uniqWorkflows[k].names;

            for (const w of ws) {
                let body = {
                    authenticity_token: WORKFLOW_PARAMS[w].token,
                    workflow: WORKFLOW_PARAMS[w].workflowFile,
                    show_workflow_tip: '',
                }
                if (ref.refType == 'tag') {
                    body['tag'] = ref.refName;
                }
                if (ref.refType == 'branch') {
                    body['branch'] = ref.refName;
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
    
    let type = '';
    let value = ''
    let selectValues = [];
    let input = '';
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

async function getParams(el, ref = null) {
    const checkBox = el.children[3];
    let params = {
        workflow: workflowFileName(el),
    };
    if (ref) {
        params = {
            workflow: workflowFileName(el),
            show_workflow_tip: '',
        };
        if (ref.refType == 'branch') {
            params['branch'] = ref.refName;
        }
        if (ref.refType == 'tag') {
            params['tag'] = ref.refName;
        }
    }
    params = '?' + Utils.uriEncodeParams(params);

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

function getRefGroupBuildForm() {
    const el   = GROUP_BUILD_FORM.querySelector('span.css-truncate-target')
    const prev = el.previousElementSibling;
    let type = 'branch';
    if (prev.innerText.toLowerCase().includes('tag')) {
        type = 'tag';
    }
    return {
        refName: el.innerText.trim(),
        refType: type,
    }
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
        Utils.arraysEqual(aParam.selectValues, bParam.selectValues) &&
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