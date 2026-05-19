/* =====================================================================
   visualizations.js — SVG infographics for each algorithm
   Each viz exports a build(container) function that:
     - inserts an SVG and control buttons
     - manages its own step animation
   ===================================================================== */

const VIZ = {};

/* helper: build an SVG element */
function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.appendChild(c);
  return el;
}

/* helper: build viz frame with controls and a stepper */
function buildViz(container, { width = 600, height = 240, caption = "" }, frames, render) {
  container.innerHTML = "";
  const root = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "viz-svg",
    preserveAspectRatio: "xMidYMid meet",
  });
  container.appendChild(root);

  const cap = document.createElement("div");
  cap.className = "viz-caption";
  container.appendChild(cap);

  const controls = document.createElement("div");
  controls.className = "viz-controls";
  controls.innerHTML = `
    <button data-act="reset">↶ Reset</button>
    <button data-act="step">Step ▸</button>
    <button data-act="play">▶ Play</button>
  `;
  container.appendChild(controls);

  let idx = 0;
  let timer = null;

  function show(i) {
    idx = Math.max(0, Math.min(frames.length - 1, i));
    render(root, frames[idx]);
    cap.textContent = frames[idx].caption || caption;
  }
  function step() { if (idx < frames.length - 1) show(idx + 1); else stopPlay(); }
  function reset() { stopPlay(); show(0); }
  function play() {
    if (timer) return;
    controls.querySelector('[data-act="play"]').textContent = "❚❚ Pause";
    timer = setInterval(() => {
      if (idx >= frames.length - 1) { stopPlay(); return; }
      step();
    }, 900);
  }
  function stopPlay() {
    if (timer) { clearInterval(timer); timer = null; }
    controls.querySelector('[data-act="play"]').textContent = "▶ Play";
  }

  controls.addEventListener("click", (e) => {
    const act = e.target.dataset.act;
    if (act === "reset") reset();
    if (act === "step") { stopPlay(); step(); }
    if (act === "play") { timer ? stopPlay() : play(); }
  });

  show(0);
}

/* =====================================================================
   BAR-CHART vizzes (sorting, kadane, etc.)
   frame: { bars: [{v, state}], pointers: [{i, label}], caption }
   state: '', 'active', 'done', 'pivot'
   ===================================================================== */
function renderBars(root, frame) {
  root.innerHTML = "";
  const W = 600, H = 240;
  const padX = 40, padY = 40;
  const n = frame.bars.length;
  const slot = (W - padX * 2) / n;
  const bw = slot * 0.7;
  const maxV = Math.max(...frame.bars.map(b => b.v), 1);
  const barH = H - padY * 2;

  frame.bars.forEach((b, i) => {
    const h = (b.v / maxV) * barH;
    const x = padX + i * slot + (slot - bw) / 2;
    const y = H - padY - h;
    root.appendChild(svg("rect", {
      class: `bar ${b.state || ""}`,
      x, y, width: bw, height: h,
    }));
    root.appendChild(svg("text", {
      class: "label outside",
      x: x + bw / 2, y: H - padY + 16,
      "text-anchor": "middle",
    })).textContent = b.v;
  });

  (frame.pointers || []).forEach(p => {
    const x = padX + p.i * slot + slot / 2;
    const y = H - padY + 28;
    const tri = svg("path", {
      class: "pointer",
      d: `M ${x},${y - 4} L ${x - 6},${y + 6} L ${x + 6},${y + 6} Z`,
    });
    root.appendChild(tri);
    root.appendChild(svg("text", {
      class: "pointer-label",
      x, y: y + 20, "text-anchor": "middle",
    })).textContent = p.label;
  });
}

/* ---------- TWO POINTERS ---------- */
VIZ.two_pointers = (c) => {
  const arr = [1, 3, 4, 6, 8, 11];
  const target = 10;
  const frames = [];
  let L = 0, R = arr.length - 1;
  const baseBars = () => arr.map(v => ({ v, state: "" }));
  frames.push({ bars: baseBars(), pointers: [{ i: L, label: "L" }, { i: R, label: "R" }],
    caption: `Looking for pair summing to ${target}` });
  while (L < R) {
    const s = arr[L] + arr[R];
    const bars = baseBars();
    bars[L].state = "active"; bars[R].state = "active";
    frames.push({ bars, pointers: [{ i: L, label: "L" }, { i: R, label: "R" }],
      caption: `${arr[L]} + ${arr[R]} = ${s} ${s === target ? "✓ found!" : s < target ? "→ move L right" : "→ move R left"}` });
    if (s === target) { frames[frames.length-1].bars[L].state="done"; frames[frames.length-1].bars[R].state="done"; break; }
    if (s < target) L++; else R--;
  }
  buildViz(c, { caption: `arr=[1,3,4,6,8,11] target=${target}` }, frames, renderBars);
};

