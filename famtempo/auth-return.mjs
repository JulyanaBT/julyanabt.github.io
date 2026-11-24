export function readAuthReturn(href){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1)),query=url.searchParams;
 const type=hash.get('type')||query.get('type');
 const valid=['recovery','invite','signup','magiclink'].includes(type);
 const expiry=Number(hash.get('expires_in'));
 return {type,valid,tokenHash:valid?(hash.get('token_hash')||query.get('token_hash')):null,accessToken:valid?hash.get('access_token'):null,refreshToken:valid?hash.get('refresh_token'):null,expiresIn:Number.isFinite(expiry)&&expiry>0?expiry:3600,error:hash.get('error')||query.get('error')};
}
