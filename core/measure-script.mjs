// Browser-side script injected only into check builds. It measures the laid-out
// page and writes a report into a data attribute that the CLI reads back via
// --dump-dom. It never touches the network and never reads spec content beyond
// what is already on the page.
//
// Findings, each tied to the spec path of the element (data-path):
// - sheet-overflow  the sheet is wider than its declared width (error)
// - overflow-x      an element's content is wider than the element (error)
// - word-split      a word is broken across two lines (error; warning when the
//                   break happens at a hyphen or slash, which is acceptable)
// - icon-overlap    text runs underneath the corner icon (warning)

export const MEASURE_SCRIPT = `(function(){
var issues=[];
function add(kind,severity,el,text){var h=el&&el.closest?el.closest('[data-path]'):null;issues.push({kind:kind,severity:severity,path:h?h.getAttribute('data-path'):'(sheet)',text:(text||'').slice(0,90)});}
var sheet=document.querySelector('.sheet');var fit=document.getElementById('fit');
if(!sheet||!fit)return;
if(sheet.scrollWidth>sheet.clientWidth+1)add('sheet-overflow','error',null,sheet.scrollWidth+'px > '+sheet.clientWidth+'px');
document.querySelectorAll('.el,.box,.band').forEach(function(el){if(el.scrollWidth>el.clientWidth+1)add('overflow-x','error',el,el.textContent.trim().replace(/\\s+/g,' '));});
var range=document.createRange();
var walker=document.createTreeWalker(sheet,NodeFilter.SHOW_TEXT);var node;
while((node=walker.nextNode())){var t=node.nodeValue;var re=/\\S+/g;var m;
 while((m=re.exec(t))){range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);
  var rects=range.getClientRects();if(rects.length<2)continue;var top=rects[0].top;
  for(var i=1;i<rects.length;i++){if(Math.abs(rects[i].top-top)>2){var soft=/[-\\/]/.test(m[0]);add('word-split',soft?'warning':'error',node.parentElement,m[0]);break;}}}}
function hit(a,b){return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;}
document.querySelectorAll('.ic').forEach(function(ic){var host=ic.parentElement;var ir=ic.getBoundingClientRect();if(!ir.width)return;
 var targets=host.querySelectorAll(':scope > h2, :scope > h3, :scope > .n, :scope > small, :scope > .tag, :scope > .note-line');
 targets.forEach(function(tg){var tw=document.createTreeWalker(tg,NodeFilter.SHOW_TEXT);var tn;
  while((tn=tw.nextNode())){range.selectNodeContents(tn);var rs=range.getClientRects();
   for(var j=0;j<rs.length;j++){if(hit(rs[j],ir)){add('icon-overlap','warning',host,tg.textContent.trim());return;}}}});});
var report={width:Math.ceil(fit.offsetWidth),height:Math.ceil(fit.offsetHeight),issues:issues};
var out=document.createElement('div');out.id='arquichef-report';
out.setAttribute('data-report',btoa(unescape(encodeURIComponent(JSON.stringify(report)))));
document.body.appendChild(out);
})();`;