/* ---------- SLIDING WINDOW ---------- */
VIZ.sliding_window = (c) => {
  const arr = [2, 5, 1, 7, 3, 4, 6];
  const k = 3;
  const frames = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const bars = arr.map((v, j) => ({ v, state: (j >= i && j < i + k) ? "active" : "" }));
    const sum = arr.slice(i, i + k).reduce((a, b) => a + b, 0);
    frames.push({ bars,
      pointers: [{ i, label: "L" }, { i: i + k - 1, label: "R" }],
      caption: `window [${i}..${i + k - 1}]  sum = ${sum}` });
  }
  buildViz(c, { caption: `Window of size ${k}` }, frames, renderBars);
};

/* ---------- KADANE ---------- */
VIZ.kadane = (c) => {
  const arr = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
  const frames = [];
  let curr = arr[0], best = arr[0], bestStart = 0, bestEnd = 0, start = 0;
  frames.push({ bars: arr.map((v,j) => ({v, state: j===0?"active":""})),
    caption: `Start: curr=${curr}, best=${best}` });
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > curr + arr[i]) { curr = arr[i]; start = i; }
    else curr += arr[i];
    if (curr > best) { best = curr; bestStart = start; bestEnd = i; }
    const bars = arr.map((v, j) => ({ v, state: (j === i) ? "active" : "" }));
    frames.push({ bars, caption: `i=${i}  curr=${curr}  best=${best}` });
  }
  const final = arr.map((v, j) => ({ v, state: (j >= bestStart && j <= bestEnd) ? "done" : "" }));
  frames.push({ bars: final, caption: `Best subarray sum = ${best}` });
  buildViz(c, { caption: "Maximum subarray (Kadane)" }, frames, renderBars);
};

/* ---------- PREFIX SUM ---------- */
VIZ.prefix_sum = (c) => {
  const arr = [3, 1, 4, 1, 5, 9, 2];
  const prefix = [0];
  for (const n of arr) prefix.push(prefix[prefix.length-1] + n);
  const frames = [{ bars: arr.map(v => ({v, state:""})), caption: "Original array" }];
  for (let i = 0; i < arr.length; i++) {
    const bars = arr.map((v,j) => ({v, state: j <= i ? "active" : ""}));
    frames.push({ bars, caption: `prefix[${i+1}] = ${prefix[i+1]}  (cumulative sum)` });
  }
  frames.push({ bars: prefix.slice(1).map(v => ({v, state: "done"})),
    caption: "Prefix array → range[i..j] sum = prefix[j+1] − prefix[i]" });
  buildViz(c, { caption: "Building a prefix-sum array" }, frames, renderBars);
};

/* ---------- MERGE SORT ---------- */
VIZ.merge_sort = (c) => {
  const arr = [5, 2, 8, 1, 9, 3, 7, 4];
  const frames = [{ bars: arr.map(v => ({v, state:""})), caption: "Unsorted" }];
  // split halves visually
  frames.push({ bars: arr.map((v,j) => ({v, state: j<4?"active":"pivot"})),
    caption: "Split in half" });
  frames.push({ bars: arr.map((v,j) => ({v, state: j<2?"active":j<4?"pivot":j<6?"active":"pivot"})),
    caption: "Split each half" });
  // sorted halves
  const left = [1,2,5,8], right = [3,4,7,9];
  frames.push({ bars: [...left,...right].map(v => ({v, state: "active"})),
    caption: "Each half sorted recursively" });
  // merge
  const merged = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) merged.push(left[i++]); else merged.push(right[j++]);
    const remaining = [...left.slice(i), ...right.slice(j)];
    frames.push({ bars: [
      ...merged.map(v => ({v, state: "done"})),
      ...remaining.map(v => ({v, state: "active"}))
    ], caption: `Merging: took ${merged[merged.length-1]}` });
  }
  while (i < left.length) {
    merged.push(left[i++]);
    frames.push({ bars: merged.map(v => ({v, state:"done"})), caption: "Tail copy" });
  }
  while (j < right.length) {
    merged.push(right[j++]);
    frames.push({ bars: merged.map(v => ({v, state:"done"})), caption: "Tail copy" });
  }
  frames.push({ bars: merged.map(v => ({v, state:"done"})), caption: "Sorted ✓" });
  buildViz(c, { caption: "Merge sort: split, sort, merge" }, frames, renderBars);
};

