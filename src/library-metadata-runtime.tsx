import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft } from './library';
import { getAuthSnapshot } from './supabase';
import './library-metadata-runtime.css';

type GroupCriterion = 'none'|'series'|'author'|'status'|'rating'|'progress'|'favorite'|'genre';
type ExtendedArchive = V2ArchiveState & {
  bookSeriesPositions?: Record<string,string>;
  libraryManualBookOrder?: string[];
  libraryManualGroupOrder?: Partial<Record<GroupCriterion,string[]>>;
};
type SortCriterion = 'none'|'manual'|'updated-new'|'updated-old'|'created-new'|'created-old'|'title-az'|'title-za'|'author-az'|'author-za'|'series-az'|'series-za'|'series-number'|'rating-high'|'rating-low'|'spice-high'|'impact-high'|'progress-high'|'progress-low'|'status'|'favorite-first';

type MappedBook = { article: HTMLElement; book: V2BookRecord };

const DESKTOP_QUERY = '(min-width: 761px)';
const SORT_OPTIONS: Array<[SortCriterion,string]> = [
  ['none','None'],['manual','Manual order'],['series-az','Series A to Z'],['series-za','Series Z to A'],['series-number','Number in series'],['title-az','Title A to Z'],['title-za','Title Z to A'],['author-az','Author A to Z'],['author-za','Author Z to A'],['updated-new','Recently updated'],['updated-old','Least recently updated'],['created-new','Newest added'],['created-old','Oldest added'],['rating-high','Rating high to low'],['rating-low','Rating low to high'],['progress-high','Progress high to low'],['progress-low','Progress low to high'],['spice-high','Spice high to low'],['impact-high','Emotional impact high to low'],['status','Reading status'],['favorite-first','Favorites first'],
];
const GROUP_OPTIONS: Array<[GroupCriterion,string]> = [
  ['none','No grouping'],['series','Series'],['author','Author'],['status','Reading status'],['rating','Rating'],['progress','Progress band'],['favorite','Favorite status'],['genre','Primary genre'],
];

