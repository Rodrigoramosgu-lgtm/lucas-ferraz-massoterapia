const crypto=require('node:crypto');
const {token,response}=require('./_shared');
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return response(405,'Método não permitido.');
 const supplied=event.queryStringParameters?.chave||'';
 const expected=process.env.WEBHOOK_SECRET||'';
 if(!expected || supplied.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return response(403,'Acesso negado.');
 try{
  const body=JSON.parse(event.body||'{}');
  // Netlify Form outgoing webhook usually sends payload.data, id and form_name.
  const payload=body.payload||body;
  const data=payload.data||payload;
  const apelido=String(data.apelido||'Cliente').trim().slice(0,60);
  const comentario=String(data.comentario||'').trim().slice(0,1500);
  const form=String(payload.form_name||payload.formName||'depoimentos').toLowerCase();
  if(form!=='depoimentos'||!comentario)return response(400,'Envio inválido.');
  const id=String(payload.id||body.id||crypto.createHash('sha256').update(apelido+'\n'+comentario).digest('hex')).slice(0,100);
  const item={id,apelido,comentario};
  const base=process.env.URL||process.env.DEPLOY_PRIME_URL;
  if(!base || !process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.TO_EMAIL)throw Error('Configure URL, RESEND_API_KEY, FROM_EMAIL e TO_EMAIL');
  const escape=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yes=`${base}/.netlify/functions/moderar?t=${encodeURIComponent(token(item,'aprovar'))}`;
  const no=`${base}/.netlify/functions/moderar?t=${encodeURIComponent(token(item,'rejeitar'))}`;
  const html=`<h2>Novo depoimento para analisar</h2><p><b>${escape(apelido)}</b></p><p style="white-space:pre-wrap">${escape(comentario)}</p><p><a href="${yes}">APROVAR</a> &nbsp;&nbsp; <a href="${no}">REJEITAR</a></p><p>Os links abrem uma página de confirmação. Válidos por 30 dias.</p>`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.FROM_EMAIL,to:[process.env.TO_EMAIL],subject:'Novo depoimento — aprovar ou rejeitar',html})});
  if(!r.ok)throw Error('Falha no envio de e-mail: '+r.status+' '+(await r.text()).slice(0,300));
  return {statusCode:200,body:'Notificação enviada'};
 }catch(err){console.error(err);return response(500,'Erro no processamento. Verifique os logs do Netlify.');}
};