/* ---------- QUICK SORT ---------- */
VIZ.quick_sort = (c) => {
  const arr = [6, 2, 8, 4, 1, 9, 3, 7];
  const frames = [{ bars: arr.map(v=>({v,state:""})), caption: "Unsorted" }];
  const pivot = arr[Math.floor(arr.length/2)];
  frames.push({ bars: arr.map(v => ({v, state: v===pivot?"pivot":""})),
    caption: `Pivot = ${pivot}` });
  const lt = arr.filter(v => v < pivot);
  const eq = arr.filter(v => v === pivot);
  const gt = arr.filter(v => v > pivot);
  frames.push({ bars: [...lt,...eq,...gt].map((v) => ({
    v, state: v < pivot ? "active" : v === pivot ? "pivot" : ""
  })), caption: "Partition: smaller / pivot / larger" });
  const sortedL = [...lt].sort((a,b)=>a-b);
  const sortedR = [...gt].sort((a,b)=>a-b);
  frames.push({ bars: [...sortedL,...eq,...sortedR].map(v => ({
    v, state: "active"
  })), caption: "Recurse into left and right partitions" });
  frames.push({ bars: [...sortedL,...eq,...sortedR].map(v => ({v, state:"done"})),
    caption: "Sorted ✓" });
  buildViz(c, { caption: "Quick sort: partition around pivot" }, frames, renderBars);
};

/* ---------- BINARY SEARCH ---------- */
VIZ.binary_search = (c) => {
  const arr = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  const target = 17;
  const frames = [];
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const bars = arr.map((v, i) => ({
      v, state: i === mid ? "pivot" : i >= lo && i <= hi ? "active" : ""
    }));
    frames.push({ bars,
      pointers: [{ i: lo, label: "lo" }, { i: hi, label: "hi" }, { i: mid, label: "mid" }],
      caption: `lo=${lo} hi=${hi} mid=${mid}  arr[mid]=${arr[mid]}` });
    if (arr[mid] === target) {
      bars[mid].state = "done";
      frames.push({ bars, caption: `Found ${target} at index ${mid} ✓` });
      break;
    }
    if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  buildViz(c, { caption: `Search for ${target}` }, frames, renderBars);
};

/* ---------- HASHMAP — two sum ---------- */
VIZ.hashmap = (c) => {
  const arr = [2, 7, 11, 4, 9];
  const target = 13;
  const frames = [];
  const seen = {};
  for (let i = 0; i < arr.length; i++) {
    const need = target - arr[i];
    const bars = arr.map((v, j) => ({ v, state: j < i ? "active" : j === i ? "pivot" : "" }));
    if (need in seen) {
      bars[seen[need]].state = "done";
      bars[i].state = "done";
      frames.push({ bars,
        caption: `Need ${need}, found at index ${seen[need]} → Two Sum = [${seen[need]}, ${i}]` });
      break;
    }
    seen[arr[i]] = i;
    frames.push({ bars,
      caption: `i=${i} val=${arr[i]} need=${need} → store ${arr[i]}→${i}` });
  }
  buildViz(c, { caption: `Two Sum, target=${target}` }, frames, renderBars);
};

