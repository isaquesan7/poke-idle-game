// Standalone client for a consented, disposable Railway ingress probe.
// Secrets and reference IP come from the local environment, never CLI args.
import {request} from 'node:https';
import {isIP} from 'node:net';

const {INGRESS_PROBE_URL:url,INGRESS_PROBE_TOKEN:token,INGRESS_PROBE_EXPECTED_IP:expected}=process.env;
const target=new URL(url??'https://invalid.example');
if(target.protocol!=='https:'||!target.hostname.endsWith('.up.railway.app')||
   target.username||target.password||target.port||target.pathname!=='/probe'||target.search||target.hash||
   target.hostname==='kanto-idle-web-production.up.railway.app'||!isIP(expected??'')||
   !/^[a-f0-9]{64}$/.test(token??''))
  throw new Error('Configure the temporary HTTPS probe, random token and independently confirmed IP');
const common=['Authorization','Bearer '+token,'X-Kanto-Probe-Expected',expected,'Connection','close'];
const cases=[
  ['baseline',[]],
  ['forged-real-ip',['X-Real-IP','192.0.2.123']],
  ['forged-forwarded',['X-Forwarded-For','198.51.100.123','Forwarded','for=198.51.100.123']],
  ['duplicate-real-ip',['X-Real-IP','192.0.2.123','X-Real-IP','198.51.100.123']],
  ['invalid-real-ip',['X-Real-IP','invalid']],
  ['chain-real-ip',['X-Real-IP','192.0.2.123, 198.51.100.123']]
];
const names=['realIpValid','expectedValid','matchesExpected','matchesSocketPeer','forwardedHeaderPresent','edgeHeaderPresent'];
function observe(extra){
  return new Promise((resolve,reject)=>{
    const req=request(target,{method:'GET',headers:[...common,...extra],timeout:5000},res=>{
      let body='',size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>2048){req.destroy();reject(Error('Response too large'));return;}body+=chunk;});
      res.on('error',()=>reject(Error('Response error')));
      res.on('end',()=>{
        if(res.statusCode!==200)return resolve({status:res.statusCode});
        try{
          const parsed=JSON.parse(body);
          if(!Number.isSafeInteger(parsed.realIpHeaderCount)||parsed.realIpHeaderCount<0||
            !names.every(name=>typeof parsed[name]==='boolean'))throw Error();
          const safe={status:200,realIpHeaderCount:parsed.realIpHeaderCount};
          for(const name of names)safe[name]=parsed[name];
          resolve(safe);
        }catch{reject(Error('Unexpected diagnostic response'));}
      });
    });
    req.on('timeout',()=>req.destroy());
    req.on('error',()=>reject(Error('Probe network error')));
    req.end();
  });
}
let ok=true;
for(const [name,headers] of cases){
  try{
    const result=await observe(headers);
    console.log(JSON.stringify({case:name,...result}));
    if(result.status!==200||result.realIpHeaderCount!==1||!result.realIpValid||!result.matchesExpected)ok=false;
  }catch{console.log(JSON.stringify({case:name,error:'probe failed'}));ok=false;}
}
console.log(JSON.stringify({publicPathConsistent:ok,scope:'single network only; independent private-path review required'}));
if(!ok)process.exitCode=1;
