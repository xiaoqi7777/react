import { TAG_ROOT, ELEMENT_TEXT, TAG_TEXT, TAG_HOST, PLACEMENT } from "./constants";
import { setProps } from './utils';
/*
  从根节点开始渲染和调度
  两个阶段
  diff阶段 对比新旧的虚拟DOM  进行增重 更新或创建 render阶段
    这个阶段可以比较花时间,我们可以对任务进行拆分,拆分的维度虚拟DOM。此阶段可以暂停
  render阶段成功是effect list知道哪些节点更新 哪些节点删除了 哪些节点增加了 
  render阶段有两个任务1、根据虚拟DOM生成fiber树 2、收集effectList
  commit阶段,进行DOM更新创建阶段,此阶段不能暂停,要一气呵成
*/
let nextUnitOfWork = null; // 下一个工作单元
let workInProgressRoot = null;// RootFiber引用的根
export function scheduleRoot(rootFiber){ //{tag:TAG_ROOT,stateNode:container,props:{children:[element]}}
  workInProgressRoot = rootFiber
  nextUnitOfWork = rootFiber;
}
// 执行当前单元节点
function performUnitOfWork(currentFiber){
  // 开始遍历当前的fiber的children 为每一个child配置成fiber 每个child之前通过 sibling 进行连接(大哥.sibling=二哥  二哥.sibling = 三妹)
  beginWork(currentFiber);
  // 1、有儿子情况 就返回他的儿子  作为下一个任务 下一个任务又回到 performUnitOfWork 里面
  if(currentFiber.child){
    return currentFiber.child;
  }
  // 2、没有儿子情况   就找弟弟
  while(currentFiber){
    completeUnitOfWork(currentFiber);//没有儿子 让自己完成
    if(currentFiber.sibling){// 看有没有弟弟
      return currentFiber.sibling;// 有弟弟就返回弟弟
    }
    // 3、没有儿子 自己也完成 没有弟弟, 就获取父亲 让父亲完成->去找他的弟弟(此时儿子都完成了),弟弟有就返回,到此三角形就循环起来了
    currentFiber = currentFiber.return;// 找父亲 然后让父亲完成
  }
}
// 在完成的时候(第一个是A1)要收集有副作用的fiber,然后组成effect list
// 每个fiber有两个属性,firstEffect指向第一个副作用的子fiber lasterEffect指向最后一个有副作用的fiber
// 中间的用nextEffect做成一个单链表 firstEffect=大儿子.nextEffect=二儿子.nextEffect=三儿子,lastEffect 也指向三儿子
/* 
  completeUnitOfWork 按照这个结构走
  A 
  A(Next)
  B1     B2
  C1 C2  D1  D2
*/
function completeUnitOfWork(currentFiber){// 第一个完成的是A1(TEXT) 
  // 此处打印所有完成的情况
  console.log('type=',currentFiber.type,'id=',currentFiber.props.id,'text=',currentFiber.props.text,)
  let returnFiber = currentFiber.return;// A1(TEXT) 的父亲 是A1
  if(returnFiber){
    /////// 这一段是把儿子的effect 链子挂到父亲身上
    //当没有父firstEffect没有的时候  让父的firstEffect 等于儿子的 firstEffect
    if(!returnFiber.firstEffect){
      // 根节点的 firstEffect 指向第一个完成的 节点 以后就不会变动了
      returnFiber.firstEffect = currentFiber.firstEffect;
    }
    if(currentFiber.lastEffect){
      if(returnFiber.lastEffect){
        // 让兄弟节点(B1)的最后一个.nextEffect 指向兄弟节点(B2)最开始一个.nextEffect
        returnFiber.lastEffect.nextEffect = currentFiber.firstEffect
      }
        // 根节点的 指向当前节点的 最后一个完成的
        returnFiber.lastEffect = currentFiber.lastEffect
    }
    /////把自己挂到父亲身上
    const effectTag = currentFiber.effectTag;
    if(effectTag){ //说明自己有副作用 没有的时候 就是新增
      if (returnFiber.lastEffect){
        returnFiber.lastEffect.nextEffect = currentFiber
      }else{
        returnFiber.firstEffect = currentFiber;
      }
      // lastEffect一直都是在变动的
      returnFiber.lastEffect = currentFiber
    }
  }
}
  /*
    beginWork开始收集
    completeUnitOfWork 把下面的都收集完成了
    1、创建真是DOM元素
    2、创建子fiber 
   */