/* ---------- STACK ---------- */
VIZ.stack = (c) => {
  const ops = [
    { op: "push", v: "(" },
    { op: "push", v: "{" },
    { op: "push", v: "[" },
    { op: "pop", expected: "[" },
    { op: "pop", expected: "{" },
    { op: "pop", expected: "(" },
  ];
  const frames = [];
  let stack = [];
  for (const o of ops) {
    if (o.op === "push") stack = [...stack, o.v];
    else stack = stack.slice(0, -1);
    frames.push({ stack: [...stack],
      caption: `${o.op}${o.v ? "("+o.v+")" : "()"} → stack: [${stack.join(", ")}]` });
  }
  function renderStack(root, frame) {
    root.innerHTML = "";
    const W=600,H=240;
    const cx = W/2;
    const boxW = 80, boxH = 30;
    frame.stack.forEach((v, idx) => {
      const y = H - 50 - (idx+1)*boxH;
      root.appendChild(svg("rect", { class:"bar active", x: cx-boxW/2, y, width:boxW, height:boxH-2 }));
      const t = svg("text", { class:"label", x:cx, y:y+boxH/2+4, "text-anchor":"middle" });
      t.textContent = v; root.appendChild(t);
    });
    // base line
    root.appendChild(svg("line", {x1:cx-boxW/2-10, y1:H-50, x2:cx+boxW/2+10, y2:H-50, stroke:"var(--ink)", "stroke-width":2}));
    root.appendChild(svg("text", { class:"label outside", x:cx, y:H-30, "text-anchor":"middle" })).textContent = "← bottom of stack";
  }
  buildViz(c, { caption: "Push/pop on a stack" }, frames, renderStack);
};

/* ---------- QUEUE ---------- */
VIZ.queue = (c) => {
  const ops = [
    {op:"enq", v:"A"}, {op:"enq", v:"B"}, {op:"enq", v:"C"},
    {op:"deq"}, {op:"enq", v:"D"}, {op:"deq"}, {op:"deq"},
  ];
  const frames = [];
  let q = [];
  for (const o of ops) {
    if (o.op === "enq") q = [...q, o.v]; else q = q.slice(1);
    frames.push({ q: [...q],
      caption: o.op==="enq" ? `enqueue(${o.v}) → [${q.join(", ")}]` : `dequeue() → [${q.join(", ")}]` });
  }
  function renderQueue(root, frame) {
    root.innerHTML = "";
    const W=600,H=240;
    const cy = H/2;
    const boxW = 60, boxH = 50;
    const totalW = frame.q.length * boxW;
    const startX = (W - totalW) / 2;
    frame.q.forEach((v, idx) => {
      const x = startX + idx*boxW;
      root.appendChild(svg("rect", { class:"bar active", x, y: cy - boxH/2, width: boxW-2, height: boxH }));
      const t = svg("text", { class:"label", x: x + boxW/2, y: cy+4, "text-anchor":"middle"});
      t.textContent = v; root.appendChild(t);
    });
    if (frame.q.length) {
      root.appendChild(svg("text",{class:"label outside",x:startX-10,y:cy+5,"text-anchor":"end"})).textContent="front→";
      root.appendChild(svg("text",{class:"label outside",x:startX+totalW+10,y:cy+5,"text-anchor":"start"})).textContent="←back";
    }
  }
  buildViz(c, { caption: "FIFO queue: enqueue at back, dequeue at front" }, frames, renderQueue);
};

/* ---------- HEAP ---------- */
VIZ.heap = (c) => {
  // min-heap visualization as tree, inserting elements
  const inserts = [5, 3, 8, 1, 4, 7];
  const frames = [];
  let heap = [];
  function heapify(h, i) {
    while (i > 0) {
      const p = (i-1) >> 1;
      if (h[p] > h[i]) { [h[p], h[i]] = [h[i], h[p]]; i = p; } else break;
    }
  }
  for (const v of inserts) {
    heap = [...heap, v];
    heapify(heap, heap.length - 1);
    frames.push({ heap: [...heap], inserted: v, caption: `Insert ${v} → heap` });
  }
  function renderHeap(root, frame) {
    root.innerHTML = "";
    const W=600,H=240;
    const levels = Math.ceil(Math.log2(frame.heap.length + 1));
    frame.heap.forEach((v, i) => {
      const lvl = Math.floor(Math.log2(i+1));
      const slotsInLvl = 2**lvl;
      const idxInLvl = i - (slotsInLvl - 1);
      const y = 40 + lvl * (180 / Math.max(levels-1, 1));
      const x = (W / (slotsInLvl + 1)) * (idxInLvl + 1);
      // line to parent
      if (i > 0) {
        const p = (i-1) >> 1;
        const plvl = Math.floor(Math.log2(p+1));
        const pSlots = 2**plvl;
        const pIdx = p - (pSlots - 1);
        const py = 40 + plvl * (180 / Math.max(levels-1, 1));
        const px = (W / (pSlots + 1)) * (pIdx + 1);
        root.appendChild(svg("line", { x1:px, y1:py, x2:x, y2:y, stroke:"var(--ink)", "stroke-width":1 }));
      }
      root.appendChild(svg("circle", { class: `node-circle ${v===frame.inserted?"active":""}`, cx: x, cy: y, r: 18 }));
      root.appendChild(svg("text", { class:"node-label", x, y })).textContent = v;
    });
  }
  buildViz(c, { caption: "Building a min-heap" }, frames, renderHeap);
};