function seriesNumber(value:string|undefined):number { const parsed=Number(value); return Number.isFinite(parsed)?parsed:Number.MAX_SAFE_INTEGER; }
function text(value:unknown):string { return String(value||'').trim(); }
function orderedIndex(order:string[],id:string):number { const index=order.indexOf(id); return index<0?Number.MAX_SAFE_INTEGER:index; }
function compareCriterion(a:V2BookRecord,b:V2BookRecord,sort:SortCriterion,positions:Record<string,string>,manualOrder:string[]):number {
  if(sort==='none')return 0;
  if(sort==='manual')return orderedIndex(manualOrder,a.id)-orderedIndex(manualOrder,b.id);
  if(sort==='updated-new')return b.updatedAt.localeCompare(a.updatedAt);
  if(sort==='updated-old')return a.updatedAt.localeCompare(b.updatedAt);
  if(sort==='created-new')return b.createdAt.localeCompare(a.createdAt);
  if(sort==='created-old')return a.createdAt.localeCompare(b.createdAt);
  if(sort==='title-az')return a.title.localeCompare(b.title);
  if(sort==='title-za')return b.title.localeCompare(a.title);
  if(sort==='author-az')return a.author.localeCompare(b.author);
  if(sort==='author-za')return b.author.localeCompare(a.author);
  if(sort==='series-az')return text(a.series).localeCompare(text(b.series));
  if(sort==='series-za')return text(b.series).localeCompare(text(a.series));
  if(sort==='series-number')return seriesNumber(positions[a.id])-seriesNumber(positions[b.id]);
  if(sort==='rating-high')return b.rating-a.rating;
  if(sort==='rating-low')return a.rating-b.rating;
  if(sort==='spice-high')return b.spice-a.spice;
  if(sort==='impact-high')return b.impact-a.impact;
  if(sort==='progress-high')return b.progress-a.progress;
  if(sort==='progress-low')return a.progress-b.progress;
  if(sort==='status')return text(a.status).localeCompare(text(b.status));
  if(sort==='favorite-first')return Number(Boolean(b.favorite))-Number(Boolean(a.favorite));
  return 0;
}
function compareBooks(a:V2BookRecord,b:V2BookRecord,sorts:SortCriterion[],positions:Record<string,string>,manualOrder:string[]):number {
  for(const sort of sorts){const result=compareCriterion(a,b,sort,positions,manualOrder);if(result)return result;}
  return a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
}
function groupLabel(book:V2BookRecord,group:GroupCriterion):string {
  if(group==='series')return text(book.series)||'Standalone';
  if(group==='author')return text(book.author)||'Unknown author';
  if(group==='status')return ({want:'Want to read',reading:'Currently reading',paused:'Paused',completed:'Completed',dnf:'DNF'} as Record<string,string>)[book.status]||text(book.status)||'Unknown status';
  if(group==='rating')return book.rating>0?`${book.rating} star${book.rating===1?'':'s'}`:'Unrated';
  if(group==='progress'){const p=Number(book.progress)||0;return p>=100?'Completed':p>=75?'75–99%':p>=50?'50–74%':p>=25?'25–49%':p>0?'1–24%':'Not started';}
  if(group==='favorite')return book.favorite?'Favorites':'Other books';
  if(group==='genre')return text(book.genres?.[0])||'No genre';
  return '';
}
function completeBookOrder(archive:ExtendedArchive):string[] {
  const valid=new Set(archive.books.map(book=>book.id));
  const saved=(archive.libraryManualBookOrder||[]).filter(id=>valid.has(id));
  const seen=new Set(saved);
  return [...saved,...archive.books.map(book=>book.id).filter(id=>!seen.has(id))];
}
function moveBefore(order:string[],dragged:string,target:string):string[] {
  if(dragged===target)return order;
  const next=order.filter(value=>value!==dragged);
  const targetIndex=next.indexOf(target);
  if(targetIndex<0)return [...next,dragged];
  next.splice(targetIndex,0,dragged);
  return next;
}
function clearGroupDecoration(article:HTMLElement){
  article.classList.remove('is-flow-group-start','is-flow-first-group','is-flow-group-tone-a','is-flow-group-tone-b');
  delete article.dataset.libraryGroupIndex;
  delete article.dataset.libraryGroupStart;
}
function decorateGroup(entries:MappedBook[],groupIndex:number){
  const tone=groupIndex%2===0?'is-flow-group-tone-a':'is-flow-group-tone-b';
  entries.forEach((entry,index)=>{
    entry.article.dataset.libraryGroupIndex=String(groupIndex);
    entry.article.classList.add(tone);
    if(index===0){
      entry.article.dataset.libraryGroupStart='true';
      entry.article.classList.add('is-flow-group-start');
      if(groupIndex===0)entry.article.classList.add('is-flow-first-group');
    }
  });
}
function createGroupMarker(label:string,index:number,entries:MappedBook[]):HTMLElement{
  const marker=document.createElement('div');
  marker.className='library-group-marker is-manual-draggable';
  marker.dataset.groupLabel=label;
  marker.dataset.groupIndex=String(index);
  marker.dataset.groupFirstBookId=entries[0]?.book.id||'';
  marker.draggable=true;
  marker.title='Drag to reorder groups';
  marker.innerHTML=`<span>${label}</span><em>Drag group</em>`;
  return marker;
}

