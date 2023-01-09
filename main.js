console.log("Hello world chrome extension");

let selectorActions = 'ul.ActionList.ActionList--subGroup';
// let actionListHtml = document.querySelector(selectorActions);
// console.log(actionListHtml.children[10].getAttribute('hidden'));

function searchShowWorkflows() {
    let actionListHtml = document.querySelector(selectorActions);
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
        console.log(showWorkflows);
        if (showWorkflows && showWorkflows !== true) {
            showWorkflows.click();
        }
        i++;
        console.log(i);
    }
}



( async () => {
    console.log(searchShowWorkflows());
    await waitClickShowWorkflows();


    // читаем все доступные workflows
    let workflows = {};
    let actionListHtml = document.querySelector(selectorActions);
    for (let i = 0; i < actionListHtml.children.length; i++) {
        let li = actionListHtml.children[i];
        if (li.getAttribute('data-test-selector') != 'workflows-show-more') {
            let name = li.children[0].children[0].innerText;
            workflows[name] = {
                li: {
                    dataItemId: li.getAttribute('data-item-id'),
                    class: li.getAttribute('class'),
                },
                a: {
                    href: li.children[0].getAttribute('href'),
                    class: li.children[0].getAttribute('class'),
                },
                span: {
                    class: li.children[0].children[0].getAttribute('class'),
                }

            }

            if ( i == 2) {
                li.onmousedown = function(event) { // (1) отследить нажатие

                    // запоминаем позицию курсора

                    let shiftX = event.clientX - li.getBoundingClientRect().left;
                    let shiftY = event.clientY - li.getBoundingClientRect().top;

                    // (2) подготовить к перемещению:
                    // разместить поверх остального содержимого и в абсолютных координатах
                    li.style.position = 'absolute';
                    li.style.zIndex = 1000;
                    // переместим в body, чтобы мяч был точно не внутри position:relative
                    document.body.append(li);
                    // и установим абсолютно спозиционированный мяч под курсор
                  
                    moveAt(event.pageX, event.pageY);
                  
                    // передвинуть мяч под координаты курсора
                    // и сдвинуть на половину ширины/высоты для центрирования
                    function moveAt(pageX, pageY) {
                      li.style.left = pageX - shiftX + 'px';
                      li.style.top = pageY - shiftY + 'px';
                    }
                  
                    function onMouseMove(event) {
                      moveAt(event.pageX, event.pageY);

                    //   li.hidden = true;
                    //   let elemBelow = document.elementFromPoint(event.clientX, event.clientY);
                    //   li.hidden = false;

                    //   if (!elemBelow) return;
                    //   console.log(elemBelow);
                    }
                  
                    // (3) перемещать по экрану
                    document.addEventListener('mousemove', onMouseMove);
                  
                    // (4) положить мяч, удалить более ненужные обработчики событий
                    li.onmouseup = function() {
                      document.removeEventListener('mousemove', onMouseMove);
                      li.onmouseup = null;
                    };
                  
                };
                li.ondragstart = function () {
                    return false;
                };
            }
        }
    }


    // пример добавления элемента в список
    let li = document.createElement('li');
    li.setAttribute('tabindex', -1);
    li.setAttribute('data-test-selector', 'workflow-rendered');
    li.setAttribute('data-view-component', true);
    li.setAttribute('class', 'ActionList-item');

    let a =  document.createElement('a');
    a.setAttribute('data-view-component', true);
    a.setAttribute('data-turbo-frame', 'repo-content-turbo-frame');
    a.setAttribute('class', 'ActionList-content ActionList-content--visual16');

    let span = document.createElement('span');
    span.setAttribute('class', 'ActionList-item-label ActionList-item-label--truncate');
    span.innerHTML = "test";

    a.appendChild(span);
    li.appendChild(a);
    actionListHtml.prepend(li);





})();