/* ---------- LINKED LIST — reversal ---------- */
VIZ.linked_list = (c) => {
  const vals = [1, 2, 3, 4, 5];
  const frames = [];
  // forward
  frames.push({ list: vals.map((v,i) => ({v, ptr:i})), reversed:false, caption: "Original: 1→2→3→4→5" });
  // gradual reversal
  for (let k = 1; k <= vals.length; k++) {
    const reversed = vals.slice(0, k).reverse();
    const rest = vals.slice(k);
    frames.push({ list: [...reversed, ...rest].map((v,i) => ({v, reversed: i < k})),
      caption: `After reversing ${k} node${k===1?"":"s"}` });
  }
  function renderLL(root, frame) {
    root.innerHTML = "";
    const W=600,H=120;
    const boxW = 50, gap = 30;
    const totalW = frame.list.length * boxW + (frame.list.length-1) * gap;
    const startX = (W - totalW) / 2;
    frame.list.forEach((node, i) => {
      const x = startX + i * (boxW + gap);
      root.appendChild(svg("rect", { class: `bar ${node.reversed?"done":""}`, x, y: 40, width: boxW, height: 50 }));
      const t = svg("text", { class:"label", x: x + boxW/2, y: 70, "text-anchor":"middle" });
      t.textContent = node.v; root.appendChild(t);
      if (i < frame.list.length - 1) {
        const ax = x + boxW;
        const dir = frame.reversed ? "← " : " →";
        root.appendChild(svg("path", {
          class:"arrow",
          d: `M ${ax+4},${65} L ${ax+gap-4},${65}`,
          "marker-end": "url(#ah)"
        }));
      }
    });
    // arrow marker
    const defs = svg("defs");
    const marker = svg("marker", { id:"ah", markerWidth:8, markerHeight:8, refX:6, refY:3, orient:"auto" });
    marker.appendChild(svg("path", { d:"M0,0 L0,6 L6,3 z", fill:"var(--ink)" }));
    defs.appendChild(marker);
    root.appendChild(defs);
  }
  buildViz(c, { width:600, height:120, caption:"Linked list reversal" }, frames, renderLL);
};

/* ---------- BINARY TREE — inorder ---------- */
VIZ.binary_tree = (c) => {
  // tree: 4 / 2 6 / 1 3 5 7
  const tree = {
    v:4, x:300, y:40,
    l:{v:2, x:180, y:110,
       l:{v:1, x:120, y:180}, r:{v:3, x:240, y:180}},
    r:{v:6, x:420, y:110,
       l:{v:5, x:360, y:180}, r:{v:7, x:480, y:180}}
  };
  const order = []; // inorder visit sequence
  (function walk(n){ if(!n) return; walk(n.l); order.push(n.v); walk(n.r); })(tree);
  const frames = [];
  for (let k = 0; k <= order.length; k++) {
    frames.push({ visited: order.slice(0, k),
      current: order[k-1],
      caption: k === 0 ? "Begin inorder traversal" :
               k === order.length ? `Inorder: ${order.join(", ")}` :
               `Visiting ${order[k-1]}` });
  }
  function renderTree(root, frame) {
    root.innerHTML = "";
    function draw(n) {
      if (!n) return;
      if (n.l) { root.appendChild(svg("line",{x1:n.x,y1:n.y,x2:n.l.x,y2:n.l.y,stroke:"var(--ink)","stroke-width":1.5})); draw(n.l); }
      if (n.r) { root.appendChild(svg("line",{x1:n.x,y1:n.y,x2:n.r.x,y2:n.r.y,stroke:"var(--ink)","stroke-width":1.5})); draw(n.r); }
    }
    draw(tree);
    function nodes(n){
      if(!n) return;
      const cls = frame.current===n.v ? "active" : (frame.visited.includes(n.v) ? "done" : "");
      root.appendChild(svg("circle", { class:`node-circle ${cls}`, cx:n.x, cy:n.y, r:18 }));
      root.appendChild(svg("text", { class:"node-label", x:n.x, y:n.y })).textContent = n.v;
      nodes(n.l); nodes(n.r);
    }
    nodes(tree);
  }
  buildViz(c, { width:600, height:230, caption:"Inorder traversal of a BST" }, frames, renderTree);
};