function LibraryMetadataTools(){
  const[archive,setArchive]=useState<ExtendedArchive|null>(null); const[editorTarget,setEditorTarget]=useState<Element|null>(null); const[libraryTarget,setLibraryTarget]=useState<Element|null>(null); const[currentBookId,setCurrentBookId]=useState(''); const[position,setPosition]=useState(''); const[saveState,setSaveState]=useState('');
  const[primary,setPrimary]=useState<SortCriterion>('updated-new'); const[secondary,setSecondary]=useState<SortCriterion>('none'); const[tertiary,setTertiary]=useState<SortCriterion>('none'); const[group,setGroup]=useState<GroupCriterion>('none');
  useEffect(()=>{let active=true;const syncTargets=()=>{setEditorTarget(document.querySelector('.v2-view--editor .book-panel .field-stack'));setLibraryTarget(document.querySelector('.v2-view--library .v2-library-controls'));};syncTargets();const observer=new MutationObserver(syncTargets);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});getAuthSnapshot().then(async({user})=>{if(!user||!active)return;const next=await loadCloudArchive(user) as ExtendedArchive;if(active)setArchive(next);}).catch(()=>undefined);return()=>{active=false;observer.disconnect();};},[]);
  useEffect(()=>{if(!editorTarget||!archive)return;loadWorkspaceDraft().then(draft=>{const id=draft?.book?.id||'';setCurrentBookId(id);setPosition(id?(archive.bookSeriesPositions?.[id]||''):'');}).catch(()=>undefined);},[editorTarget,archive]);
  const booksByTitle=useMemo(()=>{const map=new Map<string,V2BookRecord[]>();for(const book of archive?.books||[]){const key=book.title.trim().toLowerCase();map.set(key,[...(map.get(key)||[]),book]);}return map;},[archive?.books]);

  async function saveMetadata(patch:Pick<ExtendedArchive,'bookSeriesPositions'|'libraryManualBookOrder'|'libraryManualGroupOrder'>,message?:string){
    if(!archive)return;
    const optimistic={...archive,...patch,updatedAt:new Date().toISOString()};
    setArchive(optimistic); saveLocalArchive(optimistic); if(message)setSaveState(message);
    try{
      const{user}=await getAuthSnapshot(); if(!user)throw new Error('Session expired');
      const latest=await loadCloudArchive(user) as ExtendedArchive;
      const next={...latest,...patch,updatedAt:new Date().toISOString()};
      await saveCloudArchive(user,next); setArchive(next); saveLocalArchive(next);
      if(message){setSaveState('Saved');window.setTimeout(()=>setSaveState(''),1500);}
    }catch{if(message)setSaveState('Save failed');}
  }

  useEffect(()=>{
    if(!libraryTarget||!archive)return;
    const libraryView=libraryTarget.closest('.v2-view--library'); if(!libraryView)return;
    let timer:number|null=null; let arranging=false; let observer:MutationObserver|null=null;
    const observe=()=>observer?.observe(libraryView,{childList:true,subtree:true});

    const arrangeGrid=()=>{
      if(arranging)return; arranging=true; observer?.disconnect();
      const grid=libraryView.querySelector<HTMLElement>('.v2-library-grid');
      if(!grid){arranging=false;observe();return;}
      grid.classList.toggle('is-manual-order',primary==='manual');
      grid.querySelectorAll(':scope > .library-group-marker').forEach(marker=>marker.remove());
      const articles=[...grid.querySelectorAll<HTMLElement>(':scope > article')];
      articles.forEach(clearGroupDecoration);
      const used=new Set<string>();
      const mapped=articles.map(article=>{
        const existingId=article.dataset.bookId;
        const existingBook=existingId?archive.books.find(item=>item.id===existingId&&!used.has(item.id)):undefined;
        const textValue=(article.querySelector('.card-title,[data-binding="title"],h2,h3,strong')?.textContent||article.textContent||'').trim().toLowerCase();
        const matches=[...(booksByTitle.get(textValue)||[])];
        const book=existingBook||matches.find(item=>!used.has(item.id))||archive.books.find(item=>article.textContent?.includes(item.title)&&!used.has(item.id));
        if(book){used.add(book.id);article.dataset.bookId=book.id;}
        article.draggable=primary==='manual'; article.classList.toggle('is-manual-draggable',primary==='manual');
        return{article,book};
      }).filter((entry):entry is MappedBook=>Boolean(entry.book));
      const manualOrder=completeBookOrder(archive);
      mapped.sort((a,b)=>compareBooks(a.book,b.book,[primary,secondary,tertiary],archive.bookSeriesPositions||{},manualOrder));

      if(group==='none'){
        grid.classList.remove('is-grouped-tinted','is-flow-grouped');
        mapped.forEach(entry=>grid.appendChild(entry.article));
      }else{
        const buckets=new Map<string,MappedBook[]>();
        mapped.forEach(entry=>{const label=groupLabel(entry.book,group);buckets.set(label,[...(buckets.get(label)||[]),entry]);});
        const naturalLabels=[...buckets.keys()];
        const savedGroupOrder=archive.libraryManualGroupOrder?.[group]||[];
        const labels=[...naturalLabels].sort((a,b)=>{
          const ai=orderedIndex(savedGroupOrder,a),bi=orderedIndex(savedGroupOrder,b);
          if(ai!==bi)return ai-bi;
          return naturalLabels.indexOf(a)-naturalLabels.indexOf(b);
        });
        const desktop=window.matchMedia(DESKTOP_QUERY).matches;
        grid.classList.add('is-grouped-tinted');
        grid.classList.toggle('is-flow-grouped',desktop);

        if(desktop){
          const ordered:MappedBook[]=[];
          labels.forEach((label,index)=>{const entries=buckets.get(label)||[];decorateGroup(entries,index);ordered.push(...entries);});
          ordered.forEach(entry=>grid.appendChild(entry.article));
          labels.forEach((label,index)=>grid.appendChild(createGroupMarker(label,index,buckets.get(label)||[])));
        }else{
          labels.forEach((label,index)=>{
            const entries=buckets.get(label)||[];
            decorateGroup(entries,index);
            grid.appendChild(createGroupMarker(label,index,entries));
            entries.forEach(entry=>grid.appendChild(entry.article));
          });
        }
      }
      arranging=false; observe();
      window.dispatchEvent(new CustomEvent('library-groups-arranged'));
    };
    const scheduleArrange=()=>{if(arranging)return;if(timer!==null)window.clearTimeout(timer);timer=window.setTimeout(()=>{timer=null;arrangeGrid();},20);};
    observer=new MutationObserver((mutations)=>{if(arranging)return;const shouldArrange=mutations.some(mutation=>[...mutation.addedNodes,...mutation.removedNodes].some(node=>node instanceof HTMLElement&&(node.matches('article,.v2-library-grid,.v2-empty-state')||Boolean(node.querySelector?.('article,.v2-library-grid,.v2-empty-state')))));if(shouldArrange)scheduleArrange();});
    observe(); scheduleArrange();

    const dragStart=(event:DragEvent)=>{
      const target=event.target instanceof Element?event.target:null; if(!target||!event.dataTransfer)return;
      const marker=target.closest<HTMLElement>('.library-group-marker');
      if(marker?.dataset.groupLabel&&group!=='none'){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-library-group',marker.dataset.groupLabel);marker.classList.add('is-dragging');return;}
      const article=target.closest<HTMLElement>('article[data-book-id]');
      if(primary!=='manual'||!article?.dataset.bookId)return;
      event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-library-book',article.dataset.bookId);article.classList.add('is-dragging');
    };
    const dragEnd=()=>libraryView.querySelectorAll('.is-dragging,.is-drag-over').forEach(node=>node.classList.remove('is-dragging','is-drag-over'));
    const dragOver=(event:DragEvent)=>{
      const target=event.target instanceof Element?event.target:null; if(!target||!event.dataTransfer)return;
      const groupDragged=event.dataTransfer.types.includes('application/x-library-group');
      const bookDragged=event.dataTransfer.types.includes('application/x-library-book');
      const candidate=groupDragged?target.closest<HTMLElement>('.library-group-marker'):bookDragged&&primary==='manual'?target.closest<HTMLElement>('article[data-book-id]'):null;
      if(!candidate)return; event.preventDefault(); event.dataTransfer.dropEffect='move'; libraryView.querySelectorAll('.is-drag-over').forEach(node=>node.classList.remove('is-drag-over'));candidate.classList.add('is-drag-over');
    };
    const drop=(event:DragEvent)=>{
      const target=event.target instanceof Element?event.target:null; if(!target||!event.dataTransfer||!archive)return;
      const draggedGroup=event.dataTransfer.getData('application/x-library-group');
      if(draggedGroup&&group!=='none'){
        const marker=target.closest<HTMLElement>('.library-group-marker'); const targetGroup=marker?.dataset.groupLabel; if(!targetGroup||targetGroup===draggedGroup)return;
        event.preventDefault(); const visible=[...libraryView.querySelectorAll<HTMLElement>('.library-group-marker[data-group-label]')].map(node=>node.dataset.groupLabel||'').filter(Boolean); const base=[...(archive.libraryManualGroupOrder?.[group]||visible)]; const order=moveBefore([...new Set([...base,...visible])],draggedGroup,targetGroup); void saveMetadata({libraryManualGroupOrder:{...(archive.libraryManualGroupOrder||{}),[group]:order}}); return;
      }
      const draggedBook=event.dataTransfer.getData('application/x-library-book');
      if(!draggedBook||primary!=='manual')return;
      const article=target.closest<HTMLElement>('article[data-book-id]'); const targetBook=article?.dataset.bookId; if(!targetBook||targetBook===draggedBook)return;
      const draggedRecord=archive.books.find(book=>book.id===draggedBook); const targetRecord=archive.books.find(book=>book.id===targetBook); if(!draggedRecord||!targetRecord)return;
      if(group!=='none'&&groupLabel(draggedRecord,group)!==groupLabel(targetRecord,group))return;
      event.preventDefault(); const order=moveBefore(completeBookOrder(archive),draggedBook,targetBook); void saveMetadata({libraryManualBookOrder:order});
    };
    window.addEventListener('resize',scheduleArrange,{passive:true});
    libraryView.addEventListener('dragstart',dragStart);libraryView.addEventListener('dragend',dragEnd);libraryView.addEventListener('dragover',dragOver);libraryView.addEventListener('drop',drop);
    return()=>{observer?.disconnect();if(timer!==null)window.clearTimeout(timer);window.removeEventListener('resize',scheduleArrange);libraryView.removeEventListener('dragstart',dragStart);libraryView.removeEventListener('dragend',dragEnd);libraryView.removeEventListener('dragover',dragOver);libraryView.removeEventListener('drop',drop);};
  },[libraryTarget,archive,primary,secondary,tertiary,group,booksByTitle]);

  async function savePosition(){if(!archive||!currentBookId)return;const clean=position.trim();const nextMap={...(archive.bookSeriesPositions||{})};if(!clean||clean.toLowerCase()==='n/a'||clean.toLowerCase()==='na')delete nextMap[currentBookId];else nextMap[currentBookId]=clean;await saveMetadata({bookSeriesPositions:nextMap},'Saving…');if(!clean||clean.toLowerCase()==='n/a'||clean.toLowerCase()==='na')setSaveState('Standalone book');}
  const sortSelect=(label:string,value:SortCriterion,onChange:(next:SortCriterion)=>void,key:string)=><label><span>{label}</span><select data-library-pref={key} value={value} onChange={event=>onChange(event.target.value as SortCriterion)}>{SORT_OPTIONS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
  return <>{editorTarget&&createPortal(<section className="series-position-field"><div><label htmlFor="series-position-input">Book number in series</label><small>Use a number such as 1, 2, or 3.5. Enter N/A or leave blank for a standalone.</small></div><div><input id="series-position-input" value={position} onChange={event=>setPosition(event.target.value)} onBlur={()=>void savePosition()} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void savePosition();}}} placeholder="N/A"/><button type="button" onClick={()=>void savePosition()}>Save</button></div>{saveState&&<em>{saveState}</em>}</section>,editorTarget)}{libraryTarget&&createPortal(<div className="advanced-library-sort"><div className="advanced-library-sort-priorities">{sortSelect('1st',primary,setPrimary,'sortPrimary')}{sortSelect('2nd',secondary,setSecondary,'sortSecondary')}{sortSelect('3rd',tertiary,setTertiary,'sortTertiary')}</div><label className="advanced-library-group"><span>Group</span><select data-library-pref="groupBy" value={group} onChange={event=>setGroup(event.target.value as GroupCriterion)}>{GROUP_OPTIONS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>{primary==='manual'&&<small className="manual-sort-hint">Drag cards to arrange them. With groups on, cards stay inside their group.</small>}{group!=='none'&&<small className="manual-sort-hint">Drag group headings to arrange groups.</small>}</div>,libraryTarget)}</>;
}
function start(){const host=document.createElement('div');host.id='library-metadata-runtime';document.body.appendChild(host);createRoot(host).render(<StrictMode><LibraryMetadataTools/></StrictMode>);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();