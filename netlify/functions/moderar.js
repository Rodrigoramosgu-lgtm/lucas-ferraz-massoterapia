const {verify,readJson,saveJson,response}=require('./_shared');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
exports.handler=async(event)=>{
 try{
  const t=event.queryStringParameters?.t||'';
  const {item,action}=verify(t);
  if(event.httpMethod==='GET'){
   return response(200,`<b>${action==='aprovar'?'Aprovar':'Rejeitar'} este depoimento?</b><br><br>${esc(item.apelido)}<blockquote>${esc(item.comentario)}</blockquote><form method="POST"><input type="hidden" name="t" value="${esc(t)}"><button style="padding:14px 25px;background:#d7ad7c;border:0;border-radius:8px;font-weight:bold">Confirmar ${action==='aprovar'?'aprovação':'rejeição'}</button></form>`);
  }
  if(event.httpMethod!=='POST')return response(405,'Método não permitido');
  const post=new URLSearchParams(event.body||'');
  const verified=verify(post.get('t'));
  if(verified.item.id!==item.id||verified.action!==action)throw Error('Token diferente');
  // Rejections are recorded; approvals first publish and then record the decision.
  if(action==='aprovar'){
   const decisions=await readJson('depoimentos-decisoes.json');
   const prior=Array.isArray(decisions.data)&&decisions.data.find(d=>d.id===item.id);
   if(prior?.acao==='rejeitar')return response(200,'Este depoimento já foi rejeitado.');
   for(let attempt=0;attempt<3;attempt++){
    const reviews=await readJson('depoimentos-aprovados.json');
    if(!Array.isArray(reviews.data))throw Error('Formato inválido de depoimentos');
    if(reviews.data.some(d=>d.id===item.id))break;
    try{await saveJson('depoimentos-aprovados.json',[...reviews.data,item],reviews.sha);break;}
    catch(err){if((err.status!==409&&err.status!==422)||attempt===2)throw err;}
   }
  }
  for(let attempt=0;attempt<3;attempt++){
   const decisions=await readJson('depoimentos-decisoes.json');
   if(!Array.isArray(decisions.data))throw Error('Formato inválido de decisões');
   const existing=decisions.data.find(d=>d.id===item.id);
   if(existing)return response(200,`Este depoimento já foi ${existing.acao==='aprovar'?'aprovado':'rejeitado'}.`);
   try{await saveJson('depoimentos-decisoes.json',[...decisions.data,{id:item.id,acao:action,data:new Date().toISOString()}],decisions.sha);break;}
   catch(err){if((err.status!==409&&err.status!==422)||attempt===2)throw err;}
  }
  return response(200,action==='aprovar'?'Depoimento aprovado! Será publicado após o deploy automático do Netlify.':'Depoimento rejeitado. Não será publicado.');
 }catch(err){console.error(err);return response(400,'Não foi possível concluir: '+esc(err.message)+'.');}
};