/* ---------- BFS ---------- */
VIZ.bfs = (c) => {
  const nodes = [
    {id:"A", x:300, y:40},
    {id:"B", x:160, y:120}, {id:"C", x:440, y:120},
    {id:"D", x:90, y:200}, {id:"E", x:230, y:200},
    {id:"F", x:370, y:200}, {id:"G", x:510, y:200}
  ];
  const edges = [["A","B"],["A","C"],["B","D"],["B","E"],["C","F"],["C","G"]];
  const adj = {}; for(const n of nodes) adj[n.id]=[];
  for (const [u,v] of edges){ adj[u].push(v); adj[v].push(u); }
  const visited = []; const queue = ["A"]; const seen=new Set(["A"]);
  const frames = [{ visited:[], current:null, queue:["A"], caption:"Start BFS from A" }];
  while(queue.length){
    const u = queue.shift(); visited.push(u);
    frames.push({ visited:[...visited], current:u, queue:[...queue], caption:`Visit ${u}` });
    for (const v of adj[u]) if(!seen.has(v)){ seen.add(v); queue.push(v); }
    if (queue.length) frames.push({ visited:[...visited], current:null, queue:[...queue], caption:`Queue: [${queue.join(", ")}]`});
  }
  function renderGraph(root, frame){
    root.innerHTML="";
    for (const [u,v] of edges){
      const a = nodes.find(n=>n.id===u), b = nodes.find(n=>n.id===v);
      root.appendChild(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"var(--ink)","stroke-width":1.5}));
    }
    for (const n of nodes){
      const cls = frame.current===n.id ? "active" : frame.visited.includes(n.id) ? "done" : "";
      root.appendChild(svg("circle",{class:`node-circle ${cls}`, cx:n.x, cy:n.y, r:18}));
      root.appendChild(svg("text",{class:"node-label", x:n.x, y:n.y})).textContent = n.id;
    }
  }
  buildViz(c, { width:600, height:240, caption:"BFS visits layer by layer" }, frames, renderGraph);
};

/* ---------- DFS ---------- */
VIZ.dfs = (c) => {
  const nodes = [
    {id:"A", x:300, y:40},
    {id:"B", x:160, y:120}, {id:"C", x:440, y:120},
    {id:"D", x:90, y:200}, {id:"E", x:230, y:200},
    {id:"F", x:370, y:200}, {id:"G", x:510, y:200}
  ];
  const edges = [["A","B"],["A","C"],["B","D"],["B","E"],["C","F"],["C","G"]];
  const adj = {}; for(const n of nodes) adj[n.id]=[];
  for (const [u,v] of edges){ adj[u].push(v); adj[v].push(u); }
  const frames = [{ visited:[], current:null, caption:"Start DFS from A" }];
  const seen = new Set();
  function dfs(u){
    seen.add(u);
    frames.push({ visited:[...seen], current:u, caption:`Visit ${u}` });
    for (const v of adj[u]) if(!seen.has(v)) dfs(v);
  }
  dfs("A");
  function renderGraph(root, frame){
    root.innerHTML="";
    for (const [u,v] of edges){
      const a = nodes.find(n=>n.id===u), b = nodes.find(n=>n.id===v);
      root.appendChild(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"var(--ink)","stroke-width":1.5}));
    }
    for (const n of nodes){
      const cls = frame.current===n.id ? "active" : frame.visited.includes(n.id) ? "done" : "";
      root.appendChild(svg("circle",{class:`node-circle ${cls}`, cx:n.x, cy:n.y, r:18}));
      root.appendChild(svg("text",{class:"node-label", x:n.x, y:n.y})).textContent = n.id;
    }
  }
  buildViz(c, { width:600, height:240, caption:"DFS goes deep first" }, frames, renderGraph);
};

