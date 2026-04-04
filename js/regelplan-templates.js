// VZP Editor — Regelplan SVG Overlay v34
// Fixes v34:
//   - Leitbaken-Rotation FIX: Baken stehen immer senkrecht (rot=0), nicht in Fahrtrichtung gedreht
//   - Leitbaken links/rechts korrekt je nach Seite
//   - Schranken-Rotation FIX: pos.b-90 war korrekt, beibehalten

var RegelplanTemplates = (function() {

  var RSA_DISTANCES = {
    innerorts_50: { vorwarn: 50, sicher: 5, nachwarn: 30 },
    innerorts_30: { vorwarn: 30, sicher: 3, nachwarn: 20 },
  };

  var REGELPLÄNE = {
    'BII1': { id:'BII1', name:'B II/1', titel:'Paralleler Geh-/Radweg – Sperrung Radweg', beschreibung:'Radweg gesperrt, geringe Einengung',
              arbeitsstelle: { start: 0, ende: 1 } },
    'BII2': { id:'BII2', name:'B II/2', titel:'Geh-/Radweg – Sperrung mit Umleitung', beschreibung:'Umleitung über gem. Geh-/Radweg',
              arbeitsstelle: { start: 0, ende: 1 } },
    'BII3': { id:'BII3', name:'B II/3', titel:'Nicht benutzungspfl. Radweg – Sperrung', beschreibung:'Schrankengitter zur Fahrbahn',
              arbeitsstelle: { start: 0, ende: 1 } },
    'BII4': { id:'BII4', name:'B II/4', titel:'Gehwegsperrung – Notweg auf Fahrbahn', beschreibung:'3 Leitbaken diagonal, Notweg auf FB',
              arbeitsstelle: { start: 0, ende: 1 } },
    'BII5': { id:'BII5', name:'B II/5', titel:'Halbseitige Sperrung + LZA', beschreibung:'Zweistreifig, Verkehrsregelung durch LZA',
              arbeitsstelle: { start: 0, ende: 1 } },
  };

  var activeOverlay = null;

  // ═══ GEO ═══
  function oLL(ll,b,d){var R=6378137,r=b*Math.PI/180,D=d/R,a=ll[0]*Math.PI/180,o=ll[1]*Math.PI/180;var a2=Math.asin(Math.sin(a)*Math.cos(D)+Math.cos(a)*Math.sin(D)*Math.cos(r));var o2=o+Math.atan2(Math.sin(r)*Math.sin(D)*Math.cos(a),Math.cos(D)-Math.sin(a)*Math.sin(a2));return[a2*180/Math.PI,o2*180/Math.PI]}
  function bear(a,b){var x=a[0]*Math.PI/180,y=b[0]*Math.PI/180,dl=(b[1]-a[1])*Math.PI/180;return Math.atan2(Math.sin(dl)*Math.cos(y),Math.cos(x)*Math.sin(y)-Math.sin(x)*Math.cos(y)*Math.cos(dl))*180/Math.PI}
  function pLen(l){var t=0;for(var i=0;i<l.length-1;i++)t+=L.latLng(l[i]).distanceTo(L.latLng(l[i+1]));return t}
  function interp(l,t){var T=pLen(l),g=Math.max(0,Math.min(1,t))*T,a=0;for(var i=0;i<l.length-1;i++){var s=L.latLng(l[i]).distanceTo(L.latLng(l[i+1]));if(a+s>=g||i===l.length-2){var r=s>0?(g-a)/s:0;return{p:[l[i][0]+(l[i+1][0]-l[i][0])*r,l[i][1]+(l[i+1][1]-l[i][1])*r],b:bear(l[i],l[i+1])};}a+=s;}return{p:l[l.length-1],b:0}}
  function pt(lls,t,side,along){var r=interp(lls,Math.max(0,Math.min(1,t)));var p=r.p;if(along)p=oLL(p,r.b,along);if(side)p=oLL(p,r.b+90,side);return{p:p,b:r.b}}
  function ptM(lls,m,tL,side,along){return pt(lls,m/tL,side,along)}
  function m2px(map,m){var c=map.getCenter(),p1=map.latLngToContainerPoint(c),p2=map.latLngToContainerPoint(oLL([c.lat,c.lng],90,m));return Math.abs(p2.x-p1.x)}

  // ═══ SYMBOL SIZES ═══
  function schW(map){return Math.max(18, Math.round(m2px(map,2.0)))}
  function schH(map){return Math.max(5, Math.round(schW(map)*0.22))}
  function bakeH(map){return Math.max(20, Math.round(m2px(map,1.1)))}
  function bakeW(map){return Math.max(6, Math.round(bakeH(map)*0.30))}
  function vzS(map){return Math.max(18, Math.round(m2px(map,1.0)))}
  function querW(map,asB){return Math.max(18, Math.round(m2px(map,asB)))}

  function rotBB(w,h,d){var r=d*Math.PI/180;return{w:Math.ceil(w*Math.abs(Math.cos(r))+h*Math.abs(Math.sin(r))),h:Math.ceil(w*Math.abs(Math.sin(r))+h*Math.abs(Math.cos(r)))}}

  // ═══ MARKER FACTORIES ═══
  function mkSVG(map,grp,pos,svg,wPx,hPx,rot,z){
    var bb=rotBB(wPx,hPx,rot);
    var m=L.marker(pos.p,{draggable:true,icon:L.divIcon({
      html:'<div style="width:'+bb.w+'px;height:'+bb.h+'px;display:flex;align-items:center;justify-content:center"><img src="assets/svg/'+svg+'" style="width:'+wPx+'px;height:'+hPx+'px;transform:rotate('+rot+'deg);flex-shrink:0" draggable="false"></div>',
      iconSize:[bb.w,bb.h],iconAnchor:[bb.w/2,bb.h/2],className:''
    }),zIndexOffset:z||500});
    grp.addLayer(m);return m;
  }

  function mkVZ(map,grp,pos,nr,flip,z){
    var f={'123':'vz_123.svg','208':'vz_208.svg','259':'vz_259.svg','267':'vz_267.svg','283':'vz_283.svg','306':'vz_306.svg','308':'vz_308.svg'}[nr];
    if(!f)return null;
    var s=vzS(map);
    var m=L.marker(pos.p,{draggable:true,icon:L.divIcon({
      html:'<img src="assets/svg/'+f+'" style="width:'+s+'px;height:'+s+'px;background:#fff;border-radius:2px;padding:1px;box-shadow:0 1px 3px rgba(0,0,0,.3);transform:rotate('+(flip||0)+'deg)" draggable="false">',
      iconSize:[s,s],iconAnchor:[s/2,s/2],className:''
    }),zIndexOffset:z||700});
    grp.addLayer(m);return m;
  }

  // ═══ ABSPERRUNGSBAUSTEINE ═══

  // Schrankengitter OHNE Leuchten (Fahrbahnseitig)
  function schrankenReihe(map,grp,lls,sf,tL,offM,startM,endM,mk){
    var SEG=2.0,GAP=0.05,len=endM-startM;
    var n=Math.max(1,Math.floor(len/(SEG+GAP)));
    var used=n*SEG+(n-1)*GAP,pad=(len-used)/2;
    var w=schW(map),h=schH(map);
    for(var j=0;j<n;j++){
      var along=startM+pad+j*(SEG+GAP)+SEG/2;
      var pos=ptM(lls,along,tL,offM*sf,0);
      mk.push(mkSVG(map,grp,pos,'absperrschranke.svg',w,h,pos.b-90,510));
    }
  }

  // Schrankengitter MIT Leuchten (Gehwegseite)
  function schrankenReiheLeuchte(map,grp,lls,sf,tL,offM,startM,endM,mk){
    var SEG=2.0,GAP=0.05,len=endM-startM;
    var n=Math.max(1,Math.floor(len/(SEG+GAP)));
    var used=n*SEG+(n-1)*GAP,pad=(len-used)/2;
    var w=schW(map),h=Math.max(6,Math.round(schW(map)*0.28));
    for(var j=0;j<n;j++){
      var along=startM+pad+j*(SEG+GAP)+SEG/2;
      var pos=ptM(lls,along,tL,offM*sf,0);
      mk.push(mkSVG(map,grp,pos,'absperrschranke_leuchte.svg',w,h,pos.b-90,512));
    }
  }

  // ═══ LEITBAKEN-REIHE — v34 FIX ═══
  // Leitbaken stehen IMMER senkrecht (rot=0).
  // Seite bestimmt welches SVG: rechts → bake_rechts, links → bake_links
  function leitbakenReihe(map,grp,lls,sf,tL,offM,startM,endM,mk){
    var ABST=9.0,len=endM-startM;
    var n=Math.max(2,Math.floor(len/ABST)+1);
    var w=bakeW(map),h=bakeH(map);
    // Seite bestimmen: sf>0 = rechts, sf<0 = links
    var isLinks=(sf<0);
    for(var i=0;i<n;i++){
      var along=startM+(n>1?i*len/(n-1):len/2);
      var pos=ptM(lls,along,tL,offM*sf,0);
      // Erste und letzte Bake: mit Leuchte
      var hasLeuchte=(i===0||i===n-1);
      var svg;
      if(isLinks){
        svg=hasLeuchte?'bake_links_leuchte.svg':'bake_links.svg';
      } else {
        svg=hasLeuchte?'bake_rechts_leuchte.svg':'bake_rechts.svg';
      }
      // rot=0: Bake steht immer senkrecht (vertikal), unabhängig von Fahrtrichtung
      mk.push(mkSVG(map,grp,pos,svg,w,h,0,555));
    }
  }

  // Querabsperrung: Schranke quer + Leitbake
  function querAbsperrung(map,grp,lls,sf,asB,tN,mk){
    var qPos=pt(lls,tN,(asB/2)*sf,0);
    var qW=querW(map,asB),qH=Math.max(5,Math.round(qW*0.2));
    mk.push(mkSVG(map,grp,qPos,'absperrschranke_leuchte.svg',qW,qH,qPos.b,570));
    var bPos=pt(lls,tN,0,0);
    mk.push(mkSVG(map,grp,bPos,'bake_rechts_leuchte.svg',bakeW(map),bakeH(map),0,575));
  }

  // 3 diagonale Leitbaken (B II/4)
  function diagBaken(map,grp,lls,sf,asB,tN,dir,mk){
    var N=3,AL=1.5,AQ=0.8;
    var w=bakeW(map),h=bakeH(map);
    for(var i=0;i<N;i++){
      var pos=pt(lls,tN,i*AQ*sf,i*AL*dir);
      // Diagonale Baken: leicht geneigt (45° zur Fahrbahn)
      mk.push(mkSVG(map,grp,pos,'bake_rechts_leuchte.svg',w,h,pos.b*0.5,560));
    }
  }

  // Querabsperrung Gehweg
  function querGW(map,grp,lls,sf,asB,tN,aOff,mk){
    var pos=pt(lls,tN,(asB/2)*sf,aOff||0);
    var qW=querW(map,asB),qH=Math.max(5,Math.round(qW*0.2));
    mk.push(mkSVG(map,grp,pos,'absperrschranke_leuchte.svg',qW,qH,pos.b,565));
  }

  // Vorwarnung + Nachwarnung Z 123 (beidseitig)
  function vorUndNachwarnung(map,grp,lls,sf,tL,speed,mk){
    var dist = speed <= 30 ? RSA_DISTANCES.innerorts_30 : RSA_DISTANCES.innerorts_50;
    var vw = Math.min(dist.vorwarn, tL * 0.8);
    var nw = Math.min(dist.nachwarn, tL * 0.6);
    var v1=mkVZ(map,grp,pt(lls,0,-2*sf,-vw),'123',0);
    if(v1) mk.push(v1);
    var v2=mkVZ(map,grp,pt(lls,1,-2*sf,nw),'123',180);
    if(v2) mk.push(v2);
  }

  // ═══════════════════════════════════════════
  // B II/4 — Gehwegsperrung, Notweg auf Fahrbahn
  // ═══════════════════════════════════════════
  function placeBII4(map,grp,lls,sf,asB,gwB,tL,speed){
    var mk=[];
    vorUndNachwarnung(map,grp,lls,sf,tL,speed,mk);
    diagBaken(map,grp,lls,sf,asB,0,1,mk);
    diagBaken(map,grp,lls,sf,asB,1,-1,mk);
    querGW(map,grp,lls,sf,asB,0,4.5,mk);
    querGW(map,grp,lls,sf,asB,1,-4.5,mk);
    leitbakenReihe(map,grp,lls,sf,tL,0,0,tL,mk);
    schrankenReihe(map,grp,lls,sf,tL,0.2,0,tL,mk);
    schrankenReiheLeuchte(map,grp,lls,sf,tL,asB-0.15,0,tL,mk);
    return mk;
  }

  // ═══════════════════════════════════════════
  // B II/1 — Radwegsperrung
  // ═══════════════════════════════════════════
  function placeBII1(map,grp,lls,sf,asB,gwB,tL,speed){
    var mk=[];
    vorUndNachwarnung(map,grp,lls,sf,tL,speed,mk);
    querAbsperrung(map,grp,lls,sf,asB,0,mk);
    querAbsperrung(map,grp,lls,sf,asB,1,mk);
    leitbakenReihe(map,grp,lls,sf,tL,0,0,tL,mk);
    schrankenReihe(map,grp,lls,sf,tL,0.2,0,tL,mk);
    schrankenReiheLeuchte(map,grp,lls,sf,tL,asB-0.15,0,tL,mk);
    return mk;
  }

  // ═══ B II/2 — Radweg mit Umleitung ═══
  function placeBII2(map,grp,lls,sf,asB,gwB,tL,speed){
    var mk=placeBII1(map,grp,lls,sf,asB,gwB,tL,speed);
    var v1=mkVZ(map,grp,pt(lls,0,(asB+0.8)*sf,-3),'259',0);if(v1)mk.push(v1);
    var v2=mkVZ(map,grp,pt(lls,1,(asB+0.8)*sf,3),'259',180);if(v2)mk.push(v2);
    return mk;
  }

  // ═══ B II/3 — Nicht benutzungspfl. Radweg ═══
  function placeBII3(map,grp,lls,sf,asB,gwB,tL,speed){
    var mk=[];
    vorUndNachwarnung(map,grp,lls,sf,tL,speed,mk);
    querAbsperrung(map,grp,lls,sf,asB,0,mk);
    querAbsperrung(map,grp,lls,sf,asB,1,mk);
    schrankenReihe(map,grp,lls,sf,tL,0.2,0,tL,mk);
    schrankenReiheLeuchte(map,grp,lls,sf,tL,asB-0.15,0,tL,mk);
    return mk;
  }

  // ═══ B II/5 — Halbseitige Sperrung + LZA ═══
  function placeBII5(map,grp,lls,sf,asB,gwB,tL,speed){
    var mk=placeBII1(map,grp,lls,sf,asB,gwB,tL,speed);
    var v306=mkVZ(map,grp,pt(lls,0,-2*sf,-8),'306',0);if(v306)mk.push(v306);
    var v308=mkVZ(map,grp,pt(lls,1,-2*sf,8),'308',180);if(v308)mk.push(v308);
    return mk;
  }

  var placeFns={BII1:placeBII1,BII2:placeBII2,BII3:placeBII3,BII4:placeBII4,BII5:placeBII5};

  // ═══ MAIN ═══
  function generateOverlay(map,lls,rpId,seite,opts){
    var plan=REGELPLÄNE[rpId];if(!plan)return null;
    if(activeOverlay){activeOverlay.remove();activeOverlay=null;}
    opts=opts||{};
    var sf=seite==='links'?-1:1;
    var asB=opts.arbeitsstelleBreite||2.0;
    var gwB=opts.gehwegBreite||2.5;
    var speed=opts.speed||50;
    var tL=pLen(lls);
    var grp=L.layerGroup().addTo(map);

    // Baufeld-Schraffur — wie im Referenz-VZP: gepunkteter roter Rand + grau schraffiert
    var poly=[],steps=Math.max(10,Math.ceil(tL/2));
    for(var i=0;i<=steps;i++)poly.push(pt(lls,i/steps,0.05*sf,0).p);
    for(var j=steps;j>=0;j--)poly.push(pt(lls,j/steps,(asB-0.05)*sf,0).p);

    // Schraffur-Fläche (grau diagonal)
    grp.addLayer(L.polygon(poly,{
      fillColor:'#9e9e9e',fillOpacity:0.25,
      color:'#c62828',weight:2,
      dashArray:'4,4',
      interactive:false
    }));

    var markers=[];
    var placeFn=placeFns[rpId]||placeBII4;
    function render(){
      markers.forEach(function(m){grp.removeLayer(m)});
      markers=placeFn(map,grp,lls,sf,asB,gwB,tL,speed);
    }
    render();
    var onZoom=function(){render()};
    map.on('zoomend',onZoom);

    activeOverlay={
      overlay:grp, group:grp, plan:plan, markers:markers,
      baustellenLaenge: tL,
      remove:function(){map.removeLayer(grp);map.off('zoomend',onZoom);activeOverlay=null}
    };
    return activeOverlay;
  }

  function getMapScale(map){
    var c=map.getCenter(),p1=map.latLngToLayerPoint(c),p2=map.latLngToLayerPoint(L.latLng(c.lat,c.lng+0.00001));
    return Math.sqrt(Math.pow(p2.x-p1.x,2)+Math.pow(p2.y-p1.y,2))/0.00001/(111320*Math.cos(c.lat*Math.PI/180));
  }

  (function(){if(document.getElementById('rp34css'))return;var s=document.createElement('style');s.id='rp34css';s.textContent='.leaflet-div-icon{background:none!important;border:none!important}';document.head.appendChild(s)})();

  return{
    REGELPLÄNE:REGELPLÄNE,
    RSA_DISTANCES:RSA_DISTANCES,
    generateOverlay:generateOverlay,
    getMapScale:getMapScale,
    pLen:pLen
  };
})();