function beginWork(currentFiber){
  // 如果是根节点
  if(currentFiber.tag === TAG_ROOT){
    updateHostRoot(currentFiber);
  // 如果是文本节点
  }else if(currentFiber.tag === TAG_TEXT){
    updateHostText(currentFiber)
  }else if (currentFiber.tag === TAG_HOST){// 原生DOM节点
    updateHost(currentFiber)
  }
}
function updateHost(currentFiber){
  if(!currentFiber.stateNode){// 如果此fiber没有创建DOM节点
    currentFiber.stateNode = createDOM(currentFiber)
  }
  const newChildren = currentFiber.props.children
  reconcileChildren(currentFiber,newChildren);
}
// 创建真是的节点
function createDOM(currentFiber){
  // 文本节点
  if(currentFiber.tag === TAG_TEXT){
    return document.createTextNode(currentFiber.props.text)
  }else if(currentFiber.tag === TAG_HOST){
  // 原生节点
    let stateNode = document.createElement(currentFiber.type)
    updateDOM(stateNode,{},currentFiber.props);
    return stateNode;
  }
}
function updateDOM(stateNode,oldProps,newProps){
  // 增加 if (stateNode && stateNode.setAttribute)
  if (stateNode && stateNode.setAttribute){
    setProps(stateNode,oldProps,newProps);
  }
}
function updateHostText(currentFiber){
  // 如果此fiber没有创建DOM节点
  if(!currentFiber.stateNode){
    currentFiber.stateNode = createDOM(currentFiber)
  }
}
function updateHostRoot(currentFiber){
  // 先处理自己, 如果是一个原生节点 创建真实DOM 2、创建子fiber
  let newChildren = currentFiber.props.children;//[element=A1]
  // 调和节点 这里出创建根节点一个 Fiber
  reconcileChildren(currentFiber,newChildren);
}
//newChildren是一个虚拟DOM的数组 把虚拟DOM转成Fiber节点
function reconcileChildren(currentFiber,newChildren){
  let newChildIndex = 0;// 新子节点的索引
  // 增加2行
  let prevSibling;// 上一个新的子fiber
  // 遍历我们的子虚拟DOM 元素数组,为每个虚拟DOM元素创建子Fiber
  while(newChildIndex<newChildren.length){
    let newChild = newChildren[newChildIndex];// 取出子元素节点[A1]{type=A1}
    let tag;
    if(newChild && newChild.type === ELEMENT_TEXT){
      tag = TAG_TEXT;// 这是一个文本节点
    }else if(newChild && typeof newChild.type === 'string'){
      tag = TAG_HOST;// 如果type是字符串,那是一个原生的DOM节点
    }
    // beginWork创建fiber 在 completeUnitOfWork 的时候收集effect
    let newFiber = {
      tag,//TAG_HOST
      type:newChild.type,
      props:newChild.props,
      stateNode:null,// div还没有创建DOM元素
      return:currentFiber,//父Fiber
      effectTag:PLACEMENT,// 副作用标识,render我们要会收集副作用 增加 删除 更新
      nextEffect:null,// effect list 也是一个单链表
      // effect list 顺序和完成顺序是一样的 但是节点只放哪些变化的fiber节点,不变化的不会放进去
    }
    // 最小的儿子是没有弟弟的
    if(newFiber){
      if(newChildIndex === 0){// 如果当前索引为0 说明是第一个儿子
        currentFiber.child = newFiber
      }else{
        // 让第一儿子 指向他下一个兄弟
        // reconcileChildren 只会遍历当前的儿子
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber
    }
    newChildIndex++;
  }
}
// 循环执行工作 nextUnitWork 不管有沒有任务都会进入 一旦检测到nextUnitOfWork 有值就执行逻辑
function workLoop(deadLine){
  let shouldYield = false;//是否要让出时间片或者说控制权
  while(nextUnitOfWork && !shouldYield){
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);//执行完一个任务后
    shouldYield = deadLine.timeRemaining() < 1;// 没有时间的话 就要让出控制权
  }
  if(!nextUnitOfWork && workInProgressRoot){// 如果时间片到期后还有任务没有完成,就需要请求浏览器再次调度
    commitRoot();
  }
  // 不管有没有任务 都请求再次调度 每一帧都要执行一次workLoop
  requestIdleCallback(workLoop,{timeout:500})
}
function commitRoot(){
  let currentFiber = workInProgressRoot.firstEffect 
  while(currentFiber){
    commitWork(currentFiber);
    currentFiber = currentFiber.nextEffect;
  }
  workInProgressRoot = null
}
function commitWork(currentFiber){
  if(!currentFiber) return;
  let returnFiber = currentFiber.return;
  let returnDOM = returnFiber.stateNode;
  if(currentFiber.effectTag === PLACEMENT){
    returnDOM.appendChild(currentFiber.stateNode)
  }
  currentFiber.effectTag = null;
}
// react告诉浏览器 我现在有任务请你在闲的时候
requestIdleCallback(workLoop,{timeout:500})