/* ---------- RECURSION — factorial ---------- */
VIZ.recursion = (c) => {
  const frames = [];
  // build call stack going down
  for (let n = 4; n >= 1; n--) frames.push({ stack: Array.from({length:5-n}, (_,i)=>`fact(${4-i})`), unwound:[], caption:`Call fact(${n})` });
  frames.push({ stack:["fact(4)","fact(3)","fact(2)","fact(1)"], unwound:[], caption:"Base case fact(1) = 1" });
  // unwind
  const results = [1, 2, 6, 24];
  for (let i = 0; i < 4; i++){
    frames.push({ stack: ["fact(4)","fact(3)","fact(2)","fact(1)"].slice(0, 4-i-1),
      unwound: results.slice(0, i+1).map((r,j)=>`fact(${j+1})=${r}`),
      caption: `Return ${results[i]} (fact(${i+1}))` });
  }
  function renderRec(root, frame){
    root.innerHTML="";
    const W=600,H=240;
    frame.stack.forEach((s, idx) => {
      const y = 30 + idx * 36;
      root.appendChild(svg("rect", { class:"bar active", x: 50, y, width: 200, height: 28 }));
      root.appendChild(svg("text", { class:"label", x: 150, y: y+18, "text-anchor":"middle" })).textContent = s;
    });
    frame.unwound.forEach((s, idx) => {
      const y = 30 + idx * 36;
      root.appendChild(svg("rect", { class:"bar done", x: 350, y, width: 200, height: 28 }));
      root.appendChild(svg("text", { class:"label", x: 450, y: y+18, "text-anchor":"middle" })).textContent = s;
    });
    root.appendChild(svg("text",{class:"label outside", x:150, y:18, "text-anchor":"middle"})).textContent="CALL STACK";
    root.appendChild(svg("text",{class:"label outside", x:450, y:18, "text-anchor":"middle"})).textContent="RETURNED";
  }
  buildViz(c, { caption:"Recursive fact(4): stack grows, then unwinds" }, frames, renderRec);
};

/* ---------- GENERIC FALLBACK / OTHERS ---------- */
function genericConcept(c, title, steps) {
  const frames = steps.map(s => ({ text: s }));
  function render(root, frame) {
    root.innerHTML = "";
    root.appendChild(svg("rect", {x:30,y:30,width:540,height:180,fill:"var(--paper-deep)",stroke:"var(--ink)","stroke-width":1.5}));
    const lines = frame.text.split("\n");
    lines.forEach((ln, i) => {
      const t = svg("text", { x: 300, y: 80 + i*30, "text-anchor":"middle",
        "font-family":"var(--serif)","font-size":"18", fill:"var(--ink)" });
      t.textContent = ln;
      root.appendChild(t);
    });
  }
  buildViz(c, { width:600, height:240, caption:title }, frames, render);
}

VIZ.greedy = (c) => genericConcept(c, "Greedy: pick best local move", [
  "Intervals: (1,3) (2,5) (4,7) (6,9) (8,10)",
  "Sort by end time: (1,3) (2,5) (4,7) (6,9) (8,10)",
  "Pick (1,3) ✓     end = 3",
  "Skip (2,5) — starts before 3",
  "Pick (4,7) ✓     end = 7",
  "Pick (8,10) ✓    end = 10",
  "Answer: 3 non-overlapping intervals"
]);

VIZ.backtracking = (c) => genericConcept(c, "Backtracking: choose / explore / unchoose", [
  "Permutations of [1,2,3]",
  "Choose 1 → [1] → choose 2 → [1,2] → choose 3 → [1,2,3] ✓",
  "Unchoose, try [1,3,2] ✓",
  "Unchoose, try [2,1,3] ✓",
  "...continue for all 6 permutations",
  "Result: [1,2,3] [1,3,2] [2,1,3] [2,3,1] [3,1,2] [3,2,1]"
]);

VIZ.memoization = (c) => genericConcept(c, "Memoization: cache then recurse", [
  "fib(5): cache = {}",
  "fib(4) computed → cache[4] = 3",
  "fib(3) computed → cache[3] = 2",
  "fib(2) computed → cache[2] = 1",
  "fib(3) AGAIN → return cache[3] = 2 (no recompute!)",
  "fib(5) = fib(4) + fib(3) = 5"
]);

VIZ.dp_tabulation = (c) => genericConcept(c, "Bottom-up DP: fill the table", [
  "Climb stairs, n = 5",
  "dp[1] = 1 (one way: [1])",
  "dp[2] = 2 (ways: [1,1] [2])",
  "dp[3] = dp[2] + dp[1] = 3",
  "dp[4] = dp[3] + dp[2] = 5",
  "dp[5] = dp[4] + dp[3] = 8"
]);

