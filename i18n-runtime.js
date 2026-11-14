/* Generated catalogs are embedded by build.py; no translation service is used. */
window.HeatShieldI18n=(()=>{
  const catalogs=/* @catalogs */ {};
  const names=Object.freeze({zh:'简体中文',en:'English'});
  const missing=new Set(),formatters={};let language='zh';
  try{
    const query=new URLSearchParams(location.search),key=query.has('qa')?'heatshield.app.v3.qa':'heatshield.app.v3';
    const saved=JSON.parse(localStorage.getItem(key)||'{}');
    const requested=query.get('lang');
    language=['zh','en'].includes(saved?.language)?saved.language:['zh','en'].includes(requested)?requested:'zh';
  }catch{}
  function setLanguage(next){if(!Object.hasOwn(names,next))return;language=next;document.documentElement.lang=next==='en'?'en':'zh-CN'}
  function t(key,params={}){
    const catalog=catalogs[language]||{};
    if(!Object.hasOwn(catalog,key)&&/[\u3400-\u9fff]/.test(key))missing.add(key);
    const template=Object.hasOwn(catalog,key)?catalog[key]:key;
    const locale=language==='en'?'en-US':'zh-CN';
    const {plural,number}=formatters[locale]||(formatters[locale]={plural:new Intl.PluralRules(locale),number:new Intl.NumberFormat(locale)});
    return String(template).replace(/\{(\w+)(?::([^|{}]+)\|([^{}]+))?\}/g,(token,name,one,other)=>{
      if(!Object.hasOwn(params,name)){missing.add(key+' ['+name+']');return token}
      const value=params[name],formatted=typeof value==='number'?number.format(value):String(value??'');
      return one===undefined?formatted:formatted+' '+(plural.select(Number(value))==='one'?one:other);
    });
  }
  setLanguage(language);
  return Object.freeze({t,setLanguage,getLanguage:()=>language,names,missing});
})();
const tr=(key,params)=>window.HeatShieldI18n.t(key,params);
