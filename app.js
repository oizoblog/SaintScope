'use strict';
const saints=[
{name:'Saint Pierre',tags:['clés','livre','coq'],bio:'Apôtre de Jésus. Les clés évoquent traditionnellement celles du Royaume des cieux.',feast:'29 juin'},
{name:'Saint Paul',tags:['épée','livre'],bio:'Apôtre fréquemment représenté avec une épée et un livre.',feast:'29 juin'},
{name:'Saint Denis de Paris',tags:['tête portée','mitre','palme'],bio:'Évêque martyr associé à Paris ; il porte parfois sa tête dans ses mains.',feast:'9 octobre'},
{name:'Sainte Catherine d’Alexandrie',tags:['roue','épée','couronne','palme'],bio:'Martyre légendaire dont l’attribut le plus caractéristique est la roue.',feast:'25 novembre'},
{name:'Saint Georges',tags:['dragon','lance','cheval'],bio:'Saint guerrier souvent représenté combattant un dragon.',feast:'23 avril'},
{name:'Saint Laurent',tags:['gril','palme','livre'],bio:'Diacre martyr, traditionnellement identifié par un gril.',feast:'10 août'},
{name:'Saint Sébastien',tags:['flèches','arbre','palme'],bio:'Martyr souvent figuré attaché et percé de flèches.',feast:'20 janvier'},
{name:'Sainte Barbe',tags:['tour','calice','palme'],bio:'Martyre reconnaissable à une tour, parfois à trois fenêtres.',feast:'4 décembre'},
{name:'Saint Antoine abbé',tags:['cochon','bâton en tau','clochette','livre'],bio:'Ermite du désert ; ses attributs occidentaux comprennent le porc et le bâton en tau.',feast:'17 janvier'},
{name:'Saint Jacques le Majeur',tags:['coquille','bourdon','chapeau','livre'],bio:'Apôtre associé au pèlerinage de Compostelle.',feast:'25 juillet'},
{name:'Saint Martin de Tours',tags:['manteau','cheval','mendiant','mitre'],bio:'Connu pour avoir partagé son manteau avec un pauvre ; devenu évêque de Tours.',feast:'11 novembre'},
{name:'Sainte Marie-Madeleine',tags:['vase à parfum','cheveux longs','livre'],bio:'Disciple de Jésus, souvent représentée avec un vase à parfum.',feast:'22 juillet'},
{name:'Saint Jean l’Évangéliste',tags:['aigle','livre','calice'],bio:'L’aigle est son symbole traditionnel parmi les quatre évangélistes.',feast:'27 décembre'},
{name:'Saint Luc',tags:['bœuf','livre','pinceau'],bio:'Évangéliste symbolisé par le bœuf ; parfois représenté comme peintre.',feast:'18 octobre'},
{name:'Saint Marc',tags:['lion','livre'],bio:'Évangéliste traditionnellement accompagné d’un lion ailé.',feast:'25 avril'},
{name:'Saint Matthieu',tags:['ange','livre'],bio:'Évangéliste associé à une figure humaine ailée.',feast:'21 septembre'},
{name:'Sainte Agnès',tags:['agneau','palme'],bio:'Jeune martyre romaine, souvent accompagnée d’un agneau.',feast:'21 janvier'},
{name:'Saint Roch',tags:['chien','plaie','bourdon'],bio:'Saint pèlerin montrant souvent une plaie à la cuisse, accompagné d’un chien.',feast:'16 août'},
{name:'Saint Christophe',tags:['enfant','bâton','rivière'],bio:'Traditionnellement représenté portant l’Enfant Jésus à travers l’eau.',feast:'25 juillet'},
{name:'Sainte Cécile',tags:['orgue','instrument de musique','palme'],bio:'Patronne des musiciens, représentée avec un instrument.',feast:'22 novembre'},
{name:'Saint Étienne',tags:['pierres','palme','livre'],bio:'Premier martyr chrétien selon les Actes des Apôtres, associé aux pierres.',feast:'26 décembre'},
{name:'Saint François d’Assise',tags:['oiseaux','stigmates','habit franciscain'],bio:'Fondateur des frères mineurs ; représenté en habit franciscain.',feast:'4 octobre'},
{name:'Saint Dominique',tags:['chien','torche','étoile','livre'],bio:'Fondateur de l’ordre des Prêcheurs ; plusieurs attributs sont liés à son iconographie.',feast:'8 août'},
{name:'Saint Nicolas',tags:['trois enfants','mitre','trois boules'],bio:'Évêque de Myre, souvent représenté avec trois enfants ou trois boules d’or.',feast:'6 décembre'}
];
const $=id=>document.getElementById(id);let selected=new Set(),photoURL=null;
const tags=[...new Set(saints.flatMap(s=>s.tags))].sort((a,b)=>a.localeCompare(b,'fr'));
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function renderChips(){const root=$('chips');root.replaceChildren();for(const tag of tags){const b=el('button',tag,'chip');b.type='button';b.setAttribute('aria-pressed',String(selected.has(tag)));b.addEventListener('click',()=>{selected.has(tag)?selected.delete(tag):selected.add(tag);renderChips();renderResults()});root.append(b)}}
function save(name){try{const h=JSON.parse(localStorage.getItem('saintscope-history')||'[]');localStorage.setItem('saintscope-history',JSON.stringify([name,...h.filter(x=>x!==name)].slice(0,30)));renderHistory()}catch{alert('Stockage local indisponible.')}}
function renderResults(){const query=$('search').value.trim().toLocaleLowerCase('fr');const arr=saints.map(s=>({...s,hits:s.tags.filter(t=>selected.has(t))})).filter(s=>(!selected.size||s.hits.length>0)&&(!query||(s.name+' '+s.tags.join(' ')+' '+s.bio).toLocaleLowerCase('fr').includes(query))).sort((a,b)=>b.hits.length-a.hits.length||a.name.localeCompare(b.name,'fr'));$('count').textContent=arr.length+' résultat(s)';const root=$('results');root.replaceChildren();if(!arr.length){root.append(el('p','Aucune correspondance. Essayez moins de critères.','muted'));return}for(const s of arr){const item=el('article',undefined,'result');item.append(el('h3',s.name));item.append(el('p','Attributs : '+s.tags.join(', ')));item.append(el('p',s.bio));item.append(el('p','Fête : '+s.feast,'hint'));if(selected.size)item.append(el('p',s.hits.length+' attribut(s) commun(s) avec votre sélection — indice, pas probabilité.','score'));const b=el('button','☆ Enregistrer','btn secondary');b.type='button';b.addEventListener('click',()=>save(s.name));item.append(b);root.append(item)}}
function renderHistory(){const root=$('history');root.replaceChildren();let h=[];try{h=JSON.parse(localStorage.getItem('saintscope-history')||'[]')}catch{}if(!h.length){root.append(el('p','Aucun saint enregistré.','hint'));return}for(const name of h){const p=el('p',name);root.append(p)}}
function photoChanged(event){const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){$('photoStatus').textContent='Choisissez une image valide.';return}if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);$('preview').src=photoURL;$('preview').hidden=false;$('photoStatus').textContent='Photo chargée : '+file.name+' — sélectionnez les attributs visibles ci-dessous.';event.target.value=''}
$('camera').addEventListener('change',photoChanged);$('gallery').addEventListener('change',photoChanged);$('search').addEventListener('input',renderResults);$('reset').addEventListener('click',()=>{selected.clear();$('search').value='';renderChips();renderResults()});$('clearHistory').addEventListener('click',()=>{if(confirm('Effacer les saints enregistrés ?')){try{localStorage.removeItem('saintscope-history')}catch{}renderHistory()}});renderChips();renderResults();renderHistory();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