VIZ.knapsack = (c) => genericConcept(c, "0/1 Knapsack: take or skip", [
  "Items: (w=2,v=3) (w=3,v=4) (w=4,v=5)",
  "Capacity = 5",
  "Take item 1 → remaining cap 3, value 3",
  "Take item 2 → remaining cap 0, value 7",
  "Best with items 1+2 = value 7",
  "Try other combos... 7 is the max"
]);

VIZ.lcs = (c) => genericConcept(c, "LCS of 'ABCBDAB' and 'BDCAB'", [
  "Walk both strings, build dp matrix",
  "If chars match: dp[i][j] = dp[i-1][j-1] + 1",
  "Else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])",
  "Bottom-right cell = 4",
  "LCS = 'BCAB' (or 'BDAB')"
]);

VIZ.edit_distance = (c) => genericConcept(c, "kitten → sitting (distance 3)", [
  "k i t t e n",
  "↓ substitute k→s",
  "s i t t e n",
  "↓ substitute e→i",
  "s i t t i n",
  "↓ insert g",
  "s i t t i n g  ✓"
]);

VIZ.union_find = (c) => genericConcept(c, "Union-Find: merging groups", [
  "{1} {2} {3} {4} {5}  (each its own group)",
  "union(1, 2) → {1,2} {3} {4} {5}",
  "union(3, 4) → {1,2} {3,4} {5}",
  "union(2, 3) → {1,2,3,4} {5}",
  "find(1) == find(4)? Yes — same group ✓"
]);

VIZ.dijkstra = (c) => genericConcept(c, "Dijkstra: nearest-first expansion", [
  "Start at A, dist[A]=0",
  "Expand A → relax neighbors: dist[B]=2, dist[C]=5",
  "Pop B (smallest) → relax: dist[D]=2+3=5, dist[C]=min(5,2+1)=3",
  "Pop C (now 3) → relax: dist[D]=min(5,3+1)=4",
  "Pop D (4) — done with D",
  "Shortest distances locked in"
]);

VIZ.topo_sort = (c) => genericConcept(c, "Topological sort: prereqs first", [
  "Edges: A→B, A→C, B→D, C→D",
  "in-degrees: A:0, B:1, C:1, D:2",
  "Start with A (in-deg 0)",
  "Remove A → B and C now have in-deg 0",
  "Remove B and C → D has in-deg 0",
  "Order: A, B, C, D"
]);

VIZ.trie = (c) => genericConcept(c, "Trie storing 'cat', 'car', 'cab'", [
  "       (root)",
  "         │",
  "         c",
  "         │",
  "         a",
  "       / | \\",
  "      t  r  b   ← end markers"
]);

VIZ.monotonic_stack = (c) => genericConcept(c, "Next greater for [2, 1, 3]", [
  "i=0 push 2 → stack=[2]",
  "i=1 push 1 → stack=[2,1]",
  "i=2 val=3: pop 1 (answer 3), pop 2 (answer 3)",
  "push 3 → stack=[3]",
  "answer = [3, 3, -1]"
]);

VIZ.bit_manipulation = (c) => genericConcept(c, "x & (x-1) drops lowest set bit", [
  "x       = 1 0 1 1 0",
  "x - 1   = 1 0 1 0 1",
  "x & (x-1) = 1 0 1 0 0",
  "The lowest 1-bit was cleared.",
  "Loop with this to count set bits in O(popcount)."
]);

VIZ.floyd_cycle = (c) => genericConcept(c, "Tortoise & Hare", [
  "Slow moves 1 step. Fast moves 2 steps.",
  "If a cycle exists, fast laps slow.",
  "At the moment they meet, they're at the same node.",
  "If fast hits null, no cycle.",
  "O(1) extra memory — elegant."
]);

/* ---------- GENERIC PLACEHOLDER (for new algorithms without custom viz) ---------- */
/* The lesson renderer can pass extra info via container.dataset.title and dataset.steps.
   If not set, just shows a neutral "no visualization yet" placeholder. */
VIZ.generic_concept = (c) => {
  const title = c.dataset.vizTitle || "Concept illustration";
  let steps;
  try { steps = JSON.parse(c.dataset.vizSteps || "[]"); } catch { steps = []; }
  if (!steps.length) {
    steps = [
      "This algorithm's visualization is concept-based.",
      "See the explanation and code above for the full story.",
      "Add a custom viz function in visualizations.js to swap this out."
    ];
  }
  genericConcept(c, title, steps);
};
