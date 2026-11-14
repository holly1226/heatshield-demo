/* Leaflet street basemap; project records remain a separate, labelled overlay. */
let liveMapInstance=null,liveMapTiles=null,liveMapCommunities=null,liveMapFacilities=null,liveMapCity=null,liveMapTimer=null,liveMapRoads=null,liveMapRoadLabels=null,liveMapLoadState=null;
const liveMapViews={};
function mapControls(){return `<div class="chips">${[['risk',tr("风险")],['temperature',tr("温度")],['probability',tr("热浪")],['heatmap',tr("热力")],['3d',tr("3D 示意")]].map(([id,t])=>`<button class="chip ${S.layer===id?'selected':''}" aria-pressed="${S.layer===id}" data-action="layer" data-value="${id}">${t}</button>`).join('')}</div>${['temperature','probability'].includes(S.layer)?`<div class="between mt-sm"><div class="chips">${[24,48,72].map(h=>`<button class="chip ${S.horizon===h?'selected':''}" data-action="horizon" data-value="${h}">+${h}h</button>`).join('')}</div><span class="tiny">${tr("{p0} · 示例", {p0:(S.layer==='temperature'?temp(S.horizon)+'°C':`${tr("概率 {p0}%", {p0:(S.horizon===48?76:68)})}`)})}</span></div>`:''}`}
function streetMapMarkup(){return `<div class="street-map-wrap"><div id="street-map" class="street-map" role="region" aria-label="${tr("{p0}真实街道地图，可缩放并查看项目点位", {p0:(CITY_NAMES[S.city])})}"></div><div class="street-map-toolbar"><button class="map-tool" data-action="map-explore" aria-pressed="${!!S.mapExplore}">${icon(S.mapExplore?'check':'hand')}<span>${S.mapExplore?tr("完成探索"):tr("探索地图")}</span></button><button class="map-tool map-tool-square" data-action="map-recenter" aria-label="${tr("回到本城全部点位")}">${icon('scan')}</button></div><div class="street-map-status" role="status" aria-live="polite"><span id="map-connection">${tr("正在连接真实底图…")}</span><button data-action="map-retry" aria-label="${tr("重试加载地图")}" hidden>${tr("重试")}</button></div></div><div class="street-map-help"><span id="map-gesture-hint">${tr("页面可自然滑动 · 点击“探索地图”后拖动")}</span><button class="text-button" data-action="map-source">${tr("{p0}地图与数据", {p0:(icon('info'))})}</button></div>`}
function mapKey(){return `<div class="legend"><span><i></i>${S.layer==='temperature'?tr("示例温度"):S.layer==='probability'?tr("示例热浪概率"):tr("项目风险基线")}</span><span><i class="square"></i>${tr("避暑点")}</span></div><button class="text-button" data-action="cooling" aria-pressed="${S.cooling}">${tr("{p0}避暑点", {p0:(icon(S.cooling?'circle-check':'circle'))})}</button>`}
function mapCommunityRows(){return neighborhoods().map(n=>`<button class="list-row" data-action="hood" data-id="${n.idx}"><span><strong>${esc(n.name)}</strong><small>${S.layer==='temperature'?`${tr("+{p0}h 示例温度 {p1}°C", {p0:(S.horizon), p1:((Number(temp(S.horizon))+(1-n.pct_tree_canopy)).toFixed(1))})}`:`${tr("人口 {p0} · 风险基线 {p1}", {p0:(fmt(n.population)), p1:(n.risk)})}`}</small></span>${badge(n.risk)}</button>`).join('')}
function disposeLiveMap(){
  clearTimeout(liveMapTimer);
  liveMapTiles?.off();
  liveMapLoadState=null;
  if(liveMapInstance){try{const center=liveMapInstance.getCenter();liveMapViews[liveMapCity]={center:[center.lat,center.lng],zoom:liveMapInstance.getZoom()};liveMapInstance.remove()}catch{}}
  liveMapInstance=null;liveMapTiles=null;liveMapCommunities=null;liveMapFacilities=null;liveMapRoads=null;liveMapRoadLabels=null;
}
function mapConnection(text,error=false){const status=$('#map-connection');if(!status)return;status.textContent=text;status.parentElement.classList.toggle('has-error',error);status.parentElement.querySelector('button').hidden=!error}
function liveMapFit(){if(!liveMapInstance)return;const pts=[...neighborhoods(),...facilities()].map(p=>[p.lat,p.lon]);if(pts.length)liveMapInstance.fitBounds(pts,{padding:[32,42],maxZoom:12,animate:false})}
// A bundled Census road snapshot is always present beneath online tiles.
// It is not an OSM tile cache, and makes no request to a third-party service.
function mountLocalRoads(){
  const data=window.HEATSHIELD_BASEMAPS?.[S.city];
  if(!data?.features?.length)return;
  const map=liveMapInstance,dark=S.theme==='dark';
  map.createPane('localRoads').style.zIndex=190;
  map.createPane('localRoadLabels').style.zIndex=195;
  map.getPane('localRoads').style.pointerEvents='none';
  map.getPane('localRoadLabels').style.pointerEvents='none';
  const renderer=L.canvas({pane:'localRoads',padding:.2});
  const width=f=>f.properties.MTFCC==='S1100'?4.5:f.properties.MTFCC==='S1200'?3:1.7;
  liveMapRoads=L.layerGroup([
    L.geoJSON(data,{renderer,interactive:false,style:f=>({color:dark?'#48463f':'#d8d4cc',weight:width(f)+1.5,opacity:1,lineCap:'round'})}),
    L.geoJSON(data,{renderer,interactive:false,style:f=>({color:f.properties.MTFCC==='S1100'?(dark?'#9a7954':'#e2c08e'):dark?'#69665c':'#fefcf6',weight:width(f),opacity:1,lineCap:'round'})})
  ]).addTo(map);
  liveMapRoadLabels=L.layerGroup().addTo(map);
  $('#street-map').dataset.localRoads=String(data.features.length);
  map.attributionControl.addAttribution(`<a href="https://www.census.gov/programs-surveys/geography.html" target="_blank" rel="noopener noreferrer">U.S. Census Bureau</a> ${tr("· 本地路网")}`);
  updateLocalRoadLabels();
}
function updateLocalRoadLabels(){
  if(!liveMapRoadLabels||!liveMapInstance)return;
  liveMapRoadLabels.clearLayers();
  const map=liveMapInstance,data=window.HEATSHIELD_BASEMAPS?.[liveMapCity];
  if(!data||map.getZoom()<9)return;
  const used=new Set(),cells=new Set(),size=map.getSize();
  const sorted=[...data.features].sort((a,b)=>(a.properties.MTFCC==='S1100'?0:1)-(b.properties.MTFCC==='S1100'?0:1));
  for(const f of sorted){
    const name=f.properties.NAME;if(!name||used.has(name))continue;
    const g=f.geometry,lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    let point=null;
    for(const line of lines){for(const coord of [line[Math.floor(line.length/2)],line[0]]){
      if(!coord)continue;
      const ll=L.latLng(coord[1],coord[0]),p=map.latLngToContainerPoint(ll),cell=Math.floor(p.x/105)+':'+Math.floor(p.y/45);
      if(p.x>35&&p.y>35&&p.x<size.x-35&&p.y<size.y-42&&!cells.has(cell)){point={ll,cell};break}
    }if(point)break}
    if(!point)continue;
    cells.add(point.cell);used.add(name);
    L.marker(point.ll,{pane:'localRoadLabels',interactive:false,keyboard:false,icon:L.divIcon({className:'local-road-label',html:esc(name),iconSize:[105,16],iconAnchor:[52,8]})}).addTo(liveMapRoadLabels);
    if(used.size>=18)break;
  }
}
function updateMapConnection(){
  const state=liveMapLoadState,el=$('#street-map');
  if(!state||state.el!==el)return;
  const values=[...state.tiles.values()],loaded=values.filter(x=>x==='loaded').length,failed=values.filter(x=>x==='failed').length,pending=values.filter(x=>x==='pending').length;
  el.dataset.loadedTiles=String(loaded);el.dataset.failedTiles=String(failed);
  const local=!!liveMapRoads,online=loaded>0&&!failed&&!pending;
  el.dataset.basemap=online?'online':loaded?'hybrid':local?'local':'unavailable';
  if(liveMapInstance?.getPane('localRoadLabels'))liveMapInstance.getPane('localRoadLabels').style.visibility=loaded?'hidden':'visible';
  if(online){clearTimeout(liveMapTimer);mapConnection(tr("街道底图已连接"));return}
  if(state.timedOut||failed){
    const msg=local?(loaded?tr("部分在线底图未加载 · 已保留本地路网"):tr("已显示本地路网 · 在线底图暂不可用")):tr("在线底图暂不可用 · 项目点位仍可查看");
    mapConnection(msg,true);return;
  }
  mapConnection(local?tr("本地路网已就绪 · 正在连接街道详情…"):tr("正在连接真实底图…"));
}
function startMapConnectionTimer(){
  clearTimeout(liveMapTimer);
  const state=liveMapLoadState;
  liveMapTimer=setTimeout(()=>{if(liveMapLoadState===state){state.timedOut=true;updateMapConnection()}},9000);
}
function connectLiveMapTiles(){
  if(!liveMapInstance)return;
  clearTimeout(liveMapTimer);
  if(liveMapTiles){liveMapTiles.off();liveMapInstance.removeLayer(liveMapTiles)}
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',updateWhenIdle:true,keepBuffer:1});
  liveMapTiles=layer;
  const state={el:$('#street-map'),tiles:new Map(),timedOut:false};liveMapLoadState=state;
  const active=()=>liveMapLoadState===state;
  layer.on('loading',()=>{if(active()){state.timedOut=false;startMapConnectionTimer();updateMapConnection()}});
  layer.on('tileloadstart',e=>{if(active()){state.tiles.set(e.tile,'pending');updateMapConnection()}});
  layer.on('tileload',e=>{if(active()){state.tiles.set(e.tile,'loaded');updateMapConnection()}});
  layer.on('tileerror',e=>{if(active()){state.tiles.set(e.tile,'failed');updateMapConnection()}});
  layer.on('tileunload',e=>{if(active()){state.tiles.delete(e.tile);updateMapConnection()}});
  layer.on('load',()=>{if(active()){clearTimeout(liveMapTimer);updateMapConnection()}});
  updateMapConnection();startMapConnectionTimer();layer.addTo(liveMapInstance);
}
function mountLiveMap(){
  const el=$('#street-map');if(!el||S.page!=='map'||S.loading)return;
  if(!window.L){mapConnection(tr("地图组件未能加载"),true);return}
  const small=innerWidth<760,coarse=matchMedia('(pointer:coarse)').matches;
  liveMapCity=S.city;
  liveMapInstance=L.map(el,{zoomControl:false,attributionControl:true,scrollWheelZoom:false,dragging:!small&&!coarse||!!S.mapExplore,touchZoom:true,doubleClickZoom:!!S.mapExplore,keyboard:true});
  liveMapInstance.attributionControl.setPrefix(false);
  L.control.zoom({position:'bottomright',zoomInTitle:tr("放大地图"),zoomOutTitle:tr("缩小地图")}).addTo(liveMapInstance);
  liveMapCommunities=L.layerGroup().addTo(liveMapInstance);liveMapFacilities=L.layerGroup().addTo(liveMapInstance);
  updateLiveMapLayers();const view=liveMapViews[S.city];if(view)liveMapInstance.setView(view.center,view.zoom,{animate:false});else liveMapFit();
  mountLocalRoads();connectLiveMapTiles();
  liveMapInstance.on('popupopen',e=>{e.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label',tr("关闭点位信息"));const button=e.popup.getElement()?.querySelector('[data-map-dest]');if(!button)return;button.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();if(button.dataset.mapDest==='facility'){S.facility=Number(button.dataset.index);go('facility')}else{S.hood=Number(button.dataset.index);go('community')}})});
  liveMapInstance.on('moveend',()=>{if(liveMapInstance){const p=liveMapInstance.getCenter();liveMapViews[liveMapCity]={center:[p.lat,p.lng],zoom:liveMapInstance.getZoom()};updateLocalRoadLabels()}});
  const mounted=liveMapInstance;requestAnimationFrame(()=>{if(mounted===liveMapInstance)mounted.invalidateSize({pan:false})});updateMapExplore();
}
function updateLiveMapLayers(){if(!liveMapInstance||!liveMapCommunities||!liveMapFacilities)return;liveMapCommunities.clearLayers();liveMapFacilities.clearLayers();for(const n of neighborhoods()){const metric=S.layer==='temperature'?Math.min(95,(Number(temp(S.horizon))-20)*3+(1-n.pct_tree_canopy)*14):S.layer==='probability'?Math.min(95,(S.horizon===48?76:68)+n.risk*.12):n.risk;const color=metric>=75?'#b34534':metric>=50?'#cf7a3e':'#8b8857';const marker=S.layer==='heatmap'?L.circle([n.lat,n.lon],{radius:400+n.risk*9,color,weight:1,fillColor:color,fillOpacity:.22}):L.circleMarker([n.lat,n.lon],{radius:8+n.risk/25,color:'#fffaf0',weight:2,fillColor:color,fillOpacity:.88});const value=S.layer==='temperature'?`${tr("+{p0}h 示例温度 {p1}°C", {p0:(S.horizon), p1:((Number(temp(S.horizon))+(1-n.pct_tree_canopy)).toFixed(1))})}`:S.layer==='probability'?`${tr("+{p0}h 示例热浪概率 {p1}%", {p0:(S.horizon), p1:(S.horizon===48?76:68)})}`:`${tr("项目风险基线 {p0}/100", {p0:(n.risk)})}`;marker.bindPopup(`<div class="street-popup"><span class="street-popup-type">${tr("社区点位 · 项目记录")}</span><strong>${esc(n.name)}</strong><p>${value}</p><button data-map-dest="community" data-index="${n.idx}">${tr("查看社区详情")} <span>→</span></button></div>`,{maxWidth:240,minWidth:190,autoPan:true});marker.addTo(liveMapCommunities)}
  if(S.cooling)for(const c of facilities()){const marker=L.marker([c.lat,c.lon],{title:c.name,alt:c.name,icon:L.divIcon({className:'street-facility-icon',html:'<span aria-hidden="true">+</span>',iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-14]})});marker.bindPopup(`<div class="street-popup"><span class="street-popup-type">${tr("避暑点 · 项目坐标待核验")}</span><strong>${esc(c.name)}</strong><p>${tr("{p0} · 标称容量 {p1} 人", {p0:(esc(formatHours(c.hours))), p1:(c.capacity)})}</p><button data-map-dest="facility" data-index="${c.idx}">${tr("查看设施详情")} <span>→</span></button></div>`,{maxWidth:240,minWidth:190});marker.addTo(liveMapFacilities)}
}
function refreshLiveMap(){if(!liveMapInstance||S.layer==='3d'){render({preserve:true});return}const focus=document.activeElement?.dataset?{...document.activeElement.dataset}:null;$('#map-controls').innerHTML=mapControls();$('#map-key').innerHTML=mapKey();$('#map-community-list').innerHTML=mapCommunityRows();updateLiveMapLayers();icons();if(focus){[...document.querySelectorAll('#map-controls [data-action],#map-key [data-action]')].find(el=>Object.entries(focus).every(([k,v])=>el.dataset[k]===v))?.focus({preventScroll:true})}}
function updateMapExplore(){if(!liveMapInstance)return;const on=!!S.mapExplore,desktop=innerWidth>=760&&!matchMedia('(pointer:coarse)').matches;on||desktop?liveMapInstance.dragging.enable():liveMapInstance.dragging.disable();on?liveMapInstance.doubleClickZoom.enable():liveMapInstance.doubleClickZoom.disable();const button=$('[data-action="map-explore"]');if(button){button.setAttribute('aria-pressed',String(on));button.innerHTML=icon(on?'check':'hand')+`<span>${on?tr("完成探索"):tr("探索地图")}</span>`}const hint=$('#map-gesture-hint');if(hint)hint.textContent=on?tr("拖动浏览 · 双指缩放 · 点“完成探索”恢复滑动"):desktop?tr("拖动浏览街道 · 使用 + / − 缩放"):tr("页面可自然滑动 · 点击“探索地图”后拖动");icons()}
function retryLiveMap(){if(!liveMapInstance){mountLiveMap();return}connectLiveMapTiles()}
function mapSourceModal(){return `<div class="sheet-top"><h2>${tr("地图与数据")}</h2><button class="icon-button" data-action="close-modal" aria-label="${tr("关闭地图说明")}">${icon('x')}</button></div><div class="notice-card"><strong>${tr("真实街道底图")}</strong><p>${tr("在线街道详情由 OpenStreetMap 提供。应用同时内置美国人口普查局 TIGERweb 的真实路网快照，在线连接失败时自动保留道路与项目点位。")}</p></div><div class="card soft"><h3>${tr("本地路网范围")}</h3><p class="mt-sm">${tr("快照覆盖五座城市的项目点位及周边，包含主干道、次干道及部分街道，不是完整街道或导航数据。超出快照范围仍需联网，放大后不会新增本地道路细节。")}</p></div><div class="card soft"><h3>${tr("项目叠加数据")}</h3><p class="mt-sm">${tr("5 座城市，81 个社区坐标，46 个避暑点坐标，沿用项目记录。设施坐标、容量和开放时间尚未逐条外部核验。")}</p><p class="mt-sm">${tr("风险为项目加权基线；温度与热浪概率仍为示例。技术文档说明部分城市统计属性按合理分布生成，不能当作实时观测。")}</p><p class="mt-sm">${tr("当前没有真实社区边界文件，因此以点位与覆盖圆展示；3D 为可旋转、缩放的社区风险柱体，柱高表示评分，不表示实测建筑。")}</p></div><div class="photo-source-links"><a href="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer" target="_blank" rel="noopener noreferrer">${tr("U.S. Census Bureau 路网来源 ↗")}</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${tr("OpenStreetMap 来源与授权 ↗")}</a></div>`}

window.addEventListener('resize',()=>{if(liveMapInstance)updateMapExplore()});
