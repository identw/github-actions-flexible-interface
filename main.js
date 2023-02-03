let EDITABLE           = false;
const SELECTOR_ACTIONS = 'ul.ActionList.ActionList--subGroup';
const TYPE_WORKFLOW    = 1;
const TYPE_FOLDER      = 2;
const TYPE_ROOT        = 3;

// подписываемся на события переходв по страницам через history API, для этого в github используется: https://turbo.hotwired.dev/handbook/introduction
// https://turbo.hotwired.dev/reference/events
window.addEventListener('turbo:load', async function () {
    await init();
});

// (async () => {
//     await init();
// })();

async function init() {
    if (!checkRun()) { 
        document.removeEventListener('click', handlerRemoveContextMenu);
        window.onbeforeunload = null;
        console.log("remove handlers");
        return;
    }

    console.log('Github-flexible init...');
    await waitClickShowWorkflows();
    // console.log(`second: ${window.location.pathname}`);

    document.addEventListener('click', handlerRemoveContextMenu);
    
    window.onbeforeunload = function() {
        disaableEditElements();
    };

    
    let actionList = document.querySelector(SELECTOR_ACTIONS);

    let allWorkflowsUl = document.querySelector('ul.ActionList');
    allWorkflowsUl.children[1].after(globalButtons());
    actionList.prepend(createDropableLine({first: true}));

    await initWorkflowsList();
    getState();
    disaableEditElements();

    const l = window.location.pathname.split('/');
    const urlWorklowParams = window.location.origin + '/' + l[1] + '/' + l[2] + '/actions/manual?workflow=.github%2Fworkflows%2F';
    const urlWorkflowRun = window.location.origin + '/' + l[1] + '/' + l[2] + '/actions/manual';

    depthFirstSearch(actionList, async function(el) {
        if (checkWorkflow(el)) {
            const name = workflowGetUrlName(el);
            const r    = await fetch(urlWorklowParams + name, {
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
            const dom   = new DOMParser().parseFromString(await r.text(), 'text/html');
            const token = dom.children[0].children[1].children[0].children[1].children[0].value;

            el.setAttribute('data-ghflexible-run-token', token);

            // await fetch(urlWorkflowRun, {
            //     "headers": {
            //         "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            //         "accept-language": "en-US,en;q=0.9",
            //         "cache-control": "max-age=0",
            //         "content-type": "application/x-www-form-urlencoded",
            //         "sec-fetch-dest": "document",
            //         "sec-fetch-mode": "navigate",
            //         "sec-fetch-site": "same-origin",
            //         "sec-fetch-user": "?1",
            //         "upgrade-insecure-requests": "1"
            //     },
            //     "referrer": window.location.origin + '/' + window.location.pathname,
            //     "referrerPolicy": "no-referrer-when-downgrade",
            //     "body": `authenticity_token=${token}&workflow=.github%2Fworkflows%2F${name}&branch=main&show_workflow_tip=`,
            //     "method": "POST",
            //     "mode": "cors",
            //     "credentials": "include"
            // });


        }
    });

    // let response = await rrr.text();
    // let parse = new DOMParser().parseFromString(response, 'text/html');
    // let form = parse.children[0].children[1].children[0];

    // let div = document.createElement('div');
    // div.setAttribute('class', 'position-absolute Popover-message Popover-message--large Popover-message--top-right mt-2 right-0 text-left p-3 mx-auto Box color-shadow-large');
    // div.appendChild(form);
    // div.style.position = 'absolute';
    // div.style.zIndex = 1000;
    // div.style.left = '400px';
    // div.style.top = '300px';

    // // document.body.append(div);


}

function checkRun() {
    // console.log(window.location.pathname);
    const location = window.location.pathname.split('/');
    let flag = false;
    if (location[3] === 'actions' && location.length === 4 ) {
        flag = true;
    }
    if (location[3] === 'actions' && location[4] === 'workflows' && location.length === 6 ) {
        flag = true;
    }
    return flag;
}

function handlerRemoveContextMenu(event) {
    if (!event.target.classList.contains('GHflexible-contextmenu')) {
        removeConextMenus();
    }
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

async function initWorkflowsList() {
    let actionListHtml = document.querySelector(SELECTOR_ACTIONS);

    for (let i = 0; i < actionListHtml.children.length; i++) {
        let li = actionListHtml.children[i];
        if (li.getAttribute('data-test-selector') != 'workflows-show-more' && !checkDropableLine(li)) {
            
            if (!li.classList.contains('GHflexible-dir') && !li.classList.contains('GHflexible-workflow')) {
                li.classList.add('GHflexible-workflow');
                li.prepend(workflowIcon());

                let name = li.children[1].children[0].innerText;
                li.setAttribute('data-ghflexible-name', name);
                li.setAttribute('data-ghflexible-rename', name);
                li.setAttribute('data-ghflexible-type', 'workflow');
                li.setAttribute('data-ghflexible-element-indent', '0');
                li.children[1].style.display = 'inline';
                li.children[1].style.paddingLeft = '0em';
                li.appendChild(renameElement());
                li.after(createDropableLine());
                
            }

            if (!li.classList.contains('GHflexible-dropable')) {
                li.classList.add('GHflexible-dropable');
            }
        }
    }
    moveActionListBlock();
}

function disaableEditElements() {
    const actionList = document.querySelector(SELECTOR_ACTIONS);
    EDITABLE = false;
    depthFirstSearch(actionList, function(el) {
        el.ondragstart = null;
        el.oncontextmenu = null;
        el.onmousedown = null;
        if (checkFolder(el)) {
            el.children[2].setAttribute('hidden', '');
        }
        if (checkWorkflow(el)) {
            el.children[2].setAttribute('hidden', '');
        }
    });
    saveState();
}

function enableEditElements() {
    let actionList = document.querySelector(SELECTOR_ACTIONS);
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
                li.oncontextmenu = function(event) {
                    event.stopPropagation();
                    event.preventDefault();
                    removeConextMenus();

                    let div = document.createElement('div');
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
                    div.style.left = event.clientX + 'px';
                    div.style.top = event.clientY + 'px';

                    let p = document.createElement('p');
                    p.classList.add('GHflexible-contextmenu');
                    p.style.marginLeft = '0.45em';
                    p.style.marginRight = '0.45em';
                    p.style.marginTop = '0.4em';
                    p.style.cursor = 'pointer';
                    p.innerHTML = 'delete'
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
                                currentDroppable.style.backgroundColor = '#d0d7de';
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

function globalButtons() {
    const li = document.createElement('li');
    const editIcon = editButtonIcon();
    editIcon.style.width = "20px";
    editIcon.style.height = "20px";
    editIcon.style.cursor = 'pointer';


    const crFolderIcon = createFolderIcon();
    crFolderIcon.style.marginRight = '0.5em';
    crFolderIcon.style.width = "20px";
    crFolderIcon.style.height = "20px";
    crFolderIcon.style.cursor = 'pointer';

    editIcon.onclick = function (event) {
        if (EDITABLE) {
            disaableEditElements();
            moveActionListBlock();
        } else {
            enableEditElements();
            moveActionListBlock();

        }
    }

    crFolderIcon.onclick = function(event) {
        enableEditElements();
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
            enableEditElements();
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
    

    const div = document.createElement('div');
    div.style.marginLeft = 'auto';

    const divIco = document.createElement('div');

    divIco.appendChild(crFolderIcon);
    divIco.appendChild(editIcon);
    div.appendChild(divIco);
    li.appendChild(div);
    li.setAttribute('class', 'ActionList-sectionDivider');
    return li;
}


function editButtonIcon() {
    const icon = document.createElement('svg');
    icon.innerHTML = `<svg fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="15px" height="15px" viewBox="0 0 494.936 494.936"  xml:space="preserve"><g><g><path d="M389.844,182.85c-6.743,0-12.21,5.467-12.21,12.21v222.968c0,23.562-19.174,42.735-42.736,42.735H67.157c-23.562,0-42.736-19.174-42.736-42.735V150.285c0-23.562,19.174-42.735,42.736-42.735h267.741c6.743,0,12.21-5.467,12.21-12.21s-5.467-12.21-12.21-12.21H67.157C30.126,83.13,0,113.255,0,150.285v267.743c0,37.029,30.126,67.155,67.157,67.155h267.741c37.03,0,67.156-30.126,67.156-67.155V195.061C402.054,188.318,396.587,182.85,389.844,182.85z"/><path d="M483.876,20.791c-14.72-14.72-38.669-14.714-53.377,0L221.352,229.944c-0.28,0.28-3.434,3.559-4.251,5.396l-28.963,65.069c-2.057,4.619-1.056,10.027,2.521,13.6c2.337,2.336,5.461,3.576,8.639,3.576c1.675,0,3.362-0.346,4.96-1.057l65.07-28.963c1.83-0.815,5.114-3.97,5.396-4.25L483.876,74.169c7.131-7.131,11.06-16.61,11.06-26.692C494.936,37.396,491.007,27.915,483.876,20.791z M466.61,56.897L257.457,266.05c-0.035,0.036-0.055,0.078-0.089,0.107l-33.989,15.131L238.51,247.3c0.03-0.036,0.071-0.055,0.107-0.09L447.765,38.058c5.038-5.039,13.819-5.033,18.846,0.005c2.518,2.51,3.905,5.855,3.905,9.414C470.516,51.036,469.127,54.38,466.61,56.897z"/></g></g></svg>`;
    return icon.firstChild;
}

function workflowIcon() {
    const icon = document.createElement('svg');
    icon.innerHTML = `<svg width="15px" height="15px" viewBox="0 0 1024 1024" class="icon"  version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M786.358857 809.325714a88.356571 88.356571 0 0 1 176.566857 0 88.283429 88.283429 0 0 1-176.566857 0z m-274.797714 89.234286c-48.64 0-88.210286-39.497143-88.210286-88.064a88.210286 88.210286 0 0 1 176.420572 0c0 48.566857-39.570286 88.064-88.210286 88.064zM512.512 59.538286c48.566857 0 88.137143 39.497143 88.137143 87.917714a88.137143 88.137143 0 0 1-176.201143 0c0-48.493714 39.497143-87.917714 88.064-87.917714zM145.334857 896.731429c-48.64 0-88.210286-39.497143-88.210286-88.137143a88.283429 88.283429 0 0 1 176.493715 0c0 48.64-39.643429 88.137143-88.283429 88.137143zM905.069714 425.691429a29.549714 29.549714 0 0 0-8.265143-20.48 30.793143 30.793143 0 0 0-20.48-8.265143H541.257143V291.181714a147.309714 147.309714 0 0 0 117.906286-144.237714 147.163429 147.163429 0 0 0-294.253715 0c0 71.826286 49.883429 131.510857 118.125715 144.237714-0.146286 0.365714-1.974857 105.691429-1.974858 105.691429H147.675429a28.452571 28.452571 0 0 0-20.48 8.265143 30.134857 30.134857 0 0 0-8.923429 20.48l0.658286 241.590857c-59.245714 9.508571-118.345143 70.656-118.345143 143.725714 0 81.042286 65.974857 147.017143 147.090286 147.017143 81.188571 0 147.163429-65.974857 147.163428-147.017143 0-70.656-53.101714-131.437714-112.128-143.725714V464.969143h300.324572v191.488c0 3.730286 0.877714 7.094857 2.048 10.24a147.017143 147.017143 0 0 0-120.173715 144.237714 147.236571 147.236571 0 0 0 294.253715 0c0-71.899429-52.077714-131.657143-120.539429-144.237714a29.110857 29.110857 0 0 0 1.974857-10.24V464.969143h300.617143v202.24c-64.365714 14.116571-112.054857 73.142857-112.054857 143.725714a147.236571 147.236571 0 0 0 294.253714 0c0-72.996571-57.344-134.656-118.345143-144.530286 0.365714-1.097143 0-240.786286 0-240.786285z" fill="#000000" /></svg>`;
    return icon.firstChild;
}


function createFolderIcon() {
    const icon = document.createElement('svg');
    icon.innerHTML = `<svg height="15px" width="15px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512"  xml:space="preserve"><style type="text/css">
   .st0{fill:#000000;}</style><g><path class="st0" d="M503.654,101.298h-43.289V58c0-4.61-3.727-8.338-8.329-8.338h-16.833c-4.602,0-8.347,3.728-8.347,8.338v43.298h-43.289c-4.602,0-8.329,3.727-8.329,8.329v16.833c0,4.602,3.727,8.346,8.329,8.346h43.289v43.29c0,4.601,3.745,8.337,8.347,8.337h16.833c4.602,0,8.329-3.736,8.329-8.337v-43.29h43.289c4.619,0,8.346-3.744,8.346-8.346v-16.833C512,105.026,508.273,101.298,503.654,101.298z"/> <path class="st0" d="M500.836,239.74l-0.21-0.428l-0.28-0.394c-8.556-12.616-22.817-20.367-38.216-20.367H382.22l-12.633-36.115l-0.385,0.096c-8.836-19.204-27.839-32.178-49.519-32.178H144.986c-1.994-0.026-4.041-1.129-5.231-3.666l0.017,0.035c-8.592-18.889-27.314-31.329-48.224-31.329H46.474c-0.035,0-0.035-0.009-0.052-0.009c-15.118,0.009-29.134,7.489-37.743,19.702l-0.595,0.866l-0.123,0.376C2.748,144.22,0,153.355,0,162.611c0,4.768,0.736,9.571,2.188,14.243H2.17l0.018,0.035l0.017,0.061l0.018,0.062v0.017l76.115,247.645v0.035l0.332,1.033c6.912,21.801,27.121,36.587,49.973,36.587l272.719,0.009c19.72-0.009,37.48-11.102,46.404-28.268l0.437,0.141l57.516-152.178l0.07-0.201l0.017-0.062l0.018-0.035c1.838-5.196,2.73-10.62,2.73-15.992c0-9.098-2.625-18.136-7.717-25.984V239.74z M472.63,270.011l-55.03,145.58l-0.035,0.106c-2.432,6.859-8.941,11.443-16.203,11.443l-272.719-0.017c-7.506,0.017-14.156-4.848-16.412-12.004L35.783,166.382l0.017,0.043c-0.402-1.251-0.595-2.537-0.595-3.814c0-2.608,0.805-5.162,2.258-7.244l-0.018,0.017c2.223-3.114,5.547-4.786,8.994-4.786h45.11c6.754,0,13.106,4.007,16.185,10.735c6.649,14.602,21.12,24.217,37.253,24.217h174.697c8.294,0,15.906,5.486,18.653,14.156l0.07,0.21l8.994,25.678H207.733c-20.279,0-38.18,13.019-44.951,32.134l-35.608,102.904l26.596,9.204l35.573-102.781l-0.035,0.122c2.974-8.276,10.376-13.42,18.425-13.42h254.399c3.482,0,6.912,1.741,9.1,4.97c1.364,2.029,2.134,4.496,2.117,7.016C473.348,267.186,473.103,268.629,472.63,270.011z"/></g></svg>`;
    return icon.firstChild;
}


function renameElement() {
    let el = editButtonIcon();
    el.style.marginLeft = '0em';
    el.style.cursor = 'text';
    el.style.display = 'inline-block';

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
        moveActionListBlock();

        // снимаем блокировку и удаляем элемент
        input.remove(); 
        input.removeAttribute('data-ghflexible-event-lock');
        input = null;
    }

    input.onblur = function (event) {
        change(event);
    }
    
    input.onchange =    function(event) {
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
    let li = document.createElement('li');
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
    
    let span = document.createElement('span');
    span.setAttribute('class', 'ActionList-item-label ActionList-item-label--truncate');
    span.innerText = name;
    span.style.marginRight = '0.8em';

    let folderIcon = folderClosedIcon();
    folderIcon.style.cursor = 'default';

    folderIcon.onmousedown = function(event) {
        event.stopPropagation();
        folderActionClick(this.parentElement);
        saveState();
    }

    let ul = document.createElement('ul')
    ul.setAttribute('data-ghflexible-folder-list', 'true');
    let dline = createDropableLine({first: true});
    dline.setAttribute('hidden', '');
    ul.appendChild(dline);

    li.appendChild(folderIcon);
    li.appendChild(span);
    li.appendChild(renameElement());
    li.appendChild(ul);
    
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
    icon.innerHTML = `<svg width="15px" height="15px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <title>folder-outline</title><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="folder" fill="#000000" transform="translate(42.666667, 85.333333)"><path d="M426.666667,341.333333 L3.55271368e-14,341.333333 L3.55271368e-14,1.42108547e-14 L178.083413,1.42108547e-14 L232.041813,42.6666667 L426.666667,42.6666667 L426.666667,341.333333 Z M42.6666667,298.666667 L384,298.666667 L384,85.3333333 L217.20832,85.3333333 L163.24992,42.6666667 L42.6666667,42.6666667 L42.6666667,298.666667 Z" id="Shape"></path></g></g></svg>`;
    icon.firstChild.style.marginRight = '0.2em';
    return icon.firstChild;
}

function folderOpenIcon() {
    const icon = document.createElement("svg");
    icon.innerHTML = `<svg fill="#000000" width="15px" height="15px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M384,128 L384,42.6666667 L232.0416,42.6666667 L178.0832,1.42108547e-14 L-2.13162821e-14,1.42108547e-14 L-2.13162821e-14,341.333333 L60.9376,341.333333 L363.416533,341.333333 L372.583253,341.333333 L437.333333,128 L384,128 Z M42.6666667,253.44 L42.6666667,42.6666667 L163.24992,42.6666667 L217.20832,85.3333333 L341.333333,85.3333333 L341.333333,128 L82.0209067,128 L42.6666667,253.44 Z M340.95808,298.666667 L73.1874133,298.666667 L113.354027,170.666667 L379.79136,170.666667 L340.95808,298.666667 Z" transform="translate(42.667 85.333)"/></svg>`;
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
        ul.children[i].setAttribute('hidden', '');
        if (checkFolder(ul.children[i]) || checkWorkflow(ul.children[i])) {
            setIndents(ul.children[i], countIndents(ul.children[i]));
        }
    }
}

function folderActionOpen(folder) {
    folder.setAttribute('data-ghflexible-folder-open', 'true');
    let saveEventOnmouseDown = folder.children[0].onmousedown;
    folder.replaceChild(folderOpenIcon(), folder.children[0]);
    folder.children[0].onmousedown = saveEventOnmouseDown;
    folder.children[0].style.cursor = 'default';

    let ul = folder.children[3];
    for (let i = 0; i < ul.children.length; i++) {
        ul.children[i].removeAttribute('hidden');
        if (checkFolder(ul.children[i]) || checkWorkflow(ul.children[i])) {
            setIndents(ul.children[i], countIndents(ul.children[i]));
        }
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

function workflowGetUrlName(workflow) {
    const s = workflow.children[1].href.split('/');
    return s[s.length - 1];
}


function moveActionListBlock() {

    let actionList = document.querySelector(SELECTOR_ACTIONS);
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
    let px = (maxLetters * 10 + 56);
    if (px < 256) {
        px = 256;
    }
    px = px + 'px';
    block.style.setProperty('--Layout-pane-width', px);
}

function depthFirstSearch(element, callback) {
    if (checkRootFolder(element)) {
        // console.log("### IS ROOT ###");
        for (let i = 0; i < element.children.length; i++) {
            depthFirstSearch(element.children[i], callback);
        }
    }

    if (checkFolder(element)) {
        // console.log(`### IS FOLDER: ${folderGetName(element)}`);
        callback(element);
        depthFirstSearch(element.children[3], callback);
    }

    if (checkFolderList(element)) {
        // console.log(`### IS FOLDER LIST: ${folderGetName(element.parentElement)}`);
        for (let i = 0; i < element.children.length; i++) {
            depthFirstSearch(element.children[i], callback);
        }
    }

    if (checkDropableLine(element) ) {
        // console.log(`### IS DROPLINE ###`);
    }

    if (checkWorkflow(element) ) {
        // console.log(`### IS WORKFLOW: ${workflowGetName(element)}`);
        callback(element);
    }
}

function getSaveKey() {
    return 'ghflexible/' + window.location.pathname.split('/')[1] + '/' + window.location.pathname.split('/')[2];
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
    // stateConvertGraph(state, state);

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
        const span = sel.children[1].children[0];
        span.innerText = stateElement.title;
        sel.setAttribute('data-ghflexible-rename', stateElement.title);
        
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